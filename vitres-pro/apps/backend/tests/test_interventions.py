import unittest
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException

from app.models.models import AuditLog
from app.routers.interventions import update_intervention


class FakeQuery:
    def __init__(self, intervention):
        self.intervention = intervention

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self.intervention


class FakeSession:
    def __init__(self, intervention):
        self.intervention = intervention
        self.added = []
        self.committed = False

    def query(self, _model):
        return FakeQuery(self.intervention)

    def add(self, value):
        self.added.append(value)

    def commit(self):
        self.committed = True

    def refresh(self, _value):
        pass


def make_intervention(status="done"):
    return SimpleNamespace(
        id=uuid4(),
        client_id=uuid4(),
        tour_run=None,
        type="intervention",
        status=status,
        payment_mode="cash",
        price_estimated=100,
        amount_cash=None,
        amount_invoice=None,
        reprise_taken=True,
        reprise_note="Conserver cette note",
        closed_by_employee_id=uuid4(),
    )


class ReopenPermissionTests(unittest.TestCase):
    def test_admin_can_reopen_done_intervention_without_changing_closure_data(self):
        intervention = make_intervention()
        original_closed_by = intervention.closed_by_employee_id
        db = FakeSession(intervention)
        admin = SimpleNamespace(id=uuid4(), role="admin")

        result = update_intervention(
            intervention.id,
            {"status": "planned"},
            db=db,
            current_user=admin,
        )

        self.assertEqual(result.status, "planned")
        self.assertTrue(result.reprise_taken)
        self.assertEqual(result.reprise_note, "Conserver cette note")
        self.assertEqual(result.closed_by_employee_id, original_closed_by)
        self.assertTrue(db.committed)
        audit = next(value for value in db.added if isinstance(value, AuditLog))
        self.assertEqual(audit.action_type, "status_change")
        self.assertEqual(audit.description, "Statut : Terminée → Planifiée")

    def test_employee_cannot_reopen_done_intervention(self):
        intervention = make_intervention()
        db = FakeSession(intervention)

        with self.assertRaises(HTTPException) as context:
            update_intervention(
                intervention.id,
                {"status": "planned"},
                db=db,
                current_user=SimpleNamespace(id=uuid4(), role="employee"),
            )

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(intervention.status, "done")
        self.assertFalse(db.committed)

    def test_subcontractor_cannot_reopen_done_intervention(self):
        intervention = make_intervention()
        db = FakeSession(intervention)

        with self.assertRaises(HTTPException) as context:
            update_intervention(
                intervention.id,
                {"status": "planned"},
                db=db,
                current_user=SimpleNamespace(id=uuid4(), role="subcontractor"),
            )

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(intervention.status, "done")
        self.assertFalse(db.committed)

    def test_employee_can_still_close_planned_intervention(self):
        intervention = make_intervention(status="planned")
        employee = SimpleNamespace(id=uuid4(), role="employee")
        db = FakeSession(intervention)

        result = update_intervention(
            intervention.id,
            {"status": "done"},
            db=db,
            current_user=employee,
        )

        self.assertEqual(result.status, "done")
        self.assertEqual(result.closed_by_employee_id, employee.id)
        self.assertTrue(db.committed)


if __name__ == "__main__":
    unittest.main()
