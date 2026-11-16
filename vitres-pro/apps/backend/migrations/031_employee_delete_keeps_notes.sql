-- Supprimer un employe ne doit plus etre bloque par ses notes d'intervention
-- ni par ses evenements bruts : on les conserve, sans auteur.
-- A appliquer AVANT de retenter une suppression d'employe ayant ecrit des notes.

ALTER TABLE intervention_notes ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE intervention_notes DROP CONSTRAINT IF EXISTS intervention_notes_author_id_fkey;
ALTER TABLE intervention_notes
  ADD CONSTRAINT intervention_notes_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE raw_calendar_events DROP CONSTRAINT IF EXISTS raw_calendar_events_employee_id_fkey;
ALTER TABLE raw_calendar_events
  ADD CONSTRAINT raw_calendar_events_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
