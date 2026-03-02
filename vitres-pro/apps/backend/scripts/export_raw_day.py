"""
Exporte les raw events d'un jour depuis la DB vers un fichier JSON,
prêt à coller dans ChatGPT/Claude pour structuration.

Usage:
    python scripts/export_raw_day.py 2026-02-26
    python scripts/export_raw_day.py 2026-02-26 2026-02-27   (plusieurs jours)
"""
import sys
import json
import os
from datetime import date

# Ajoute le dossier parent au path pour importer app.*
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import get_db, RawCalendarEvent
from sqlalchemy.sql import func as sqlfunc
import pytz

BRUSSELS_TZ = pytz.timezone("Europe/Brussels")


def export_day(date_str: str) -> list:
    target = date.fromisoformat(date_str)
    db = next(get_db())

    events = (
        db.query(RawCalendarEvent)
        .filter(
            sqlfunc.date(RawCalendarEvent.start_time) == target,
            RawCalendarEvent.status.in_(["raw", "assigned"]),
        )
        .order_by(RawCalendarEvent.start_time)
        .all()
    )

    result = []
    for e in events:
        start_bxl = e.start_time.astimezone(BRUSSELS_TZ) if e.start_time else None
        end_bxl = e.end_time.astimezone(BRUSSELS_TZ) if e.end_time else None

        result.append({
            "id": str(e.id),
            "summary": e.summary or "",
            "description": e.description or "",
            "location": e.location or "",
            "start": start_bxl.isoformat() if start_bxl else "",
            "end": end_bxl.isoformat() if end_bxl else "",
        })

    db.close()
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/export_raw_day.py YYYY-MM-DD [YYYY-MM-DD ...]")
        sys.exit(1)

    dates = sys.argv[1:]
    all_events = []

    for date_str in dates:
        try:
            events = export_day(date_str)
            all_events.extend(events)
            print(f"✅ {date_str} : {len(events)} événements")
        except Exception as e:
            print(f"❌ {date_str} : erreur — {e}")

    if not all_events:
        print("Aucun événement trouvé.")
        sys.exit(0)

    # Sauvegarde
    if len(dates) == 1:
        filename = f"raw_export_{dates[0]}.json"
    else:
        filename = f"raw_export_{dates[0]}_to_{dates[-1]}.json"

    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(all_events, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Fichier sauvegardé : scripts/{filename}")
    print(f"📋 Total : {len(all_events)} événements")
    print("\n👉 Copie le contenu du fichier et colle-le dans le prompt ChatGPT/Claude.")


if __name__ == "__main__":
    main()
