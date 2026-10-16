-- Seuil hebdomadaire d'heures sup propre a un employe (temps partiel).
-- NULL = seuil standard de 37h (WEEKLY_FLOOR_HOURS).
-- Jessy Wargnies (temps partiel) : 29,36h (decimal).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_floor_hours FLOAT;

UPDATE employees SET weekly_floor_hours = 29.36
WHERE full_name = 'Jessy Wargnies';
