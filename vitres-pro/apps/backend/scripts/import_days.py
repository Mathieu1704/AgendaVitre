"""
Import direct en base — pas besoin du serveur HTTP.

Usage:
  python scripts/import_days.py 2026-02-26 2026-02-27
"""
import os
import sys
import datetime

# Permet d'importer les modules du backend
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.models.models import SessionLocal, RawCalendarEvent, Base, engine
from sqlalchemy import and_

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CALENDAR_ID = 'max.berdoux@gmail.com'

# --- Auth Google (réutilise le même token que preview_day.py) ---
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
token_path = os.path.join(BASE_DIR, 'token.json')
creds_path = os.path.join(BASE_DIR, 'credentials.json')

creds = None
if os.path.exists(token_path):
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)

if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:
            creds = None
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
        creds = flow.run_local_server(port=0)
    with open(token_path, 'w') as f:
        f.write(creds.to_json())

service = build('calendar', 'v3', credentials=creds)

# --- Créer la table si elle n'existe pas encore ---
Base.metadata.create_all(bind=engine, tables=[RawCalendarEvent.__table__])

# --- Dates à importer ---
if len(sys.argv) > 1:
    dates_str = sys.argv[1:]
else:
    print("Usage: python scripts/import_days.py 2026-02-26 2026-02-27")
    sys.exit(1)

dates = []
for d in dates_str:
    try:
        dates.append(datetime.date.fromisoformat(d))
    except ValueError:
        print(f"❌ Format invalide : {d}. Attendu : YYYY-MM-DD")
        sys.exit(1)

# --- Import ---
db = SessionLocal()

for target_date in dates:
    print(f"\n📅 Import du {target_date.strftime('%A %d %B %Y').capitalize()}...")

    start_dt = datetime.datetime(target_date.year, target_date.month, target_date.day)
    end_dt = start_dt + datetime.timedelta(days=1)

    result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=start_dt.isoformat() + 'Z',
        timeMax=end_dt.isoformat() + 'Z',
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    all_events = result.get('items', [])
    timed_events = [e for e in all_events if 'dateTime' in e.get('start', {})]
    skipped = len(all_events) - len(timed_events)

    upserted = 0
    for event in timed_events:
        external_id = event.get('id', '')
        if not external_id:
            continue

        start_str = event['start']['dateTime']
        end_str = event['end']['dateTime']
        start_t = datetime.datetime.fromisoformat(start_str)
        end_t = datetime.datetime.fromisoformat(end_str)

        existing = db.query(RawCalendarEvent).filter(
            and_(
                RawCalendarEvent.source == 'google',
                RawCalendarEvent.calendar_id == CALENDAR_ID,
                RawCalendarEvent.external_id == external_id,
            )
        ).first()

        if existing:
            existing.summary = event.get('summary', 'Sans titre')
            existing.description = event.get('description', None)
            existing.location = event.get('location', None)
            existing.start_time = start_t
            existing.end_time = end_t
            existing.raw_payload = event
            action = "MAJ"
        else:
            new = RawCalendarEvent(
                source='google',
                external_id=external_id,
                calendar_id=CALENDAR_ID,
                summary=event.get('summary', 'Sans titre'),
                description=event.get('description', None),
                location=event.get('location', None),
                start_time=start_t,
                end_time=end_t,
                all_day=False,
                status='raw',
                raw_payload=event,
            )
            db.add(new)
            action = "NOUVEAU"

        duration = int((end_t - start_t).total_seconds() / 60)
        print(f"  [{action}] {start_t.strftime('%H:%M')}→{end_t.strftime('%H:%M')} ({duration}min) — {event.get('summary', '?')}")
        upserted += 1

    db.commit()
    print(f"  ✅ {upserted} importés, {skipped} all-day ignorés")

db.close()
print("\n🎉 Import terminé. Ouvre l'app → vue Jour → tu verras les events en 'Non assigné'.")
