-- Split du montant pour le mode de paiement FAC+ESP (invoice_cash) : permet
-- de distinguer la part payee en especes de la part facturee sur une meme
-- intervention. Nullable, pas de backfill : impossible de deduire un split
-- pour les interventions deja closes avant cette migration.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS amount_cash NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amount_invoice NUMERIC(10,2);
