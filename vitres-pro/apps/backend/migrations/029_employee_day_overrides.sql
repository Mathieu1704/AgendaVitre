-- Jours ponctuels d'un sous-traitant : heures prevues pour UNE date precise,
-- prioritaires sur hours_per_weekday (ex. Dylan absent le lundi 26/10 -> 0h,
-- vient le mardi 27/10 -> 8h), sans se repeter les semaines suivantes.

CREATE TABLE IF NOT EXISTS employee_day_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours FLOAT NOT NULL CHECK (hours >= 0 AND hours <= 24),
  UNIQUE (employee_id, date)
);
