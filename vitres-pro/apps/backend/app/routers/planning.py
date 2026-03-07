from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Dict
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


def calculate_day_stats(target_date: date, db: Session):
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

    all_employees = db.query(Employee).all()

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

    interventions = db.query(Intervention).filter(
        func.date(Intervention.start_time) == target_date
    ).all()

    total_planned = 0
    for inter in interventions:
        duration = (inter.end_time - inter.start_time).total_seconds() / 3600
        nb_assigned = len(inter.employees)
        if nb_assigned > 0:
            total_planned += (duration * nb_assigned)
        else:
            total_planned += duration

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
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user) 
):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return calculate_day_stats(d, db)

@router.get("/range-stats")
def get_range_stats_endpoint(
    start_str: str,
    end_str: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user) 
):
    start = datetime.strptime(start_str, "%Y-%m-%d").date()
    end = datetime.strptime(end_str, "%Y-%m-%d").date()
    
    results = {}
    current = start
    while current <= end:
        stats = calculate_day_stats(current, db)
        results[stats["date"]] = stats
        current += timedelta(days=1)
        
    return results