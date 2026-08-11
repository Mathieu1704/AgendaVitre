-- Migration 006 : catalogue de services persistant pour les interventions
-- sans client (coche/décoche par reprise, comme client_services mais sans
-- fiche client). Purement additif : nouvelle colonne nullable + nouvelle
-- table, aucune donnée ni requête existante n'est modifiée.

-- Identité stable qui relie une intervention à ses reprises successives
-- (une reprise crée une ligne indépendante ; sans ce champ, rien ne les relie).
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS reprise_chain_id UUID;

CREATE INDEX IF NOT EXISTS idx_interventions_reprise_chain
  ON interventions(reprise_chain_id);

CREATE TABLE IF NOT EXISTS intervention_services (
  id                UUID PRIMARY KEY,
  reprise_chain_id  UUID NOT NULL,
  label             TEXT NOT NULL,
  price             NUMERIC(10, 2) NOT NULL DEFAULT 0,
  position          FLOAT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_intervention_services_chain
  ON intervention_services(reprise_chain_id);

ALTER TABLE intervention_items
  ADD COLUMN IF NOT EXISTS intervention_service_id UUID
    REFERENCES intervention_services(id) ON DELETE SET NULL;
