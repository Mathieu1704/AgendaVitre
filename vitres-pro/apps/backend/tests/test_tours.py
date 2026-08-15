import json
import unittest
from datetime import date, time
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from openpyxl import load_workbook

from app.routers.tours import (
    _assert_run_access,
    _validate_template_activation,
    _workweek_buckets,
    _xlsx_bytes,
)
from app.schemas.schemas import TourTemplateInput


ROOT = Path(__file__).resolve().parents[1]


class PermissionTests(unittest.TestCase):
    def setUp(self):
        assigned = SimpleNamespace(id="employee-1")
        intervention = SimpleNamespace(employees=[assigned], status="planned")
        self.run = SimpleNamespace(publication_status="published", intervention=intervention)

    def test_assigned_employee_can_execute(self):
        _assert_run_access(self.run, SimpleNamespace(id="employee-1", role="employee"), execute=True)

    def test_unassigned_employee_is_refused(self):
        with self.assertRaises(HTTPException) as context:
            _assert_run_access(self.run, SimpleNamespace(id="employee-2", role="employee"))
        self.assertEqual(context.exception.status_code, 403)

    def test_subcontractor_is_refused(self):
        with self.assertRaises(HTTPException) as context:
            _assert_run_access(self.run, SimpleNamespace(id="sub-1", role="subcontractor"))
        self.assertEqual(context.exception.status_code, 403)

    def test_draft_is_invisible_to_employee(self):
        self.run.publication_status = "draft"
        with self.assertRaises(HTTPException):
            _assert_run_access(self.run, SimpleNamespace(id="employee-1", role="employee"))


class TemplateValidationTests(unittest.TestCase):
    def _payload(self, **changes):
        values = {
            "name": "Tournee test",
            "zone": "hainaut",
            "weekday": 2,
            "default_start_time": time(8),
            "default_end_time": time(16),
        }
        values.update(changes)
        return TourTemplateInput(**values)

    def test_archived_template_cannot_be_active(self):
        with self.assertRaises(HTTPException) as context:
            _validate_template_activation(self._payload(active=True, archived=True))
        self.assertEqual(context.exception.status_code, 422)

    def test_default_end_must_follow_start(self):
        with self.assertRaises(HTTPException) as context:
            _validate_template_activation(self._payload(default_start_time=time(16), default_end_time=time(8)))
        self.assertEqual(context.exception.status_code, 422)

    def test_active_template_requires_a_service(self):
        with self.assertRaises(HTTPException) as context:
            _validate_template_activation(self._payload(active=True, sections=[]))
        self.assertEqual(context.exception.status_code, 422)

    def test_active_template_with_a_service_is_valid(self):
        payload = self._payload(active=True, sections=[{
            "label": "Section",
            "stops": [{"name": "Commerce", "services": [{"label": "2 F", "price_ht": 30}]}],
        }])
        _validate_template_activation(payload)  # ne doit pas lever


class BillingWorkbookTests(unittest.TestCase):
    def test_five_workweek_columns(self):
        self.assertEqual(len(_workweek_buckets(date(2026, 3, 1))), 5)
        self.assertEqual(len(_workweek_buckets(date(2026, 2, 1))), 5)

    def test_workbook_names_numeric_amounts_and_totals(self):
        buckets = _workweek_buckets(date(2026, 3, 1))
        rows = {
            "Commerce A": {
                "payment_text": "F -> mens.",
                "amounts": {buckets[0]: Decimal("10.5"), buckets[1]: Decimal("20")},
            },
        }
        content = _xlsx_bytes(buckets, rows)
        workbook = load_workbook(BytesIO(content), data_only=False)
        self.assertEqual(workbook.sheetnames, ["Facturation"])
        sheet = workbook["Facturation"]
        self.assertEqual(sheet["A2"].value, "Commerce A")
        self.assertEqual(sheet["B2"].value, "F -> mens.")
        self.assertEqual(sheet["C2"].value, 10.5)
        last_column = 2 + len(buckets)
        total_cell = sheet.cell(row=2, column=last_column + 1)
        self.assertTrue(str(total_cell.value).startswith("=SUM("))


class InitialSeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_path = ROOT / "data" / "tours_initial_seed.json"
        if not seed_path.exists():
            raise unittest.SkipTest("La reprise privée Word n'est pas présente dans cet environnement")
        cls.seed = json.loads(seed_path.read_text(encoding="utf-8"))

    def test_all_source_documents_are_present_with_negligible_ignored_rows(self):
        self.assertEqual(self.seed["stats"]["templates"], 21)
        self.assertEqual(self.seed["stats"]["hainaut"], 11)
        self.assertEqual(self.seed["stats"]["ardennes"], 10)
        self.assertEqual(self.seed["stats"]["stops"], 517)
        self.assertEqual(self.seed["stats"]["services"], 875)
        # Sans parsing de fréquence/paiement, une ligne de continuation qui ne
        # porte plus qu'un code paiement isolé (ex: "F") et rien d'autre n'a
        # plus rien à rattacher au commerce précédent. Cas negligeable (1/517).
        total_ignored = sum(len(template["import_report"]["ignored_rows"]) for template in self.seed["templates"])
        self.assertLessEqual(total_ignored, 2)

    def test_mons_is_wednesday_and_two_ardennes_route_two_are_distinct(self):
        mons = next(template for template in self.seed["templates"] if template["name"] == "Tournée Mons")
        self.assertEqual(mons["weekday"], 3)
        wednesday_route_twos = [
            template for template in self.seed["templates"]
            if template["zone"] == "ardennes" and template["weekday"] == 3 and template["name"].startswith("Tournée 2")
        ]
        self.assertEqual(len(wednesday_route_twos), 2)

    def test_import_is_safe_by_default(self):
        self.assertTrue(all(not template["active"] for template in self.seed["templates"]))

    def test_services_are_free_text_not_structured_billing(self):
        services = [
            service
            for template in self.seed["templates"]
            for section in template["sections"]
            for stop in section["stops"]
            for service in stop["services"]
        ]
        self.assertTrue(services)
        self.assertTrue(all("billing_mode" not in service for service in services))
        self.assertTrue(all("needs_review" not in service for service in services))


if __name__ == "__main__":
    unittest.main()
