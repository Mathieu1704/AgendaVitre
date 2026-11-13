"""Fermetures d'entreprise et jours fériés.

Un jour férié est une `CompanyClosure` d'un seul jour. Les fermetures sont
déjà neutres dans le calcul des heures sup (`timetracking._is_neutral_day`)
et ferment la capacité du planning (`planning.calculate_day_stats`).

Les fériés légaux belges sont pré-remplis une seule fois par année (table
`holiday_seeded_years`) : un férié retiré par un admin parce que l'équipe
travaille exceptionnellement ce jour-là n'est jamais recréé.
"""
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.models.models import get_db, CompanyClosure, HolidaySeededYear
from app.schemas.schemas import ClosureIn, ClosureOut

router = APIRouter()

# Avant cette date, on ne pré-remplit rien : les soldes d'heures sup déjà
# constatés ne doivent pas bouger. Le 11/11/2026 est ainsi corrigé.
HOLIDAY_SEED_FROM = date(2026, 11, 1)


def _easter_sunday(year: int) -> date:
    """Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Butcher)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def belgian_holidays(year: int) -> list[tuple[date, str]]:
    """Les 10 jours fériés légaux belges de l'année."""
    easter = _easter_sunday(year)
    return [
        (date(year, 1, 1), "Nouvel An"),
        (easter + timedelta(days=1), "Lundi de Pâques"),
        (date(year, 5, 1), "Fête du Travail"),
        (easter + timedelta(days=39), "Ascension"),
        (easter + timedelta(days=50), "Lundi de Pentecôte"),
        (date(year, 7, 21), "Fête nationale"),
        (date(year, 8, 15), "Assomption"),
        (date(year, 11, 1), "Toussaint"),
        (date(year, 11, 11), "Armistice"),
        (date(year, 12, 25), "Noël"),
    ]


def _overlapping(db: Session, start: date, end: date, exclude_id: Optional[UUID] = None):
    q = db.query(CompanyClosure).filter(
        CompanyClosure.start_date <= end,
        CompanyClosure.end_date >= start,
    )
    if exclude_id:
        q = q.filter(CompanyClosure.id != exclude_id)
    return q.all()


def _seed_year(db: Session, year: int) -> None:
    """Pré-remplit les fériés d'une année, une seule fois. Le marqueur d'année
    est posé en premier (ON CONFLICT) : deux requêtes simultanées ne peuvent
    pas pré-remplir deux fois."""
    res = db.execute(
        pg_insert(HolidaySeededYear.__table__)
        .values(year=year)
        .on_conflict_do_nothing(index_elements=["year"])
    )
    if res.rowcount == 0:
        return
    for d, name in belgian_holidays(year):
        if d < HOLIDAY_SEED_FROM:
            continue
        if _overlapping(db, d, d):
            continue
        db.add(CompanyClosure(start_date=d, end_date=d, reason=name))
    db.commit()


def ensure_holidays_seeded(db: Session, start: date, end: date) -> None:
    seeded = {y for (y,) in db.query(HolidaySeededYear.year).all()}
    # Borne : on ne pré-remplit jamais au-delà de l'an prochain.
    max_year = date.today().year + 1
    for year in range(max(start.year, HOLIDAY_SEED_FROM.year), min(end.year, max_year) + 1):
        if year not in seeded:
            _seed_year(db, year)


@router.get("", response_model=List[ClosureOut])
def list_closures(
    start: date,
    end: date,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if end < start:
        raise HTTPException(status_code=400, detail="Plage invalide")
    ensure_holidays_seeded(db, start, end)
    return (
        db.query(CompanyClosure)
        .filter(CompanyClosure.start_date <= end, CompanyClosure.end_date >= start)
        .order_by(CompanyClosure.start_date)
        .all()
    )


@router.post("", response_model=ClosureOut)
def create_closure(
    payload: ClosureIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="Plage invalide")
    if _overlapping(db, payload.start_date, payload.end_date):
        raise HTTPException(status_code=409, detail="Ce jour est déjà marqué comme fermé")
    reason = (payload.reason or "").strip() or "Férié"
    closure = CompanyClosure(start_date=payload.start_date, end_date=payload.end_date, reason=reason)
    db.add(closure)
    db.commit()
    db.refresh(closure)
    return closure


@router.delete("/{closure_id}")
def delete_closure(
    closure_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux admins")
    closure = db.query(CompanyClosure).filter(CompanyClosure.id == closure_id).first()
    if not closure:
        raise HTTPException(status_code=404, detail="Fermeture introuvable")
    db.delete(closure)
    db.commit()
    return {"ok": True}
