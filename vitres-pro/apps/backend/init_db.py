# apps/backend/init_db.py
from app.models.models import Base, engine, Employee, Client, CompanySettings
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

def init_db():
    print("🚀  Démarrage du RESET COMPLET de la base de données...")

    # 1. NETTOYAGE RADICAL (DROP SCHEMA)
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            print("🗑️   Suppression de toutes les tables (Cascade)...")
            connection.execute(text("DROP SCHEMA public CASCADE;"))
            connection.execute(text("CREATE SCHEMA public;"))
            connection.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
            connection.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            
            # On réactive l'extension UUID pour que ton SQL d'invoices fonctionne
            connection.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            
            transaction.commit()
            print("✨  Nettoyage terminé.")
        except Exception as e:
            transaction.rollback()
            print(f"⚠️  Erreur pendant le nettoyage : {e}")
            return

    # 2. CRÉATION DES TABLES PYTHON (SQLAlchemy)
    # Crée: employees, clients, interventions, company_settings, absences, intervention_employees
    print("🏗️   Création des tables du Backend (Planning, Clients, etc)...")
    Base.metadata.create_all(bind=engine)

    # 3. RECRÉATION DE LA TABLE INVOICES (SQL Brut)
    # Comme elle n'est pas dans models.py, on l'ajoute à la main ici
    print("📄  Recréation de la table 'invoices'...")
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text("""
                CREATE TABLE public.invoices (
                  id uuid NOT NULL DEFAULT gen_random_uuid(),
                  created_at timestamp with time zone DEFAULT now(),
                  invoice_number text,
                  
                  client_name text,
                  description text,
                  
                  -- Montants
                  amount_ht numeric DEFAULT 0,
                  tva_amount numeric DEFAULT 0,
                  total_ttc numeric DEFAULT 0,
                  
                  -- Statut
                  is_paid boolean DEFAULT false,
                  payment_method text,
                  
                  -- Relations
                  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
                  
                  CONSTRAINT invoices_pkey PRIMARY KEY (id)
                );
            """))
            transaction.commit()
            print("✅  Table 'invoices' restaurée.")
        except Exception as e:
            transaction.rollback()
            print(f"⚠️  Erreur création invoices : {e}")

    # 4. AJOUT DES DONNÉES DE DÉMARRAGE
    print("🌱  Ajout des données de base...")
    with Session(engine) as db:
        # Settings
        settings = CompanySettings(overtime_tolerance_hours=3.0)
        db.add(settings)

        # Admin
        admin_id = uuid.uuid4()
        admin = Employee(
            id=admin_id,
            email="admin@lvmagenda.be",
            full_name="Mathieu Admin",
            role="admin",
            color="#EF4444",
            weekly_hours=40.0
        )
        db.add(admin)

        # Employé
        employee = Employee(
            id=uuid.uuid4(),
            email="axel@lvmagenda.be",
            full_name="Axel",
            role="employee",
            color="#3B82F6",
            weekly_hours=38.0
        )
        db.add(employee)

        # Client de test
        client = Client(
            name="Google Belgique",
            address="Chaussée d'Etterbeek 180, Bruxelles"
        )
        db.add(client)

        db.commit()
        print(f"✅  Terminé ! Admin ID : {admin_id}")

if __name__ == "__main__":
    init_db()