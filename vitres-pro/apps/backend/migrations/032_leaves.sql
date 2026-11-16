-- Congés : droit annuel par employé + demandes soumises à validation.
-- Le solde se calcule à partir des absences de type VA (une demande acceptée
-- en crée une).

CREATE TABLE IF NOT EXISTS leave_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  days DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (days >= 0),
  CONSTRAINT uq_leave_entitlements_employee_year UNIQUE (employee_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DOUBLE PRECISION NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
  comment TEXT,
  decision_note TEXT,
  decided_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  absence_id UUID REFERENCES absences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS ix_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS ix_leave_requests_status ON leave_requests (status);

-- Même protection que les autres tables de l'app : accès par le backend uniquement.
ALTER TABLE leave_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
