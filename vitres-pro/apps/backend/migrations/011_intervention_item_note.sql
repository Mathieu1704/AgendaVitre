-- Migration 011 : note par prestation decochee a la cloture
--
-- Motif saisi (employe ou sous-traitant) quand une prestation est marquee
-- "pas faite" / "faite en partie" a la fermeture d'une intervention.

ALTER TABLE intervention_items ADD COLUMN IF NOT EXISTS note TEXT;
