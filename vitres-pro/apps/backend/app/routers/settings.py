from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.models.models import get_db, City, Client, Intervention, HourlyRate, CompanySettings
from app.schemas.schemas import CityOut, CityCreate, CityUpdate, AssignInterventionCityIn, HourlyRateOut, HourlyRateCreate, normalize_city
from app.core.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class CompanySettingsPatch(BaseModel):
    hide_cash: bool


@router.get("/cities", response_model=List[CityOut])
def list_cities(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(City).order_by(City.zone, City.position, City.city).all()


@router.post("/cities", response_model=CityOut)
def create_city(body: CityCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    name = normalize_city(body.city)
    if db.query(City).filter(City.city == name).first():
        raise HTTPException(status_code=400, detail="Cette ville existe déjà")
    max_pos = db.query(City).filter(City.zone == body.zone).count()
    city = City(city=name, zone=body.zone, color=body.color, position=max_pos)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


@router.patch("/cities/{city}", response_model=CityOut)
def update_city(city: str, body: CityUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Renomme une ville et/ou change sa zone ; répercute sur clients + interventions."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    city = normalize_city(city)
    row = db.query(City).filter(City.city == city).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ville introuvable")

    new_name = normalize_city(body.city) if body.city else city
    new_zone = body.zone or row.zone

    if new_name != city and db.query(City).filter(City.city == new_name).first():
        raise HTTPException(status_code=400, detail="Une ville avec ce nom existe déjà")

    row.city = new_name
    row.zone = new_zone
    if body.color is not None:
        row.color = body.color

    if new_name != city:
        db.query(Client).filter(Client.city == city).update({"city": new_name})
    db.query(Intervention).filter(Intervention.city == city).update(
        {"city": new_name, "zone": new_zone}, synchronize_session=False
    )

    db.commit()
    db.refresh(row)
    return row


@router.delete("/cities/{city}")
def delete_city(city: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    city = normalize_city(city)
    row = db.query(City).filter(City.city == city).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ville introuvable")
    intervention_count = db.query(Intervention).filter(Intervention.city == city).count()
    if intervention_count > 0:
        raise HTTPException(status_code=400, detail=f"Impossible de supprimer : {intervention_count} intervention(s) rattachée(s).")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/interventions/unassigned-cities")
def list_unassigned_interventions(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Interventions sans ville assignée, groupées par titre/adresse pour assignation en masse."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    rows = db.query(Intervention).filter(
        Intervention.city.is_(None)
    ).order_by(Intervention.title, Intervention.start_time).all()
    groups: dict = {}
    for i in rows:
        key = (i.title or "").strip().lower() + "|" + (i.address or "").strip().lower()
        group = groups.setdefault(key, {
            "title": i.title,
            "address": i.address,
            "zone": i.zone,
            "intervention_ids": [],
        })
        group["intervention_ids"].append(str(i.id))
    return list(groups.values())


@router.post("/interventions/assign-city")
def assign_intervention_city(body: AssignInterventionCityIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Assigne une ville (et sa zone) à un lot d'interventions sans ville."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    city = normalize_city(body.city)
    city_row = db.query(City).filter(City.city == city).first()
    if not city_row:
        raise HTTPException(status_code=404, detail="Ville inconnue — crée-la d'abord dans les paramètres.")
    if not body.intervention_ids:
        raise HTTPException(status_code=400, detail="Aucune intervention fournie")
    db.query(Intervention).filter(Intervention.id.in_(body.intervention_ids)).update(
        {"city": city, "zone": city_row.zone}, synchronize_session=False
    )
    db.commit()
    return {"ok": True, "city": city, "zone": city_row.zone, "count": len(body.intervention_ids)}


# --- TAUX HORAIRES ---

@router.get("/hourly-rates", response_model=List[HourlyRateOut])
def list_hourly_rates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux admins.")
    return db.query(HourlyRate).order_by(HourlyRate.rate).all()


@router.post("/hourly-rates", response_model=HourlyRateOut)
def create_hourly_rate(
    body: HourlyRateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement.")
    hr = HourlyRate(
        rate=body.rate,
        label=body.label,
        time_only=body.time_only,
        fixed_hours=body.fixed_hours,
    )
    db.add(hr)
    db.commit()
    db.refresh(hr)
    return hr


@router.delete("/hourly-rates/{rate_id}")
def delete_hourly_rate(
    rate_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement.")
    hr = db.query(HourlyRate).filter(HourlyRate.id == rate_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Introuvable.")
    db.delete(hr)
    db.commit()
    return {"ok": True}


@router.get("/company")
def get_company_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(CompanySettings).first()
    if not s:
        s = CompanySettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return {"hide_cash": s.hide_cash}


@router.patch("/company")
def update_company_settings(
    body: CompanySettingsPatch,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Réservé aux admins.")
    s = db.query(CompanySettings).first()
    if not s:
        s = CompanySettings()
        db.add(s)
    s.hide_cash = body.hide_cash
    db.commit()
    return {"hide_cash": s.hide_cash}
