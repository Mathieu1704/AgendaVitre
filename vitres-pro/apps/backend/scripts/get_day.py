import os.path
import sys
import datetime
import json
import pytz
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# --- CONFIGURATION ---
CALENDAR_ID = 'max.berdoux@gmail.com'
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TZ = pytz.timezone('Europe/Brussels')
REGISTRY_PATH = os.path.join(BASE_DIR, 'seen_recurring.json')


def load_registry() -> set:
    """Charge les IDs maîtres des récurrences déjà traitées."""
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, 'r') as f:
            return set(json.load(f))
    return set()


def save_registry(registry: set):
    with open(REGISTRY_PATH, 'w') as f:
        json.dump(sorted(registry), f, indent=2)


def get_service():
    creds = None
    token_path = os.path.join(BASE_DIR, 'token.json')
    creds_path = os.path.join(BASE_DIR, 'credentials.json')

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Renouvellement du token...")
            creds.refresh(Request())
        else:
            print("🆕 Nouvelle connexion requise...")
            if not os.path.exists(creds_path):
                print(f"❌ ERREUR : Fichier {creds_path} introuvable.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    return build('calendar', 'v3', credentials=creds)


def fetch_day(service, date_str: str, registry: set):
    # Minuit heure belge → UTC pour ne pas rater les events entre 00h et 02h
    naive = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    start_date = TZ.localize(naive)
    end_date = start_date + datetime.timedelta(days=1)

    print(f"📡 Récupération du {start_date.date()}...")

    events_result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=start_date.isoformat(),
        timeMax=end_date.isoformat(),
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    # Cache des événements parents pour éviter des appels API répétés
    parent_cache = {}

    clean_events = []
    skipped_allday = 0
    skipped_recurring = 0

    for event in events_result.get('items', []):
        start = event.get('start', {})
        if 'dateTime' not in start:
            skipped_allday += 1
            continue

        # Récupérer la règle de récurrence depuis l'événement parent
        recurrence_rule = None
        recurring_event_id = event.get('recurringEventId')

        if recurring_event_id:
            # Skipper si cette série récurrente est déjà dans le registre
            if recurring_event_id in registry:
                skipped_recurring += 1
                continue

            if recurring_event_id not in parent_cache:
                try:
                    parent = service.events().get(
                        calendarId=CALENDAR_ID,
                        eventId=recurring_event_id
                    ).execute()
                    parent_cache[recurring_event_id] = parent
                except Exception:
                    parent_cache[recurring_event_id] = {}
            parent = parent_cache[recurring_event_id]
            for r in parent.get('recurrence', []):
                if r.startswith('RRULE:'):
                    recurrence_rule = r
                    break

            # Ajouter au registre pour ne plus l'extraire ensuite
            registry.add(recurring_event_id)

        clean_events.append({
            "summary": event.get('summary', 'Sans titre'),
            "description": event.get('description', ''),
            "start": start.get('dateTime'),
            "end": event.get('end', {}).get('dateTime'),
            "google_event_id": event.get('id'),
            "recurrence_rule": recurrence_rule,
        })

    todo_dir = os.path.join(BASE_DIR, 'to_do_raw')
    os.makedirs(todo_dir, exist_ok=True)
    filename = f"raw_day_{date_str}.json"
    filepath = os.path.join(todo_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(clean_events, f, ensure_ascii=False, indent=2)

    print(f"  ✅ {len(clean_events)} events → to_do_raw/{filename} "
          f"({skipped_allday} journée entière ignorés, {skipped_recurring} récurrences connues skippées)")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/get_day.py 2026-05-04 [2026-05-05 ...]")
        sys.exit(1)

    registry = load_registry()
    print(f"📋 Registre chargé : {len(registry)} séries récurrentes connues")

    service = get_service()
    for date_str in sys.argv[1:]:
        fetch_day(service, date_str, registry)

    save_registry(registry)
    print(f"💾 Registre sauvegardé : {len(registry)} séries au total")


if __name__ == '__main__':
    main()
