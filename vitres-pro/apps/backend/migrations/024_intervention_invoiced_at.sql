-- Horodatage "facture traitee" pour l'ecran Facturation (Melissa coche au fur
-- et a mesure les RDV FAC/FAC+Cash deja encodes dans l'outil de facturation
-- externe). NULL = pas encore facture.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
