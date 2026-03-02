"""
Service Google Calendar — réutilise token.json + credentials.json du dossier scripts/.
"""
import os
import datetime
from typing import List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Les fichiers token/credentials sont dans apps/backend/scripts/
SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts")
TOKEN_PATH = os.path.join(SCRIPTS_DIR, "token.json")
CREDS_PATH = os.path.join(SCRIPTS_DIR, "credentials.json")

CALENDAR_ID = "max.berdoux@gmail.com"


def _get_credentials() -> Credentials:
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, "w") as f:
                f.write(creds.to_json())
        else:
            raise RuntimeError(
                "Token Google invalide ou manquant. "
                "Lance scripts/get_day.py une fois pour générer token.json."
            )

    return creds


def fetch_day_events(target_date: datetime.date) -> List[Dict[str, Any]]:
    """
    Récupère tous les événements non-all-day d'une journée depuis Google Calendar.
    Retourne une liste de dicts avec les champs bruts de l'API Google.
    """
    creds = _get_credentials()
    service = build("calendar", "v3", credentials=creds)

    start_dt = datetime.datetime(target_date.year, target_date.month, target_date.day)
    end_dt = start_dt + datetime.timedelta(days=1)

    time_min = start_dt.isoformat() + "Z"
    time_max = end_dt.isoformat() + "Z"

    result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])

    # Filtre : on garde uniquement les events avec dateTime (pas all-day)
    timed_events = [e for e in events if "dateTime" in e.get("start", {})]

    return timed_events
