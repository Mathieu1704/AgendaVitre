from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Dict, Optional
from sqlalchemy.sql import func

BRUSSELS_TZ = ZoneInfo("Europe/Brussels")


def _utc_bounds(d: date):
    """Retourne les bornes UTC exactes du jour calendaire Brussels d (minuit à minuit),
    en tenant compte du décalage été/hiver (UTC+1/+2)."""
    start = datetime(d.year, d.month, d.day, tzinfo=BRUSSELS_TZ).astimezone(timezone.utc)
    end   = (datetime(d.year, d.month, d.day, tzinfo=BRUSSELS_TZ) + timedelta(days=1)).astimezone(timezone.utc)
    return start, end

from app.models.models import get_db, Intervention, Employee, Absence, CompanySettings, ProgressiveHours, CompanyClosure, TourRun
from app.core.deps import get_current_user

router = APIRouter()

# --- SERVICE (Logique pure) ---
def _get_employee_hours_for_day(emp: Employee, target_date: date, progressive: list) -> float:
    """Retourne les heures disponibles d'un employé pour un jour donné."""
    weekday_key = str(target_date.isoweekday())  # "1"=lun ... "5"=ven, "6"=sam, "7"=dim

    # 1. Montée en charge progressive
    for ph in progressive:
        if ph.employee_id == emp.id and ph.start_date <= target_date <= ph.end_date:
            return float(ph.hours_per_weekday.get(weekday_key, 0))

    # 2. Plage de validité optionnelle (ex: sous-traitant en mission temporaire).
    #    Hors de cette plage, l'employé est traité comme ayant 0h prévues.
    if emp.hours_valid_from and target_date < emp.hours_valid_from:
        return 0.0
    if emp.hours_valid_until and target_date > emp.hours_valid_until:
        return 0.0

    # 3. Heures par jour définies sur l'employé
    if emp.hours_per_weekday:
        return float(emp.hours_per_weekday.get(weekday_key, 0))

    # 4. Fallback : daily_capacity (ancien comportement)
    return emp.daily_capacity


def intervention_hours(interv) -> float:
    """
    Heures comptabilisées pour une intervention.

    Règle métier :
      - taux « temps de travail uniquement » avec forfait → le forfait ;
      - taux « temps de travail uniquement » sans forfait → durée planifiée ;
      - taux horaire en €/h → prix estimé / taux ;
      - tout le reste → 0 (exclu du total planifié).

    Doit rester alignée sur le calcul de l'écran « Session taux » côté mobile
    (apps/mobile/app/(app)/calendar/rate-session.tsx) : les deux affichent le
    même total à l'utilisateur.
    """
    if not (interv.hourly_rate_id and interv.hourly_rate):
        return 0.0

    rate = interv.hourly_rate

    if rate.time_only:
        # Le forfait prime sur la durée planifiée : c'est tout l'intérêt d'un
        # taux forfaitaire (ex. un chantier compté 12 h quelle que soit la
        # plage horaire posée au calendrier).
        if rate.fixed_hours is not None:
            return float(rate.fixed_hours)
        if interv.start_time and interv.end_time:
            return (interv.end_time - interv.start_time).total_seconds() / 3600
        return 0.0

    # Les prestations à prix négatif (remboursement dû au client) réduisent
    # le prix_estimated facturé mais ne doivent pas réduire les heures
    # comptabilisées : on les réintègre avant division par le taux.
    price_estimated = float(interv.price_estimated or 0)
    negative_total = sum(
        float(it.price) for it in interv.items if float(it.price) < 0
    )
    # Solde cash reporté absorbé depuis le RDV précédent (client absent) :
    # encaisser une vieille dette ne prend pas de temps sur place, seules les
    # prestations réellement prévues cette fois-ci doivent compter.
    carried_over = float(getattr(interv, "carried_over_deferred_amount", None) or 0)
    rate_eligible = price_estimated - negative_total - carried_over

    if rate_eligible > 0 and rate.rate > 0:
        # Arrondi au quart d'heure, comme côté mobile (rate-session.tsx,
        # Math.round(x*4)/4) — sans ça, le total du jour (ici) et le total
        # affiché dans "Session taux" divergent légèrement.
        return round((rate_eligible / rate.rate) * 4) / 4

    return 0.0


def calculate_day_stats(target_date: date, db: Session, zone: Optional[str] = None, city: Optional[str] = None):
    settings = db.query(CompanySettings).first()
    tolerance = settings.overtime_tolerance_hours if settings else 3.0

    # Vérifier fermeture entreprise
    closure = db.query(CompanyClosure).filter(
        CompanyClosure.start_date <= target_date,
        CompanyClosure.end_date >= target_date
    ).first()
    if closure:
        return {
            "date": target_date.strftime("%Y-%m-%d"),
            "capacity_hours": 0,
            "planned_hours": 0,
            "tolerance": tolerance,
            "present_employees": 0,
            "status": "closed"
        }

    emp_query = db.query(Employee)
    if zone:
        emp_query = emp_query.filter(Employee.zone == zone)
    all_employees = emp_query.all()

    day_start, day_end = _utc_bounds(target_date)
    absences = db.query(Absence).filter(
        Absence.start_date < day_end,
        Absence.end_date >= day_start,
    ).all()
    absent_ids = {a.employee_id for a in absences}

    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= target_date,
        ProgressiveHours.end_date >= target_date
    ).all()

    total_capacity = 0
    present_count = 0
    for emp in all_employees:
        if emp.id not in absent_ids:
            hours = _get_employee_hours_for_day(emp, target_date, progressive)
            total_capacity += hours
            if hours > 0:
                present_count += 1

    int_query = db.query(Intervention).options(
        selectinload(Intervention.employees),
        selectinload(Intervention.hourly_rate),
    ).filter(
        Intervention.start_time >= day_start,
        Intervention.start_time < day_end,
        Intervention.status != "cancelled",
        Intervention.type != "devis",
        ~Intervention.tour_run.has() | Intervention.tour_run.has(TourRun.publication_status == "published"),
    )
    if city:
        int_query = int_query.filter(Intervention.city == city)
    elif zone:
        int_query = int_query.filter(Intervention.zone == zone)
    interventions = int_query.all()

    total_planned = 0
    for inter in interventions:
        hours = intervention_hours(inter)
        if hours <= 0:
            continue
        # Heures de l'intervention elle-meme, sans multiplier par le nombre
        # d'employes assignes : 2 ouvriers sur un chantier de 4h ne doivent
        # pas compter comme 8h dans le total planifie du jour.
        total_planned += hours

    status = "ok"
    if total_planned > (total_capacity + tolerance):
        status = "overload"
    elif total_planned > total_capacity:
        status = "warning"

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "capacity_hours": round(total_capacity, 1),
        "planned_hours": round(total_planned, 1),
        "tolerance": tolerance,
        "present_employees": present_count,
        "status": status
    }

# --- ROUTES ---

@router.get("/zero-hours-on-date")
def read_zero_hours_employee_ids(
    date_str: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ids des employés dont les heures prévues (hors congé) sont à 0 ce jour-là
    (ex: jour non travaillé dans hours_per_weekday, ou hors plage hours_valid_from/until).
    Sert à masquer ces employés des listes d'assignation/filtre planning."""
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    all_employees = db.query(Employee).all()
    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= target_date,
        ProgressiveHours.end_date >= target_date
    ).all()
    return [
        str(emp.id) for emp in all_employees
        if _get_employee_hours_for_day(emp, target_date, progressive) <= 0
    ]


@router.get("/daily-stats")
def get_daily_stats_endpoint(
    date_str: str,
    zone: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return calculate_day_stats(d, db, zone=zone, city=city)

@router.get("/range-stats")
def get_range_stats_endpoint(
    start_str: str,
    end_str: str,
    zone: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    start = datetime.strptime(start_str, "%Y-%m-%d").date()
    end = datetime.strptime(end_str, "%Y-%m-%d").date()

    # --- Batch : 6 requêtes pour tout le range ---
    settings = db.query(CompanySettings).first()
    tolerance = settings.overtime_tolerance_hours if settings else 3.0

    closures = db.query(CompanyClosure).filter(
        CompanyClosure.start_date <= end,
        CompanyClosure.end_date >= start
    ).all()
    closed_dates = set()
    for c in closures:
        d = c.start_date
        while d <= c.end_date:
            if start <= d <= end:
                closed_dates.add(d)
            d += timedelta(days=1)

    emp_query = db.query(Employee)
    if zone:
        emp_query = emp_query.filter(Employee.zone == zone)
    employees = emp_query.all()

    range_start_utc, _ = _utc_bounds(start)
    _, range_end_utc    = _utc_bounds(end)

    absences = db.query(Absence).filter(
        Absence.start_date < range_end_utc,
        Absence.end_date >= range_start_utc,
    ).all()

    progressive = db.query(ProgressiveHours).filter(
        ProgressiveHours.start_date <= end,
        ProgressiveHours.end_date >= start,
    ).all()

    int_query = db.query(Intervention).options(
        selectinload(Intervention.employees),
        selectinload(Intervention.hourly_rate),
    ).filter(
        Intervention.start_time >= range_start_utc,
        Intervention.start_time < range_end_utc,
        Intervention.status != "cancelled",
        Intervention.type != "devis",
        ~Intervention.tour_run.has() | Intervention.tour_run.has(TourRun.publication_status == "published"),
    )
    if city:
        int_query = int_query.filter(Intervention.city == city)
    elif zone:
        int_query = int_query.filter(Intervention.zone == zone)
    interventions = int_query.all()

    # Index interventions par jour
    from collections import defaultdict
    interventions_by_day: Dict[date, list] = defaultdict(list)
    for iv in interventions:
        day = iv.start_time.date() if iv.start_time else None
        if day:
            interventions_by_day[day].append(iv)

    # Index absences par employé
    def is_absent(emp_id, d: date) -> bool:
        for ab in absences:
            if ab.employee_id == emp_id and ab.start_date.date() <= d <= ab.end_date.date():
                return True
        return False

    results = {}
    current = start
    while current <= end:
        if current in closed_dates:
            results[current.strftime("%Y-%m-%d")] = {
                "date": current.strftime("%Y-%m-%d"),
                "capacity_hours": 0, "planned_hours": 0,
                "tolerance": tolerance, "present_employees": 0, "status": "closed"
            }
            current += timedelta(days=1)
            continue

        total_capacity = 0.0
        present_count = 0
        for emp in employees:
            if not is_absent(emp.id, current):
                h = _get_employee_hours_for_day(emp, current, progressive)
                total_capacity += h
                if h > 0:
                    present_count += 1

        total_planned = 0.0
        for iv in interventions_by_day.get(current, []):
            h = intervention_hours(iv)
            if h > 0:
                total_planned += h

        if total_planned > (total_capacity + tolerance):
            status = "overload"
        elif total_planned > total_capacity:
            status = "warning"
        else:
            status = "ok"

        results[current.strftime("%Y-%m-%d")] = {
            "date": current.strftime("%Y-%m-%d"),
            "capacity_hours": round(total_capacity, 1),
            "planned_hours": round(total_planned, 1),
            "tolerance": tolerance,
            "present_employees": present_count,
            "status": status,
        }
        current += timedelta(days=1)

    return results


@router.get("/monthly-revenue")
def get_monthly_revenue(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    CA réalisé par mois, sur les `months` derniers mois (mois courant inclus).

    Le dashboard calculait ces totaux côté mobile, ce qui l'obligeait à
    télécharger tout l'historique des interventions au démarrage. L'agrégation
    est faite ici en SQL : la réponse tient en quelques lignes {month, revenue},
    assez légère pour être conservée hors ligne et affichée immédiatement.

    Les mois sans chiffre d'affaires sont renvoyés à 0 plutôt qu'omis, pour que
    le graphique garde toujours le même nombre de points.
    """
    months = max(1, min(months, 24))

    today = datetime.now(BRUSSELS_TZ).date()
    year, month = today.year, today.month - (months - 1)
    while month <= 0:
        month += 12
        year -= 1

    start_utc = datetime(year, month, 1, tzinfo=BRUSSELS_TZ).astimezone(timezone.utc)

    # Les mois sont découpés en heure de Bruxelles, pas en UTC : sinon une
    # intervention du 1er du mois à 00h30 locale bascule dans le mois précédent.
    month_expr = func.date_trunc(
        "month", func.timezone("Europe/Brussels", Intervention.start_time)
    )
    rows = (
        db.query(
            month_expr.label("month"),
            func.sum(Intervention.price_estimated).label("revenue"),
        )
        .filter(
            Intervention.status == "done",
            Intervention.start_time >= start_utc,
        )
        .group_by(month_expr)
        .all()
    )
    totals = {r.month.strftime("%Y-%m"): float(r.revenue or 0) for r in rows}

    result = []
    for _ in range(months):
        key = f"{year:04d}-{month:02d}"
        result.append({"month": key, "revenue": round(totals.get(key, 0.0), 2)})
        month += 1
        if month > 12:
            month = 1
            year += 1
    return result
