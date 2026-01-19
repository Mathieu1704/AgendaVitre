from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import uuid

from app.models.models import get_db, Intervention, Client, Employee, intervention_employees
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
    current_user=Depends(get_current_user), 
):
    # Récupération propre de l'utilisateur connecté via le token
    user_id = uuid.UUID(current_user["sub"])
    
    current_employee = db.query(Employee).filter(Employee.id == user_id).first()
    
    # Si l'employé n'existe pas en base, on renvoie une liste vide (ou erreur 403)
    if not current_employee:
        return []

    query = db.query(Intervention)

    # 2. LOGIQUE DE FILTRAGE
    if current_employee.role == 'admin':
        # Admin : Voit TOUT
        pass 
    else:
        # Employé : Ne voit que les interventions où il est assigné
        query = query.filter(Intervention.employees.any(id=user_id))

    return query.all()

@router.get("/{intervention_id}", response_model=InterventionOut)
def read_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Non trouvé")
    return intervention

@router.post("", response_model=InterventionOut)
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # 1. Vérif Client
    client = db.query(Client).filter(Client.id == intervention.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    # 2. Création objet
    # On exclut employee_ids du dump car ce n'est pas une colonne directe
    data = intervention.model_dump(exclude={"employee_ids"})
    new_intervention = Intervention(**data)
    
    # 3. Gestion des Assignations (Many-to-Many)
    if intervention.employee_ids:
        employees = db.query(Employee).filter(Employee.id.in_(intervention.employee_ids)).all()
        new_intervention.employees = employees
    else:
        # Par défaut, si aucun employé spécifié, on assigne celui qui crée ? 
        # Ou on laisse vide (à planifier). Laissons vide pour l'instant.
        pass

    db.add(new_intervention)
    db.commit()
    db.refresh(new_intervention)
    return new_intervention

@router.patch("/{intervention_id}", response_model=InterventionOut)
def update_intervention(
    intervention_id: UUID,
    intervention_update: dict, # On utilise dict pour simplifier ici
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    # Mise à jour des champs simples
    for key, value in intervention_update.items():
        if key == "employee_ids":
             # Mise à jour des employés
             employees = db.query(Employee).filter(Employee.id.in_(value)).all()
             db_intervention.employees = employees
        elif hasattr(db_intervention, key):
            setattr(db_intervention, key, value)

    db.commit()
    db.refresh(db_intervention)
    return db_intervention