from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Dict
from sqlalchemy.sql import func

from app.models.models import get_db, Intervention, Employee, Absence, CompanySettings
from app.core.deps import get_current_user

router = APIRouter()

# --- SERVICE (Logique pure) ---
def calculate_day_stats(target_date: date, db: Session):
    settings = db.query(CompanySettings).first()
    tolerance = settings.overtime_tolerance_hours if settings else 3.0

    all_employees = db.query(Employee).all()
    
    absences = db.query(Absence).filter(
        func.date(Absence.start_date) <= target_date,
        func.date(Absence.end_date) >= target_date
    ).all()
    absent_ids = [a.employee_id for a in absences]

    total_capacity = 0
    present_count = 0
    for emp in all_employees:
        if emp.id not in absent_ids:
            total_capacity += emp.daily_capacity
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