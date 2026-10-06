-- Supprime le niveau "Sections" : pur regroupement visuel sans logique
-- metier (aucune regle de facturation/filtre n'en depend). Les commerces
-- (tour_stops) sont desormais ordonnes directement sous le modele par leur
-- `position`, sans section intermediaire.

-- Reindexe les stops pour que leur position globale respecte l'ancien ordre
-- (section.position, puis stop.position a l'interieur de la section), avant
-- de perdre la cle section_id.
WITH ordered AS (
  SELECT ts.id,
         ROW_NUMBER() OVER (
           PARTITION BY ts.template_id
           ORDER BY sec.position, ts.position
         ) - 1 AS new_position
  FROM tour_stops ts
  LEFT JOIN tour_sections sec ON sec.id = ts.section_id
)
UPDATE tour_stops ts
SET position = ordered.new_position
FROM ordered
WHERE ts.id = ordered.id;

ALTER TABLE tour_stops DROP COLUMN IF EXISTS section_id;
DROP TABLE IF EXISTS tour_sections;

ALTER TABLE tour_run_stops DROP COLUMN IF EXISTS section_label;
