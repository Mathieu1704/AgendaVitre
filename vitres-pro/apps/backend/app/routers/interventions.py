from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID
import uuid

from app.models.models import get_db, Intervention, Client, Employee, InterventionItem, intervention_employees, RawCalendarEvent
from app.schemas.schemas import InterventionCreate, InterventionOut
from app.core.deps import get_current_user

router = APIRouter()

# Fonction helper pour vérifier si l'user est admin
def is_admin(user_id: str, db: Session) -> bool:
    emp = db.query(Employee).filter(Employee.id == user_id).first()
    return emp.role == 'admin' if emp else False

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

    # 1. FILTRAGE PAR RÔLE
    if current_user.role == 'admin':
        pass
    else:
        query = query.filter(Intervention.employees.any(id=current_user.id))

    # 2. FILTRAGE PAR DATE (Optionnel)
    if start and end:
        pass

    # On trie par date décroissante (le plus récent en haut)
    return query.order_by(Intervention.start_time.desc()).all()

@router.get("/{intervention_id}", response_model=InterventionOut)
def read_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    intervention = db.query(Intervention).options(
        selectinload(Intervention.client),
        selectinload(Intervention.employees),
        selectinload(Intervention.items),
    ).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Non trouvé")
    return intervention

@router.post("", response_model=InterventionOut)
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    # 1. Vérif Client (optionnel pour tournee/note)
    if intervention.client_id:
        client = db.query(Client).filter(Client.id == intervention.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")

    # 2. Création de l'Intervention
    data = intervention.model_dump(exclude={"employee_ids", "items"})
    new_intervention = Intervention(**data)
    
    # 3. Assignations Employés
    if intervention.employee_ids:
        employees = db.query(Employee).filter(Employee.id.in_(intervention.employee_ids)).all()
        new_intervention.employees = employees

    # 4. Items (Lignes de prix)
    total_price = 0
    if intervention.items:
        for item_data in intervention.items:
            new_item = InterventionItem(
                label=item_data.label,
                price=item_data.price
            )
            new_intervention.items.append(new_item)
            total_price += item_data.price
    
    if not new_intervention.price_estimated or new_intervention.price_estimated == 0:
        new_intervention.price_estimated = total_price

    db.add(new_intervention)
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
    # Sécurité : Vérifier si Admin (conseillé)
    # if current_user.role != 'admin': raise HTTPException(403, "Interdit")

    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    for key, value in intervention_update.items():
        if key == "employee_ids":
             employees = db.query(Employee).filter(Employee.id.in_(value)).all()
             db_intervention.employees = employees
        elif key == "items":
            # ⚠️ GESTION SPÉCIALE POUR LES ITEMS (Prestations)
            # 1. On supprime les anciens items
            db.query(InterventionItem).filter(InterventionItem.intervention_id == intervention_id).delete()
            # 2. On recrée les nouveaux
            for item_data in value:
                new_item = InterventionItem(
                    intervention_id=intervention_id,
                    label=item_data["label"],
                    price=item_data["price"]
                )
                db.add(new_item)
        elif hasattr(db_intervention, key):
            setattr(db_intervention, key, value)

    db.commit()
    db.refresh(db_intervention)
    return db_intervention

@router.delete("/{intervention_id}")
def delete_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    # Sécurité : Seul admin peut supprimer
    if current_user.role != 'admin': 
        raise HTTPException(status_code=403, detail="Seul un admin peut supprimer.")

    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    # Détacher les raw events qui pointent vers cette intervention avant suppression
    db.query(RawCalendarEvent).filter(
        RawCalendarEvent.linked_intervention_id == intervention_id
    ).update({"linked_intervention_id": None, "status": "pending"})

    db.delete(db_intervention)
    db.commit()
    return {"message": "Intervention supprimée"}