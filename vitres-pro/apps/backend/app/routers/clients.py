from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.models import get_db, Client
from app.schemas.schemas import ClientCreate, ClientOut
from app.core.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=ClientOut)
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

@router.get("/", response_model=List[ClientOut])
def read_clients(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Client).all()