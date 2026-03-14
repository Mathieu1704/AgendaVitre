"""
build_review_json.py — Exporte les interventions DB par jour pour vérification par Gemini.

Seul "title" est le texte brut de Google Calendar.
"description", "services" et "price_estimated" sont des sorties GPT à vérifier.

But : que Gemini détecte les erreurs d'argent (services manquants, prix incorrects,
totaux faux) en comparant le title brut aux données structurées.

Usage:
    python scripts/build_review_json.py 2026-03-01 2026-03-31
    python scripts/build_review_json.py 2026-03-09          # jour unique
"""

import sys, os, json, datetime, pytz

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy.orm import selectinload
from app.models.models import get_db, Intervention, InterventionItem

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "review_output")
TZ         = pytz.timezone("Europe/Brussels")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/build_review_json.py 2026-03-01 [2026-03-31]")
        sys.exit(1)

    date_start = datetime.date.fromisoformat(sys.argv[1])
    date_end   = datetime.date.fromisoformat(sys.argv[2]) if len(sys.argv) >= 3 else date_start

    start_utc = TZ.localize(datetime.datetime.combine(date_start, datetime.time.min)).astimezone(pytz.utc)
    end_utc   = TZ.localize(datetime.datetime.combine(date_end + datetime.timedelta(days=1), datetime.time.min)).astimezone(pytz.utc)

    print(f"\n🔍 Export DB du {date_start} au {date_end}...\n")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    db   = next(get_db())
    rows = (
        db.query(Intervention)
        .options(selectinload(Intervention.items))
        .filter(Intervention.start_time >= start_utc)
        .filter(Intervention.start_time <  end_utc)
        .order_by(Intervention.start_time)
        .all()
    )
    db.close()

    by_day = {}
    for i in rows:
        start_local = i.start_time.astimezone(TZ)
        date_str    = start_local.strftime("%Y-%m-%d")
        by_day.setdefault(date_str, []).append({
            "google_event_id":  i.google_event_id or str(i.id),
            "start":            start_local.strftime("%H:%M"),
            "title":            i.title or "",           # ← brut Google Calendar
            "description_gpt":  i.description or "",    # ← sortie GPT
            "services_gpt":     [                        # ← sortie GPT
                {"label": it.label, "price": float(it.price)}
                for it in (i.items or [])
            ],
            "price_estimated":  float(i.price_estimated) if i.price_estimated is not None else None,
        })

    if not by_day:
        print("  Aucune intervention trouvée.")
        return

    for date_str in sorted(by_day.keys()):
        interventions = by_day[date_str]
        out = {"date": date_str, "nb": len(interventions), "interventions": interventions}
        out_path = os.path.join(OUTPUT_DIR, f"review_{date_str}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2, default=str)
        print(f"  ✅ {date_str} : {len(interventions)} interventions")

    print(f"\n📁 {len(by_day)} fichier(s) dans : {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
