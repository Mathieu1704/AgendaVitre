"""
Importe des événements structurés (JSON export_done/) dans la DB.

- Étend les événements récurrents (RRULE) jusqu'à leur date UNTIL
- Déduplique par (date, original_summary, start_time)
- Trouve ou crée le client par nom
- Crée l'Intervention + InterventionItems

Usage:
    python scripts/import_structured.py scripts/export_done/*.json
"""
import sys
import json
import os
from datetime import datetime, date as date_type
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import get_db, Client, Intervention, InterventionItem
from sqlalchemy.sql import func as sqlfunc
import pytz
import uuid

from dateutil.rrule import rrulestr

BRUSSELS_TZ = pytz.timezone("Europe/Brussels")
FALLBACK_UNTIL = date_type(2026, 12, 31)


def normalize_event(ev: dict) -> dict:
    """Normalise le format brut Google Calendar vers le format structuré."""
    if "date" in ev:
        return ev  # Déjà structuré
    import re
    # Format brut : summary, start (ISO datetime), end, google_event_id, recurrence_rule
    start_str = ev.get("start", "")
    end_str   = ev.get("end", "")
    sm = re.match(r"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})", start_str)
    em = re.match(r"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})", end_str)
    return {
        "original_summary": ev.get("summary", ""),
        "date":             sm.group(1) if sm else "",
        "client_name":      "",
        "client_street":    "",
        "client_zip":       "",
        "client_city":      "",
        "client_phone":     "",
        "client_email":     "",
        "client_notes":     "",
        "start_time":       sm.group(2) if sm else "00:00",
        "end_time":         em.group(2) if em else "00:00",
        "is_invoice":       False,
        "total_price":      0.0,
        "full_description": ev.get("description", ""),
        "services_json":    [],
        "google_event_id":  ev.get("google_event_id", ""),
        "recurrence_rule":  ev.get("recurrence_rule"),
    }


def load_events(file_paths: list[str]) -> list[dict]:
    all_events = []
    for fp in file_paths:
        with open(fp, encoding="utf-8") as f:
            events = json.load(f)
        zone = "ardennes" if "ardennes" in os.path.basename(fp) else "hainaut"
        normalized = [normalize_event(ev) for ev in events]
        for ev in normalized:
            ev["_zone"] = zone
        all_events.extend(normalized)
        print(f"  📂 {os.path.basename(fp)} : {len(events)} événements [{zone}]")
    return all_events


def expand_recurrences(events: list[dict]) -> list[dict]:
    """Expand recurring events (RRULE) into individual occurrences."""
    result = []
    expanded_count = 0

    for ev in events:
        rule_str = ev.get("recurrence_rule")
        if not rule_str:
            result.append(ev)
            continue

        orig_start = datetime.strptime(f"{ev['date']} {ev['start_time']}", "%Y-%m-%d %H:%M")
        orig_end   = datetime.strptime(f"{ev['date']} {ev['end_time']}",   "%Y-%m-%d %H:%M")
        duration   = orig_end - orig_start

        try:
            rule = rrulestr(rule_str, dtstart=orig_start, ignoretz=True)
            occurrences = []
            for i, occ in enumerate(rule):
                if occ.date() > FALLBACK_UNTIL:
                    break
                new_ev = dict(ev)
                new_ev["date"]       = occ.strftime("%Y-%m-%d")
                new_ev["start_time"] = occ.strftime("%H:%M")
                new_ev["end_time"]   = (occ + duration).strftime("%H:%M")
                # Seule la première occurrence garde le google_event_id (contrainte UNIQUE)
                if i > 0:
                    new_ev["google_event_id"] = None
                occurrences.append(new_ev)

            if occurrences:
                expanded_count += len(occurrences) - 1
                result.extend(occurrences)
            else:
                result.append(ev)

        except Exception as e:
            print(f"  ⚠️  RRULE invalide pour '{ev.get('original_summary', '')}': {e}")
            result.append(ev)

    if expanded_count > 0:
        print(f"  🔄 {expanded_count} occurrences supplémentaires générées depuis les récurrences")

    return result


def deduplicate(events: list[dict]) -> list[dict]:
    """Déduplique par (date, original_summary, start_time)."""
    groups: dict[tuple, dict] = {}
    for ev in events:
        key = (ev["date"], ev["original_summary"], ev["start_time"])
        if key not in groups:
            groups[key] = ev
    result = list(groups.values())
    n_dupes = len(events) - len(result)
    if n_dupes > 0:
        print(f"  🔄 {n_dupes} doublon(s) fusionné(s) → {len(result)} événements uniques")
    return result


def import_event(db, ev: dict) -> str:
    """Importe un événement structuré. Retourne 'created', 'skipped' ou 'error'."""

    # Vérifier si déjà importé — même clé que la déduplication : (titre, date Brussels, heure début)
    _date_str  = ev["date"]
    _start_utc = BRUSSELS_TZ.localize(
        datetime.strptime(f"{_date_str} {ev['start_time']}", "%Y-%m-%d %H:%M")
    ).astimezone(pytz.utc)
    already_exists = db.query(Intervention).filter(
        Intervention.title == ev.get("original_summary", ""),
        Intervention.start_time == _start_utc,
    ).first()
    if already_exists:
        return "skipped"

    # Trouver ou créer le client
    client_name = (ev.get("client_name") or "").strip()
    is_unknown = client_name.lower() == "client inconnu" or not client_name
    has_real_data = bool(ev.get("client_street") or ev.get("client_phone") or ev.get("client_city"))

    address_parts = [p for p in [ev.get("client_street"), ev.get("client_zip"), ev.get("client_city")] if p]
    address_str = ", ".join(address_parts) if address_parts else None

    if is_unknown:
        if has_real_data:
            # Chercher un client existant avec les mêmes infos avant d'en créer un
            lookup = db.query(Client).filter(Client.name == None)
            if ev.get("client_street"):
                lookup = lookup.filter(sqlfunc.lower(Client.street) == ev["client_street"].lower())
            if ev.get("client_city"):
                lookup = lookup.filter(sqlfunc.lower(Client.city) == ev["client_city"].lower())
            if ev.get("client_phone"):
                lookup = lookup.filter(Client.phone == ev["client_phone"])
            client = lookup.first()
            if not client:
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
            # Client sans aucune info utile : chercher par ville seule
            city_val = ev.get("client_city") or None
            if city_val:
                client = db.query(Client).filter(
                    Client.name == None,
                    Client.address == None,
                    sqlfunc.lower(Client.city) == city_val.lower(),
                ).first()
                if not client:
                    client = Client(city=city_val)
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
    end_naive   = datetime.strptime(f"{date_str} {ev['end_time']}",   "%Y-%m-%d %H:%M")
    start_dt = BRUSSELS_TZ.localize(start_naive).astimezone(pytz.utc)
    end_dt   = BRUSSELS_TZ.localize(end_naive).astimezone(pytz.utc)

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
        zone=ev.get("_zone") or "hainaut",
        google_event_id=ev.get("google_event_id") or None,
    )
    db.add(intervention)
    db.flush()

    # Créer les InterventionItems
    for svc in ev.get("services_json", []):
        db.add(InterventionItem(
            intervention_id=intervention.id,
            label=svc.get("description", ""),
            price=svc.get("price", 0.0),
        ))

    db.commit()
    return "created"


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_structured.py fichier1.json [fichier2.json ...]")
        sys.exit(1)

    file_paths = sys.argv[1:]

    # Résoudre les chemins
    script_dir = os.path.dirname(__file__)
    resolved = []
    for fp in file_paths:
        if os.path.exists(fp):
            resolved.append(fp)
        else:
            candidate = os.path.join(script_dir, os.path.basename(fp))
            if os.path.exists(candidate):
                resolved.append(candidate)
            else:
                print(f"❌ Fichier introuvable : {fp}")
                sys.exit(1)

    print(f"\n📂 Chargement de {len(resolved)} fichier(s)...\n")
    events = load_events(resolved)
    print(f"\n  Total brut : {len(events)} événements")

    print("\n🔄 Expansion des récurrences...")
    events = expand_recurrences(events)

    print("\n🔄 Déduplication...")
    events = deduplicate(events)
    print(f"  → {len(events)} événements à importer\n")

    db = next(get_db())
    created = skipped = errors = 0

    print("⬆️  Import en cours...\n")
    for ev in events:
        try:
            result = import_event(db, ev)
            if result == "created":
                created += 1
                print(f"  ✅ {ev['date']} | {ev['original_summary'][:60]}")
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            db.rollback()
            print(f"  ❌ {ev.get('date')} | {ev.get('original_summary', '')[:60]} → {e}")

    db.close()

    print(f"\n{'='*60}")
    print(f"  ✅ {created} créé(s)   ⏭  {skipped} ignoré(s)   ❌ {errors} erreur(s)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
