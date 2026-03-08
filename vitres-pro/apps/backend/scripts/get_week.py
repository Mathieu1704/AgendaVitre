"""
get_week.py — Extrait les événements Google Calendar par semaine (lun-ven).
Skippe les séries récurrentes déjà connues dans seen_recurring.json.

Usage : python scripts/get_week.py 2026-07-06 [2026-07-13 ...]
        (donner la date du lundi de chaque semaine)
"""

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


def fetch_week(service, monday_str: str, registry: set):
    # Minuit lundi heure belge → minuit samedi (on ne prend que lun-ven)
    naive = datetime.datetime.strptime(monday_str, "%Y-%m-%d")
    monday = TZ.localize(naive)
    saturday = monday + datetime.timedelta(days=5)

    print(f"📡 Semaine du {monday.date()} au {(saturday - datetime.timedelta(days=1)).date()}...")

    events_result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=monday.isoformat(),
        timeMax=saturday.isoformat(),
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    parent_cache = {}
    clean_events = []
    skipped_allday = 0
    skipped_recurring = 0
    skipped_weekend = 0

    for event in events_result.get('items', []):
        start = event.get('start', {})

        # Ignorer les événements "toute la journée"
        if 'dateTime' not in start:
            skipped_allday += 1
            continue

        # Ignorer les week-ends (ne devrait pas arriver avec timeMax=samedi mais sécurité)
        event_dt = datetime.datetime.fromisoformat(start['dateTime'])
        if event_dt.weekday() >= 5:
            skipped_weekend += 1
            continue

        # Récurrence : skipper si déjà connue
        recurrence_rule = None
        recurring_event_id = event.get('recurringEventId')

        if recurring_event_id:
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
    filename = f"raw_week_{monday_str}.json"
    filepath = os.path.join(todo_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(clean_events, f, ensure_ascii=False, indent=2)

    print(f"  ✅ {len(clean_events)} events → to_do_raw/{filename} "
          f"({skipped_allday} journée entière, {skipped_recurring} récurrences skippées)")


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/get_week.py 2026-07-06 [2026-07-13 ...]")
        print("       (donner la date du lundi de chaque semaine)")
        sys.exit(1)

    registry = load_registry()
    print(f"📋 Registre chargé : {len(registry)} séries récurrentes connues")

    service = get_service()
    for monday_str in sys.argv[1:]:
        fetch_week(service, monday_str, registry)

    save_registry(registry)
    print(f"💾 Registre sauvegardé : {len(registry)} séries au total")


if __name__ == '__main__':
    main()
