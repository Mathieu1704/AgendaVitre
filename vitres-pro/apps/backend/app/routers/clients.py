from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.models.models import get_db, Client, Intervention, ClientService
from app.schemas.schemas import ClientCreate, ClientOut, ClientOutLite, ClientServiceCreate, ClientServiceOut, ClientServiceUpdate
from app.core.deps import get_current_user
from app.core.idempotency import already_processed, record_operation
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    new_client = Client(**client.model_dump())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client

@router.get("", response_model=List[ClientOutLite])
def read_clients(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client introuvable")
    # Délier les interventions avant suppression (garder les interventions, juste retirer le lien)
    db.query(Intervention).filter(Intervention.client_id == client.id).update({"client_id": None})
    db.delete(client)
    db.commit()


# --- CLIENT SERVICES (catalogue de prestations) ---

@router.get("/{client_id}/services", response_model=List[ClientServiceOut])
def get_client_services(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return db.query(ClientService).filter(ClientService.client_id == client_id).order_by(ClientService.position).all()


@router.post("/{client_id}/services", response_model=ClientServiceOut)
def create_client_service(
    client_id: UUID,
    payload: ClientServiceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Ouvriers autorises : ils ajustent le catalogue depuis le formulaire de reprise.
    # Rejeu d'une operation hors-connexion : on renvoie la prestation deja creee.
    seen = already_processed(db, payload.client_operation_id)
    if seen is not None and seen.result_id:
        existing = db.query(ClientService).filter(ClientService.id == seen.result_id).first()
        if existing:
            return existing

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    service = ClientService(
        client_id=client_id,
        **payload.model_dump(exclude={"client_operation_id"}),
    )
    db.add(service)
    db.flush()  # pour disposer de l'id avant de journaliser

    record_operation(
        db, payload.client_operation_id, current_user.id,
        f"POST /api/clients/{client_id}/services", service.id,
    )

    db.commit()
    db.refresh(service)
    return service


@router.patch("/{client_id}/services/{service_id}", response_model=ClientServiceOut)
def update_client_service(
    client_id: UUID,
    service_id: UUID,
    payload: ClientServiceUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Ouvriers autorises (renommage depuis le formulaire de reprise).
    service = db.query(ClientService).filter(
        ClientService.id == service_id, ClientService.client_id == client_id
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{client_id}/services/{service_id}", status_code=204)
def delete_client_service(
    client_id: UUID,
    service_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Ouvriers autorises (suppression depuis le formulaire de reprise).
    service = db.query(ClientService).filter(
        ClientService.id == service_id, ClientService.client_id == client_id
    ).first()
    if not service:
        # Deja supprime (rejeu hors-connexion) : on considere l'operation aboutie.
        return
    db.delete(service)
    db.commit()