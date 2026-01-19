# apps/backend/init_db.py
from app.models.models import Base, engine, Employee, Client, CompanySettings
from sqlalchemy.orm import Session
import uuid

def init_db():
    # 1. SUPPRIMER TOUTES LES TABLES (Attention, ça efface tout !)
    print("🗑️  Suppression des anciennes tables...")
    Base.metadata.drop_all(bind=engine)

    # 2. CRÉER LES NOUVELLES TABLES
    print("🏗️  Création des nouvelles tables...")
    Base.metadata.create_all(bind=engine)

    # 3. AJOUTER DES DONNÉES DE TEST
    print("🌱  Ajout des données de test (Seed)...")
    with Session(engine) as db:
        # Créer les paramètres entreprise
        settings = CompanySettings(overtime_tolerance_hours=3.0)
        db.add(settings)

        # Créer un Employé ADMIN (Simulé)
        # NOTE : Pour que ça marche avec le login plus tard, 
        # il faudra que cet ID corresponde à un vrai user Supabase.
        # Pour l'instant, on met un ID aléatoire juste pour tester la structure.
        admin_id = uuid.uuid4()
        admin = Employee(
            id=admin_id,
            email="admin@lvmagenda.be",
            full_name="Mathieu Admin",
            role="admin",
            color="#EF4444", # Rouge
            weekly_hours=40.0
        )
        db.add(admin)

        # Créer un Employé NORMAL
        employee = Employee(
            id=uuid.uuid4(),
            email="axel@lvmagenda.be",
            full_name="Axel",
            role="employee",
            color="#3B82F6", # Bleu
            weekly_hours=38.0
        )
        db.add(employee)

        # Créer un Client
        client = Client(
            name="Google Belgique",
            address="Chaussée d'Etterbeek 180, Bruxelles"
        )
        db.add(client)

        db.commit()
        print(f"✅  Succès ! Admin ID créé : {admin_id}")

if __name__ == "__main__":
    init_db()