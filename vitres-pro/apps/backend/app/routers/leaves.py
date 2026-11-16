"""Congés : droit annuel, demandes soumises à validation, vue d'ensemble.

Le solde se calcule à partir des absences de type VA. Une demande acceptée en
crée une, et une absence VA déclarée directement par un admin (écran Équipe)
compte de la même façon : il n'y a qu'une seule source pour le décompte.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.models.models import (
    get_db, Absence, CompanyClosure, Employee, InAppNotification,
    LeaveEntitlement, LeaveRequest, ProgressiveHours,
)
from app.routers.closures import HOLIDAY_SEED_FROM, belgian_holidays, ensure_holidays_seeded
from app.routers.planning import BRUSSELS_TZ, _get_employee_hours_for_day, _utc_bounds

router = APIRouter()

LEAVE_ABSENCE_TYPE = "VA"


# --- Schémas ---

class EntitlementIn(BaseModel):
    employee_id: UUID
    year: int = Field(ge=2020, le=2100)
    days: float = Field(ge=0, le=366)


class LeaveRequestIn(BaseModel):
    start_date: date
    end_date: date
    comment: Optional[str] = None
    # Réservé aux admins : encoder une demande au nom d'un employé.
    employee_id: Optional[UUID] = None


class DecisionIn(BaseModel):
    note: Optional[str] = None


class LeaveRequestOut(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    start_date: date
    end_date: date
    days: float
    status: str
    comment: Optional[str] = None
    decision_note: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


# --- Décompte des jours ---

def closed_dates_between(db: Session, start: date, end: date) -> set:
    """Jours de fermeture (fériés compris) : ils ne consomment pas de congé."""
    ensure_holidays_seeded(db, start, end)
    closed = set()
    closures = db.query(CompanyClosure).filter(
        CompanyClosure.start_date <= end, CompanyClosure.end_date >= start,
    ).all()
    for c in closures:
        d = max(c.start_date, start)
        while d <= min(c.end_date, end):
            closed.add(d)
            d += timedelta(days=1)
    # Les fériés ne sont enregistrés comme fermetures qu'à partir de
    # HOLIDAY_SEED_FROM : avant cette date on les ajoute ici, sinon un férié
    # passé serait décompté comme un jour de congé.
    for year in range(start.year, end.year + 1):
        for d, _name in belgian_holidays(year):
            if start <= d <= end and d < HOLIDAY_SEED_FROM:
                closed.add(d)
    return closed


def _has_schedule(emp) -> bool:
    """L'employé a-t-il un horaire encodé ? Les admins et le personnel de
    bureau n'en ont pas (0 h partout, ils ne sont pas planifiés sur les
    chantiers) mais prennent quand même des congés."""
    hours = getattr(emp, "hours_per_weekday", None) or {}
    if any(float(h or 0) > 0 for h in hours.values()):
        return True
    return float(getattr(emp, "daily_capacity", 0) or 0) > 0


def leave_days(emp, start: date, end: date, closed: set, progressive: list) -> List[date]:
    """Jours réellement décomptés entre deux dates incluses : ceux où
    l'employé devait travailler (heures prévues > 0), hors fermetures et
    fériés. Un week-end ou un jour non presté ne coûte donc rien.

    Sans horaire encodé, on compte du lundi au vendredi : sinon aucun jour ne
    serait décompté et la demande serait refusée."""
    scheduled = _has_schedule(emp)
    days = []
    d = start
    while d <= end:
        if d not in closed:
            works = (
                _get_employee_hours_for_day(emp, d, progressive) > 0
                if scheduled else d.isoweekday() <= 5
            )
            if works:
                days.append(d)
        d += timedelta(days=1)
    return days


def _absence_dates(absence) -> tuple:
    """Bornes d'une absence en jours calendaires de Bruxelles."""
    return (
        absence.start_date.astimezone(BRUSSELS_TZ).date(),
        absence.end_date.astimezone(BRUSSELS_TZ).date(),
    )


def _year_context(db: Session, year: int):
    start, end = date(year, 1, 1), date(year, 12, 31)
    closed = closed_dates_between(db, start, end)
    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= end, ProgressiveHours.end_date >= start,
    ).all()
    lo, _ = _utc_bounds(start)
    _, hi = _utc_bounds(end)
    absences = db.query(Absence).filter(
        Absence.type == LEAVE_ABSENCE_TYPE,
        Absence.start_date < hi, Absence.end_date >= lo,
    ).all()
    by_emp = defaultdict(list)
    for a in absences:
        by_emp[a.employee_id].append(a)
    return start, end, closed, progressive, by_emp


def summarize(emp, year: int, entitled: float, absences: list, closed: set,
              progressive: list, pending_days: float, today: date) -> dict:
    """Ligne de compteur d'un employé, au format de l'écran Appipay :
    valeur initiale, jours par mois, total pris, total prévu, solde."""
    year_start, year_end = date(year, 1, 1), date(year, 12, 31)
    counted = set()
    for a in absences:
        a_start, a_end = _absence_dates(a)
        counted.update(leave_days(emp, max(a_start, year_start), min(a_end, year_end), closed, progressive))

    months = [0.0] * 12
    taken = planned = 0.0
    for d in counted:
        months[d.month - 1] += 1
        if d <= today:
            taken += 1
        else:
            planned += 1

    return {
        "employee_id": str(emp.id),
        "employee_name": emp.full_name or emp.email,
        "year": year,
        "entitled": entitled,
        "months": months,
        "taken": taken,          # jours déjà passés
        "planned": planned,      # jours validés à venir
        "pending": pending_days,  # demandes en attente de validation
        "remaining": entitled - taken - planned,
    }


def _pending_days_by_employee(db: Session, year: int) -> dict:
    rows = db.query(LeaveRequest).filter(
        LeaveRequest.status == "pending",
        LeaveRequest.start_date <= date(year, 12, 31),
        LeaveRequest.end_date >= date(year, 1, 1),
    ).all()
    out = defaultdict(float)
    for r in rows:
        out[r.employee_id] += r.days
    return out


def _today() -> date:
    return datetime.now(BRUSSELS_TZ).date()


def _employees_query(db: Session):
    return db.query(Employee).options(selectinload(Employee.day_overrides))


def _require_admin(user):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")


def _out(r: LeaveRequest) -> LeaveRequestOut:
    emp = r.employee
    return LeaveRequestOut(
        id=r.id, employee_id=r.employee_id,
        employee_name=(emp.full_name or emp.email) if emp else None,
        start_date=r.start_date, end_date=r.end_date, days=r.days, status=r.status,
        comment=r.comment, decision_note=r.decision_note,
        decided_at=r.decided_at, created_at=r.created_at,
    )


def _fr(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _period(r: LeaveRequest) -> str:
    return _fr(r.start_date) if r.start_date == r.end_date else f"du {_fr(r.start_date)} au {_fr(r.end_date)}"


# --- Compteurs ---

@router.get("/balance")
def my_balance(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Solde de l'employé connecté."""
    year = year or _today().year
    _, _, closed, progressive, by_emp = _year_context(db, year)
    emp = _employees_query(db).filter(Employee.id == current_user.id).first()
    ent = db.query(LeaveEntitlement).filter(
        LeaveEntitlement.employee_id == emp.id, LeaveEntitlement.year == year,
    ).first()
    pending = _pending_days_by_employee(db, year).get(emp.id, 0.0)
    return summarize(emp, year, ent.days if ent else 0.0, by_emp.get(emp.id, []),
                     closed, progressive, pending, _today())


@router.get("/overview")
def overview(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Vue d'ensemble de tous les employés (admins), à recopier dans Appipay."""
    _require_admin(current_user)
    year = year or _today().year
    _, _, closed, progressive, by_emp = _year_context(db, year)
    entitlements = {
        e.employee_id: e.days
        for e in db.query(LeaveEntitlement).filter(LeaveEntitlement.year == year).all()
    }
    pending = _pending_days_by_employee(db, year)
    today = _today()
    employees = _employees_query(db).filter(Employee.role != "subcontractor").all()
    rows = [
        summarize(emp, year, entitlements.get(emp.id, 0.0), by_emp.get(emp.id, []),
                  closed, progressive, pending.get(emp.id, 0.0), today)
        for emp in employees
    ]
    rows.sort(key=lambda r: (r["employee_name"] or "").lower())
    return rows


@router.put("/entitlements")
def set_entitlement(
    body: EntitlementIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Encode le droit annuel d'un employé (la « valeur initiale » d'Appipay)."""
    _require_admin(current_user)
    if not db.query(Employee).filter(Employee.id == body.employee_id).first():
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    ent = db.query(LeaveEntitlement).filter(
        LeaveEntitlement.employee_id == body.employee_id, LeaveEntitlement.year == body.year,
    ).first()
    if ent:
        ent.days = body.days
    else:
        db.add(LeaveEntitlement(employee_id=body.employee_id, year=body.year, days=body.days))
    db.commit()
    return {"employee_id": str(body.employee_id), "year": body.year, "days": body.days}


# --- Demandes ---

@router.get("/requests", response_model=List[LeaveRequestOut])
def list_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Un admin voit toutes les demandes, un employé uniquement les siennes."""
    q = db.query(LeaveRequest).options(selectinload(LeaveRequest.employee))
    if current_user.role != "admin":
        q = q.filter(LeaveRequest.employee_id == current_user.id)
    if status:
        q = q.filter(LeaveRequest.status == status)
    return [_out(r) for r in q.order_by(LeaveRequest.start_date.desc()).limit(300).all()]


@router.post("/requests", response_model=LeaveRequestOut)
def create_request(
    body: LeaveRequestIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    target_id = current_user.id
    if body.employee_id and body.employee_id != current_user.id:
        _require_admin(current_user)
        target_id = body.employee_id
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="La date de fin doit suivre la date de début.")
    if (body.end_date - body.start_date).days > 92:
        raise HTTPException(status_code=400, detail="Une demande ne peut pas dépasser trois mois.")
    if current_user.role != "admin" and body.start_date < _today():
        raise HTTPException(status_code=400, detail="Un congé ne peut pas être demandé dans le passé.")

    emp = _employees_query(db).filter(Employee.id == target_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == target_id,
        LeaveRequest.status.in_(["pending", "approved"]),
        LeaveRequest.start_date <= body.end_date,
        LeaveRequest.end_date >= body.start_date,
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail="Une demande existe déjà sur ces dates.")

    closed = closed_dates_between(db, body.start_date, body.end_date)
    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.employee_id == target_id,
        ProgressiveHours.start_date <= body.end_date, ProgressiveHours.end_date >= body.start_date,
    ).all()
    days = float(len(leave_days(emp, body.start_date, body.end_date, closed, progressive)))
    if days == 0:
        raise HTTPException(
            status_code=400,
            detail="Aucun jour de travail sur cette période (week-end, férié ou fermeture).",
        )

    req = LeaveRequest(
        employee_id=target_id, start_date=body.start_date, end_date=body.end_date,
        days=days, status="pending", comment=(body.comment or "").strip() or None,
    )
    db.add(req)
    db.flush()

    name = emp.full_name or emp.email
    for admin in db.query(Employee).filter(Employee.role == "admin", Employee.id != current_user.id).all():
        db.add(InAppNotification(
            recipient_id=admin.id, type="leave_request",
            title="Demande de congé",
            message=f"{name} demande {days:g} jour(s) de congé {_period(req)}.",
            metadata_={"leave_request_id": str(req.id), "employee_id": str(target_id)},
        ))
    db.commit()
    db.refresh(req)
    return _out(req)


def _get_request(db: Session, request_id: UUID) -> LeaveRequest:
    req = db.query(LeaveRequest).options(selectinload(LeaveRequest.employee)).filter(
        LeaveRequest.id == request_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return req


def _notify_employee(db: Session, req: LeaveRequest, actor: Employee, title: str, message: str):
    if req.employee_id == actor.id:
        return
    db.add(InAppNotification(
        recipient_id=req.employee_id, type="leave_decision", title=title, message=message,
        metadata_={"leave_request_id": str(req.id)},
    ))


@router.post("/requests/{request_id}/approve", response_model=LeaveRequestOut)
def approve_request(
    request_id: UUID,
    body: DecisionIn = DecisionIn(),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Accepte la demande : crée l'absence VA qui retire l'employé du planning
    et fait baisser son solde."""
    _require_admin(current_user)
    req = _get_request(db, request_id)
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée.")

    start_utc, _ = _utc_bounds(req.start_date)
    _, end_next = _utc_bounds(req.end_date)
    absence = Absence(
        employee_id=req.employee_id, type=LEAVE_ABSENCE_TYPE,
        start_date=start_utc, end_date=end_next - timedelta(minutes=1),
    )
    db.add(absence)
    db.flush()

    req.status = "approved"
    req.absence_id = absence.id
    req.decided_by = current_user.id
    req.decided_at = datetime.now(timezone.utc)
    req.decision_note = (body.note or "").strip() or None
    _notify_employee(db, req, current_user, "Congé accepté",
                     f"Votre congé {_period(req)} est accepté ({req.days:g} jour(s)).")
    db.commit()
    db.refresh(req)
    return _out(req)


@router.post("/requests/{request_id}/refuse", response_model=LeaveRequestOut)
def refuse_request(
    request_id: UUID,
    body: DecisionIn = DecisionIn(),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _require_admin(current_user)
    req = _get_request(db, request_id)
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a déjà été traitée.")
    req.status = "refused"
    req.decided_by = current_user.id
    req.decided_at = datetime.now(timezone.utc)
    req.decision_note = (body.note or "").strip() or None
    reason = f" Motif : {req.decision_note}" if req.decision_note else ""
    _notify_employee(db, req, current_user, "Congé refusé",
                     f"Votre congé {_period(req)} est refusé.{reason}")
    db.commit()
    db.refresh(req)
    return _out(req)


@router.post("/requests/{request_id}/cancel", response_model=LeaveRequestOut)
def cancel_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """L'employé peut retirer sa demande tant qu'elle est en attente. Un admin
    peut annuler aussi un congé déjà accepté : l'absence liée est supprimée et
    les jours reviennent dans le solde."""
    req = _get_request(db, request_id)
    is_admin = current_user.role == "admin"
    if not is_admin and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    if req.status == "pending":
        pass
    elif req.status == "approved" and is_admin:
        if req.absence_id:
            absence = db.query(Absence).filter(Absence.id == req.absence_id).first()
            if absence:
                db.delete(absence)
        _notify_employee(db, req, current_user, "Congé annulé",
                         f"Votre congé {_period(req)} a été annulé.")
    else:
        raise HTTPException(status_code=400, detail="Cette demande ne peut plus être annulée.")
    req.status = "cancelled"
    req.absence_id = None
    db.commit()
    db.refresh(req)
    return _out(req)
