-- Migration 010 : plage de validité optionnelle pour l'horaire hebdo des sous-traitants
--
-- Un sous-traitant travaille souvent sur une periode limitee. Plutot que de
-- compter sur l'admin pour remettre ses heures a 0 manuellement a la fin de
-- la mission, on stocke une date de debut/fin de validite optionnelle sur
-- hours_per_weekday. Hors de cette plage, l'employe est traite comme ayant
-- 0h prevues ce jour-la (voir _get_employee_hours_for_day). Les deux champs
-- sont independants et optionnels ; NULL/NULL = comportement actuel inchange.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS hours_valid_from DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hours_valid_until DATE;
