-- Seuil applique AVANT weekly_floor_from (NULL = 37h standard). Permet de
-- modifier le seuil depuis l'app avec une date d'effet sans que les semaines
-- d'avant, pas encore soldees, retombent a 37h au lieu de l'ancien seuil.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_floor_previous_hours FLOAT;
