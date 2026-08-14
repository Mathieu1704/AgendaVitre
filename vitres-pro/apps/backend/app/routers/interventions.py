from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql import func, or_
from typing import List, Literal, Optional
from uuid import UUID
from datetime import datetime, date
import math
import re
import uuid
from pydantic import BaseModel

from app.models.models import (
    get_db, Intervention, Client, Employee, InterventionItem,
    intervention_employees, RawCalendarEvent, AuditLog, InAppNotification,
    InterventionService
)
from app.schemas.schemas import (
    InterventionCreate, InterventionOut,
    InterventionServiceCreate, InterventionServiceOut, InterventionServiceUpdate,
)
from app.core.deps import get_current_user
from app.core.idempotency import already_processed, record_operation

router = APIRouter()

# Supplément "à la demande" par prestation : le prix de base (InterventionItem.price)
# reste inchangé, la majoration se calcule à la volée partout où un total est sommé.
# Arrondi au multiple de 5€ supérieur pour limiter la monnaie sur le terrain.
ON_DEMAND_MULTIPLIER = 1.33

def _item_effective_price(item) -> float:
    price = float(item.price)
    if not item.on_demand:
        return price
    return math.ceil((price * ON_DEMAND_MULTIPLIER) / 5) * 5

class BulkAssignBody(BaseModel):
    date: date
    sub_zone: str
    employee_ids: List[UUID] = []
    skip_assigned: bool = True

def is_admin(user_id: str, db: Session) -> bool:
    emp = db.query(Employee).filter(Employee.id == user_id).first()
    return emp.role == 'admin' if emp else False

def _strip_prices(interventions: List[Intervention]) -> None:
    """Neutralise les prix en mémoire (non commité) pour les sous-traitants,
    qui ne doivent jamais voir de montants."""
    for iv in interventions:
        iv.price_estimated = None
        iv.hourly_rate = None
        for item in iv.items:
            item.price = 0

def _load_intervention(intervention_id: UUID, db: Session) -> Intervention:
    return db.query(Intervention).options(
        selectinload(Intervention.client),
        selectinload(Intervention.employees),
        selectinload(Intervention.items),
        selectinload(Intervention.hourly_rate),
    ).filter(Intervention.id == intervention_id).first()


def _migrate_orphan_items_to_chain(db: Session, intervention: Intervention, chain_id) -> dict:
    """Convertit les items ad-hoc existants d'une intervention (label+prix
    seuls, sans catalogue) en entrées intervention_services au moment où sa
    chaîne de reprises est créée — sinon les prestations d'avant la migration
    restent pour toujours de simples items, jamais cochables.
    Retourne {label: InterventionService} pour relier aussi les items
    entrants qui portent le même libellé (voir appels ci-dessous)."""
    label_map = {}
    for idx, old_item in enumerate(list(intervention.items)):
        if old_item.client_service_id or old_item.intervention_service_id:
            continue
        svc = InterventionService(
            reprise_chain_id=chain_id,
            label=old_item.label,
            price=old_item.price,
            position=idx,
        )
        db.add(svc)
        db.flush()
        old_item.intervention_service_id = svc.id
        label_map[old_item.label] = svc
    return label_map

STATUS_LABELS = {
    "planned": "Planifiée",
    "in_progress": "En cours",
    "done": "Terminée",
    "cancelled": "Annulée",
}

FIELD_LABELS = {
    "title": "titre",
    "start_time": "date/heure de début",
    "end_time": "date/heure de fin",
    "status": "statut",
    "hourly_rate_id": "taux horaire",
    "price_estimated": "prix estimé",
    "price_real": "prix réel",
    "notes": "notes",
    "employee_ids": "employés assignés",
    "items": "prestations",
    "sub_zone": "sous-zone",
    "time_tbd": "heure à définir",
    "reprise_taken": "reprise RDV",
    "reprise_note": "note reprise",
    "payment_mode": "mode de paiement",
    "payment_collected": "encaissement",
    "type": "type",
    "zone": "zone",
    "client_id": "client",
}

def _add_audit(db: Session, action_type: str, employee_id, intervention_id=None, description="", metadata=None):
    log = AuditLog(
        action_type=action_type,
        employee_id=employee_id,
        intervention_id=intervention_id,
        description=description,
        metadata_=metadata or {},
    )
    db.add(log)


@router.get("", response_model=List[InterventionOut])
def read_interventions(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    query = db.query(Intervention).options(
        selectinload(Intervention.client),
        selectinload(Intervention.employees),
        selectinload(Intervention.items),
        selectinload(Intervention.hourly_rate),
    )
    if current_user.role != 'admin':
        query = query.filter(
            Intervention.zone == current_user.zone,
            Intervention.employees.any(id=current_user.id),
        )
    if start:
        try:
            query = query.filter(Intervention.start_time >= datetime.fromisoformat(start.replace("Z", "+00:00")))
        except ValueError:
            pass
    if end:
        try:
            query = query.filter(Intervention.start_time <= datetime.fromisoformat(end.replace("Z", "+00:00")))
        except ValueError:
            pass
    results = query.order_by(Intervention.start_time.asc()).all()
    if current_user.role == 'subcontractor':
        _strip_prices(results)
    return results


@router.get("/search", response_model=List[InterventionOut])
def search_interventions(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Mini moteur de recherche : nom, adresse ou téléphone (avec ou sans
    séparateurs) -> tout l'historique d'interventions qui s'y rapporte, que
    l'intervention soit rattachée à une fiche client ou non."""
    q = q.strip()
    digits = re.sub(r"\D", "", q)

    conditions = [
        Intervention.title.ilike(f"%{q}%"),
        Intervention.description.ilike(f"%{q}%"),
        Client.name.ilike(f"%{q}%"),
        Client.address.ilike(f"%{q}%"),
    ]
    if len(digits) >= 6:
        digits_only = lambda col: func.regexp_replace(func.coalesce(col, ""), r"\D", "", "g")
        conditions += [
            digits_only(Intervention.title).ilike(f"%{digits}%"),
            digits_only(Intervention.description).ilike(f"%{digits}%"),
            digits_only(Client.phone).ilike(f"%{digits}%"),
        ]

    query = (
        db.query(Intervention)
        .outerjoin(Client, Intervention.client_id == Client.id)
        .options(
            selectinload(Intervention.client),
            selectinload(Intervention.employees),
            selectinload(Intervention.items),
            selectinload(Intervention.hourly_rate),
        )
        .filter(or_(*conditions))
    )
    if current_user.role != 'admin':
        query = query.filter(
            Intervention.zone == current_user.zone,
            Intervention.employees.any(id=current_user.id),
        )
    results = query.order_by(Intervention.start_time.desc()).limit(200).all()
    if current_user.role == 'subcontractor':
        _strip_prices(results)
    return results


# --- INTERVENTION SERVICES (catalogue de prestations pour une intervention
# sans client, persistant par chaîne de reprises — miroir de client_services) ---

@router.get("/chain-services", response_model=List[InterventionServiceOut])
def get_intervention_services(
    reprise_chain_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == 'subcontractor':
        raise HTTPException(status_code=403, detail="Réservé aux admins et employés.")
    return (
        db.query(InterventionService)
        .filter(InterventionService.reprise_chain_id == reprise_chain_id)
        .order_by(InterventionService.position)
        .all()
    )


@router.post("/chain-services", response_model=InterventionServiceOut)
def create_intervention_service(
    payload: InterventionServiceCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == 'subcontractor':
        raise HTTPException(status_code=403, detail="Réservé aux admins et employés.")
    seen = already_processed(db, payload.client_operation_id)
    if seen is not None and seen.result_id:
        existing = db.query(InterventionService).filter(InterventionService.id == seen.result_id).first()
        if existing:
            return existing

    service = InterventionService(
        **payload.model_dump(exclude={"client_operation_id"}),
    )
    db.add(service)
    db.flush()

    record_operation(
        db, payload.client_operation_id, current_user.id,
        "POST /api/interventions/chain-services", service.id,
    )

    db.commit()
    db.refresh(service)
    return service


@router.patch("/chain-services/{service_id}", response_model=InterventionServiceOut)
def update_intervention_service(
    service_id: UUID,
    payload: InterventionServiceUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == 'subcontractor':
        raise HTTPException(status_code=403, detail="Réservé aux admins et employés.")
    service = db.query(InterventionService).filter(InterventionService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/chain-services/{service_id}", status_code=204)
def delete_intervention_service(
    service_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == 'subcontractor':
        raise HTTPException(status_code=403, detail="Réservé aux admins et employés.")
    service = db.query(InterventionService).filter(InterventionService.id == service_id).first()
    if not service:
        return
    db.delete(service)
    db.commit()


@router.get("/{intervention_id}", response_model=InterventionOut)
def read_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    intervention = _load_intervention(intervention_id, db)
    if not intervention:
        raise HTTPException(status_code=404, detail="Non trouvé")
    if current_user.role == 'subcontractor':
        _strip_prices([intervention])
    return intervention


@router.post("", response_model=InterventionOut)
def create_intervention(
    intervention: InterventionCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role == 'subcontractor':
        raise HTTPException(status_code=403, detail="Réservé aux admins et employés.")
    # Rejeu d'une operation hors-connexion deja traitee : on renvoie l'existante
    # au lieu d'en creer une seconde.
    seen = already_processed(db, intervention.client_operation_id)
    if seen is not None:
        existing = _load_intervention(seen.result_id, db) if seen.result_id else None
        if existing:
            return existing

    if intervention.client_id:
        client = db.query(Client).filter(Client.id == intervention.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")

    data = intervention.model_dump(
        exclude={"employee_ids", "items", "reprise_of_id", "client_operation_id"}
    )
    if current_user.role != 'admin':
        data["zone"] = current_user.zone
        data["type"] = "intervention"
        # En mode reprise, hériter le taux horaire de la source
        if intervention.reprise_of_id:
            source = db.query(Intervention).filter(Intervention.id == intervention.reprise_of_id).first()
            data["hourly_rate_id"] = source.hourly_rate_id if source else None
        else:
            data["hourly_rate_id"] = None
    new_intervention = Intervention(**data)
    if new_intervention.id is None:
        new_intervention.id = uuid.uuid4()

    # Chaîne de reprises : identité stable reliant une intervention sans
    # client à ses reprises suivantes (sert de catalogue "intervention_services").
    # Non pertinent quand il y a un client : client_id joue déjà ce rôle.
    chain_label_map = {}
    if not new_intervention.client_id:
        if intervention.reprise_of_id:
            source = db.query(Intervention).filter(Intervention.id == intervention.reprise_of_id).first()
            if source and not source.client_id:
                if not source.reprise_chain_id:
                    source.reprise_chain_id = source.id
                # Migre les prestations ad-hoc encore orphelines de la source
                # (typiquement celles de sa toute première création, avant que
                # sa propre chaîne n'existe) — indépendant du fait que la
                # chaîne existait déjà ou vient d'être assignée ci-dessus.
                chain_label_map = _migrate_orphan_items_to_chain(
                    db, source, source.reprise_chain_id,
                )
                new_intervention.reprise_chain_id = source.reprise_chain_id
        if not new_intervention.reprise_chain_id:
            new_intervention.reprise_chain_id = new_intervention.id

    if current_user.role != 'admin':
        employee = db.query(Employee).filter(Employee.id == current_user.id).first()
        new_intervention.employees = [employee] if employee else []
    elif intervention.employee_ids:
        employees = db.query(Employee).filter(Employee.id.in_(intervention.employee_ids)).all()
        new_intervention.employees = employees

    total_price = 0
    if intervention.items:
        for item_data in intervention.items:
            intervention_service_id = item_data.intervention_service_id
            if (
                not item_data.client_service_id
                and not intervention_service_id
                and item_data.label in chain_label_map
            ):
                # Item ad-hoc de reprise dont le libellé correspond à un
                # service tout juste migré depuis la source : on le relie
                # directement plutôt que de recréer un doublon "orphelin".
                intervention_service_id = chain_label_map[item_data.label].id
            new_item = InterventionItem(
                label=item_data.label,
                price=item_data.price,
                client_service_id=item_data.client_service_id,
                intervention_service_id=intervention_service_id,
                on_demand=item_data.on_demand,
            )
            new_intervention.items.append(new_item)
            total_price += _item_effective_price(item_data)

    if not new_intervention.price_estimated or new_intervention.price_estimated == 0:
        new_intervention.price_estimated = total_price

    db.add(new_intervention)
    db.flush()  # pour avoir l'id avant le commit

    _add_audit(
        db, "created", current_user.id, new_intervention.id,
        f"Créée: {new_intervention.title}",
        {"title": new_intervention.title},
    )

    # Journalise dans la MEME transaction que la creation : un crash entre les
    # deux laisserait une intervention sans trace, que le rejeu dupliquerait.
    record_operation(
        db, intervention.client_operation_id, current_user.id,
        "POST /api/interventions", new_intervention.id,
    )

    db.commit()
    db.refresh(new_intervention)
    return new_intervention


@router.patch("/bulk-assign")
def bulk_assign_employees(
    body: BulkAssignBody,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Assigne des employés à toutes les interventions d'une sous-zone pour un jour donné.
    skip_assigned=True (défaut) : saute les interventions qui ont déjà des employés assignés."""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Réservé aux admins.")
    interventions = db.query(Intervention).options(selectinload(Intervention.employees)).filter(
        func.date(Intervention.start_time) == body.date,
        Intervention.sub_zone == body.sub_zone,
    ).all()

    employees = db.query(Employee).filter(Employee.id.in_(body.employee_ids)).all()

    updated = 0
    for intervention in interventions:
        if body.skip_assigned and len(intervention.employees) > 0:
            continue
        intervention.employees = employees
        updated += 1

    db.commit()
    return {"ok": True, "updated": updated, "skipped": len(interventions) - updated}


@router.patch("/{intervention_id}", response_model=InterventionOut)
def update_intervention(
    intervention_id: UUID,
    intervention_update: dict,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    # Backfill paresseux : une intervention sans client créée avant ce champ
    # n'a pas de reprise_chain_id. On lui en attribue un dès la première
    # modification pour qu'elle puisse avoir un catalogue de services persistant.
    # On migre aussi ses prestations ad-hoc encore orphelines (typiquement
    # celles de sa toute première création) — indépendamment du fait que la
    # chaîne existait déjà ou vient d'être assignée ci-dessus.
    update_label_map = {}
    if not db_intervention.client_id:
        if not db_intervention.reprise_chain_id:
            db_intervention.reprise_chain_id = db_intervention.id
        update_label_map = _migrate_orphan_items_to_chain(
            db, db_intervention, db_intervention.reprise_chain_id,
        )

    # Filtrage des champs autorisés pour les non-admins. Un sous-traitant ne
    # touche jamais aux horaires/prix/reprise — seulement le statut et les
    # heures réelles de passage.
    if current_user.role == 'subcontractor':
        SUBCONTRACTOR_ALLOWED = {"status", "real_start_time", "real_end_time"}
        intervention_update = {k: v for k, v in intervention_update.items() if k in SUBCONTRACTOR_ALLOWED}
    elif current_user.role != 'admin':
        EMPLOYEE_ALLOWED = {"status", "real_start_time", "real_end_time", "reprise_taken", "reprise_note", "title", "start_time", "end_time", "payment_mode", "is_invoice"}
        intervention_update = {k: v for k, v in intervention_update.items() if k in EMPLOYEE_ALLOWED}

    old_status = db_intervention.status

    # Si l'admin fixe une vraie heure, lever le flag time_tbd en avance
    # (la boucle ci-dessous peut le remettre à True si time_tbd est explicitement envoyé)
    if "start_time" in intervention_update or "end_time" in intervention_update:
        db_intervention.time_tbd = False

    for key, value in intervention_update.items():
        if key == "employee_ids":
            employees = db.query(Employee).filter(Employee.id.in_(value)).all()
            db_intervention.employees = employees
        elif key == "items":
            db.query(InterventionItem).filter(InterventionItem.intervention_id == intervention_id).delete()
            for item_data in value:
                intervention_service_id = item_data.get("intervention_service_id")
                if (
                    not item_data.get("client_service_id")
                    and not intervention_service_id
                    and item_data["label"] in update_label_map
                ):
                    intervention_service_id = update_label_map[item_data["label"]].id
                db.add(InterventionItem(
                    intervention_id=intervention_id,
                    label=item_data["label"],
                    price=item_data["price"],
                    client_service_id=item_data.get("client_service_id"),
                    intervention_service_id=intervention_service_id,
                    on_demand=item_data.get("on_demand", False),
                ))
        elif hasattr(db_intervention, key):
            setattr(db_intervention, key, value)

    # Audit log
    new_status = intervention_update.get("status")
    if new_status and new_status != old_status:
        old_label = STATUS_LABELS.get(old_status, old_status)
        new_label = STATUS_LABELS.get(new_status, new_status)
        _add_audit(
            db, "status_change", current_user.id, intervention_id,
            f"Statut : {old_label} → {new_label}",
            {"old_status": old_status, "new_status": new_status},
        )
    else:
        changed = [k for k in intervention_update if k not in ("real_start_time", "real_end_time")]
        if changed:
            changed_labels = [FIELD_LABELS.get(k, k) for k in changed]
            _add_audit(
                db, "modified", current_user.id, intervention_id,
                f"Modifiée : {', '.join(changed_labels)}",
                {"fields": changed},
            )

    db.commit()
    db.refresh(db_intervention)
    if current_user.role == 'subcontractor':
        _strip_prices([db_intervention])
    return db_intervention


class RecurrenceScopeBody(BaseModel):
    scope: Literal["following", "all"]
    fields: dict  # sous-ensemble de champs à propager (jamais start_time/end_time/time_tbd)


# Champs ignorés même s'ils sont présents dans le body : chaque occurrence
# garde sa propre date/heure et son propre statut/historique.
RECURRENCE_SCOPE_FORBIDDEN_KEYS = {
    "start_time", "end_time", "time_tbd", "status",
    "reprise_taken", "reprise_note", "recurrence_rule", "recurrence_group_id",
}


@router.patch("/{intervention_id}/recurrence-scope")
def update_intervention_recurrence_scope(
    intervention_id: UUID,
    body: RecurrenceScopeBody,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Propage un changement (hors horaires) à toute une série récurrente, ou
    à cette occurrence et celles qui suivent — voir `update_intervention` pour
    l'édition d'une seule occurrence."""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Réservé aux admins.")
    anchor = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not anchor or not anchor.recurrence_group_id:
        raise HTTPException(status_code=404, detail="Intervention introuvable ou hors série")

    fields = {k: v for k, v in body.fields.items() if k not in RECURRENCE_SCOPE_FORBIDDEN_KEYS}

    query = db.query(Intervention).filter(Intervention.recurrence_group_id == anchor.recurrence_group_id)
    if body.scope == "following":
        query = query.filter(Intervention.start_time >= anchor.start_time)
    targets = query.all()

    updated = 0
    for target in targets:
        for key, value in fields.items():
            if key == "employee_ids":
                target.employees = db.query(Employee).filter(Employee.id.in_(value)).all()
            elif key == "items":
                db.query(InterventionItem).filter(InterventionItem.intervention_id == target.id).delete()
                for item_data in value:
                    db.add(InterventionItem(
                        intervention_id=target.id,
                        label=item_data["label"],
                        price=item_data["price"],
                        client_service_id=item_data.get("client_service_id"),
                        intervention_service_id=item_data.get("intervention_service_id"),
                        on_demand=item_data.get("on_demand", False),
                    ))
            elif hasattr(target, key):
                setattr(target, key, value)
        updated += 1

    _add_audit(
        db, "modified", current_user.id, intervention_id,
        f"Modifiée en série ({'toutes' if body.scope == 'all' else 'celle-ci et les suivantes'}) : {updated} occurrence(s)",
        {"scope": body.scope, "fields": list(fields.keys()), "count": updated},
    )
    db.commit()
    return {"ok": True, "updated": updated}


class NewAdjustmentItem(BaseModel):
    label: str
    price: float  # négatif = déduction partielle, positif = supplément


class ItemsDoneBody(BaseModel):
    not_done_item_ids: List[UUID] = []
    new_items: List[NewAdjustmentItem] = []


@router.patch("/{intervention_id}/items-done", response_model=InterventionOut)
def update_items_done(
    intervention_id: UUID,
    body: ItemsDoneBody,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Marque certaines prestations comme non faites lors de la clôture d'une
    intervention, ajoute d'éventuels ajustements ad-hoc (déduction partielle
    ou supplément imprévu) et recalcule price_estimated en conséquence."""
    db_intervention = _load_intervention(intervention_id, db)
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    valid_ids = {item.id for item in db_intervention.items}
    not_done_ids = valid_ids.intersection(set(body.not_done_item_ids))

    for item in db_intervention.items:
        item.done = item.id not in not_done_ids

    new_rows = [
        InterventionItem(
            intervention_id=intervention_id,
            label=adj.label,
            price=adj.price,
            done=True,
            on_demand=False,
            is_adjustment=True,
        )
        for adj in body.new_items
    ]
    for row in new_rows:
        db.add(row)

    db_intervention.price_estimated = sum(
        _item_effective_price(item) for item in db_intervention.items if item.done
    ) + sum(float(row.price) for row in new_rows)

    _add_audit(
        db, "items_adjusted", current_user.id, intervention_id,
        f"Prestations ajustées : {len(not_done_ids)} non faite(s), {len(new_rows)} ajustement(s)",
        {
            "not_done_item_ids": [str(i) for i in not_done_ids],
            "new_items": [{"label": adj.label, "price": adj.price} for adj in body.new_items],
            "new_price_estimated": db_intervention.price_estimated,
        },
    )

    db.commit()
    db.refresh(db_intervention)
    if current_user.role == 'subcontractor':
        _strip_prices([db_intervention])
    return db_intervention


@router.delete("/{intervention_id}")
def delete_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Seul un admin peut supprimer.")

    db_intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not db_intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    title = db_intervention.title
    db.query(RawCalendarEvent).filter(
        RawCalendarEvent.linked_intervention_id == intervention_id
    ).update({"linked_intervention_id": None, "status": "pending"})

    _add_audit(
        db, "deleted", current_user.id, None,
        f"Supprimée: {title}",
        {"title": title, "intervention_id": str(intervention_id)},
    )

    db.delete(db_intervention)
    db.commit()
    return {"message": "Intervention supprimée"}


@router.delete("/{intervention_id}/recurrence-scope")
def delete_intervention_recurrence_scope(
    intervention_id: UUID,
    scope: Literal["following", "all"],
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Supprime toute une série récurrente, ou cette occurrence et celles qui
    suivent — voir `delete_intervention` pour une seule occurrence."""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Seul un admin peut supprimer.")

    anchor = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not anchor or not anchor.recurrence_group_id:
        raise HTTPException(status_code=404, detail="Intervention introuvable ou hors série")

    query = db.query(Intervention).filter(Intervention.recurrence_group_id == anchor.recurrence_group_id)
    if scope == "following":
        query = query.filter(Intervention.start_time >= anchor.start_time)
    targets = query.all()
    ids = [t.id for t in targets]

    db.query(RawCalendarEvent).filter(
        RawCalendarEvent.linked_intervention_id.in_(ids)
    ).update({"linked_intervention_id": None, "status": "pending"}, synchronize_session=False)

    _add_audit(
        db, "deleted", current_user.id, None,
        f"Supprimée en série ({'toutes' if scope == 'all' else 'celle-ci et les suivantes'}) : {len(ids)} occurrence(s)",
        {"scope": scope, "count": len(ids), "intervention_ids": [str(i) for i in ids]},
    )

    for target in targets:
        db.delete(target)
    db.commit()
    return {"ok": True, "deleted": len(ids)}


@router.post("/{intervention_id}/no-reprise")
def no_reprise(
    intervention_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Marque l'intervention comme terminée sans reprise de RDV + notifie les admins."""
    from datetime import datetime, timezone

    # Rejeu d'une operation hors-connexion : sans cette garde, chaque nouvelle
    # tentative renverrait une notification a tous les admins.
    op_id = payload.get("client_operation_id")
    op_uuid = UUID(op_id) if isinstance(op_id, str) else op_id
    if already_processed(db, op_uuid) is not None:
        return {"message": "ok", "replayed": True}

    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Introuvable")

    note = payload.get("note", "").strip()
    now = datetime.now(timezone.utc)

    intervention.status = "done"
    intervention.reprise_taken = False
    intervention.reprise_note = note if note else None

    emp_name = current_user.full_name or current_user.email or "Un employé"
    description = f"{emp_name} n'a pas repris de RDV pour '{intervention.title}'"
    if note:
        description += f" — {note}"

    _add_audit(
        db, "no_reprise", current_user.id, intervention_id,
        description,
        {"note": note, "intervention_title": intervention.title},
    )

    # Notifier tous les admins
    admins = db.query(Employee).filter(Employee.role == "admin").all()
    for admin in admins:
        notif = InAppNotification(
            recipient_id=admin.id,
            type="no_reprise",
            title="RDV non repris",
            message=description,
            metadata_={
                "intervention_id": str(intervention_id),
                "employee_id": str(current_user.id),
                "intervention_title": intervention.title,
            },
        )
        db.add(notif)

    record_operation(
        db, op_uuid, current_user.id,
        f"POST /api/interventions/{intervention_id}/no-reprise", intervention_id,
    )

    db.commit()
    return {"message": "ok"}
