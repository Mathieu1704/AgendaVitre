-- reprise_of_id : lien persiste vers l'intervention source d'une reprise
-- (jusqu'ici transitoire cote Pydantic uniquement, jete apres creation).
-- deferred_cash_amount / deferred_settled_by_intervention_id : report de
-- paiement cash quand le client est absent au passage. Le montant reste
-- "en attente" (non compte dans le total cash de la semaine) tant que
-- deferred_settled_by_intervention_id est NULL.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS reprise_of_id UUID REFERENCES interventions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deferred_cash_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deferred_settled_by_intervention_id UUID REFERENCES interventions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interventions_reprise_of_id ON interventions(reprise_of_id);
