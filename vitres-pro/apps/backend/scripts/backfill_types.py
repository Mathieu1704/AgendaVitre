"""
backfill_types.py — Met à jour le champ `type` des interventions en DB.

Règles (dans l'ordre de priorité) :
  1. "devis"   dans le titre → type = "devis"
  2. "tournée" / "tournee" dans le titre → type = "tournee"
  3. Pas de client OU client sans adresse ET sans nom → type = "note"
  4. Sinon → type = "intervention"

Usage:
    python scripts/backfill_types.py              # génère backfill_types_preview.json
    python scripts/backfill_types.py --apply      # applique en DB
"""

import sys, os, argparse, json
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.models.models import get_db, Intervention, Client

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
PREVIEW_OUT = os.path.join(BASE_DIR, "backfill_types_preview.json")


def infer_type(title: str, client) -> str:
    t = (title or "").lower()
    if "devis" in t:
        return "devis"
    if "tournée" in t or "tournee" in t:
        return "tournee"
    has_address = client and (client.address or client.name)
    if not has_address:
        return "note"
    return "intervention"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Applique les changements en DB")
    args = parser.parse_args()

    db = next(get_db())
    interventions = db.query(Intervention).all()
    print(f"\n📊 {len(interventions)} interventions en DB")

    changes = []
    counter_before = Counter()
    counter_after  = Counter()

    for iv in interventions:
        counter_before[iv.type or "intervention"] += 1
        new_type = infer_type(iv.title, iv.client)
        counter_after[new_type] += 1
        if (iv.type or "intervention") != new_type:
            changes.append({
                "id":        str(iv.id),
                "title":     iv.title,
                "type_avant": iv.type or "intervention",
                "type_apres": new_type,
                "client":    iv.client.name if iv.client else None,
                "address":   iv.client.address if iv.client else None,
            })

    print(f"\n📋 Distribution AVANT :")
    for t, n in sorted(counter_before.items()):
        print(f"   {t:15s} {n:4d}")

    print(f"\n📋 Distribution APRÈS :")
    for t, n in sorted(counter_after.items()):
        print(f"   {t:15s} {n:4d}")

    print(f"\n✏️  {len(changes)} modification(s)")

    if not args.apply:
        with open(PREVIEW_OUT, "w", encoding="utf-8") as f:
            json.dump(changes, f, ensure_ascii=False, indent=2, default=str)
        print(f"📁 Preview exporté → {PREVIEW_OUT}")
        print("   Vérifie le fichier puis relance avec --apply pour appliquer.")
    else:
        for iv in interventions:
            new_type = infer_type(iv.title, iv.client)
            iv.type = new_type
        db.commit()
        print(f"✅ {len(changes)} interventions mises à jour.")

    db.close()


if __name__ == "__main__":
    main()
