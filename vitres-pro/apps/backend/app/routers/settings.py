from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
import re

from app.models.models import get_db, SubZone, CitySubZone, Client, Intervention
from app.schemas.schemas import SubZoneOut
from app.core.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class LabelUpdate(BaseModel):
    label: str


class SubZoneCreate(BaseModel):
    label: str
    parent_zone: str  # "hainaut" | "ardennes"


class CityReassign(BaseModel):
    sub_zone_id: UUID


@router.get("/zones", response_model=List[SubZoneOut])
def list_zones(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    zones = db.query(SubZone).options(joinedload(SubZone.cities)).order_by(
        SubZone.parent_zone, SubZone.position
    ).all()
    result = []
    for z in zones:
        out = SubZoneOut(
            id=z.id,
            code=z.code,
            label=z.label,
            parent_zone=z.parent_zone,
            position=z.position,
            cities=[c.city for c in z.cities],
        )
        result.append(out)
    return result


@router.post("/zones", response_model=SubZoneOut)
def create_zone(body: SubZoneCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    if body.parent_zone not in ("hainaut", "ardennes"):
        raise HTTPException(status_code=400, detail="parent_zone doit être 'hainaut' ou 'ardennes'")

    # Générer un code unique depuis le label
    slug = re.sub(r"[^a-z0-9]+", "_", body.label.lower().strip()).strip("_")
    code = f"{body.parent_zone.upper()}_{slug.upper()}"
    # S'assurer de l'unicité
    existing_codes = {z.code for z in db.query(SubZone.code).all()}
    base_code = code
    i = 2
    while code in existing_codes:
        code = f"{base_code}_{i}"
        i += 1

    # Position = max existant + 1 pour ce parent
    max_pos = db.query(SubZone).filter(SubZone.parent_zone == body.parent_zone).count()

    zone = SubZone(code=code, label=body.label.strip(), parent_zone=body.parent_zone, position=max_pos)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return SubZoneOut(id=zone.id, code=zone.code, label=zone.label,
                      parent_zone=zone.parent_zone, position=zone.position, cities=[])


@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    zone = db.query(SubZone).filter(SubZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Sous-zone introuvable")
    city_count = db.query(CitySubZone).filter(CitySubZone.sub_zone_id == zone_id).count()
    if city_count > 0:
        raise HTTPException(status_code=400, detail=f"Impossible de supprimer : {city_count} ville(s) rattachée(s). Déplace-les d'abord.")
    db.delete(zone)
    db.commit()
    return {"ok": True}


@router.patch("/zones/{zone_id}/label", response_model=SubZoneOut)
def rename_zone(zone_id: UUID, body: LabelUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    zone = db.query(SubZone).filter(SubZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Sous-zone introuvable")
    zone.label = body.label
    db.commit()
    db.refresh(zone)
    cities = db.query(CitySubZone).filter(CitySubZone.sub_zone_id == zone.id).all()
    return SubZoneOut(
        id=zone.id, code=zone.code, label=zone.label,
        parent_zone=zone.parent_zone, position=zone.position,
        cities=[c.city for c in cities],
    )


@router.patch("/zones/cities/{city}")
def reassign_city(city: str, body: CityReassign, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Réassigne une ville à une nouvelle sous-zone et met à jour clients + interventions."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    new_zone = db.query(SubZone).filter(SubZone.id == body.sub_zone_id).first()
    if not new_zone:
        raise HTTPException(status_code=404, detail="Sous-zone cible introuvable")

    # Mettre à jour city_sub_zones
    mapping = db.query(CitySubZone).filter(CitySubZone.city == city).first()
    if mapping:
        mapping.sub_zone_id = body.sub_zone_id
    else:
        db.add(CitySubZone(city=city, sub_zone_id=body.sub_zone_id))

    # Mettre à jour clients
    db.query(Client).filter(Client.city == city).update({"sub_zone": new_zone.code})

    # Mettre à jour interventions via leurs clients
    client_ids = [c.id for c in db.query(Client).filter(Client.city == city).all()]
    if client_ids:
        db.query(Intervention).filter(Intervention.client_id.in_(client_ids)).update(
            {"sub_zone": new_zone.code}, synchronize_session=False
        )

    db.commit()
    return {"ok": True, "city": city, "new_sub_zone": new_zone.code}
