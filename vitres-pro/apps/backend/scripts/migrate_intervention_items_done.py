"""
Migration : ajoute la colonne `done` sur intervention_items.

Permet de marquer une prestation comme non réalisée lors de la clôture d'une
intervention (voir endpoint PATCH /interventions/{id}/items-done), sans
toucher au label/prix/catalogue de l'item.

Idempotent, safe à relancer.

Usage:
    python scripts/migrate_intervention_items_done.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            conn.execute(text("""
                ALTER TABLE intervention_items
                ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT true;
            """))
            print("✅ Colonne done ajoutée sur intervention_items (ou déjà existante)")
            tx.commit()
            print("🎉 Migration terminée avec succès.")
        except Exception as e:
            tx.rollback()
            print(f"❌ Erreur : {e}")
            raise


if __name__ == "__main__":
    migrate()
