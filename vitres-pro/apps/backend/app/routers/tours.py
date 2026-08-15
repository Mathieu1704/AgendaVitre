from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from typing import Dict, List, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.idempotency import already_processed, record_operation
from app.models.models import (
    Employee,
    Intervention,
    TourRun,
    TourRunService,
    TourRunStop,
    TourSection,
    TourService,
    TourStop,
    TourTemplate,
    get_db,
)
from app.schemas.schemas import (
    TourDraftGenerateInput,
    TourDraftScheduleInput,
    TourPublishInput,
    TourRunOut,
    TourStopResolveInput,
    TourStopSelectionInput,
    TourTemplateInput,
    TourTemplateOut,
)


router = APIRouter()
BRUSSELS = ZoneInfo("Europe/Brussels")


def _admin(user: Employee) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Action reservee aux administrateurs.")


def _template_query(db: Session):
    return db.query(TourTemplate).options(
        selectinload(TourTemplate.sections)
        .selectinload(TourSection.stops)
        .selectinload(TourStop.services),
    )


def _run_query(db: Session):
    return db.query(TourRun).options(
        selectinload(TourRun.intervention).selectinload(Intervention.employees),
        selectinload(TourRun.stops).selectinload(TourRunStop.services),
    )


def _load_run(db: Session, run_id: UUID, for_update: bool = False) -> TourRun:
    query = _run_query(db).filter(TourRun.id == run_id)
    if for_update:
        query = query.with_for_update()
    run = query.first()
    if not run:
        raise HTTPException(status_code=404, detail="Tournee introuvable.")
    return run


def _assert_run_access(run: TourRun, user: Employee, execute: bool = False) -> None:
    if user.role == "admin":
        return
    if user.role != "employee":
        raise HTTPException(status_code=403, detail="Les sous-traitants n'ont pas acces aux tournees.")
    if run.publication_status != "published":
        raise HTTPException(status_code=403, detail="Ce brouillon n'est pas publie.")
    assigned = any(employee.id == user.id for employee in run.intervention.employees)
    if not assigned:
        raise HTTPException(status_code=403, detail="Vous n'etes pas assigne a cette tournee.")
    if execute and run.intervention.status in {"done", "cancelled"}:
        raise HTTPException(status_code=409, detail="La tournee doit etre reouverte avant correction.")


def _local_datetime(day: date, value: time) -> datetime:
    return datetime.combine(day, value, tzinfo=BRUSSELS).astimezone(timezone.utc)


def _month_bounds(day: date) -> Tuple[date, date]:
    start = day.replace(day=1)
    end = day.replace(day=monthrange(day.year, day.month)[1])
    return start, end


def _workweek_buckets(month_start: date) -> List[date]:
    """Cinq semaines de travail qui couvrent le mois (heure de Bruxelles).

    Une semaine situee avant le mois n'est gardee que si elle contient au moins
    un jour ouvre du mois. Les mois ne contiennent jamais plus de cinq groupes
    lundi-vendredi; un cinquieme groupe vide est ajoute pour les mois courts.
    """
    month_end = _month_bounds(month_start)[1]
    cursor = month_start - timedelta(days=month_start.weekday())
    buckets: List[date] = []
    while cursor <= month_end:
        work_days = [cursor + timedelta(days=i) for i in range(5)]
        if any(month_start <= value <= month_end for value in work_days):
            buckets.append(cursor)
        cursor += timedelta(days=7)
    while len(buckets) < 5:
        buckets.append((buckets[-1] if buckets else month_start) + timedelta(days=7))
    return buckets[:5]


def _bucket_for(day: date, month_start: date) -> date:
    buckets = _workweek_buckets(month_start)
    monday = day - timedelta(days=day.weekday())
    if monday in buckets:
        return monday
    return min(buckets, key=lambda value: abs((value - monday).days))


def _replace_template_tree(db: Session, template: TourTemplate, payload: TourTemplateInput) -> None:
    db.query(TourStop).filter(TourStop.template_id == template.id).delete(synchronize_session=False)
    db.query(TourSection).filter(TourSection.template_id == template.id).delete(synchronize_session=False)
    db.flush()

    for section_index, section_data in enumerate(payload.sections):
        section = TourSection(
            template_id=template.id,
            label=section_data.label.strip(),
            position=section_data.position if section_data.position is not None else section_index,
        )
        db.add(section)
        db.flush()
        for stop_index, stop_data in enumerate(section_data.stops):
            stop = TourStop(
                template_id=template.id,
                section_id=section.id,
                name=stop_data.name.strip(),
                note=stop_data.note,
                payment_text=stop_data.payment_text,
                frequency_text=stop_data.frequency_text,
                estimated_minutes=stop_data.estimated_minutes,
                position=stop_data.position if stop_data.position is not None else stop_index,
                active=stop_data.active,
            )
            db.add(stop)
            db.flush()
            for service_index, service_data in enumerate(stop_data.services):
                db.add(TourService(
                    stop_id=stop.id,
                    label=service_data.label.strip(),
                    price_ht=service_data.price_ht,
                    position=service_data.position if service_data.position is not None else service_index,
                    active=service_data.active,
                ))


def _validate_template_activation(payload: TourTemplateInput) -> None:
    if payload.default_end_time <= payload.default_start_time:
        raise HTTPException(status_code=422, detail="L'heure de fin doit suivre l'heure de debut.")
    if payload.active and payload.archived:
        raise HTTPException(status_code=422, detail="Un modele archive ne peut pas rester actif.")
    if not payload.active:
        return
    services = [service for section in payload.sections for stop in section.stops if stop.active for service in stop.services if service.active]
    if not services:
        raise HTTPException(status_code=422, detail="Le modele doit contenir au moins une prestation active avant activation.")


def _snapshot_template(db: Session, template: TourTemplate, run: TourRun) -> None:
    """Copie figee du modele : rien n'est preselectionne, l'admin coche chaque
    semaine les commerces a faire (l'ancien point au crayon sur le papier)."""
    for stop in list(run.stops):
        db.delete(stop)
    db.flush()
    ordered_stops = [
        stop
        for section in sorted(template.sections, key=lambda item: item.position)
        for stop in sorted((item for item in section.stops if item.active), key=lambda item: item.position)
    ]
    for run_position, stop in enumerate(ordered_stops):
        run_stop = TourRunStop(
            run_id=run.id,
            source_stop_id=stop.id,
            section_label=stop.section.label if stop.section else None,
            name=stop.name,
            note=stop.note,
            payment_text=stop.payment_text,
            frequency_text=stop.frequency_text,
            estimated_minutes=stop.estimated_minutes,
            position=run_position,
            selected=False,
        )
        db.add(run_stop)
        db.flush()
        for service in sorted((item for item in stop.services if item.active), key=lambda item: item.position):
            db.add(TourRunService(
                run_stop_id=run_stop.id,
                source_service_id=service.id,
                label=service.label,
                price_ht=service.price_ht,
                position=service.position,
            ))
    run.intervention.price_estimated = Decimal("0")


def _ensure_one_draft(db: Session, template: TourTemplate, scheduled_date: date) -> Tuple[TourRun, bool]:
    existing = db.query(TourRun).filter(
        TourRun.template_id == template.id,
        TourRun.scheduled_date == scheduled_date,
    ).first()
    if existing:
        return existing, False
    intervention = Intervention(
        type="tournee",
        title=template.name,
        description="Tournee recurrente preparee depuis un modele.",
        start_time=_local_datetime(scheduled_date, template.default_start_time),
        end_time=_local_datetime(scheduled_date, template.default_end_time),
        status="planned",
        zone=template.zone,
        time_tbd=False,
        payment_mode="invoice",
    )
    db.add(intervention)
    db.flush()
    run = TourRun(
        template_id=template.id,
        intervention_id=intervention.id,
        scheduled_date=scheduled_date,
        publication_status="draft",
    )
    db.add(run)
    db.flush()
    _snapshot_template(db, template, run)
    return run, True


def ensure_drafts(db: Session, start_date: date, weeks: int = 8) -> int:
    weeks = max(1, min(weeks, 52))
    end_date = start_date + timedelta(weeks=weeks)
    templates = _template_query(db).filter(
        TourTemplate.active.is_(True),
        TourTemplate.archived.is_(False),
    ).with_for_update().all()
    created = 0
    for template in templates:
        cursor = start_date
        cursor += timedelta(days=(template.weekday - cursor.isoweekday()) % 7)
        while cursor < end_date:
            _, was_created = _ensure_one_draft(db, template, cursor)
            created += int(was_created)
            cursor += timedelta(days=7)
    return created


def _refresh_future_drafts(db: Session, template: TourTemplate) -> None:
    today = datetime.now(BRUSSELS).date()
    drafts = db.query(TourRun).filter(
        TourRun.template_id == template.id,
        TourRun.publication_status == "draft",
        TourRun.scheduled_date >= today,
    ).all()
    for run in drafts:
        # Si l'admin change le jour fixe, l'ancien brouillon ne doit pas
        # subsister en plus de celui qui sera regenere au nouveau jour.
        if run.scheduled_date.isoweekday() != template.weekday:
            db.delete(run.intervention)
            continue
        intervention = run.intervention
        intervention.title = template.name
        intervention.zone = template.zone
        intervention.start_time = _local_datetime(run.scheduled_date, template.default_start_time)
        intervention.end_time = _local_datetime(run.scheduled_date, template.default_end_time)
        _snapshot_template(db, template, run)


def _delete_future_drafts(db: Session, template: TourTemplate) -> None:
    today = datetime.now(BRUSSELS).date()
    drafts = db.query(TourRun).filter(
        TourRun.template_id == template.id,
        TourRun.publication_status == "draft",
        TourRun.scheduled_date >= today,
    ).all()
    for run in drafts:
        db.delete(run.intervention)


@router.get("/templates", response_model=List[TourTemplateOut])
def list_templates(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    query = _template_query(db)
    if not include_archived:
        query = query.filter(TourTemplate.archived.is_(False))
    return query.order_by(TourTemplate.zone, TourTemplate.weekday, TourTemplate.name).all()


@router.get("/templates/{template_id}", response_model=TourTemplateOut)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    template = _template_query(db).filter(TourTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Modele introuvable.")
    return template


@router.post("/templates", response_model=TourTemplateOut)
def create_template(
    payload: TourTemplateInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    _validate_template_activation(payload)
    template = TourTemplate(
        name=payload.name.strip(),
        zone=payload.zone,
        weekday=payload.weekday,
        default_start_time=payload.default_start_time,
        default_end_time=payload.default_end_time,
        active=payload.active,
        archived=payload.archived,
        source_document=payload.source_document,
    )
    db.add(template)
    db.flush()
    _replace_template_tree(db, template, payload)
    if template.active and not template.archived:
        ensure_drafts(db, datetime.now(BRUSSELS).date(), 8)
    db.commit()
    return get_template(template.id, db, current_user)


@router.put("/templates/{template_id}", response_model=TourTemplateOut)
def update_template(
    template_id: UUID,
    payload: TourTemplateInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    template = _template_query(db).filter(TourTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Modele introuvable.")
    _validate_template_activation(payload)
    template.name = payload.name.strip()
    template.zone = payload.zone
    template.weekday = payload.weekday
    template.default_start_time = payload.default_start_time
    template.default_end_time = payload.default_end_time
    template.active = payload.active
    template.archived = payload.archived
    template.source_document = payload.source_document
    _replace_template_tree(db, template, payload)
    db.flush()
    db.expire(template, ["sections", "stops"])
    template = _template_query(db).filter(TourTemplate.id == template_id).first()
    _refresh_future_drafts(db, template)
    if template.active and not template.archived:
        ensure_drafts(db, datetime.now(BRUSSELS).date(), 8)
    else:
        _delete_future_drafts(db, template)
    db.commit()
    return get_template(template.id, db, current_user)


@router.post("/templates/{template_id}/archive", response_model=TourTemplateOut)
def archive_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    template = db.query(TourTemplate).filter(TourTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Modele introuvable.")
    template.archived = True
    template.active = False
    _delete_future_drafts(db, template)
    db.commit()
    return get_template(template.id, db, current_user)


@router.post("/drafts/generate")
def generate_drafts(
    payload: TourDraftGenerateInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    start = payload.start_date or datetime.now(BRUSSELS).date()
    created = ensure_drafts(db, start, payload.weeks)
    db.commit()
    return {"created": created, "weeks": max(1, min(payload.weeks, 52))}


@router.get("/drafts", response_model=List[TourRunOut])
def list_drafts(
    start: Optional[date] = None,
    weeks: int = Query(8, ge=1, le=52),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    start_date = start or datetime.now(BRUSSELS).date()
    ensure_drafts(db, start_date, weeks)
    db.commit()
    end = start_date + timedelta(weeks=weeks)
    return _run_query(db).filter(
        TourRun.publication_status == "draft",
        TourRun.scheduled_date >= start_date,
        TourRun.scheduled_date < end,
    ).order_by(TourRun.scheduled_date).all()


@router.patch("/runs/{run_id}/stops/{stop_id}/selection", response_model=TourRunOut)
def select_draft_stop(
    run_id: UUID,
    stop_id: UUID,
    payload: TourStopSelectionInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """La coche hebdomadaire de l'admin : l'equivalent du point au crayon."""
    _admin(current_user)
    run = _load_run(db, run_id, for_update=True)
    if run.publication_status != "draft":
        raise HTTPException(status_code=409, detail="Une tournee publiee est figee.")
    stop = next((item for item in run.stops if item.id == stop_id), None)
    if not stop:
        raise HTTPException(status_code=404, detail="Commerce introuvable.")
    stop.selected = payload.selected
    stop.status = "pending"
    stop.exception_reason = None
    run.intervention.price_estimated = sum(
        (Decimal(service.price_ht) for run_stop in run.stops if run_stop.selected for service in run_stop.services),
        Decimal("0"),
    )
    db.commit()
    return _load_run(db, run_id)


@router.patch("/runs/{run_id}/schedule", response_model=TourRunOut)
def update_draft_schedule(
    run_id: UUID,
    payload: TourDraftScheduleInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    run = _load_run(db, run_id, for_update=True)
    if run.publication_status != "draft":
        raise HTTPException(status_code=409, detail="Une tournee publiee est figee.")
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=422, detail="L'heure de fin doit suivre l'heure de debut.")
    if payload.start_time.astimezone(BRUSSELS).date() != run.scheduled_date:
        raise HTTPException(status_code=422, detail="Le jour fixe de cette occurrence ne peut pas etre deplace ici.")
    run.intervention.start_time = payload.start_time
    run.intervention.end_time = payload.end_time
    run.scheduled_date = payload.start_time.astimezone(BRUSSELS).date()
    db.commit()
    return _load_run(db, run_id)


@router.post("/runs/{run_id}/publish", response_model=TourRunOut)
def publish_run(
    run_id: UUID,
    payload: TourPublishInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    run = _load_run(db, run_id, for_update=True)
    if run.publication_status == "published":
        return run
    selected_stops = [stop for stop in run.stops if stop.selected]
    if not selected_stops:
        raise HTTPException(status_code=422, detail="Selectionnez au moins un commerce avant publication.")
    if not payload.employee_ids:
        raise HTTPException(status_code=422, detail="Assignez au moins un employe avant publication.")
    employees = db.query(Employee).filter(Employee.id.in_(payload.employee_ids)).all()
    if len(employees) != len(set(payload.employee_ids)):
        raise HTTPException(status_code=422, detail="Un employe assigne est introuvable.")
    invalid = [employee.full_name or employee.email for employee in employees if employee.role != "employee" or employee.zone != run.intervention.zone]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Employes incompatibles avec la tournee: {', '.join(invalid)}")
    run.intervention.employees = employees
    run.publication_status = "published"
    run.published_at = datetime.now(timezone.utc)
    db.commit()
    return _load_run(db, run_id)


@router.get("/assigned", response_model=List[TourRunOut])
def assigned_runs(
    start: Optional[date] = None,
    end: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == "subcontractor":
        raise HTTPException(status_code=403, detail="Les sous-traitants n'ont pas acces aux tournees.")
    query = _run_query(db).filter(TourRun.publication_status == "published")
    if current_user.role != "admin":
        query = query.filter(TourRun.intervention.has(Intervention.employees.any(id=current_user.id)))
    if start:
        query = query.filter(TourRun.scheduled_date >= start)
    if end:
        query = query.filter(TourRun.scheduled_date <= end)
    return query.order_by(TourRun.scheduled_date).all()


def _touch_in_progress(run: TourRun) -> None:
    if run.intervention.status == "planned":
        run.intervention.status = "in_progress"


@router.post("/runs/{run_id}/stops/{stop_id}/resolve", response_model=TourRunOut)
def resolve_run_stop(
    run_id: UUID,
    stop_id: UUID,
    payload: TourStopResolveInput,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    run = _load_run(db, run_id, for_update=True)
    _assert_run_access(run, current_user, execute=True)
    seen = already_processed(db, payload.client_operation_id)
    if seen is not None:
        return run
    stop = next((item for item in run.stops if item.id == stop_id and item.selected), None)
    if not stop:
        raise HTTPException(status_code=404, detail="Commerce selectionne introuvable.")
    services = list(stop.services)
    not_done_ids = set(payload.not_done_service_ids)
    now = datetime.now(timezone.utc)
    if payload.status == "not_visited":
        reason = (payload.reason or "").strip()
        if not reason:
            raise HTTPException(status_code=422, detail="Une justification est obligatoire pour un commerce non visite.")
        for service in services:
            service.status = "not_done"
            service.exception_reason = reason
            service.performed_at = None
        stop.status = "not_visited"
        stop.exception_reason = reason
    elif payload.status == "partial":
        if not not_done_ids or len(not_done_ids) >= len(services):
            raise HTTPException(status_code=422, detail="Une tournee partielle doit contenir au moins une prestation faite et une non faite.")
        unknown = not_done_ids - {service.id for service in services}
        if unknown:
            raise HTTPException(status_code=422, detail="Une prestation ne fait pas partie de ce commerce.")
        for service in services:
            if service.id in not_done_ids:
                reason = (payload.service_reasons.get(str(service.id)) or payload.reason or "").strip()
                if not reason:
                    raise HTTPException(status_code=422, detail=f"Justification manquante pour {service.label}.")
                service.status = "not_done"
                service.exception_reason = reason
                service.performed_at = None
            else:
                service.status = "done"
                service.exception_reason = None
                service.performed_at = now
        stop.status = "partial"
        stop.exception_reason = (payload.reason or "").strip() or None
    else:
        for service in services:
            service.status = "done"
            service.exception_reason = None
            service.performed_at = now
        stop.status = "done"
        stop.exception_reason = None
    stop.completed_at = now
    _touch_in_progress(run)
    record_operation(db, payload.client_operation_id, current_user.id, f"POST /api/tours/runs/{run_id}/stops/{stop_id}/resolve", stop.id)
    db.commit()
    return _load_run(db, run_id)


@router.post("/runs/{run_id}/close", response_model=TourRunOut)
def close_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    run = _load_run(db, run_id, for_update=True)
    # Une reponse perdue apres le commit doit pouvoir etre rejouee par
    # l'outbox sans creer un faux echec permanent.
    _assert_run_access(run, current_user)
    if run.intervention.status == "done":
        return run
    if run.intervention.status == "cancelled":
        raise HTTPException(status_code=409, detail="La tournee annulee doit etre reouverte avant cloture.")
    pending = [stop.name for stop in run.stops if stop.selected and stop.status == "pending"]
    if pending:
        raise HTTPException(status_code=409, detail=f"Commerces encore en attente: {', '.join(pending)}")
    run.intervention.status = "done"
    run.completed_at = datetime.now(timezone.utc)
    db.commit()
    return _load_run(db, run_id)


@router.post("/runs/{run_id}/reopen", response_model=TourRunOut)
def reopen_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    run = _load_run(db, run_id, for_update=True)
    if run.publication_status != "published":
        raise HTTPException(status_code=409, detail="Un brouillon n'a pas besoin d'etre reouvert.")
    resolved = any(stop.selected and stop.status != "pending" for stop in run.stops)
    run.intervention.status = "in_progress" if resolved else "planned"
    run.completed_at = None
    db.commit()
    return _load_run(db, run_id)


@router.post("/runs/{run_id}/cancel", response_model=TourRunOut)
def cancel_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    run = _load_run(db, run_id, for_update=True)
    if run.publication_status != "published":
        raise HTTPException(status_code=409, detail="Supprimez simplement le brouillon non publie.")
    run.intervention.status = "cancelled"
    run.completed_at = None
    db.commit()
    return _load_run(db, run_id)


@router.get("/runs/{run_id}", response_model=TourRunOut)
def get_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    run = _load_run(db, run_id)
    _assert_run_access(run, current_user)
    return run


def _billing_rows(db: Session, zone: str, period_start: date) -> Tuple[List[date], Dict[str, dict]]:
    """Additionne les prestations "faites" par commerce et par semaine.

    Aucune notion de mode de paiement structure : le texte "Paiement" du
    modele est simplement recopie pour que l'admin route la ligne comme sur
    le papier (F/N/NF/F.T...).
    """
    month_start, month_end = _month_bounds(period_start.replace(day=1))
    buckets = _workweek_buckets(month_start)
    runs = _run_query(db).join(Intervention, TourRun.intervention_id == Intervention.id).filter(
        TourRun.publication_status == "published",
        TourRun.scheduled_date >= month_start,
        TourRun.scheduled_date <= month_end,
        Intervention.zone == zone,
    ).all()
    rows: Dict[str, dict] = {}
    for run in runs:
        bucket = _bucket_for(run.scheduled_date, month_start)
        for stop in run.stops:
            if not stop.selected:
                continue
            done_services = [service for service in stop.services if service.status == "done"]
            if not done_services:
                continue
            row = rows.setdefault(stop.name, {"payment_text": stop.payment_text, "amounts": {}})
            row["amounts"][bucket] = row["amounts"].get(bucket, Decimal("0")) + sum(
                (Decimal(service.price_ht) for service in done_services), Decimal("0"),
            )
    return buckets, rows


def _xlsx_bytes(buckets: List[date], rows: Dict[str, dict]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Facturation"
    headers = [
        "Commerce", "Paiement",
        *[f"S{index + 1} · {bucket.strftime('%d/%m')}-{(bucket + timedelta(days=4)).strftime('%d/%m')}" for index, bucket in enumerate(buckets)],
        "Total",
    ]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="1E3A5F")
    for row_index, name in enumerate(sorted(rows, key=str.casefold), start=2):
        row = rows[name]
        amounts = [float(row["amounts"].get(bucket, 0)) for bucket in buckets]
        sheet.append([name, row["payment_text"] or "", *amounts, None])
        first = 3
        last = 2 + len(buckets)
        sheet.cell(row=row_index, column=last + 1, value=f"=SUM({sheet.cell(row=row_index, column=first).coordinate}:{sheet.cell(row=row_index, column=last).coordinate})")
        for column in range(first, last + 2):
            sheet.cell(row=row_index, column=column).number_format = '#,##0.00 [$€-fr-BE]'
    sheet.freeze_panes = "C2"
    sheet.column_dimensions["A"].width = 32
    sheet.column_dimensions["B"].width = 16
    for column in range(3, len(headers) + 1):
        sheet.column_dimensions[sheet.cell(row=1, column=column).column_letter].width = 16
    sheet.auto_filter.ref = sheet.dimensions
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


@router.get("/billing/export")
def billing_export(
    zone: str,
    period_start: date,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    _admin(current_user)
    if zone not in {"hainaut", "ardennes"}:
        raise HTTPException(status_code=422, detail="Zone invalide.")
    buckets, rows = _billing_rows(db, zone, period_start)
    content = _xlsx_bytes(buckets, rows)
    filename = f"facturation_tournees_{zone}_{period_start.strftime('%Y_%m')}.xlsx"
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def generate_drafts_job() -> None:
    """Etend l'horizon a huit semaines, sans faire echouer le demarrage API.

    Le verrou transactionnel evite que plusieurs workers generent la meme
    occurrence simultanement. L'unicite template/date reste la seconde garde.
    """
    from sqlalchemy import text
    from app.models.models import SessionLocal

    db = SessionLocal()
    try:
        locked = db.execute(text("SELECT pg_try_advisory_xact_lock(837264021)")).scalar()
        if not locked:
            db.rollback()
            return
        ensure_drafts(db, datetime.now(BRUSSELS).date(), 8)
        db.commit()
    except Exception as error:
        db.rollback()
        # La premiere mise en route peut preceder l'application de la migration.
        # Le prochain passage reprendra automatiquement, sans bloquer l'API.
        print(f"[tour-drafts] generation differee: {error}")
    finally:
        db.close()
