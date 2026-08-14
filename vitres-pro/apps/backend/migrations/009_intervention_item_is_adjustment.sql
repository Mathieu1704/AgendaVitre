-- Migration 009 : ajustements ad-hoc a la cloture (deduction partielle / supplement)
--
-- Distingue une ligne InterventionItem creee comme correction de prix a la
-- cloture (deduction partielle sur une prestation non finie, ou supplement
-- impreve) d'une vraie prestation du catalogue. Sert uniquement a exclure ces
-- lignes du prerempissage d'une future reprise (elles ne doivent pas devenir
-- des prestations recurrentes) ; elles restent visibles dans le detail de
-- l'intervention.

ALTER TABLE intervention_items ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN NOT NULL DEFAULT false;
