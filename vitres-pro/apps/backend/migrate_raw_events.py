"""
Migration légère : crée raw_calendar_events + raw_event_employees sans toucher au reste.
Lance avec : python migrate_raw_events.py
"""
from app.models.models import Base, engine, RawCalendarEvent, raw_event_employees

print("Création des tables raw_calendar_events + raw_event_employees...")
Base.metadata.create_all(bind=engine, tables=[
    RawCalendarEvent.__table__,
    raw_event_employees,
])
print("Done.")
