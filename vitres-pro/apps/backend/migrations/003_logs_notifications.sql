-- Migration 003: audit_logs, notifications, reprise fields, recurrence fields

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(30) NOT NULL,  -- 'created', 'deleted', 'modified', 'status_change', 'no_reprise'
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  intervention_id UUID REFERENCES interventions(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_intervention ON audit_logs(intervention_id);

-- Table: notifications in-app
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,  -- 'no_reprise', 'info', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,  -- { intervention_id, employee_id, ... }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);

-- Champs reprise sur interventions
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS reprise_taken BOOLEAN,
  ADD COLUMN IF NOT EXISTS reprise_note TEXT;

-- Champs récurrence sur interventions
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_interventions_recurrence_group
  ON interventions(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
