from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.models.models import get_db, AuditLog, Employee
from app.schemas.schemas import AuditLogOut
from app.core.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[AuditLogOut])
def get_logs(
    page: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    action_type: Optional[str] = None,
    intervention_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Retourne l'historique des actions (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux admins.")

    query = db.query(AuditLog)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    if intervention_id:
        query = query.filter(AuditLog.intervention_id == intervention_id)

    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset(page * limit)
        .limit(limit)
        .all()
    )

    result = []
    for log in logs:
        emp_name = None
        if log.employee:
            emp_name = log.employee.full_name or log.employee.email
        result.append(AuditLogOut(
            id=log.id,
            action_type=log.action_type,
            employee_id=log.employee_id,
            intervention_id=log.intervention_id,
            description=log.description,
            created_at=log.created_at,
            employee_name=emp_name,
        ))
    return result
