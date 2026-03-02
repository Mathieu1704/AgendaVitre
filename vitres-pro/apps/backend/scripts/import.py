import sys
import os
import json
import datetime
from dotenv import load_dotenv # <--- AJOUT IMPORTANT

# 1. SETUP DE L'ENVIRONNEMENT
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# --- CHARGEMENT DU FICHIER .ENV ---
# On cherche le fichier .env qui est dans apps/backend/
env_path = os.path.join(parent_dir, '.env')
if os.path.exists(env_path):
    print(f"✅ Chargement des variables depuis : {env_path}")
    load_dotenv(env_path)
else:
    print(f"⚠️ ATTENTION : Fichier .env introuvable à : {env_path}")
# ----------------------------------

# Importation des modèles APRÈS avoir chargé les variables d'environnement
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.models.models import Base, Client, Intervention, InterventionItem, Employee
from app.core.config import settings

# --- CONFIGURATION FICHIER JSON ---
INPUT_FILENAME = 'export_02_02.json' # ✅ J'ai mis ton nom de fichier ici

# FICHIER SOURCE
INPUT_FILE = os.path.join(current_dir, INPUT_FILENAME)

def get_db_session():
    """Crée une connexion à la DB"""
    engine = create_engine(settings.DATABASE_URL)
    return Session(bind=engine)

def main():
    db_url_masked = settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else "LOCALE"
    print(f"\n🚀 Démarrage de l'importation vers : {db_url_masked}")
    
    # 1. CHARGEMENT JSON
    if not os.path.exists(INPUT_FILE):
        print(f"❌ ERREUR : Fichier {INPUT_FILE} introuvable.")
        print(f"   -> Place le fichier '{INPUT_FILENAME}' dans le dossier 'apps/backend/scripts/'.")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"📂 Fichier chargé : {len(data)} événements trouvés.\n")

    db = get_db_session()
    
    stats = {
        "created": 0,
        "skipped": 0,
        "clients_new": 0,
        "clients_found": 0,
        "errors": 0
    }

    try:
        for index, entry in enumerate(data):
            summary = entry.get('original_summary', 'Sans titre')[:40]
            print(f"🔹 [{index+1}/{len(data)}] Traitement : {summary}...")

            # --- A. GESTION CLIENT ---
            client_name = entry.get('client_name', 'Client Inconnu').strip()
            if not client_name: 
                client_name = "Client Inconnu"

            # 1. Chercher Client existant (par nom)
            client = db.query(Client).filter(Client.name == client_name).first()

            # Préparation des données d'adresse
            street = entry.get('client_street', '') or ''
            zip_code = entry.get('client_zip', '') or ''
            city = entry.get('client_city', '') or ''
            
            # Construction de l'adresse complète (format: "Rue X 10, 7000 Mons")
            full_address_parts = []
            if street: full_address_parts.append(street)
            if zip_code or city: full_address_parts.append(f"{zip_code} {city}".strip())
            full_address = ", ".join(full_address_parts)

            if not client:
                # -> CRÉATION
                client = Client(
                    name=client_name,
                    street=street,      # ✅ Ta colonne street
                    zip_code=zip_code,  # ✅ Ta colonne zip_code
                    city=city,          # ✅ Ta colonne city
                    address=full_address, # ✅ Ta colonne address (concaténée)
                    phone=entry.get('client_phone'),
                    email=entry.get('client_email'),
                    notes=entry.get('client_notes')
                )
                db.add(client)
                db.flush() # Pour récupérer l'ID tout de suite
                print(f"   👤 Nouveau client créé : {client_name}")
                stats["clients_new"] += 1
            else:
                # -> MISE À JOUR (Si l'adresse est vide en DB mais dispo dans le JSON)
                updated = False
                if not client.street and street:
                    client.street = street
                    updated = True
                if not client.zip_code and zip_code:
                    client.zip_code = zip_code
                    updated = True
                if not client.city and city:
                    client.city = city
                    updated = True
                if (not client.address or client.address == "") and full_address:
                    client.address = full_address
                    updated = True
                
                if updated:
                    print(f"   👤 Client mis à jour (Adresse) : {client_name}")
                else:
                    print(f"   👤 Client existant trouvé : {client_name}")
                stats["clients_found"] += 1

            # --- B. GESTION DATES ---
            date_str = entry.get('date', '2026-02-02') 
            start_str = entry.get('start_time', '09:00')
            end_str = entry.get('end_time', '10:00')

            try:
                # Création datetime naïf (sans fuseau horaire explicite pour l'instant, Postgres gérera)
                start_dt = datetime.datetime.strptime(f"{date_str} {start_str}", "%Y-%m-%d %H:%M")
                end_dt = datetime.datetime.strptime(f"{date_str} {end_str}", "%Y-%m-%d %H:%M")
            except ValueError:
                # Fallback si erreur de format
                print("   ⚠️ Erreur format date, utilisation par défaut.")
                start_dt = datetime.datetime.strptime(f"{date_str} 09:00", "%Y-%m-%d %H:%M")
                end_dt = datetime.datetime.strptime(f"{date_str} 10:00", "%Y-%m-%d %H:%M")

            # --- C. VÉRIFICATION DOUBLON ---
            # On vérifie si une intervention existe pour ce client à la même heure de début
            exists = db.query(Intervention).filter(
                Intervention.client_id == client.id,
                Intervention.start_time == start_dt
            ).first()

            if exists:
                print(f"   ⏩ Déjà en base (ID: {exists.id}). Ignoré.")
                stats["skipped"] += 1
                continue

            # --- D. CRÉATION INTERVENTION ---
            intervention = Intervention(
                client_id=client.id,
                title=entry.get('original_summary', 'Intervention'),
                description=entry.get('full_description', ''), # Description complète IA
                start_time=start_dt,
                end_time=end_dt,
                status="planned",
                is_invoice=entry.get('is_invoice', False),
                price_estimated=entry.get('total_price', 0.0)
            )
            
            db.add(intervention)
            db.flush() # Récup ID intervention

            # --- E. CRÉATION ITEMS (PRESTATIONS) ---
            services = entry.get('services_json', [])
            for srv in services:
                item = InterventionItem(
                    intervention_id=intervention.id,
                    label=srv.get('description', 'Prestation'),
                    price=srv.get('price', 0.0)
                )
                db.add(item)

            print(f"   ✅ Intervention créée (ID: {intervention.id}) avec {len(services)} prestations.")
            stats["created"] += 1

        # Validation finale
        db.commit()
        
        print("\n" + "="*40)
        print("🎉 IMPORTATION TERMINÉE !")
        print("="*40)
        print(f"Total Lu       : {len(data)}")
        print(f"✅ Créés       : {stats['created']}")
        print(f"⏩ Ignorés     : {stats['skipped']} (Doublons)")
        print(f"👤 Clients New : {stats['clients_new']}")
        print(f"👤 Clients Old : {stats['clients_found']}")
        print("="*40)

    except Exception as e:
        print(f"\n❌ ERREUR CRITIQUE PENDANT L'IMPORT : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()