import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

from app.routers import employees as employees_router
from app.routers.employees import delete_employee


class FakeQuery:
    def __init__(self, session, employee):
        self.session = session
        self.employee = employee

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self.employee

    def update(self, values, **_kwargs):
        self.session.updates.append(values)
        return 0


class FakeSession:
    """Session minimale : compte les commits et peut refuser la suppression."""

    def __init__(self, employee, fail_on_commit=False):
        self.employee = employee
        self.fail_on_commit = fail_on_commit
        self.commits = 0
        self.rollbacks = 0
        self.deleted = []
        self.updates = []

    def query(self, _model):
        return FakeQuery(self, self.employee)

    def delete(self, value):
        self.deleted.append(value)

    def commit(self):
        if self.fail_on_commit:
            raise RuntimeError("violates foreign key constraint")
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class DeleteEmployeeAtomicityTests(unittest.TestCase):
    def setUp(self):
        self.admin = SimpleNamespace(id=uuid4(), role="admin")
        self.target = SimpleNamespace(id=uuid4(), interventions=[object(), object()])

    def test_refus_de_la_base_ne_valide_rien(self):
        # Incident du 16/11/2026 : la désassignation était validée avant la
        # suppression, donc un refus laissait l'employé sans aucune intervention.
        db = FakeSession(self.target, fail_on_commit=True)
        with patch.object(employees_router, "supabase_admin") as supabase:
            with self.assertRaises(HTTPException) as ctx:
                delete_employee(self.target.id, db=db, current_user=self.admin)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(db.commits, 0)
        self.assertEqual(db.rollbacks, 1)
        supabase.auth.admin.delete_user.assert_not_called()

    def test_suppression_en_une_seule_transaction(self):
        db = FakeSession(self.target)
        with patch.object(employees_router, "supabase_admin") as supabase:
            delete_employee(self.target.id, db=db, current_user=self.admin)
        self.assertEqual(db.commits, 1)
        self.assertEqual(db.deleted, [self.target])
        # Notes et évènements bruts détachés de l'auteur avant la suppression.
        self.assertEqual(len(db.updates), 2)
        supabase.auth.admin.delete_user.assert_called_once()

    def test_non_admin_refuse(self):
        db = FakeSession(self.target)
        with self.assertRaises(HTTPException) as ctx:
            delete_employee(self.target.id, db=db, current_user=SimpleNamespace(id=uuid4(), role="employee"))
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(db.commits, 0)


if __name__ == "__main__":
    unittest.main()
