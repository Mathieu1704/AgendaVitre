"""
Backfill : crée des clients anonymes (name=None) pour les interventions existantes
importées avec "Client Inconnu" mais qui ont de vraies données dans le JSON.

À exécuter UNE FOIS après avoir fait la migration SQL :
    ALTER TABLE clients ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE clients ALTER COLUMN address DROP NOT NULL;

Usage:
    python scripts/backfill_anonymous_clients.py scripts/export_2026-02-27.json
    python scripts/backfill_anonymous_clients.py scripts/export_2026-02-26.json scripts/export_2026-02-27.json
"""
import sys
import os
import json
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import get_db, RawCalendarEvent, Client, Intervention


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/backfill_anonymous_clients.py fichier.json [...]")
        sys.exit(1)

    all_events = []
    for fp in sys.argv[1:]:
        script_dir = os.path.dirname(__file__)
        if not os.path.isabs(fp):
            candidate = os.path.join(script_dir, os.path.basename(fp))
            fp = candidate if os.path.exists(candidate) else fp
        with open(fp, encoding="utf-8") as f:
            events = json.load(f)
        all_events.extend(events)
        print(f"📂 {fp} : {len(events)} événements chargés")

    db = next(get_db())
    fixed = skipped = errors = 0

    for ev in all_events:
        client_name = (ev.get("client_name") or "").strip()
        if client_name.lower() != "client inconnu":
            continue

        has_real_data = bool(ev.get("client_street") or ev.get("client_phone") or ev.get("client_city"))
        if not has_real_data:
            skipped += 1
            continue

        try:
            google_id = ev["google_id"]
            raw_ev = db.query(RawCalendarEvent).filter(
                RawCalendarEvent.id == uuid.UUID(google_id)
            ).first()

            if not raw_ev or not raw_ev.linked_intervention_id:
                print(f"  ⏭️  {ev['date']} | Pas d'intervention liée pour {google_id[:8]}…")
                skipped += 1
                continue

            intervention = db.query(Intervention).filter(
                Intervention.id == raw_ev.linked_intervention_id
            ).first()

            if not intervention:
                skipped += 1
                continue

            # Déjà un client anonyme (name=None) → skip
            if intervention.client and intervention.client.name is None:
                print(f"  ✅ Déjà anonymisé : {ev['original_summary'][:50]}")
                skipped += 1
                continue

            # Créer le client anonyme avec les vraies données
            address_parts = [p for p in [ev.get("client_street"), ev.get("client_zip"), ev.get("client_city")] if p]
            address_str = ", ".join(address_parts) if address_parts else None

            client = Client(
                name=None,
                street=ev.get("client_street") or None,
                zip_code=ev.get("client_zip") or None,
                city=ev.get("client_city") or None,
                address=address_str,
                phone=ev.get("client_phone") or None,
                email=ev.get("client_email") or None,
                notes=ev.get("client_notes") or None,
            )
            db.add(client)
            db.flush()

            intervention.client_id = client.id
            db.commit()

            print(f"  ✅ {ev['date']} | {ev['original_summary'][:60]}")
            fixed += 1

        except Exception as e:
            errors += 1
            db.rollback()
            print(f"  ❌ {ev.get('date')} | {ev.get('original_summary', '')[:50]} → {e}")

    db.close()
    print(f"\n📊 Résultat : {fixed} corrigé(s), {skipped} ignoré(s), {errors} erreur(s)")


if __name__ == "__main__":
    main()
