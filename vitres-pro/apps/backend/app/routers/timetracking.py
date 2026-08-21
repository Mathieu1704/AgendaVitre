from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from app.models.models import (
    get_db,
    Employee,
    EmployeeTimeEntry,
    OvertimeSettlement,
    CashSettlement,
    Absence,
    ProgressiveHours,
    Intervention,
    InAppNotification,
)
from app.core.deps import get_current_user
from app.routers.planning import BRUSSELS_TZ, _utc_bounds, _get_employee_hours_for_day
from app.schemas.schemas import (
    TimeEntryOut,
    DailyEntryOut,
    WeeklySummaryEmployeeOut,
    WeeklySummaryOut,
    CashSettlementIn,
    CashSettlementOut,
    OvertimeSettlementIn,
    OvertimeSettlementOut,
    TimeEntryCorrectionIn,
)

router = APIRouter()

WEEKLY_FLOOR_HOURS = 37.0


def _require_admin(current_user: Employee):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")


def _today_brussels() -> date:
    return datetime.now(BRUSSELS_TZ).date()


def _week_bounds(d: date) -> tuple[date, date]:
    """Lundi et dimanche de la semaine ISO contenant d."""
    monday = d - timedelta(days=d.isoweekday() - 1)
    sunday = monday + timedelta(days=6)
    return monday, sunday


def weekly_delta_hours(weekly_actual: float, floor: float = WEEKLY_FLOOR_HOURS) -> float:
    """Solde hebdomadaire heures sup (+) / en moins (-). Plancher de 37h uniforme
    pour tous les employés : personne n'est jamais compté en dessous de ce plancher,
    et tout ce qui dépasse est intégralement compté en heures sup."""
    return weekly_actual - floor


def _entry_status(entry: Optional[EmployeeTimeEntry]) -> str:
    if not entry or not entry.clock_in_at:
        return "not_started"
    if not entry.clock_out_at:
        return "in_progress"
    return "done"


def _worked_hours(entry: EmployeeTimeEntry) -> Optional[float]:
    if entry.clock_in_at and entry.clock_out_at:
        return round((entry.clock_out_at - entry.clock_in_at).total_seconds() / 3600, 2)
    return None


def _notify_admins(db: Session, notif_type: str, title: str, message: str, metadata: dict):
    admins = db.query(Employee).filter(Employee.role == "admin").all()
    for admin in admins:
        db.add(InAppNotification(
            recipient_id=admin.id,
            type=notif_type,
            title=title,
            message=message,
            metadata_=metadata,
        ))


def _employee_actual_hours_for_day(
    emp: Employee, d: date, entries_by_day: dict, absences: list, progressive: list
) -> float:
    entry = entries_by_day.get(d)
    if entry and entry.clock_in_at and entry.clock_out_at:
        return (entry.clock_out_at - entry.clock_in_at).total_seconds() / 3600
    day_start, day_end = _utc_bounds(d)
    for ab in absences:
        if ab.employee_id == emp.id and ab.start_date < day_end and ab.end_date >= day_start:
            return _get_employee_hours_for_day(emp, d, progressive)
    return 0.0


def _weekly_actual_hours(db: Session, emp: Employee, week_start: date, week_end: date) -> float:
    entries = (
        db.query(EmployeeTimeEntry)
        .filter(
            EmployeeTimeEntry.employee_id == emp.id,
            EmployeeTimeEntry.work_date >= week_start,
            EmployeeTimeEntry.work_date <= week_end,
        )
        .all()
    )
    entries_by_day = {e.work_date: e for e in entries}

    day_start_utc, _ = _utc_bounds(week_start)
    _, day_end_utc = _utc_bounds(week_end)
    absences = db.query(Absence).filter(
        Absence.start_date < day_end_utc,
        Absence.end_date >= day_start_utc,
        Absence.employee_id == emp.id,
    ).all()
    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= week_end,
        ProgressiveHours.end_date >= week_start,
    ).all()

    total = 0.0
    d = week_start
    while d <= week_end:
        total += _employee_actual_hours_for_day(emp, d, entries_by_day, absences, progressive)
        d += timedelta(days=1)
    return total


def _overtime_balance(
    db: Session, emp: Employee, include_current_week: bool = False
) -> tuple[float, date, date]:
    """Solde d'heures sup/en moins depuis le dernier règlement (ou depuis le
    premier pointage si jamais réglé), calculé à la volée.

    Par défaut, on ne juge que les semaines complètes : la semaine en cours
    n'est comptée qu'une fois terminée (dimanche passé), sinon un employé qui
    n'a pas encore fini sa semaine afficherait un solde négatif artificiel
    (0h réelles jusqu'ici - 37h de plancher) avant même d'avoir eu la chance
    de pointer ses heures.

    `include_current_week=True` force l'inclusion de la semaine en cours
    (jusqu'à aujourd'hui) — calcul manuel/anticipé demandé par l'admin, par
    ex. le vendredi après-midi quand la semaine de travail est déjà terminée
    sans attendre le dimanche calendaire."""
    today = _today_brussels()
    current_week_start, current_week_end = _week_bounds(today)

    last_settlement = (
        db.query(OvertimeSettlement)
        .filter(OvertimeSettlement.employee_id == emp.id)
        .order_by(OvertimeSettlement.period_end.desc())
        .first()
    )
    # Un règlement partiel (ex. 1 jour de congé pris sur un solde plus large)
    # laisse un reliquat non consommé : on repart de là plutôt que de zéro,
    # sinon le reste du solde disparaîtrait silencieusement.
    carried_forward = last_settlement.carried_forward_hours if last_settlement else 0.0
    if last_settlement:
        period_start = last_settlement.period_end + timedelta(days=1)
    else:
        first_entry = (
            db.query(EmployeeTimeEntry)
            .filter(EmployeeTimeEntry.employee_id == emp.id)
            .order_by(EmployeeTimeEntry.work_date.asc())
            .first()
        )
        period_start = first_entry.work_date if first_entry else current_week_start
        period_start, _ = _week_bounds(period_start)

    last_counted_week_end = (
        current_week_end if include_current_week else current_week_start - timedelta(days=1)
    )

    if period_start > last_counted_week_end:
        return round(carried_forward, 2), period_start, last_counted_week_end

    total_delta = carried_forward
    week_cursor = period_start
    while week_cursor <= last_counted_week_end:
        w_start, w_end = _week_bounds(week_cursor)
        w_end = min(w_end, last_counted_week_end)
        actual = _weekly_actual_hours(db, emp, w_start, w_end)
        total_delta += weekly_delta_hours(actual)
        week_cursor = w_end + timedelta(days=1)

    return round(total_delta, 2), period_start, last_counted_week_end


def _weekly_cash_amount(db: Session, emp: Employee, week_start: date, week_end: date) -> float:
    day_start_utc, _ = _utc_bounds(week_start)
    _, day_end_utc = _utc_bounds(week_end)
    interventions = (
        db.query(Intervention)
        .options(selectinload(Intervention.employees))
        .filter(
            Intervention.start_time >= day_start_utc,
            Intervention.start_time < day_end_utc,
            Intervention.status == "done",
            Intervention.payment_mode.in_(["cash", "invoice_cash"]),
            ~Intervention.tour_run.has(),
        )
        .all()
    )
    total = 0.0
    for iv in interventions:
        if iv.closed_by_employee_id is not None:
            # Un seul employe encaisse reellement, meme si plusieurs sont
            # assignes au RDV : sans ca, un RDV a 2 employes doublait le
            # montant compte (une fois par employe assigne).
            if iv.closed_by_employee_id != emp.id:
                continue
        elif not any(e.id == emp.id for e in iv.employees):
            # Ancienne intervention cloturee avant l'ajout de ce champ : on
            # retombe sur l'ancien comportement (compte pour chaque assigne)
            # plutot que de perdre silencieusement ce cash historique.
            continue
        if iv.deferred_cash_amount is not None:
            # Paiement reporte (client absent) : cette intervention ne compte
            # jamais dans le total cash de SA semaine, meme une fois reglee —
            # l'argent est compte plus tard, sur l'intervention qui l'encaisse
            # reellement (son propre amount_cash/price_estimated normal).
            continue
        if iv.payment_mode == "invoice_cash":
            # Part cash uniquement. NULL (ancienne ligne, ou split reinitialise
            # par une cloture qui a change le total) : on retombe sur le prix
            # total pour ne pas sous-declarer silencieusement le cash du.
            total += float(iv.amount_cash) if iv.amount_cash is not None else float(iv.price_estimated or 0)
        else:  # "cash"
            total += float(iv.price_estimated or 0)
    return round(total, 2)


def _daily_entries(
    db: Session, emp: Employee, week_start: date, week_end: date
) -> List[DailyEntryOut]:
    entries = (
        db.query(EmployeeTimeEntry)
        .filter(
            EmployeeTimeEntry.employee_id == emp.id,
            EmployeeTimeEntry.work_date >= week_start,
            EmployeeTimeEntry.work_date <= week_end,
        )
        .all()
    )
    entries_by_day = {e.work_date: e for e in entries}

    day_start_utc, _ = _utc_bounds(week_start)
    _, day_end_utc = _utc_bounds(week_end)
    absences = db.query(Absence).filter(
        Absence.start_date < day_end_utc,
        Absence.end_date >= day_start_utc,
        Absence.employee_id == emp.id,
    ).all()
    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= week_end,
        ProgressiveHours.end_date >= week_start,
    ).all()

    result = []
    d = week_start
    while d <= week_end:
        entry = entries_by_day.get(d)
        day_start, day_end = _utc_bounds(d)
        is_absence = any(
            ab.employee_id == emp.id and ab.start_date < day_end and ab.end_date >= day_start
            for ab in absences
        )
        actual = _employee_actual_hours_for_day(emp, d, entries_by_day, absences, progressive)
        result.append(DailyEntryOut(
            date=d,
            clock_in_at=entry.clock_in_at if entry else None,
            clock_out_at=entry.clock_out_at if entry else None,
            is_absence=is_absence,
            actual_hours=round(actual, 2),
            edited_by_admin=bool(entry.edited_by_admin) if entry else False,
        ))
        d += timedelta(days=1)
    return result


# --- ROUTES EMPLOYÉ ---

@router.get("/today", response_model=TimeEntryOut)
def get_today_entry(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    today = _today_brussels()
    entry = (
        db.query(EmployeeTimeEntry)
        .filter(EmployeeTimeEntry.employee_id == current_user.id, EmployeeTimeEntry.work_date == today)
        .first()
    )
    return TimeEntryOut(
        work_date=today,
        clock_in_at=entry.clock_in_at if entry else None,
        clock_out_at=entry.clock_out_at if entry else None,
        status=_entry_status(entry),
        worked_hours=_worked_hours(entry) if entry else None,
    )


@router.get("/day/{work_date}", response_model=TimeEntryOut)
def get_day_entry(
    work_date: date,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Comme /today, mais pour une date arbitraire — utilisé pour afficher le
    pointage d'un jour passé dans l'app employé (le jour courant continue de
    passer par /today, qui reste la source pour le pointage en cours)."""
    if work_date > _today_brussels():
        raise HTTPException(status_code=400, detail="Date future")
    entry = (
        db.query(EmployeeTimeEntry)
        .filter(EmployeeTimeEntry.employee_id == current_user.id, EmployeeTimeEntry.work_date == work_date)
        .first()
    )
    return TimeEntryOut(
        work_date=work_date,
        clock_in_at=entry.clock_in_at if entry else None,
        clock_out_at=entry.clock_out_at if entry else None,
        status=_entry_status(entry),
        worked_hours=_worked_hours(entry) if entry else None,
    )


@router.post("/clock-in", response_model=TimeEntryOut)
def clock_in(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Réservé aux employés et sous-traitants")

    today = _today_brussels()
    entry = (
        db.query(EmployeeTimeEntry)
        .filter(EmployeeTimeEntry.employee_id == current_user.id, EmployeeTimeEntry.work_date == today)
        .first()
    )
    if entry and entry.clock_in_at:
        raise HTTPException(status_code=409, detail="Journée déjà commencée")

    now = datetime.now(timezone.utc)
    if not entry:
        entry = EmployeeTimeEntry(employee_id=current_user.id, work_date=today, clock_in_at=now)
        db.add(entry)
    else:
        entry.clock_in_at = now

    emp_name = current_user.full_name or current_user.email
    heure = now.astimezone(BRUSSELS_TZ).strftime("%H:%M")
    _notify_admins(
        db, "clock_in", "Début de journée",
        f"{emp_name} a commencé sa journée à {heure}",
        {"employee_id": str(current_user.id), "work_date": today.isoformat()},
    )

    db.commit()
    db.refresh(entry)
    return TimeEntryOut(
        work_date=today, clock_in_at=entry.clock_in_at, clock_out_at=entry.clock_out_at,
        status=_entry_status(entry), worked_hours=_worked_hours(entry),
    )


@router.post("/clock-out", response_model=TimeEntryOut)
def clock_out(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Réservé aux employés et sous-traitants")

    today = _today_brussels()
    entry = (
        db.query(EmployeeTimeEntry)
        .filter(EmployeeTimeEntry.employee_id == current_user.id, EmployeeTimeEntry.work_date == today)
        .first()
    )
    if not entry or not entry.clock_in_at:
        raise HTTPException(status_code=400, detail="Journée non commencée")
    if entry.clock_out_at:
        raise HTTPException(status_code=409, detail="Journée déjà terminée")

    now = datetime.now(timezone.utc)
    entry.clock_out_at = now

    emp_name = current_user.full_name or current_user.email
    heure = now.astimezone(BRUSSELS_TZ).strftime("%H:%M")
    duree = _worked_hours(entry)
    duree_str = f"{int(duree)}h{round((duree % 1) * 60):02d}" if duree is not None else ""
    _notify_admins(
        db, "clock_out", "Fin de journée",
        f"{emp_name} a terminé sa journée à {heure} ({duree_str} travaillées)",
        {"employee_id": str(current_user.id), "work_date": today.isoformat()},
    )

    db.commit()
    db.refresh(entry)
    return TimeEntryOut(
        work_date=today, clock_in_at=entry.clock_in_at, clock_out_at=entry.clock_out_at,
        status=_entry_status(entry), worked_hours=_worked_hours(entry),
    )


# --- ROUTES ADMIN ---

@router.patch("/entries", response_model=DailyEntryOut)
def correct_entry(
    payload: TimeEntryCorrectionIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _require_admin(current_user)

    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    entry = (
        db.query(EmployeeTimeEntry)
        .filter(EmployeeTimeEntry.employee_id == payload.employee_id, EmployeeTimeEntry.work_date == payload.work_date)
        .first()
    )
    if not entry:
        entry = EmployeeTimeEntry(employee_id=payload.employee_id, work_date=payload.work_date)
        db.add(entry)

    entry.clock_in_at = payload.clock_in_at
    entry.clock_out_at = payload.clock_out_at
    entry.edited_by_admin = True

    db.commit()
    db.refresh(entry)

    day_start, day_end = _utc_bounds(payload.work_date)
    is_absence = db.query(Absence).filter(
        Absence.employee_id == payload.employee_id,
        Absence.start_date < day_end,
        Absence.end_date >= day_start,
    ).first() is not None

    return DailyEntryOut(
        date=payload.work_date,
        clock_in_at=entry.clock_in_at,
        clock_out_at=entry.clock_out_at,
        is_absence=is_absence,
        actual_hours=round((entry.clock_out_at - entry.clock_in_at).total_seconds() / 3600, 2)
        if entry.clock_in_at and entry.clock_out_at else 0.0,
        edited_by_admin=True,
    )


@router.get("/weekly-summary", response_model=WeeklySummaryOut)
def weekly_summary(
    week_start: Optional[str] = None,
    include_current_week: bool = False,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _require_admin(current_user)

    if week_start:
        ref_date = datetime.strptime(week_start, "%Y-%m-%d").date()
    else:
        ref_date = _today_brussels()
    w_start, w_end = _week_bounds(ref_date)

    employees = db.query(Employee).filter(Employee.role.in_(["employee", "subcontractor"])).all()

    result_employees = []
    for emp in employees:
        cash_settlement = (
            db.query(CashSettlement)
            .filter(CashSettlement.employee_id == emp.id, CashSettlement.week_start == w_start)
            .first()
        )
        if cash_settlement:
            cash_amount = float(cash_settlement.amount)
            cash_settled = True
        else:
            cash_amount = _weekly_cash_amount(db, emp, w_start, w_end)
            cash_settled = False

        overtime_balance, period_start, period_end = _overtime_balance(
            db, emp, include_current_week=include_current_week
        )

        result_employees.append(WeeklySummaryEmployeeOut(
            employee_id=emp.id,
            full_name=emp.full_name,
            role=emp.role,
            cash_amount=cash_amount,
            cash_settled=cash_settled,
            overtime_balance_hours=overtime_balance,
            overtime_period_start=period_start,
            overtime_period_end=period_end,
            daily_entries=_daily_entries(db, emp, w_start, w_end),
        ))

    return WeeklySummaryOut(week_start=w_start, week_end=w_end, employees=result_employees)


@router.post("/cash-settlements", response_model=CashSettlementOut)
def confirm_cash_settlement(
    payload: CashSettlementIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _require_admin(current_user)

    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    existing = (
        db.query(CashSettlement)
        .filter(CashSettlement.employee_id == payload.employee_id, CashSettlement.week_start == payload.week_start)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Déjà réglé pour cette semaine")

    w_start, w_end = _week_bounds(payload.week_start)
    amount = _weekly_cash_amount(db, emp, w_start, w_end)

    settlement = CashSettlement(
        employee_id=payload.employee_id,
        amount=amount,
        week_start=w_start,
        confirmed_by=current_user.id,
    )
    db.add(settlement)
    db.commit()
    db.refresh(settlement)
    return settlement


@router.post("/overtime-settlements", response_model=OvertimeSettlementOut)
def confirm_overtime_settlement(
    payload: OvertimeSettlementIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _require_admin(current_user)

    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    balance, period_start, period_end = _overtime_balance(
        db, emp, include_current_week=payload.include_current_week
    )

    if payload.hours is not None:
        if payload.hours <= 0:
            raise HTTPException(status_code=400, detail="Le nombre d'heures doit être positif.")
        if balance >= 0 and payload.hours > balance:
            raise HTTPException(
                status_code=400,
                detail=f"Le solde actuel ({balance}h) est inférieur au nombre d'heures à solder.",
            )
        delta_hours = payload.hours
        carried_forward_hours = round(balance - payload.hours, 2)
    else:
        # Solde total (comportement historique) : rien ne reste en reliquat.
        delta_hours = balance
        carried_forward_hours = 0.0

    settlement = OvertimeSettlement(
        employee_id=payload.employee_id,
        delta_hours=delta_hours,
        carried_forward_hours=carried_forward_hours,
        period_start=period_start,
        period_end=period_end,
        confirmed_by=current_user.id,
    )
    db.add(settlement)
    db.commit()
    db.refresh(settlement)
    return settlement
