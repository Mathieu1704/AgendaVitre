from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# --- EMPLOYEE ---
class EmployeeBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "employee"
    color: str = "#3B82F6"
    weekly_hours: float = 38.0
    daily_capacity: float = 7.6

class EmployeeOut(EmployeeBase):
    id: UUID
    class Config:
        from_attributes = True

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    color: Optional[str] = None
    role: Optional[str] = None
    weekly_hours: Optional[float] = None
    daily_capacity: Optional[float] = None

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

# --- INTERVENTION ---
class InterventionBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str = "planned"
    price_estimated: Optional[float] = None
    client_id: UUID
    # On remplace employee_id par une liste d'IDs
    employee_ids: List[UUID] = [] 

class InterventionCreate(InterventionBase):
    pass

class InterventionOutLite(BaseModel):
    id: UUID
    title: str
    start_time: datetime
    end_time: datetime
    status: str
    class Config:
        from_attributes = True

class InterventionOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    status: str
    price_estimated: Optional[float]
    client: Optional[ClientOutLite] = None
    # On renvoie la liste complète des employés assignés
    employees: List[EmployeeOut] = []

    class Config:
        from_attributes = True

# --- CLIENT COMPLET ---
class ClientOut(ClientOutLite):
    interventions: List[InterventionOutLite] = []
    class Config:
        from_attributes = True