from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.models import get_db, Client
from app.schemas.schemas import ClientCreate, ClientOut
from app.core.deps import get_current_user

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
def read_clients(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Client).all()

@router.get("/{client_id}", response_model=ClientOut)
def read_client(
    client_id: str, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    # On cherche le client dans la base de données SQL par son ID
    client = db.query(Client).filter(Client.id == client_id).first()
    
    if client is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
        
    return client