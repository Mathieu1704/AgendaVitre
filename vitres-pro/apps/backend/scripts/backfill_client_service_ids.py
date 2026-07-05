"""
Backfill : relie chaque intervention_item orphelin (client_service_id NULL) à un
client_service existant, ou en crée un nouveau si aucun ne correspond (find-or-create
par client_id + label normalisé). Sans ça, la prestation existe en base mais sa case
à cocher n'apparaît jamais côté frontend (add.tsx ne coche que via client_service_id).

Idempotent, safe à relancer (ne touche que les items où client_service_id IS NULL).

Usage:
    python scripts/backfill_client_service_ids.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import get_db, ClientService, InterventionItem, Intervention
from sqlalchemy.sql import func as sqlfunc


def backfill():
    db = next(get_db())

    orphans = (
        db.query(InterventionItem, Intervention.client_id)
        .join(Intervention, InterventionItem.intervention_id == Intervention.id)
        .filter(
            InterventionItem.client_service_id.is_(None),
            Intervention.client_id.isnot(None),
        )
        .all()
    )

    linked = 0
    created = 0
    for item, client_id in orphans:
        label = (item.label or "").strip()
        service = db.query(ClientService).filter(
            ClientService.client_id == client_id,
            sqlfunc.lower(sqlfunc.trim(ClientService.label)) == label.lower(),
        ).first()
        if not service:
            service = ClientService(client_id=client_id, label=label, price=item.price or 0)
            db.add(service)
            db.flush()
            created += 1
        item.client_service_id = service.id
        linked += 1

    db.commit()
    print(f"✅ {linked} intervention_items liés (dont {created} nouveaux client_services créés)")


if __name__ == "__main__":
    backfill()
