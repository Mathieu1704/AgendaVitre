"""
Migration : ajoute payment_mode sur interventions et backfill depuis is_invoice.
Lance depuis apps/backend/ avec : python scripts/migrate_payment_mode.py
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
                ALTER TABLE interventions
                ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'cash' NOT NULL;
            """))
            print("✅ Colonne payment_mode ajoutée")

            conn.execute(text("""
                UPDATE interventions SET payment_mode = 'invoice' WHERE is_invoice = true;
            """))
            conn.execute(text("""
                UPDATE interventions SET payment_mode = 'cash' WHERE is_invoice = false OR is_invoice IS NULL;
            """))

            r = conn.execute(text("SELECT payment_mode, COUNT(*) FROM interventions GROUP BY payment_mode"))
            for row in r:
                print(f"  {row[0]} : {row[1]} interventions")

            tx.commit()
            print("🎉 Migration payment_mode terminée.")
        except Exception as e:
            tx.rollback()
            print(f"❌ Erreur : {e}")
            raise

if __name__ == "__main__":
    migrate()
