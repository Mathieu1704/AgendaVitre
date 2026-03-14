"""
Migration : ajoute la table client_services + backfill depuis les intervention_items existants.

Ce que ça fait :
1. Crée la table client_services
2. Ajoute client_service_id sur intervention_items
3. Backfill : pour chaque (client_id, label) unique dans les items existants,
   crée un client_service (prix = dernier prix connu), puis lie tous les items concernés.

Lance depuis apps/backend/ avec : python scripts/migrate_client_services.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            # 1. Créer la table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS client_services (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                    label VARCHAR NOT NULL,
                    price NUMERIC(10,2) NOT NULL DEFAULT 0,
                    position FLOAT DEFAULT 0
                );
            """))
            print("✅ Table client_services créée (ou déjà existante)")

            # 2. Ajouter la colonne FK sur intervention_items
            conn.execute(text("""
                ALTER TABLE intervention_items
                ADD COLUMN IF NOT EXISTS client_service_id UUID
                    REFERENCES client_services(id) ON DELETE SET NULL;
            """))
            print("✅ Colonne client_service_id ajoutée sur intervention_items")

            # 3. Backfill : créer un client_service par (client_id, label) unique
            #    Prix = celui de l'intervention la plus récente pour ce label
            conn.execute(text("""
                INSERT INTO client_services (id, client_id, label, price, position)
                SELECT
                    gen_random_uuid(),
                    sub.client_id,
                    sub.label,
                    sub.price,
                    ROW_NUMBER() OVER (PARTITION BY sub.client_id ORDER BY sub.label) - 1
                FROM (
                    SELECT DISTINCT ON (i.client_id, ii.label)
                        i.client_id,
                        ii.label,
                        ii.price
                    FROM intervention_items ii
                    JOIN interventions i ON ii.intervention_id = i.id
                    WHERE i.client_id IS NOT NULL
                    ORDER BY i.client_id, ii.label, i.start_time DESC
                ) sub;
            """))
            result = conn.execute(text("SELECT COUNT(*) FROM client_services"))
            count = result.scalar()
            print(f"✅ {count} services créés dans le catalogue clients")

            # 4. Lier les intervention_items à leur client_service
            conn.execute(text("""
                UPDATE intervention_items
                SET client_service_id = cs.id
                FROM interventions i, client_services cs
                WHERE intervention_items.intervention_id = i.id
                  AND i.client_id IS NOT NULL
                  AND intervention_items.client_service_id IS NULL
                  AND cs.client_id = i.client_id
                  AND cs.label = intervention_items.label;
            """))
            result = conn.execute(text(
                "SELECT COUNT(*) FROM intervention_items WHERE client_service_id IS NOT NULL"
            ))
            linked = result.scalar()
            print(f"✅ {linked} intervention_items liés à leur client_service")

            tx.commit()
            print("🎉 Migration terminée avec succès.")
        except Exception as e:
            tx.rollback()
            print(f"❌ Erreur : {e}")
            raise

if __name__ == "__main__":
    migrate()
