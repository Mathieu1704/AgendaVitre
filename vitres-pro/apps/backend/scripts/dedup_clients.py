"""
dedup_clients.py — Déduplique les clients en DB.

Fusionne les clients qui ont exactement les mêmes (name, address, city, phone).

Usage:
    python scripts/dedup_clients.py              # génère dedup_preview.json
    python scripts/dedup_clients.py --apply      # applique les changements
"""

import sys, os, argparse, json
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.models.models import get_db, Client, Intervention

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
PREVIEW_OUT = os.path.join(BASE_DIR, "dedup_preview.json")


def normalize(value):
    return (value or "").lower().strip()


def make_key(client):
    return (
        normalize(client.name),
        normalize(client.address),
        normalize(client.city),
        normalize(client.phone),
    )


def completeness(client):
    fields = [client.name, client.address, client.city, client.phone,
              client.email, client.street, client.zip_code, client.notes]
    return sum(1 for f in fields if f)


def client_to_dict(c):
    return {
        "id":      str(c.id),
        "name":    c.name,
        "address": c.address,
        "city":    c.city,
        "phone":   c.phone,
        "email":   c.email,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Appliquer les changements (par défaut : génère dedup_preview.json)")
    args = parser.parse_args()

    db = next(get_db())

    all_clients = db.query(Client).all()
    print(f"\n📊 {len(all_clients)} clients en DB")

    groups = defaultdict(list)
    for c in all_clients:
        groups[make_key(c)].append(c)

    duplicates_groups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"🔍 {len(duplicates_groups)} groupe(s) de doublons\n")

    preview = []
    total_delete = 0
    total_reassign = 0

    for key, clients in sorted(duplicates_groups.items(), key=lambda x: -len(x[1])):
        canonical = max(clients, key=lambda c: (
            completeness(c),
            -(c.created_at.timestamp() if c.created_at else 0)
        ))
        duplicates = [c for c in clients if c.id != canonical.id]

        dup_interventions = []
        for dup in duplicates:
            intervs = db.query(Intervention).filter(Intervention.client_id == dup.id).all()
            for i in intervs:
                dup_interventions.append({
                    "intervention_id": str(i.id),
                    "title":           i.title,
                    "from_client_id":  str(dup.id),
                })

        entry = {
            "nb_duplicates":    len(duplicates),
            "canonical":        client_to_dict(canonical),
            "to_delete":        [client_to_dict(d) for d in duplicates],
            "interventions_reassigned": dup_interventions,
        }
        preview.append(entry)
        total_delete   += len(duplicates)
        total_reassign += len(dup_interventions)

        if args.apply:
            for dup in duplicates:
                db.query(Intervention).filter(
                    Intervention.client_id == dup.id
                ).update({"client_id": canonical.id})
            for dup in duplicates:
                db.delete(dup)

    print(f"📋 {total_delete} client(s) à supprimer, {total_reassign} intervention(s) à réassigner")

    if args.apply:
        db.commit()
        remaining = db.query(Client).count()
        print(f"✅ Terminé — {remaining} clients restants en DB.")
    else:
        with open(PREVIEW_OUT, "w", encoding="utf-8") as f:
            json.dump(preview, f, ensure_ascii=False, indent=2, default=str)
        print(f"📁 Aperçu exporté → {PREVIEW_OUT}")
        print("   Vérifie le fichier puis relance avec --apply pour appliquer.")

    db.close()


if __name__ == "__main__":
    main()
