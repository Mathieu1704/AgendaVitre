"""
Migration : ajoute la colonne `type` sur la table `interventions`.

Usage:
    python scripts/add_intervention_type.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Vérifie si la colonne existe déjà
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='interventions' AND column_name='type'
        """))
        if result.fetchone():
            print("✅ Colonne 'type' déjà présente — rien à faire.")
            return

        conn.execute(text("""
            ALTER TABLE interventions
            ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'intervention'
        """))
        conn.commit()
        print("✅ Colonne 'type' ajoutée avec succès.")
        print("   Valeur par défaut : 'intervention' pour tous les enregistrements existants.")

if __name__ == "__main__":
    run()
