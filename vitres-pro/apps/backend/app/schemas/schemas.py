from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# -------------------------
# CLIENT
# -------------------------
class ClientBase(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientOutLite(ClientBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# INTERVENTION
# -------------------------
class InterventionBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str = "planned"
    price_estimated: Optional[float] = None
    client_id: UUID
    employee_id: Optional[UUID] = None

class InterventionCreate(InterventionBase):
    pass

class InterventionOutLite(InterventionBase):
    id: UUID

    class Config:
        from_attributes = True

class InterventionOut(InterventionOutLite):
    # On inclut le client, mais en version Lite pour éviter le cycle
    client: Optional[ClientOutLite] = None


# -------------------------
# CLIENT COMPLET (avec historique)
# -------------------------
class ClientOut(ClientOutLite):
    # Historique d'interventions, mais en Lite pour éviter le cycle
    interventions: List[InterventionOutLite] = []

    class Config:
        from_attributes = True
