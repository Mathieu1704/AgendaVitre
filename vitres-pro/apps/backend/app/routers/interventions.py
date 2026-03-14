from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID
import uuid

from app.models.models import (
    get_db, Intervention, Client, Employee, InterventionItem,
    intervention_employees, RawCalendarEvent, AuditLog, InAppNotification
)
from app.schemas.schemas import InterventionCreate, InterventionOut
from app.core.deps import get_current_user

router = APIRouter()

def is_admin(user_id: str, db: Session) -> bool:
    emp = db.query(Employee).filter(Employee.id == user_id).first()
    return emp.role == 'admin' if emp else False

def _load_intervention(intervention_id: UUID, db: Session) -> Intervention:
    return db.query(Intervention).options(
        selectinload(Intervention.client),
        selectinload(Intervention.employees),
        selectinload(Intervention.items),
    ).filter(Intervention.id == intervention_id).first()

def _add_audit(db: Session, action_type: str, employee_id, intervention_id=None, description="", metadata=None):
    log = AuditLog(
        action_type=action_type,
        employee_id=employee_id,
        intervention_id=intervention_id,
        description=description,
        metadata_=metadata or {},
    )
    db.add(log)


@router.get("", response_model=List[InterventionOut])
def read_interventions(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    query = db.query(Intervention).options(
        selectinload(Intervention.client),
        selectinload(Intervention.employees),
        selectinload(Intervention.items),
    )
    if current_user.role != 'admin':
        query = query.filter(
            Intervention.zone == current_user.zone,
            Intervention.employees.any(id=current_user.id),
        )
    return query.order_by(Intervention.start_time.desc()).all()


@router.get("/{intervention_id}", response_model=InterventionOut)
def read_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    intervention = _load_intervention(intervention_id, db)
    if not intervention:
        raise HTTPException(status_code=404, detail="Non trouvé")
    return intervention


@router.post("", response_model=InterventionOut)
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if intervention.client_id:
        client = db.query(Client).filter(Client.id == intervention.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")

    data = intervention.model_dump(exclude={"employee_ids", "items"})
    if current_user.role != 'admin':
        data["zone"] = current_user.zone
    new_intervention = Intervention(**data)

    if intervention.employee_ids:
        employees = db.query(Employee).filter(Employee.id.in_(intervention.employee_ids)).all()
        new_intervention.employees = employees

    total_price = 0
    if intervention.items:
        for item_data in intervention.items:
            new_item = InterventionItem(
                label=item_data.label,
                price=item_data.price,
                client_service_id=item_data.client_service_id,
            )
            new_intervention.items.append(new_item)
            total_price += item_data.price

    if not new_intervention.price_estimated or new_intervention.price_estimated == 0:
        new_intervention.price_estimated = total_price

    db.add(new_intervention)
    db.flush()  # pour avoir l'id avant le commit

    _add_audit(
        db, "created", current_user.id, new_intervention.id,
        f"Créée: {new_intervention.title}",
        {"title": new_intervention.title},
    )

    db.commit()
    db.refresh(new_intervention)
    return new_intervention


@router.patch("/{intervention_id}", response_model=InterventionOut)
def update_intervention(
    intervention_id: UUID,
    intervention_update: dict,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    old_status = db_intervention.status

    for key, value in intervention_update.items():
        if key == "employee_ids":
            employees = db.query(Employee).filter(Employee.id.in_(value)).all()
            db_intervention.employees = employees
        elif key == "items":
            db.query(InterventionItem).filter(InterventionItem.intervention_id == intervention_id).delete()
            for item_data in value:
                db.add(InterventionItem(
                    intervention_id=intervention_id,
                    label=item_data["label"],
                    price=item_data["price"],
                    client_service_id=item_data.get("client_service_id"),
                ))
        elif hasattr(db_intervention, key):
            setattr(db_intervention, key, value)

    # Audit log
    new_status = intervention_update.get("status")
    if new_status and new_status != old_status:
        _add_audit(
            db, "status_change", current_user.id, intervention_id,
            f"Statut: {old_status} → {new_status}",
            {"old_status": old_status, "new_status": new_status},
        )
    else:
        changed = [k for k in intervention_update if k not in ("real_start_time", "real_end_time")]
        if changed:
            _add_audit(
                db, "modified", current_user.id, intervention_id,
                f"Modifiée: {', '.join(changed)}",
                {"fields": changed},
            )

    db.commit()
    db.refresh(db_intervention)
    return db_intervention


@router.delete("/{intervention_id}")
def delete_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Seul un admin peut supprimer.")

    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    title = db_intervention.title
    db.query(RawCalendarEvent).filter(
        RawCalendarEvent.linked_intervention_id == intervention_id
    ).update({"linked_intervention_id": None, "status": "pending"})

    _add_audit(
        db, "deleted", current_user.id, None,
        f"Supprimée: {title}",
        {"title": title, "intervention_id": str(intervention_id)},
    )

    db.delete(db_intervention)
    db.commit()
    return {"message": "Intervention supprimée"}


@router.post("/{intervention_id}/no-reprise")
def no_reprise(
    intervention_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Marque l'intervention comme terminée sans reprise de RDV + notifie les admins."""
    from datetime import datetime, timezone

    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    note = payload.get("note", "").strip()
    now = datetime.now(timezone.utc)

    intervention.status = "done"
    intervention.reprise_taken = False
    intervention.reprise_note = note if note else None

    emp_name = current_user.full_name or current_user.email or "Un employé"
    description = f"{emp_name} n'a pas repris de RDV pour '{intervention.title}'"
    if note:
        description += f" — {note}"

    _add_audit(
        db, "no_reprise", current_user.id, intervention_id,
        description,
        {"note": note, "intervention_title": intervention.title},
    )

    # Notifier tous les admins
    admins = db.query(Employee).filter(Employee.role == "admin").all()
    for admin in admins:
        notif = InAppNotification(
            recipient_id=admin.id,
            type="no_reprise",
            title="RDV non repris",
            message=description,
            metadata_={
                "intervention_id": str(intervention_id),
                "employee_id": str(current_user.id),
                "intervention_title": intervention.title,
            },
        )
        db.add(notif)

    db.commit()
    return {"message": "ok"}
