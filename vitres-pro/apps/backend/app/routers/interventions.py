# apps/backend/app/routers/interventions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import uuid

from app.models.models import get_db, Intervention, Client
from app.schemas.schemas import InterventionCreate, InterventionOut
from app.core.deps import get_current_user

router = APIRouter()

# ✅ GET /api/interventions/  (LISTE)
@router.get("/", response_model=List[InterventionOut])
def read_interventions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(Intervention).offset(skip).limit(limit).all()


# ✅ GET /api/interventions/{intervention_id} (DETAIL)
@router.get("/{intervention_id}", response_model=InterventionOut)
def read_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    intervention = (
        db.query(Intervention)
        .filter(Intervention.id == intervention_id)
        .first()
    )
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return intervention


# ✅ POST /api/interventions/ (CREATE)
@router.post("/", response_model=InterventionOut)
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == intervention.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    new_intervention = Intervention(**intervention.model_dump())

    # sub Supabase = string UUID → on le convertit proprement
    if not new_intervention.employee_id:
        new_intervention.employee_id = uuid.UUID(current_user["sub"])

    db.add(new_intervention)
    db.commit()
    db.refresh(new_intervention)
    return new_intervention


# ✅ PATCH /api/interventions/{intervention_id} (UPDATE)
@router.patch("/{intervention_id}", response_model=InterventionOut)
def update_intervention(
    intervention_id: UUID,
    intervention_update: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db_intervention = (
        db.query(Intervention)
        .filter(Intervention.id == intervention_id)
        .first()
    )
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    for key, value in intervention_update.items():
        setattr(db_intervention, key, value)

    db.commit()
    db.refresh(db_intervention)
    return db_intervention
