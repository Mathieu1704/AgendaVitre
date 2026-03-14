from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.models import get_db, Client, Intervention
from app.schemas.schemas import ClientCreate, ClientOut
from app.core.deps import get_current_user
from pydantic import BaseModel

class ClientUpdate(BaseModel):
    name:     Optional[str] = None
    street:   Optional[str] = None
    zip_code: Optional[str] = None
    city:     Optional[str] = None
    address:  Optional[str] = None
    phone:    Optional[str] = None
    email:    Optional[str] = None
    notes:    Optional[str] = None

router = APIRouter()

@router.post("", response_model=ClientOut)
def create_client(
    client: ClientCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    new_client = Client(**client.model_dump())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client

@router.get("", response_model=List[ClientOut])
def read_clients(
    db: Session = Depends(get_db), 
    # current_user = Depends(get_current_user)
):
    return db.query(Client).all()

@router.get("/{client_id}", response_model=ClientOut)
def read_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client

@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client

@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    # Délier les interventions avant suppression (garder les interventions, juste retirer le lien)
    db.query(Intervention).filter(Intervention.client_id == client.id).update({"client_id": None})
    db.delete(client)
    db.commit()