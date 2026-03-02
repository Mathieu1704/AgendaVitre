import os.path
import sys
import datetime
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# --- CONFIGURATION ---
CALENDAR_ID = 'max.berdoux@gmail.com'
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


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


def fetch_day(service, date_str: str):
    start_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    end_date = start_date + datetime.timedelta(days=1)

    print(f"📡 Récupération du {start_date.date()}...")

    events_result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=start_date.isoformat() + 'Z',
        timeMax=end_date.isoformat() + 'Z',
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    # Cache des événements parents pour éviter des appels API répétés
    parent_cache = {}

    clean_events = []
    skipped = 0
    for event in events_result.get('items', []):
        start = event.get('start', {})
        if 'dateTime' not in start:
            skipped += 1
            continue

        # Récupérer la règle de récurrence depuis l'événement parent
        recurrence_rule = None
        recurring_event_id = event.get('recurringEventId')
        if recurring_event_id:
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

        clean_events.append({
            "summary": event.get('summary', 'Sans titre'),
            "description": event.get('description', ''),
            "start": start.get('dateTime'),
            "end": event.get('end', {}).get('dateTime'),
            "google_event_id": event.get('id'),
            "recurrence_rule": recurrence_rule,
        })

    filename = f"raw_day_{date_str}.json"
    filepath = os.path.join(BASE_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(clean_events, f, ensure_ascii=False, indent=2)

    print(f"  ✅ {len(clean_events)} interventions → {filename} ({skipped} globaux ignorés)")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/get_day.py 2026-03-02 [2026-03-03 ...]")
        sys.exit(1)

    service = get_service()
    for date_str in sys.argv[1:]:
        fetch_day(service, date_str)


if __name__ == '__main__':
    main()
