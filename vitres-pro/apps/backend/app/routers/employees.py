from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.models.models import get_db, Employee
from app.schemas.schemas import EmployeeBase, EmployeeOut
from app.core.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[EmployeeOut])
def read_employees(
    db: Session = Depends(get_db), 
    # current_user=Depends(get_current_user)
):
    return db.query(Employee).all()

@router.post("/sync-profile")
def sync_profile(
    profile: EmployeeBase,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Appelé par le mobile au premier login pour créer/maj le profil employé local
    """
    user_id = UUID(current_user["sub"])
    email = current_user.get("email") # Supabase renvoie l'email dans le token souvent

    emp = db.query(Employee).filter(Employee.id == user_id).first()
    
    if not emp:
        emp = Employee(id=user_id, email=email, **profile.model_dump())
        db.add(emp)
    else:
        # Update
        for k, v in profile.model_dump().items():
            setattr(emp, k, v)
    
    db.commit()
    db.refresh(emp)
    return emp