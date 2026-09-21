import unittest
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from app.routers.timetracking import (
    WEEKLY_FLOOR_HOURS,
    _employee_actual_hours_for_day,
    _is_neutral_day,
    _utc_bounds,
    weekly_delta_hours,
)


def _make_employee():
    return SimpleNamespace(
        id="emp-1",
        hours_per_weekday={"1": 8, "2": 8, "3": 8, "4": 8, "5": 7, "6": 0, "7": 0},
        hours_valid_from=None,
        hours_valid_until=None,
        daily_capacity=8,
    )


def _make_absence(emp_id, start_day, end_day):
    # Reproduit team.tsx:628 : end_date = 23:59 heure locale du dernier jour,
    # PAS minuit du lendemain (sinon l'absence "déborde" sur le jour suivant).
    start, _ = _utc_bounds(start_day)
    _, next_day_start = _utc_bounds(end_day)
    end = next_day_start - timedelta(minutes=1)
    return SimpleNamespace(employee_id=emp_id, start_date=start, end_date=end)


def _make_closure(start_day, end_day):
    return SimpleNamespace(start_date=start_day, end_date=end_day)


def _week_delta(emp, absences, closures, entries_by_day=None):
    """Reproduit la logique de _weekly_actual_hours/_overtime_balance sans DB."""
    entries_by_day = entries_by_day or {}
    monday = date(2026, 3, 2)
    total = 0.0
    floor_reduction = 0.0
    from app.routers.planning import _get_employee_hours_for_day

    for i in range(5):
        d = monday + timedelta(days=i)
        total += _employee_actual_hours_for_day(emp, d, entries_by_day, absences, [], closures)
        if _is_neutral_day(emp.id, d, absences, closures):
            floor_reduction += _get_employee_hours_for_day(emp, d, [])
    reduced_floor = max(0.0, WEEKLY_FLOOR_HOURS - floor_reduction)
    return weekly_delta_hours(total, floor=reduced_floor)


class AbsenceAndClosureNeutralityTests(unittest.TestCase):
    """Un employé en congé (ou l'entreprise fermée) ne doit ni gagner ni
    perdre d'heures sup : régression sur le bug où une semaine complète de
    congé créditait les heures théoriques (+2h de sup au lieu de 0h)."""

    def setUp(self):
        self.emp = _make_employee()
        self.monday = date(2026, 3, 2)

    def test_full_week_absence_is_neutral(self):
        absences = [_make_absence(self.emp.id, self.monday, self.monday + timedelta(days=4))]
        delta = _week_delta(self.emp, absences, closures=[])
        self.assertEqual(delta, 0.0)

    def test_full_week_company_closure_is_neutral(self):
        closures = [_make_closure(self.monday, self.monday + timedelta(days=4))]
        delta = _week_delta(self.emp, absences=[], closures=closures)
        self.assertEqual(delta, 0.0)

    def test_partial_absence_reduces_floor_proportionally(self):
        # Lundi + mardi en congé (8h + 8h théoriques) : plancher réduit de 16h.
        absences = [_make_absence(self.emp.id, self.monday, self.monday + timedelta(days=1))]
        delta = _week_delta(self.emp, absences, closures=[])
        self.assertEqual(delta, -(WEEKLY_FLOOR_HOURS - 16.0))

    def test_normal_week_unaffected(self):
        entries_by_day = {}
        for i in range(5):
            d = self.monday + timedelta(days=i)
            hours = 8 if i < 4 else 7
            clock_in = datetime(d.year, d.month, d.day, 8, tzinfo=timezone.utc)
            entries_by_day[d] = SimpleNamespace(
                clock_in_at=clock_in, clock_out_at=clock_in + timedelta(hours=hours)
            )
        delta = _week_delta(self.emp, absences=[], closures=[], entries_by_day=entries_by_day)
        self.assertEqual(delta, 39.0 - WEEKLY_FLOOR_HOURS)

    def test_absence_day_credits_zero_not_theoretical_hours(self):
        absences = [_make_absence(self.emp.id, self.monday, self.monday)]
        hours = _employee_actual_hours_for_day(self.emp, self.monday, {}, absences, [], [])
        self.assertEqual(hours, 0.0)


if __name__ == "__main__":
    unittest.main()
