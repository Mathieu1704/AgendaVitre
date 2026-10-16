-- Date d'effet du seuil hebdo propre a un employe : avant cette date, les
-- semaines restent calculees avec le seuil standard (37h). NULL = toujours.
-- Jessy : depuis la semaine du 12/10/2026.
-- Xavier : 20h a partir du 19/10/2026 (pose apres deploiement du code qui
-- lit cette date, sinon sa semaine en cours serait calculee a 20h).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_floor_from DATE;

UPDATE employees SET weekly_floor_from = '2026-10-12'
WHERE full_name = 'Jessy Wargnies';
