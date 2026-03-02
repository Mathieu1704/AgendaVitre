import os.path
import datetime
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# --- CONFIGURATION ---
CALENDAR_ID = 'max.berdoux@gmail.com'

# CHOISIS TA SEMAINE ICI (Année, Mois, Jour de début)
# Pour la semaine du Lundi 26 Janvier 2026
START_YEAR = 2026
START_MONTH = 1
START_DAY = 26 

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    # 1. AUTHENTIFICATION ROBUSTE (Renouvelle le token si besoin)
    creds = None
    token_path = os.path.join(BASE_DIR, 'token.json')
    creds_path = os.path.join(BASE_DIR, 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    
    # Si pas de crédits ou crédits invalides -> On renouvelle !
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Renouvellement du token expiré...")
            creds.refresh(Request())
        else:
            print("🆕 Nouvelle connexion requise...")
            if not os.path.exists(creds_path):
                print(f"❌ ERREUR : Fichier {creds_path} introuvable.")
                return
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # On sauvegarde le nouveau token tout neuf
        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    service = build('calendar', 'v3', credentials=creds)

    # 2. CALCUL DES DATES
    start_date = datetime.datetime(START_YEAR, START_MONTH, START_DAY)
    end_date = start_date + datetime.timedelta(days=7) # + 7 jours

    print(f"📡 Récupération de la semaine du {start_date.date()} au {end_date.date()}...")

    timeMin = start_date.isoformat() + 'Z'
    timeMax = end_date.isoformat() + 'Z'

    # 3. RÉCUPÉRATION
    events_result = service.events().list(
        calendarId=CALENDAR_ID, 
        timeMin=timeMin,
        timeMax=timeMax,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    events = events_result.get('items', [])

    if not events:
        print('Aucun événement trouvé.')
        return

    # 4. FILTRAGE ET NETTOYAGE
    clean_events = []
    skipped_count = 0
    
    for event in events:
        summary = event.get('summary', 'Sans titre')
        start = event.get('start', {})
        
        # FILTRE TECHNIQUE : Si pas de "dateTime", c'est un événement "Toute la journée" (Global)
        if 'dateTime' not in start:
            # print(f"⏩ Ignoré (Global) : {summary}") # Décommente pour voir ce qu'il ignore
            skipped_count += 1
            continue

        # On garde l'événement
        clean_events.append({
            "summary": summary,
            "description": event.get('description', ''),
            "start": start.get('dateTime'),
            "end": event.get('end', {}).get('dateTime')
        })

    print(f"✅ {len(clean_events)} interventions trouvées ! ({skipped_count} événements globaux ignorés)")

    # 5. SAUVEGARDE
    filename = f"raw_week_{start_date.strftime('%Y-%m-%d')}.json"
    filepath = os.path.join(BASE_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(clean_events, f, ensure_ascii=False, indent=2)

    print(f"💾 Fichier sauvegardé : {filename}")
    print("👉 Ouvre ce fichier, copie tout le contenu, et colle-le dans le chat Gemini !")

if __name__ == '__main__':
    main()