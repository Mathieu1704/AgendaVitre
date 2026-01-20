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
    current_user=Depends(get_current_user)
):
    # 1. Vérification Admin
    admin_id = UUID(current_user["sub"])
    admin = db.query(Employee).filter(Employee.id == admin_id).first()
    if not admin or admin.role != "admin":
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
        # Souvent : email déjà pris
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
        # En cas d'échec SQL, on devrait nettoyer Supabase Auth, mais restons simple pour l'instant
        raise HTTPException(status_code=400, detail=f"Erreur DB: {str(e)}")

    return new_employee

@router.post("/sync-profile")
def sync_profile(
    profile: EmployeeBase,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_id = UUID(current_user["sub"])
    email = current_user.get("email") 

    emp = db.query(Employee).filter(Employee.id == user_id).first()
    
    if not emp:
        emp = Employee(id=user_id, email=email, **profile.model_dump())
        db.add(emp)
    else:
        for k, v in profile.model_dump().items():
            setattr(emp, k, v)
    
    db.commit()
    db.refresh(emp)
    return emp

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