from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func as sqlfunc
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
import json
import pytz

import anthropic as anthropic_sdk

from app.models.models import get_db, RawCalendarEvent, Employee, Client, Intervention, InterventionItem
from app.core.deps import get_current_user
from app.core.config import settings

router = APIRouter()


def require_admin(current_user: Employee):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux admins")


def raw_event_to_dict(ev: RawCalendarEvent) -> dict:
    return {
        "id": str(ev.id),
        "source": ev.source,
        "external_id": ev.external_id,
        "calendar_id": ev.calendar_id,
        "summary": ev.summary,
        "description": ev.description,
        "location": ev.location,
        "start_time": ev.start_time.isoformat() if ev.start_time else None,
        "end_time": ev.end_time.isoformat() if ev.end_time else None,
        "all_day": ev.all_day,
        "status": ev.status,
        "employee_id": str(ev.employee_id) if ev.employee_id else None,
        "linked_intervention_id": str(ev.linked_intervention_id) if ev.linked_intervention_id else None,
        "assigned_employees": [
            {"id": str(e.id), "full_name": e.full_name, "color": e.color}
            for e in ev.assigned_employees
        ],
        # Kept for backward compat (first assigned employee)
        "employee": {
            "id": str(ev.employee.id),
            "full_name": ev.employee.full_name,
            "color": ev.employee.color,
        } if ev.employee else None,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
        "updated_at": ev.updated_at.isoformat() if ev.updated_at else None,
    }


def _query_with_joins(db: Session):
    return db.query(RawCalendarEvent).options(
        joinedload(RawCalendarEvent.assigned_employees),
        joinedload(RawCalendarEvent.employee),
    )


# --- IMPORT ---

@router.post("/import/google")
def import_google_day(
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format date invalide. Attendu: YYYY-MM-DD")

    from app.services.google_calendar import fetch_day_events, CALENDAR_ID

    try:
        events = fetch_day_events(target_date)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Google API: {str(e)}")

    upserted = 0
    skipped = 0

    for event in events:
        external_id = event.get("id", "")
        if not external_id:
            skipped += 1
            continue

        start_str = event.get("start", {}).get("dateTime", "")
        end_str = event.get("end", {}).get("dateTime", "")

        if not start_str or not end_str:
            skipped += 1
            continue

        try:
            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)
        except ValueError:
            skipped += 1
            continue

        existing = db.query(RawCalendarEvent).filter(
            and_(
                RawCalendarEvent.source == "google",
                RawCalendarEvent.calendar_id == CALENDAR_ID,
                RawCalendarEvent.external_id == external_id,
            )
        ).first()

        if existing:
            existing.summary = event.get("summary", "Sans titre")
            existing.description = event.get("description", None)
            existing.location = event.get("location", None)
            existing.start_time = start_dt
            existing.end_time = end_dt
            existing.raw_payload = event
        else:
            new_event = RawCalendarEvent(
                source="google",
                external_id=external_id,
                calendar_id=CALENDAR_ID,
                summary=event.get("summary", "Sans titre"),
                description=event.get("description", None),
                location=event.get("location", None),
                start_time=start_dt,
                end_time=end_dt,
                all_day=False,
                status="raw",
                raw_payload=event,
            )
            db.add(new_event)

        upserted += 1

    db.commit()
    return {"date": date, "upserted": upserted, "skipped": skipped, "total_from_google": len(events)}


# --- LECTURE ---

@router.get("")
def list_raw_events(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="raw,assigned,converted,ignored"),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    query = _query_with_joins(db)

    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Format date invalide. Attendu: YYYY-MM-DD")
        from sqlalchemy.sql import func as sqlfunc
        query = query.filter(sqlfunc.date(RawCalendarEvent.start_time) == target_date)

    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(RawCalendarEvent.status.in_(statuses))
    else:
        query = query.filter(RawCalendarEvent.status.in_(["raw", "assigned"]))

    events = query.order_by(RawCalendarEvent.start_time).all()
    return [raw_event_to_dict(e) for e in events]


@router.get("/range")
def list_raw_events_range(
    from_date: str = Query(..., alias="from", description="YYYY-MM-DD"),
    to_date: str = Query(..., alias="to", description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    try:
        start = datetime.strptime(from_date, "%Y-%m-%d").date()
        end = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format date invalide. Attendu: YYYY-MM-DD")

    from sqlalchemy.sql import func as sqlfunc
    events = _query_with_joins(db).filter(
        sqlfunc.date(RawCalendarEvent.start_time) >= start,
        sqlfunc.date(RawCalendarEvent.start_time) <= end,
        RawCalendarEvent.status.in_(["raw", "assigned"]),
    ).order_by(RawCalendarEvent.start_time).all()

    return [raw_event_to_dict(e) for e in events]


# --- ACTIONS ADMIN ---

class AssignBody(BaseModel):
    employee_ids: List[UUID]


@router.post("/{event_id}/assign")
def assign_raw_event(
    event_id: UUID,
    body: AssignBody,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    ev = _query_with_joins(db).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    employees = []
    for emp_id in body.employee_ids:
        emp = db.query(Employee).filter(Employee.id == emp_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail=f"Employé {emp_id} introuvable")
        employees.append(emp)

    ev.assigned_employees = employees
    ev.employee_id = employees[0].id if employees else None
    ev.status = "assigned" if employees else "raw"
    db.commit()
    db.refresh(ev)

    return raw_event_to_dict(ev)


@router.post("/{event_id}/ignore")
def ignore_raw_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    ev = db.query(RawCalendarEvent).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    ev.status = "ignored"
    db.commit()
    return {"id": str(event_id), "status": "ignored"}


@router.post("/{event_id}/convert")
def convert_raw_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    ev = _query_with_joins(db).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    if ev.status == "converted" and ev.linked_intervention_id:
        raise HTTPException(status_code=409, detail="Déjà converti")

    intervention = Intervention(
        title=ev.summary,
        description=ev.description,
        start_time=ev.start_time,
        end_time=ev.end_time,
        client_id=None,
        status="planned",
    )
    for emp in ev.assigned_employees:
        intervention.employees.append(emp)

    db.add(intervention)
    db.flush()

    ev.status = "converted"
    ev.linked_intervention_id = intervention.id
    db.commit()

    return {"id": str(event_id), "status": "converted", "intervention_id": str(intervention.id)}


@router.get("/{event_id}")
def get_raw_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    ev = _query_with_joins(db).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    return raw_event_to_dict(ev)


# --- AI PARSING ---

BRUSSELS_TZ = pytz.timezone("Europe/Brussels")

_AI_SYSTEM_PROMPT = """Tu es un assistant pour une entreprise de nettoyage de vitres en Belgique (LVM Agenda).
Tu reçois un événement Google Agenda brut (titre, description, localisation, heures) et tu dois extraire les informations structurées.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires, sans texte supplémentaire.

Structure attendue :
{
  "client_name": "Nom complet du client",
  "client_street": "Rue et numéro",
  "client_zip": "Code postal",
  "client_city": "Ville",
  "client_phone": "Numéro de téléphone ou vide",
  "client_email": "Email ou vide",
  "client_notes": "Notes importantes (contraintes horaires, accès, avertissements) ou vide",
  "is_invoice": true si le titre contient 'Fac' ou 'TVAC' ou 'HTVA', false sinon,
  "total_price": montant total en euros (float) ou 0.0,
  "full_description": "Description complète et détaillée des prestations",
  "services_json": [
    {"description": "Nom de la prestation", "price": 0.0}
  ]
}

Règles :
- Extraire l'adresse depuis la localisation ou la description
- Extraire les prix depuis la description (format: "Prestation (XX€)")
- total_price = somme de tous les prix des services
- Si pas de prix connus, mettre 0.0
- client_notes = contraintes (ex: "pas avant 11h", "⚠️ bien faire les seuils")
- Enlever les notes de contraintes de full_description, les mettre dans client_notes
"""


@router.post("/{event_id}/ai-parse")
def ai_parse_raw_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY non configurée")

    ev = _query_with_joins(db).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    # Heures en heure de Bruxelles
    start_bxl = ev.start_time.astimezone(BRUSSELS_TZ)
    end_bxl = ev.end_time.astimezone(BRUSSELS_TZ)

    user_content = f"""Titre: {ev.summary or ""}
Description: {ev.description or ""}
Localisation: {ev.location or ""}
Date: {start_bxl.strftime("%Y-%m-%d")}
Heure début: {start_bxl.strftime("%H:%M")}
Heure fin: {end_bxl.strftime("%H:%M")}"""

    client = anthropic_sdk.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=_AI_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    raw_text = message.content[0].text.strip()
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"Réponse IA invalide: {raw_text[:200]}")

    # Compléter avec les champs fixes du raw event
    parsed["google_id"] = ev.external_id or str(ev.id)
    parsed["original_summary"] = ev.summary or ""
    parsed["date"] = start_bxl.strftime("%Y-%m-%d")
    parsed["start_time"] = start_bxl.strftime("%H:%M")
    parsed["end_time"] = end_bxl.strftime("%H:%M")

    return parsed


class ServiceItem(BaseModel):
    description: str
    price: float = 0.0

class AiConfirmBody(BaseModel):
    google_id: str = ""
    original_summary: str
    date: str
    client_name: str
    client_street: str = ""
    client_zip: str = ""
    client_city: str = ""
    client_phone: str = ""
    client_email: str = ""
    client_notes: str = ""
    start_time: str
    end_time: str
    is_invoice: bool = False
    total_price: float = 0.0
    full_description: str = ""
    services_json: List[ServiceItem] = []


@router.post("/{event_id}/ai-confirm")
def ai_confirm_raw_event(
    event_id: UUID,
    body: AiConfirmBody,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    require_admin(current_user)

    ev = _query_with_joins(db).filter(RawCalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Événement introuvable")

    if ev.status == "converted" and ev.linked_intervention_id:
        raise HTTPException(status_code=409, detail="Déjà converti")

    # Construire l'adresse complète
    address_parts = [p for p in [body.client_street, body.client_zip, body.client_city] if p]
    address_str = ", ".join(address_parts) if address_parts else None

    is_unknown = body.client_name.strip().lower() == "client inconnu"
    has_real_data = bool(body.client_street or body.client_phone or body.client_city)

    if is_unknown:
        # Client anonyme : name=None, on garde toutes les vraies données si dispo
        if has_real_data:
            client = Client(
                name=None,
                street=body.client_street or None,
                zip_code=body.client_zip or None,
                city=body.client_city or None,
                address=address_str,
                phone=body.client_phone or None,
                email=body.client_email or None,
                notes=body.client_notes or None,
            )
            db.add(client)
            db.flush()
        else:
            client = None
    else:
        # Client nommé : cherche par nom exact ou crée
        client = db.query(Client).filter(
            sqlfunc.lower(Client.name) == body.client_name.strip().lower()
        ).first()
        if not client:
            client = Client(
                name=body.client_name,
                street=body.client_street or None,
                zip_code=body.client_zip or None,
                city=body.client_city or None,
                address=address_str,
                phone=body.client_phone or None,
                email=body.client_email or None,
                notes=body.client_notes or None,
            )
            db.add(client)
            db.flush()

    # Construire les datetimes en heure de Bruxelles → UTC
    start_naive = datetime.strptime(f"{body.date} {body.start_time}", "%Y-%m-%d %H:%M")
    end_naive = datetime.strptime(f"{body.date} {body.end_time}", "%Y-%m-%d %H:%M")
    start_dt = BRUSSELS_TZ.localize(start_naive).astimezone(pytz.utc)
    end_dt = BRUSSELS_TZ.localize(end_naive).astimezone(pytz.utc)

    intervention = Intervention(
        title=body.original_summary,
        description=body.full_description or None,
        start_time=start_dt,
        end_time=end_dt,
        client_id=client.id if client else None,
        status="planned",
        is_invoice=body.is_invoice,
        price_estimated=body.total_price if body.total_price else None,
    )
    for emp in ev.assigned_employees:
        intervention.employees.append(emp)
    db.add(intervention)
    db.flush()

    for svc in body.services_json:
        db.add(InterventionItem(
            intervention_id=intervention.id,
            label=svc.description,
            price=svc.price,
        ))

    ev.status = "converted"
    ev.linked_intervention_id = intervention.id
    db.commit()

    return {"id": str(event_id), "status": "converted", "intervention_id": str(intervention.id)}
