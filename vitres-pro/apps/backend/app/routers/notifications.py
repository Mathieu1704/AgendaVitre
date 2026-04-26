from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.models.models import get_db, InAppNotification, Employee
from app.schemas.schemas import NotificationOut
from app.core.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Retourne les notifications de l'utilisateur courant (non lues d'abord)."""
    notifs = (
        db.query(InAppNotification)
        .filter(InAppNotification.recipient_id == current_user.id)
        .order_by(InAppNotification.is_read.asc(), InAppNotification.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for n in notifs:
        result.append(NotificationOut(
            id=n.id,
            recipient_id=n.recipient_id,
            type=n.type,
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            metadata=n.metadata_,
            created_at=n.created_at,
        ))
    return result


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    count = (
        db.query(InAppNotification)
        .filter(InAppNotification.recipient_id == current_user.id, InAppNotification.is_read == False)
        .count()
    )
    return {"count": count}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    notif = db.query(InAppNotification).filter(
        InAppNotification.id == notification_id,
        InAppNotification.recipient_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    notif.is_read = True
    db.commit()
    return {"message": "ok"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    notif = db.query(InAppNotification).filter(
        InAppNotification.id == notification_id,
        InAppNotification.recipient_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    db.delete(notif)
    db.commit()
    return {"message": "ok"}


@router.delete("")
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    db.query(InAppNotification).filter(
        InAppNotification.recipient_id == current_user.id,
    ).delete()
    db.commit()
    return {"message": "ok"}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    db.query(InAppNotification).filter(
        InAppNotification.recipient_id == current_user.id,
        InAppNotification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "ok"}
