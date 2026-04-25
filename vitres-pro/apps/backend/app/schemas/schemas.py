from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
import unicodedata


def normalize_city(v: Optional[str]) -> Optional[str]:
    """Normalise un nom de ville : trim + apostrophes uniformes."""
    if not v:
        return v
    v = v.strip()
    # Remplace toutes les variantes d'apostrophe par l'apostrophe droite standard
    for char in ("\u2019", "\u2018", "\u02bc", "\u0060", "\u00b4"):
        v = v.replace(char, "'")
    return v

# --- EMPLOYEE ---
class EmployeeBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "employee"
    color: str = "#3B82F6"
    phone: Optional[str] = None
    zone: str = "hainaut"  # "hainaut" ou "ardennes"
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
    zone: Optional[str] = None
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

# --- SUB ZONE ---
class SubZoneOut(BaseModel):
    id: UUID
    code: str
    label: str
    parent_zone: str
    position: int
    cities: List[str] = []
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

    @field_validator("city", mode="before")
    @classmethod
    def normalize_city_field(cls, v):
        return normalize_city(v)

class ClientCreate(ClientBase):
    pass

class ClientOutLite(ClientBase):
    id: UUID
    sub_zone: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# --- CLIENT SERVICE (catalogue de prestations par client) ---
class ClientServiceCreate(BaseModel):
    label: str
    price: float
    position: float = 0

class ClientServiceOut(BaseModel):
    id: UUID
    label: str
    price: float
    position: float = 0
    class Config:
        from_attributes = True

class ClientServiceUpdate(BaseModel):
    label: Optional[str] = None
    price: Optional[float] = None
    position: Optional[float] = None

# --- INTERVENTION ITEMS ---
class InterventionItemBase(BaseModel):
    label: str  # Ex: "RDC", "Velux"
    price: float # Ex: 35.0
    client_service_id: Optional[UUID] = None

class InterventionItemCreate(InterventionItemBase):
    pass

class InterventionItemOut(InterventionItemBase):
    id: UUID
    class Config:
        from_attributes = True

# --- HOURLY RATE ---
class HourlyRateCreate(BaseModel):
    rate: float
    label: Optional[str] = None
    time_only: bool = False

class HourlyRateOut(BaseModel):
    id: UUID
    rate: float
    label: Optional[str] = None
    time_only: bool = False
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
    payment_mode: str = "cash"  # "cash" | "invoice" | "invoice_cash"
    zone: str = "hainaut"  # "hainaut" ou "ardennes"
    client_id: Optional[UUID] = None
    employee_ids: List[UUID] = []
    items: List[InterventionItemCreate] = []
    recurrence_rule: Optional[Dict[str, Any]] = None
    recurrence_group_id: Optional[UUID] = None
    time_tbd: bool = False
    hourly_rate_id: Optional[UUID] = None

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
    payment_mode: str = "cash"
    zone: Optional[str] = None
    sub_zone: Optional[str] = None
    reprise_taken: Optional[bool] = None
    reprise_note: Optional[str] = None
    recurrence_rule: Optional[Dict[str, Any]] = None
    recurrence_group_id: Optional[UUID] = None
    time_tbd: bool = False
    hourly_rate_id: Optional[UUID] = None
    hourly_rate: Optional[HourlyRateOut] = None
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

# --- AUDIT LOG ---
class AuditLogOut(BaseModel):
    id: UUID
    action_type: str
    employee_id: Optional[UUID] = None
    intervention_id: Optional[UUID] = None
    description: Optional[str] = None
    created_at: datetime
    employee_name: Optional[str] = None  # Enrichi côté router

    class Config:
        from_attributes = True

# --- NOTIFICATION ---
class NotificationOut(BaseModel):
    id: UUID
    recipient_id: UUID
    type: str
    title: str
    message: str
    is_read: bool
    metadata: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
