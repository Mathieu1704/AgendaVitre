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
        employees=[],
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


class CloserTests(unittest.TestCase):
    def test_admin_designates_assigned_employee_as_collector(self):
        intervention = make_intervention(status="planned")
        axel = SimpleNamespace(id=uuid4())
        intervention.employees = [axel, SimpleNamespace(id=uuid4())]
        admin = SimpleNamespace(id=uuid4(), role="admin")

        result = update_intervention(
            intervention.id,
            {"status": "done", "closed_by_employee_id": str(axel.id)},
            db=FakeSession(intervention),
            current_user=admin,
        )

        self.assertEqual(result.closed_by_employee_id, axel.id)

    def test_admin_cannot_designate_unassigned_employee(self):
        intervention = make_intervention(status="planned")
        intervention.employees = [SimpleNamespace(id=uuid4())]
        db = FakeSession(intervention)

        with self.assertRaises(HTTPException) as context:
            update_intervention(
                intervention.id,
                {"status": "done", "closed_by_employee_id": str(uuid4())},
                db=db,
                current_user=SimpleNamespace(id=uuid4(), role="admin"),
            )

        self.assertEqual(context.exception.status_code, 422)
        self.assertFalse(db.committed)

    def test_employee_cannot_designate_another_collector(self):
        intervention = make_intervention(status="planned")
        employee = SimpleNamespace(id=uuid4(), role="employee")
        colleague = SimpleNamespace(id=uuid4())
        intervention.employees = [employee, colleague]

        result = update_intervention(
            intervention.id,
            {"status": "done", "closed_by_employee_id": str(colleague.id)},
            db=FakeSession(intervention),
            current_user=employee,
        )

        self.assertEqual(result.closed_by_employee_id, employee.id)


if __name__ == "__main__":
    unittest.main()


class DeferredCashCarryTests(unittest.TestCase):
    """Solde cash reporte (client absent) : rattache au RDV suivant, conserve
    quand le prix est reecrit depuis le formulaire, rendu si annule."""

    def _pair(self, amount=35, payment_mode="cash"):
        source = SimpleNamespace(id=uuid4(), deferred_cash_amount=amount, deferred_settled_by_intervention_id=None)
        target = SimpleNamespace(
            id=uuid4(), price_estimated=35, carried_over_deferred_amount=None,
            payment_mode=payment_mode, amount_cash=None, amount_invoice=None,
        )
        return source, target

    def test_attach_adds_to_price_and_marks_settled(self):
        from app.routers.interventions import _attach_deferred
        source, target = self._pair()
        _attach_deferred(source, target)
        self.assertEqual(target.price_estimated, 70)
        self.assertEqual(target.carried_over_deferred_amount, 35)
        self.assertEqual(source.deferred_settled_by_intervention_id, target.id)

    def test_attach_then_detach_restores_target(self):
        from app.routers.interventions import _attach_deferred, _detach_deferred
        source, target = self._pair(payment_mode="invoice_cash")
        target.amount_cash, target.amount_invoice = 10, 25
        _attach_deferred(source, target)
        self.assertEqual(target.amount_cash, 45)
        _detach_deferred(source, target)
        self.assertEqual(target.price_estimated, 35)
        self.assertIsNone(target.carried_over_deferred_amount)
        self.assertEqual(target.amount_cash, 10)
        self.assertIsNone(source.deferred_settled_by_intervention_id)

    def test_form_price_keeps_carried_over(self):
        # Bug du 28/10 : l'edition admin renvoyait 35 (prestations) et
        # effacait les 35 reportes deja absorbes.
        from app.routers.interventions import _reapply_carried_over
        _, target = self._pair()
        target.carried_over_deferred_amount = 35
        target.price_estimated = 35  # valeur envoyee par le formulaire
        _reapply_carried_over(target)
        self.assertEqual(target.price_estimated, 70)

    def test_form_split_on_items_only_gets_cash_completed(self):
        from app.routers.interventions import _reapply_carried_over, _validate_payment_split
        _, target = self._pair(payment_mode="invoice_cash")
        target.carried_over_deferred_amount = 35
        target.price_estimated, target.amount_cash, target.amount_invoice = 35, 10, 25
        _reapply_carried_over(target)
        self.assertEqual(target.amount_cash, 45)
        _validate_payment_split(target.payment_mode, target.price_estimated, target.amount_cash, target.amount_invoice)

    def test_form_split_already_on_full_total_is_untouched(self):
        from app.routers.interventions import _reapply_carried_over
        _, target = self._pair(payment_mode="invoice_cash")
        target.carried_over_deferred_amount = 35
        target.price_estimated, target.amount_cash, target.amount_invoice = 35, 45, 25
        _reapply_carried_over(target)
        self.assertEqual((target.price_estimated, target.amount_cash), (70, 45))
