from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime
from uuid import UUID

# --- EMPLOYEE ---
class EmployeeBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "employee"
    color: str = "#3B82F6"
    phone: Optional[str] = None
    weekly_hours: float = 38.0
    daily_capacity: float = 7.6
    hours_per_weekday: Optional[Dict[str, float]] = None

class EmployeeOut(EmployeeBase):
    id: UUID
    class Config:
        from_attributes = True

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    color: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    weekly_hours: Optional[float] = None
    daily_capacity: Optional[float] = None
    hours_per_weekday: Optional[Dict[str, float]] = None

# --- ABSENCE ---
class AbsenceBase(BaseModel):
    employee_id: UUID
    start_date: datetime
    end_date: datetime
    reason: Optional[str] = "Maladie"

class AbsenceCreate(AbsenceBase):
    pass

class AbsenceOut(AbsenceBase):
    id: UUID
    class Config:
        from_attributes = True

# --- ABSENCE ---
class AbsenceCreate(BaseModel):
    employee_id: UUID
    start_date: datetime
    end_date: datetime
    reason: Optional[str] = "Congé"

class AbsenceOut(AbsenceCreate):
    id: UUID
    class Config:
        from_attributes = True

# --- CLIENT ---
class ClientBase(BaseModel):
    name: Optional[str] = None
    street: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientOutLite(ClientBase):
    id: UUID
    created_at: datetime
    class Config:
        from_attributes = True

class InterventionItemBase(BaseModel):
    label: str  # Ex: "RDC", "Velux"
    price: float # Ex: 35.0

class InterventionItemCreate(InterventionItemBase):
    pass

class InterventionItemOut(InterventionItemBase):
    id: UUID
    class Config:
        from_attributes = True

# --- INTERVENTION ---
class InterventionBase(BaseModel):
    type: str = "intervention"
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str = "planned"
    price_estimated: Optional[float] = None
    is_invoice: bool = False
    client_id: Optional[UUID] = None
    employee_ids: List[UUID] = []
    items: List[InterventionItemCreate] = []

class InterventionCreate(InterventionBase):
    pass

class InterventionOutLite(BaseModel):
    id: UUID
    type: str = "intervention"
    title: str
    start_time: datetime
    end_time: datetime
    status: str
    class Config:
        from_attributes = True

class InterventionOut(BaseModel):
    id: UUID
    type: str = "intervention"
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    status: str
    price_estimated: Optional[float]
    is_invoice: bool = False
    client: Optional[ClientOutLite] = None
    employees: List[EmployeeOut] = []
    items: List[InterventionItemOut] = []

    class Config:
        from_attributes = True

# --- CLIENT COMPLET ---
class ClientOut(ClientOutLite):
    interventions: List[InterventionOutLite] = []
    class Config:
        from_attributes = True