from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date, time
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

VALID_WEEKDAY_KEYS = {"1", "2", "3", "4", "5"}

def validate_hours_per_weekday(v: Optional[Dict[str, float]]) -> Optional[Dict[str, float]]:
    """Valide le format de hours_per_weekday : clés '1' (lundi) à '5' (vendredi), heures entre 0 et 24."""
    if v is None:
        return v
    for key, hours in v.items():
        if key not in VALID_WEEKDAY_KEYS:
            raise ValueError(f"Clé de jour invalide: '{key}' (attendu '1' à '5', 1=lundi..5=vendredi)")
        if hours < 0 or hours > 24:
            raise ValueError(f"Heures invalides pour le jour {key}: {hours}")
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
    hours_valid_from: Optional[date] = None
    hours_valid_until: Optional[date] = None
    # URL signée (calculée à la volée, jamais persistée) — pas une colonne DB.
    avatar_url: Optional[str] = None

    @field_validator("hours_per_weekday")
    @classmethod
    def _check_hours_per_weekday(cls, v):
        return validate_hours_per_weekday(v)

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
    hours_valid_from: Optional[date] = None
    hours_valid_until: Optional[date] = None

    @field_validator("hours_per_weekday")
    @classmethod
    def _check_hours_per_weekday(cls, v):
        return validate_hours_per_weekday(v)

# --- ABSENCE ---
AbsenceType = Literal["Certificat", "VA", "RJF", "CSS"]

class AbsenceCreate(BaseModel):
    employee_id: UUID
    start_date: datetime
    end_date: datetime
    type: AbsenceType = "VA"

class AbsenceOut(BaseModel):
    id: UUID
    employee_id: UUID
    start_date: datetime
    end_date: datetime
    type: str  # str en sortie : couvre les anciennes valeurs libres ("Congé") antérieures aux 4 types fixes
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
    # Id genere par la file d'attente hors-connexion du mobile : evite de creer
    # la prestation en double si l'operation est rejouee.
    client_operation_id: Optional[UUID] = None

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

# --- INTERVENTION SERVICE (catalogue de prestations pour une intervention
# sans client, persistant par chaîne de reprises) ---
class InterventionServiceCreate(BaseModel):
    reprise_chain_id: UUID
    label: str
    price: float
    position: float = 0
    client_operation_id: Optional[UUID] = None

class InterventionServiceOut(BaseModel):
    id: UUID
    reprise_chain_id: UUID
    label: str
    price: float
    position: float = 0
    class Config:
        from_attributes = True

class InterventionServiceUpdate(BaseModel):
    label: Optional[str] = None
    price: Optional[float] = None
    position: Optional[float] = None

# --- INTERVENTION ITEMS ---
class InterventionItemBase(BaseModel):
    label: str  # Ex: "RDC", "Velux"
    price: float # Ex: 35.0
    client_service_id: Optional[UUID] = None
    intervention_service_id: Optional[UUID] = None
    done: bool = True
    on_demand: bool = False
    is_adjustment: bool = False
    note: Optional[str] = None

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
    fixed_hours: Optional[float] = None

class HourlyRateOut(BaseModel):
    id: UUID
    rate: float
    label: Optional[str] = None
    time_only: bool = False
    fixed_hours: Optional[float] = None
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
    amount_cash: Optional[float] = None
    amount_invoice: Optional[float] = None
    zone: str = "hainaut"  # "hainaut" ou "ardennes"
    client_id: Optional[UUID] = None
    employee_ids: List[UUID] = []
    items: List[InterventionItemCreate] = []
    recurrence_rule: Optional[Dict[str, Any]] = None
    recurrence_group_id: Optional[UUID] = None
    time_tbd: bool = False
    hourly_rate_id: Optional[UUID] = None

class InterventionCreate(InterventionBase):
    reprise_of_id: Optional[UUID] = None
    # Id genere par la file d'attente hors-connexion du mobile : permet de
    # detecter un rejeu et d'eviter de creer l'intervention en double.
    client_operation_id: Optional[UUID] = None

class InterventionOutLite(BaseModel):
    id: UUID
    type: str = "intervention"
    title: str
    start_time: datetime
    end_time: datetime
    status: str
    class Config:
        from_attributes = True

class TourRunSummaryOut(BaseModel):
    id: UUID
    publication_status: str
    lifecycle_status: str
    progress: Dict[str, int]
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
    amount_cash: Optional[float] = None
    amount_invoice: Optional[float] = None
    zone: Optional[str] = None
    sub_zone: Optional[str] = None
    reprise_taken: Optional[bool] = None
    reprise_note: Optional[str] = None
    reprise_chain_id: Optional[UUID] = None
    reinforcement_for_id: Optional[UUID] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    recurrence_rule: Optional[Dict[str, Any]] = None
    recurrence_group_id: Optional[UUID] = None
    time_tbd: bool = False
    hourly_rate_id: Optional[UUID] = None
    hourly_rate: Optional[HourlyRateOut] = None
    client: Optional[ClientOutLite] = None
    employees: List[EmployeeOut] = []
    items: List[InterventionItemOut] = []
    tour_run: Optional[TourRunSummaryOut] = None

    class Config:
        from_attributes = True

# --- INTERVENTION NOTES ---
class InterventionNoteCreate(BaseModel):
    text: str

class InterventionNoteOut(BaseModel):
    id: UUID
    text: str
    created_at: datetime
    author_id: UUID
    author_name: Optional[str] = None
    author_color: Optional[str] = None
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


# --- TIMETRACKING ---
class TimeEntryOut(BaseModel):
    work_date: date
    clock_in_at: Optional[datetime] = None
    clock_out_at: Optional[datetime] = None
    status: Literal["not_started", "in_progress", "done"]
    worked_hours: Optional[float] = None

    class Config:
        from_attributes = True


class DailyEntryOut(BaseModel):
    date: date
    clock_in_at: Optional[datetime] = None
    clock_out_at: Optional[datetime] = None
    is_absence: bool
    actual_hours: float
    edited_by_admin: bool = False


class WeeklySummaryEmployeeOut(BaseModel):
    employee_id: UUID
    full_name: Optional[str] = None
    role: str
    cash_amount: float
    cash_settled: bool
    overtime_balance_hours: float
    overtime_period_start: date
    overtime_period_end: date
    daily_entries: List[DailyEntryOut]


class WeeklySummaryOut(BaseModel):
    week_start: date
    week_end: date
    employees: List[WeeklySummaryEmployeeOut]


class CashSettlementIn(BaseModel):
    employee_id: UUID
    week_start: date


class CashSettlementOut(BaseModel):
    id: UUID
    employee_id: UUID
    amount: float
    week_start: date
    confirmed_at: datetime
    confirmed_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class OvertimeSettlementIn(BaseModel):
    employee_id: UUID
    include_current_week: bool = False


class OvertimeSettlementOut(BaseModel):
    id: UUID
    employee_id: UUID
    delta_hours: float
    period_start: date
    period_end: date
    confirmed_at: datetime
    confirmed_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class TimeEntryCorrectionIn(BaseModel):
    employee_id: UUID
    work_date: date
    clock_in_at: Optional[datetime] = None
    clock_out_at: Optional[datetime] = None


# --- TOURNEES RECURRENTES ---
# Fidele au tableau papier : paiement et frequence restent du texte libre,
# jamais interpretes/calcules par l'app.

class TourServiceInput(BaseModel):
    id: Optional[UUID] = None
    label: str
    price_ht: float = 0
    position: float = 0
    active: bool = True

    @field_validator("price_ht")
    @classmethod
    def _valid_price(cls, value):
        if value < 0:
            raise ValueError("Le prix HT ne peut pas etre negatif.")
        return value


class TourStopInput(BaseModel):
    id: Optional[UUID] = None
    name: str
    note: Optional[str] = None
    payment_text: Optional[str] = None
    frequency_text: Optional[str] = None
    estimated_minutes: Optional[int] = None
    position: float = 0
    active: bool = True
    services: List[TourServiceInput] = []

    @field_validator("estimated_minutes")
    @classmethod
    def _valid_duration(cls, value):
        if value is not None and value <= 0:
            raise ValueError("La duree estimee doit etre superieure a zero.")
        return value


class TourSectionInput(BaseModel):
    id: Optional[UUID] = None
    label: str
    position: float = 0
    stops: List[TourStopInput] = []


class TourTemplateInput(BaseModel):
    name: str
    zone: Literal["hainaut", "ardennes"]
    weekday: int
    default_start_time: time
    default_end_time: time
    active: bool = False
    archived: bool = False
    source_document: Optional[str] = None
    sections: List[TourSectionInput] = []

    @field_validator("weekday")
    @classmethod
    def _valid_weekday(cls, value):
        if value < 1 or value > 7:
            raise ValueError("Le jour doit etre compris entre 1 (lundi) et 7 (dimanche).")
        return value


class TourServiceOut(TourServiceInput):
    id: UUID
    class Config:
        from_attributes = True


class TourStopOut(TourStopInput):
    id: UUID
    services: List[TourServiceOut] = []
    class Config:
        from_attributes = True


class TourSectionOut(TourSectionInput):
    id: UUID
    stops: List[TourStopOut] = []
    class Config:
        from_attributes = True


class TourTemplateOut(TourTemplateInput):
    id: UUID
    created_at: datetime
    updated_at: datetime
    sections: List[TourSectionOut] = []
    class Config:
        from_attributes = True


class TourRunServiceOut(BaseModel):
    id: UUID
    source_service_id: Optional[UUID] = None
    label: str
    price_ht: float
    position: float
    class Config:
        from_attributes = True


class TourRunStopOut(BaseModel):
    id: UUID
    source_stop_id: Optional[UUID] = None
    section_label: Optional[str] = None
    name: str
    note: Optional[str] = None
    payment_text: Optional[str] = None
    frequency_text: Optional[str] = None
    estimated_minutes: Optional[int] = None
    position: float
    selected: bool
    selected_service_id: Optional[UUID] = None
    status: Literal["pending", "done", "not_visited"]
    exception_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    services: List[TourRunServiceOut] = []
    class Config:
        from_attributes = True


class TourRunOut(BaseModel):
    id: UUID
    template_id: Optional[UUID] = None
    scheduled_date: date
    publication_status: Literal["draft", "published"]
    lifecycle_status: str
    progress: Dict[str, int]
    published_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    intervention: InterventionOutLite
    employees: List[EmployeeOut] = []
    stops: List[TourRunStopOut] = []
    class Config:
        from_attributes = True


class TourDraftGenerateInput(BaseModel):
    start_date: Optional[date] = None
    weeks: int = 8


class TourStopSelectionInput(BaseModel):
    selected: bool
    service_id: Optional[UUID] = None


class TourDraftScheduleInput(BaseModel):
    start_time: datetime
    end_time: datetime


class TourPublishInput(BaseModel):
    employee_ids: List[UUID]


class TourStopResolveInput(BaseModel):
    status: Literal["done", "not_visited"]
    reason: Optional[str] = None
    client_operation_id: Optional[UUID] = None
