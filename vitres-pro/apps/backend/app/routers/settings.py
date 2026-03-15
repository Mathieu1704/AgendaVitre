from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from app.models.models import get_db, SubZone, CitySubZone, Client, Intervention
from app.schemas.schemas import SubZoneOut
from app.core.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class LabelUpdate(BaseModel):
    label: str


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
