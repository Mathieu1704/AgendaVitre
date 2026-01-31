from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel

from app.models.models import get_db, Employee
from app.schemas.schemas import EmployeeBase, EmployeeOut, EmployeeUpdate
from app.core.deps import get_current_user
from app.core.supabase import supabase_admin 

router = APIRouter()

# --- SCHEMAS LOCAUX ---
class EmployeeCreateRequest(BaseModel):
    email: str
    password: str
    full_name: str
    color: str = "#3B82F6"
    weekly_hours: float = 38.0
    role: str = "employee"

class PasswordResetRequest(BaseModel):
    password: str

# --- ROUTES ---

@router.get("", response_model=List[EmployeeOut])
def read_employees(
    db: Session = Depends(get_db), 
    current_user=Depends(get_current_user)
):
    return db.query(Employee).all()

@router.post("", response_model=EmployeeOut)
def create_employee(
    emp_data: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user) # current_user est un objet Employee
):
    # 1. Vérification Admin (CORRIGÉ)
    # On vérifie directement l'attribut .role de l'objet, plus besoin de ["sub"]
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé. Admin requis.")

    # 2. Création dans Supabase Auth
    try:
        user_response = supabase_admin.auth.admin.create_user({
            "email": emp_data.email,
            "password": emp_data.password,
            "email_confirm": True,
            "user_metadata": {"full_name": emp_data.full_name}
        })
        new_user_id = UUID(user_response.user.id)
    except Exception as e:
        # AJOUT : Log l'erreur exacte dans la console serveur
        print(f"❌ ERREUR SUPABASE AUTH: {str(e)}") 
        raise HTTPException(status_code=400, detail=f"Erreur Auth: {str(e)}")

    # 3. Création dans la DB SQL
    new_employee = Employee(
        id=new_user_id,
        email=emp_data.email,
        full_name=emp_data.full_name,
        color=emp_data.color,
        role=emp_data.role,
        weekly_hours=emp_data.weekly_hours
    )
    
    try:
        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)
    except Exception as e:
        # Nettoyage si échec DB
        try:
            supabase_admin.auth.admin.delete_user(str(new_user_id))
        except:
            pass
        raise HTTPException(status_code=400, detail=f"Erreur DB: {str(e)}")

    return new_employee

@router.post("/sync-profile")
def sync_profile(
    profile: EmployeeBase,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user) # ✅ Objet Employee
):
    # Plus besoin de chercher en DB, current_user EST l'employé
    # Mais sync_profile sert souvent à créer le profil la première fois...
    # Si get_current_user échoue car l'employé n'existe pas encore en DB,
    # il faudra peut-être adapter deps.py ou gérer ce cas spécifique.
    
    # Pour l'instant, si tu utilises sync_profile juste pour mettre à jour :
    for k, v in profile.model_dump().items():
        setattr(current_user, k, v)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.patch("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: UUID,
    obj_in: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Vérification Admin (Optionnel mais conseillé)
    admin_id = UUID(current_user["sub"])
    admin = db.query(Employee).filter(Employee.id == admin_id).first()
    if not admin or admin.role != "admin":
        raise HTTPException(status_code=403, detail="Seul un admin peut modifier un employé")

    db_obj = db.query(Employee).filter(Employee.id == employee_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    update_data = obj_in.model_dump(exclude_unset=True)
    
    # Si on change les heures hebdo, on recalcule la capacité journalière (hebdo / 5)
    if "weekly_hours" in update_data:
        update_data["daily_capacity"] = update_data["weekly_hours"] / 5

    for field in update_data:
        setattr(db_obj, field, update_data[field])

    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """
    Supprime un employé.
    1. Retire l'employé de toutes les interventions (Désassignation).
    2. Supprime l'employé de la DB.
    3. Supprime le compte de connexion Supabase Auth.
    """
    # 1. Sécurité : Seul l'admin peut supprimer
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Interdit : Seul l'admin peut supprimer.")

    # 2. Récupérer l'employé
    employee_to_delete = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee_to_delete:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    try:
        # ✅ CRUCIAL : On vide ses interventions avant de supprimer
        # Cela supprime les liens dans la table 'intervention_employees'
        # Les interventions redeviennent "Non assignées" (ou assignées aux autres collègues s'il y en a)
        employee_to_delete.interventions = []
        db.commit() # On valide la désassignation

        # 3. Supprimer l'employé de la base de données
        db.delete(employee_to_delete)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Erreur DB: {e}")
        raise HTTPException(status_code=400, detail=f"Impossible de supprimer : {str(e)}")

    # 4. Supprimer le compte Auth Supabase (Optionnel mais recommandé pour nettoyer)
    try:
        supabase_admin.auth.admin.delete_user(str(employee_id))
    except Exception as e:
        print(f"⚠️ Note: Le compte Auth n'a pas pu être supprimé (peut-être déjà fait) : {e}")

    return {"message": "Employé supprimé et interventions libérées."}