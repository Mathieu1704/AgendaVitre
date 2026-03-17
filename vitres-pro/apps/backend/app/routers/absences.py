from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.models.models import get_db, Absence, Employee
from app.schemas.schemas import AbsenceCreate, AbsenceOut
from app.core.deps import get_current_user

router = APIRouter()

@router.post("", response_model=AbsenceOut)
def create_absence(
    absence: AbsenceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    emp = db.query(Employee).filter(Employee.id == absence.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé non trouvé")

    new_absence = Absence(**absence.model_dump())
    db.add(new_absence)
    db.commit()
    db.refresh(new_absence)
    return new_absence

@router.get("/employee/{employee_id}", response_model=List[AbsenceOut])
def read_absences_by_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Un employé peut voir ses propres absences ; un admin peut voir celles de tous
    if current_user.role != "admin" and current_user.id != employee_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return db.query(Absence).filter(Absence.employee_id == employee_id).all()

@router.delete("/{absence_id}")
def delete_absence(
    absence_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    db_abs = db.query(Absence).filter(Absence.id == absence_id).first()
    if not db_abs:
        raise HTTPException(status_code=404, detail="Absence non trouvée")
    db.delete(db_abs)
    db.commit()
    return {"status": "deleted"}