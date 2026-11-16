import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.routers.leaves import leave_days, summarize

# Lun-jeu 8h, ven 7h, week-end non presté.
WEEK = {"1": 8, "2": 8, "3": 8, "4": 8, "5": 7, "6": 0, "7": 0}


def employee(hours=WEEK):
    return SimpleNamespace(
        id=uuid4(), full_name="Test", email="t@example.com", hours_per_weekday=hours,
        day_overrides=[], hours_valid_from=None, hours_valid_until=None, daily_capacity=8,
    )


def absence(start: date, end: date):
    # Mêmes bornes que l'app : minuit et 23:59 heure de Bruxelles (UTC+1 l'hiver).
    return SimpleNamespace(
        start_date=datetime(start.year, start.month, start.day, 0, 0, tzinfo=timezone.utc).replace(hour=0) ,
        end_date=datetime(end.year, end.month, end.day, 22, 59, tzinfo=timezone.utc),
    )


class LeaveDaysTests(unittest.TestCase):
    def test_semaine_complete_saute_le_week_end(self):
        # Lundi 4 au dimanche 10 janvier 2027 : 5 jours ouvrés.
        days = leave_days(employee(), date(2027, 1, 4), date(2027, 1, 10), set(), [])
        self.assertEqual(len(days), 5)

    def test_ferie_et_fermeture_ne_coutent_rien(self):
        closed = {date(2027, 1, 6)}
        days = leave_days(employee(), date(2027, 1, 4), date(2027, 1, 8), closed, [])
        self.assertEqual(len(days), 4)
        self.assertNotIn(date(2027, 1, 6), days)

    def test_jour_non_preste_ne_coute_rien(self):
        # Employé qui ne travaille pas le vendredi.
        emp = employee({**WEEK, "5": 0})
        days = leave_days(emp, date(2027, 1, 4), date(2027, 1, 8), set(), [])
        self.assertEqual(len(days), 4)

    def test_un_seul_jour(self):
        self.assertEqual(len(leave_days(employee(), date(2027, 1, 5), date(2027, 1, 5), set(), [])), 1)
        self.assertEqual(len(leave_days(employee(), date(2027, 1, 9), date(2027, 1, 9), set(), [])), 0)


class SummarizeTests(unittest.TestCase):
    def test_pris_prevu_et_solde(self):
        emp = employee()
        absences = [
            absence(date(2027, 3, 1), date(2027, 3, 5)),   # 5 jours, passés
            absence(date(2027, 7, 12), date(2027, 7, 16)),  # 5 jours, à venir
        ]
        row = summarize(emp, 2027, 20.0, absences, set(), [], 2.0, date(2027, 4, 1))
        self.assertEqual(row["months"][2], 5)
        self.assertEqual(row["months"][6], 5)
        self.assertEqual(row["taken"], 5)
        self.assertEqual(row["planned"], 5)
        self.assertEqual(row["pending"], 2.0)
        self.assertEqual(row["remaining"], 10)

    def test_absences_qui_se_chevauchent_ne_comptent_pas_double(self):
        emp = employee()
        absences = [
            absence(date(2027, 3, 1), date(2027, 3, 3)),
            absence(date(2027, 3, 2), date(2027, 3, 5)),
        ]
        row = summarize(emp, 2027, 0.0, absences, set(), [], 0.0, date(2027, 12, 31))
        self.assertEqual(row["taken"], 5)
        self.assertEqual(row["remaining"], -5)

    def test_absence_a_cheval_sur_deux_annees(self):
        emp = employee()
        # Mardi 29/12/2026 au mardi 5/01/2027 : seuls lun 4 et mar 5 comptent en 2027
        # (le 1er janvier est un vendredi férié, passé ici comme fermeture).
        row = summarize(emp, 2027, 0.0, [absence(date(2026, 12, 29), date(2027, 1, 5))],
                        {date(2027, 1, 1)}, [], 0.0, date(2027, 12, 31))
        self.assertEqual(row["taken"], 2)


if __name__ == "__main__":
    unittest.main()
