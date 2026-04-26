from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.sql import func

from app.models.models import get_db, Intervention, Employee, Absence, CompanySettings, ProgressiveHours, CompanyClosure
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

    # 2. Heures par jour définies sur l'employé
    if emp.hours_per_weekday:
        return float(emp.hours_per_weekday.get(weekday_key, 0))

    # 3. Fallback : daily_capacity (ancien comportement)
    return emp.daily_capacity


def calculate_day_stats(target_date: date, db: Session, zone: Optional[str] = None, sub_zone: Optional[str] = None):
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

    absences = db.query(Absence).filter(
        func.date(Absence.start_date) <= target_date,
        func.date(Absence.end_date) >= target_date
    ).all()
    absent_ids = [a.employee_id for a in absences]

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
        func.date(Intervention.start_time) == target_date
    )
    if sub_zone:
        int_query = int_query.filter(Intervention.sub_zone == sub_zone)
    elif zone:
        int_query = int_query.filter(Intervention.zone == zone)
    interventions = int_query.all()

    def _intervention_hours(interv) -> float:
        """
        Règle métier :
        - hourly_rate_id set + price_estimated > 0 → prix / taux
        - time_tbd = True (reprise non-admin) → durée stockée (end - start)
        - Tout le reste → 0 (exclu du total planifié)
        """
        if interv.hourly_rate_id and interv.hourly_rate:
            if interv.hourly_rate.time_only:
                if interv.start_time and interv.end_time:
                    return (interv.end_time - interv.start_time).total_seconds() / 3600
                return 0.0
            if (interv.price_estimated
                    and float(interv.price_estimated) > 0
                    and interv.hourly_rate.rate > 0):
                return float(interv.price_estimated) / interv.hourly_rate.rate
        return 0.0

    total_planned = 0
    for inter in interventions:
        hours = _intervention_hours(inter)
        if hours <= 0:
            continue
        nb_assigned = len(inter.employees)
        total_planned += hours * (nb_assigned if nb_assigned > 0 else 1)

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

@router.get("/daily-stats")
def get_daily_stats_endpoint(
    date_str: str,
    zone: Optional[str] = None,
    sub_zone: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return calculate_day_stats(d, db, zone=zone, sub_zone=sub_zone)

@router.get("/range-stats")
def get_range_stats_endpoint(
    start_str: str,
    end_str: str,
    zone: Optional[str] = None,
    sub_zone: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    start = datetime.strptime(start_str, "%Y-%m-%d").date()
    end = datetime.strptime(end_str, "%Y-%m-%d").date()

    results = {}
    current = start
    while current <= end:
        stats = calculate_day_stats(current, db, zone=zone, sub_zone=sub_zone)
        results[stats["date"]] = stats
        current += timedelta(days=1)

    return results