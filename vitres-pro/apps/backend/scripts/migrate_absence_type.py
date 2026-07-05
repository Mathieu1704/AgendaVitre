"""
Migration : renomme la colonne `reason` en `type` sur la table absences.

Le champ n'était utilisé nulle part (toujours envoyé en dur "Maladie" par le
mobile, jamais affiché ni lu ailleurs) — il devient le type d'absence choisi
par l'admin : Certificat, VA, RJF, CSS.

Idempotent, safe à relancer (skip si la colonne `type` existe déjà).

Usage:
    python scripts/migrate_absence_type.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            exists = conn.execute(text("""
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'absences' AND column_name = 'type'
            """)).first()
            if exists:
                print("✅ Colonne type déjà présente sur absences, rien à faire")
            else:
                conn.execute(text("ALTER TABLE absences RENAME COLUMN reason TO type;"))
                print("✅ Colonne reason renommée en type sur absences")
            tx.commit()
            print("🎉 Migration terminée avec succès.")
        except Exception as e:
            tx.rollback()
            print(f"❌ Erreur : {e}")
            raise


if __name__ == "__main__":
    migrate()
