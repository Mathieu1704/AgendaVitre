"""
Importe des événements structurés (JSON ChatGPT/Claude) dans la DB.

- Déduplique automatiquement les événements identiques (même date + summary + start_time)
  causés par la duplication Google Agenda (1 event par employé)
- Trouve ou crée le client par nom
- Crée l'Intervention + InterventionItems
- Assigne les employés depuis les raw events correspondants
- Marque tous les raw events du groupe comme "converted"

Usage:
    python scripts/import_structured.py scripts/export_2026-02-26.json
    python scripts/import_structured.py scripts/export_2026-02-26.json scripts/export_2026-02-27.json
"""
import sys
import json
import os
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import get_db, RawCalendarEvent, Client, Intervention, InterventionItem
from sqlalchemy.sql import func as sqlfunc
import pytz
import uuid

BRUSSELS_TZ = pytz.timezone("Europe/Brussels")


def load_events(file_paths: list[str]) -> list[dict]:
    all_events = []
    for fp in file_paths:
        with open(fp, encoding="utf-8") as f:
            events = json.load(f)
        all_events.extend(events)
        print(f"📂 {fp} : {len(events)} événements chargés")
    return all_events


def deduplicate(events: list[dict]) -> list[dict]:
    """
    Groupe les événements par (date, original_summary, start_time).
    Pour chaque groupe, garde un seul event mais accumule tous les google_ids.
    """
    groups: dict[tuple, dict] = {}
    google_ids_map: dict[tuple, list[str]] = defaultdict(list)

    for ev in events:
        key = (ev["date"], ev["original_summary"], ev["start_time"])
        if key not in groups:
            groups[key] = ev
        google_ids_map[key].append(ev["google_id"])

    result = []
    for key, ev in groups.items():
        ev = dict(ev)
        ev["_all_google_ids"] = google_ids_map[key]
        result.append(ev)

    n_dupes = len(events) - len(result)
    if n_dupes > 0:
        print(f"🔄 {n_dupes} doublon(s) fusionné(s) → {len(result)} événements uniques")
    return result


def import_event(db, ev: dict) -> str:
    """
    Importe un événement structuré. Retourne "created", "skipped" ou "error".
    """
    all_ids = ev.get("_all_google_ids", [ev["google_id"]])

    # Vérifier si déjà converti (au moins un des raw events)
    already_converted = (
        db.query(RawCalendarEvent)
        .filter(
            RawCalendarEvent.id.in_([uuid.UUID(gid) for gid in all_ids]),
            RawCalendarEvent.status == "converted",
        )
        .first()
    )
    if already_converted:
        return "skipped"

    # Récupérer les raw events correspondants pour leurs employés assignés
    raw_events = (
        db.query(RawCalendarEvent)
        .filter(RawCalendarEvent.id.in_([uuid.UUID(gid) for gid in all_ids]))
        .all()
    )

    # Collecter tous les employés uniques de tous les raw events du groupe
    employees = []
    seen_emp_ids = set()
    for raw_ev in raw_events:
        for emp in raw_ev.assigned_employees:
            if emp.id not in seen_emp_ids:
                employees.append(emp)
                seen_emp_ids.add(emp.id)

    # Trouver ou créer le client
    client_name = (ev.get("client_name") or "").strip()
    is_unknown = client_name.lower() == "client inconnu" or not client_name
    has_real_data = bool(ev.get("client_street") or ev.get("client_phone") or ev.get("client_city"))

    address_parts = [p for p in [ev.get("client_street"), ev.get("client_zip"), ev.get("client_city")] if p]
    address_str = ", ".join(address_parts) if address_parts else None

    if is_unknown:
        if has_real_data:
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
        else:
            client = None
    else:
        client = db.query(Client).filter(
            sqlfunc.lower(Client.name) == client_name.lower()
        ).first()
        if not client:
            client = Client(
                name=client_name,
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

    # Construire les datetimes Bruxelles → UTC
    date_str = ev["date"]
    start_naive = datetime.strptime(f"{date_str} {ev['start_time']}", "%Y-%m-%d %H:%M")
    end_naive = datetime.strptime(f"{date_str} {ev['end_time']}", "%Y-%m-%d %H:%M")
    start_dt = BRUSSELS_TZ.localize(start_naive).astimezone(pytz.utc)
    end_dt = BRUSSELS_TZ.localize(end_naive).astimezone(pytz.utc)

    # Créer l'intervention
    total = ev.get("total_price") or 0.0
    intervention = Intervention(
        title=ev.get("original_summary", ""),
        description=ev.get("full_description") or None,
        start_time=start_dt,
        end_time=end_dt,
        client_id=client.id if client else None,
        status="planned",
        is_invoice=ev.get("is_invoice", False),
        price_estimated=total if total else None,
    )
    for emp in employees:
        intervention.employees.append(emp)
    db.add(intervention)
    db.flush()

    # Créer les InterventionItems
    for svc in ev.get("services_json", []):
        db.add(InterventionItem(
            intervention_id=intervention.id,
            label=svc.get("description", ""),
            price=svc.get("price", 0.0),
        ))

    # Marquer tous les raw events comme convertis
    for raw_ev in raw_events:
        raw_ev.status = "converted"
        raw_ev.linked_intervention_id = intervention.id

    db.commit()
    return "created"


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_structured.py fichier1.json [fichier2.json ...]")
        sys.exit(1)

    file_paths = sys.argv[1:]

    # Résoudre les chemins relatifs par rapport à ce script
    script_dir = os.path.dirname(__file__)
    resolved = []
    for fp in file_paths:
        if not os.path.isabs(fp):
            candidate = os.path.join(script_dir, os.path.basename(fp))
            if os.path.exists(candidate):
                resolved.append(candidate)
            elif os.path.exists(fp):
                resolved.append(fp)
            else:
                print(f"❌ Fichier introuvable : {fp}")
                sys.exit(1)
        else:
            resolved.append(fp)

    events = load_events(resolved)
    events = deduplicate(events)

    db = next(get_db())
    created = skipped = errors = 0

    for ev in events:
        try:
            result = import_event(db, ev)
            if result == "created":
                created += 1
                print(f"  ✅ {ev['date']} | {ev['original_summary'][:50]}")
            else:
                skipped += 1
                print(f"  ⏭️  {ev['date']} | {ev['original_summary'][:50]} (déjà converti)")
        except Exception as e:
            errors += 1
            db.rollback()
            print(f"  ❌ {ev.get('date')} | {ev.get('original_summary', '')[:50]} → {e}")

    db.close()

    print(f"\n📊 Résultat : {created} créé(s), {skipped} ignoré(s), {errors} erreur(s)")


if __name__ == "__main__":
    main()
