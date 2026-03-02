"""
Preview d'import Google Calendar — LECTURE SEULE, ne touche pas à la base.

Usage:
  python preview_day.py              → aujourd'hui
  python preview_day.py 2026-02-25  → date spécifique
"""
import os
import sys
import datetime
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

CALENDAR_ID = 'max.berdoux@gmail.com'
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- Date cible ---
if len(sys.argv) > 1:
    try:
        target_date = datetime.date.fromisoformat(sys.argv[1])
    except ValueError:
        print(f"❌ Format invalide : {sys.argv[1]}. Attendu : YYYY-MM-DD")
        sys.exit(1)
else:
    target_date = datetime.date.today()

# --- Auth ---
token_path = os.path.join(BASE_DIR, 'token.json')
creds_path = os.path.join(BASE_DIR, 'credentials.json')

creds = None
if os.path.exists(token_path):
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)

if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        try:
            print("🔄 Renouvellement du token...")
            creds.refresh(Request())
        except Exception:
            print("⚠️  Refresh échoué, nouvelle connexion requise...")
            creds = None

    if not creds or not creds.valid:
        if not os.path.exists(creds_path):
            print(f"❌ Fichier {creds_path} introuvable.")
            sys.exit(1)
        flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
        creds = flow.run_local_server(port=0)

    with open(token_path, 'w') as f:
        f.write(creds.to_json())

service = build('calendar', 'v3', credentials=creds)

# --- Fetch ---
start_dt = datetime.datetime(target_date.year, target_date.month, target_date.day)
end_dt = start_dt + datetime.timedelta(days=1)

print(f"\n📅 PREVIEW — {target_date.strftime('%A %d %B %Y').capitalize()}")
print(f"📡 Calendrier : {CALENDAR_ID}")
print("-" * 60)

result = service.events().list(
    calendarId=CALENDAR_ID,
    timeMin=start_dt.isoformat() + 'Z',
    timeMax=end_dt.isoformat() + 'Z',
    singleEvents=True,
    orderBy='startTime'
).execute()

all_events = result.get('items', [])
timed_events = [e for e in all_events if 'dateTime' in e.get('start', {})]
allday_events = [e for e in all_events if 'dateTime' not in e.get('start', {})]

print(f"Total Google : {len(all_events)} événements")
print(f"  ✅ Avec heure (seront importés) : {len(timed_events)}")
print(f"  ⏭️  Toute la journée (ignorés)   : {len(allday_events)}")
print("-" * 60)

if not timed_events:
    print("\n⚠️  Aucun événement avec heure ce jour-là.")
    sys.exit(0)

# --- Affichage lisible ---
preview = []
for i, event in enumerate(timed_events, 1):
    start_str = event['start']['dateTime']
    end_str = event['end']['dateTime']
    start_t = datetime.datetime.fromisoformat(start_str)
    end_t = datetime.datetime.fromisoformat(end_str)
    duration = int((end_t - start_t).total_seconds() / 60)

    entry = {
        "n": i,
        "heure": f"{start_t.strftime('%H:%M')} → {end_t.strftime('%H:%M')} ({duration} min)",
        "summary": event.get('summary', '(sans titre)'),
        "description": event.get('description', '').strip() or None,
        "location": event.get('location', None),
        "google_id": event.get('id'),
    }
    preview.append(entry)

    print(f"\n[{i}] {entry['heure']}")
    print(f"    📝 {entry['summary']}")
    if entry['description']:
        # Affiche les 3 premières lignes max
        lines = entry['description'].splitlines()[:3]
        for line in lines:
            print(f"       {line}")
        if len(entry['description'].splitlines()) > 3:
            print(f"       ... ({len(entry['description'].splitlines())} lignes)")
    if entry['location']:
        print(f"    📍 {entry['location']}")

print("\n" + "=" * 60)
print(f"✅ {len(timed_events)} événement(s) prêts à importer.")
print("\nPour importer dans l'app :")
print(f"  POST /api/raw-events/import/google?date={target_date}")
print("=" * 60 + "\n")
