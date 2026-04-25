"""
Migration : ajoute time_only (boolean) sur hourly_rates.
Safe à relancer (idempotent via IF NOT EXISTS).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(settings.DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE hourly_rates
        ADD COLUMN IF NOT EXISTS time_only BOOLEAN NOT NULL DEFAULT FALSE;
    """))
    conn.commit()
    print("✅ Colonne time_only ajoutée sur hourly_rates.")
