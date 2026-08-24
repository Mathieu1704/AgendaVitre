from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID

from app.models.models import get_db, City, CityGroup, Client, Intervention, HourlyRate, CompanySettings
from app.schemas.schemas import CityOut, CityCreate, CityUpdate, CityGroupOut, CityGroupCreate, CityGroupUpdate, AssignInterventionCityIn, HourlyRateOut, HourlyRateCreate, normalize_city, city_identity_key
from app.core.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


def _find_city(db: Session, value: str, *, exclude: Optional[str] = None):
    """Résout aussi les variantes de ponctuation/casse d'un nom de ville."""
    name = normalize_city(value)
    exact = db.query(City).filter(City.city == name).first()
    if exact and exact.city != exclude:
        return exact
    identity = city_identity_key(name)
    if not identity:
        return None
    return next(
        (
            row for row in db.query(City).all()
            if row.city != exclude and city_identity_key(row.city) == identity
        ),
        None,
    )


def _clean_group_name(value: str) -> str:
    return " ".join((value or "").strip().split())


def _find_group_by_name(db: Session, zone: str, name: str, *, exclude_id: Optional[UUID] = None):
    identity = _clean_group_name(name).casefold()
    return next(
        (
            row for row in db.query(CityGroup).filter(CityGroup.zone == zone).all()
            if row.id != exclude_id and row.name.casefold() == identity
        ),
        None,
    )


class CompanySettingsPatch(BaseModel):
    hide_cash: bool


@router.get("/cities", response_model=List[CityOut])
def list_cities(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(City).options(selectinload(City.group)).order_by(City.zone, City.position, City.city).all()


@router.get("/city-groups", response_model=List[CityGroupOut])
def list_city_groups(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(CityGroup).order_by(CityGroup.zone, CityGroup.position, CityGroup.name).all()


@router.post("/city-groups", response_model=CityGroupOut)
def create_city_group(body: CityGroupCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    name = _clean_group_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Le nom du groupe est requis")
    if _find_group_by_name(db, body.zone, name):
        raise HTTPException(status_code=400, detail="Un groupe portant ce nom existe déjà dans cette zone")
    max_pos = db.query(CityGroup).filter(CityGroup.zone == body.zone).count()
    group = CityGroup(name=name, zone=body.zone, color=body.color, position=max_pos)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.patch("/city-groups/{group_id}", response_model=CityGroupOut)
def update_city_group(group_id: UUID, body: CityGroupUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    group = db.query(CityGroup).filter(CityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    if body.name is not None:
        name = _clean_group_name(body.name)
        if not name:
            raise HTTPException(status_code=400, detail="Le nom du groupe est requis")
        if _find_group_by_name(db, group.zone, name, exclude_id=group.id):
            raise HTTPException(status_code=400, detail="Un groupe portant ce nom existe déjà dans cette zone")
        group.name = name
    if body.color is not None:
        group.color = body.color
    db.commit()
    db.refresh(group)
    return group


@router.delete("/city-groups/{group_id}")
def delete_city_group(group_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    group = db.query(CityGroup).filter(CityGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable")
    db.query(City).filter(City.group_id == group.id).update({"group_id": None}, synchronize_session=False)
    db.delete(group)
    db.commit()
    return {"ok": True}


@router.post("/cities", response_model=CityOut)
def create_city(body: CityCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    name = normalize_city(body.city)
    existing = _find_city(db, name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Cette ville existe déjà sous le nom « {existing.city} »")
    group = None
    if body.group_id:
        group = db.query(CityGroup).filter(CityGroup.id == body.group_id).first()
        if not group or group.zone != body.zone:
            raise HTTPException(status_code=400, detail="Ce groupe n'appartient pas à la zone choisie")
    max_pos = db.query(City).filter(City.zone == body.zone).count()
    city = City(city=name, zone=body.zone, color=body.color, position=max_pos, group_id=group.id if group else None)
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
    row = _find_city(db, city)
    if not row:
        raise HTTPException(status_code=404, detail="Ville introuvable")

    old_name = row.city
    new_name = normalize_city(body.city) if body.city else old_name
    new_zone = body.zone or row.zone

    if "group_id" in body.model_fields_set:
        if body.group_id is None:
            row.group_id = None
        else:
            group = db.query(CityGroup).filter(CityGroup.id == body.group_id).first()
            if not group or group.zone != new_zone:
                raise HTTPException(status_code=400, detail="Ce groupe n'appartient pas à la zone choisie")
            row.group_id = group.id
    elif row.group_id:
        current_group = db.query(CityGroup).filter(CityGroup.id == row.group_id).first()
        if not current_group or current_group.zone != new_zone:
            row.group_id = None

    duplicate = _find_city(db, new_name, exclude=row.city)
    if duplicate:
        raise HTTPException(status_code=400, detail=f"Une ville équivalente existe déjà : « {duplicate.city} »")

    row.city = new_name
    row.zone = new_zone
    if body.color is not None:
        row.color = body.color

    if new_name != old_name:
        db.query(Client).filter(Client.city == old_name).update({"city": new_name})
    db.query(Intervention).filter(Intervention.city == old_name).update(
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
    row = _find_city(db, city)
    if not row:
        raise HTTPException(status_code=404, detail="Ville introuvable")
    intervention_count = db.query(Intervention).filter(Intervention.city == row.city).count()
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
    city_row = _find_city(db, city)
    if not city_row:
        raise HTTPException(status_code=404, detail="Ville inconnue — crée-la d'abord dans les paramètres.")
    if not body.intervention_ids:
        raise HTTPException(status_code=400, detail="Aucune intervention fournie")
    db.query(Intervention).filter(Intervention.id.in_(body.intervention_ids)).update(
        {"city": city_row.city, "zone": city_row.zone}, synchronize_session=False
    )
    db.commit()
    return {"ok": True, "city": city_row.city, "zone": city_row.zone, "count": len(body.intervention_ids)}


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
