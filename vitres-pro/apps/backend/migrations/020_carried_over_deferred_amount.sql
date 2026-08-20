-- Montant absorbe depuis un solde cash reporte (client absent au RDV
-- precedent), persiste sur l'intervention qui l'a effectivement encaisse.
--
-- Sert a exclure ce montant du calcul des heures "planifiees" (taux horaire
-- en euros/h = price_estimated / taux) : encaisser une vieille dette ne
-- prend pas de temps supplementaire sur place, seules les prestations
-- reellement prevues doivent compter dans la duree.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS carried_over_deferred_amount NUMERIC(10,2);

-- Backfill : interventions ayant deja absorbe un solde reporte avant cette
-- colonne (reglement deja marque via deferred_settled_by_intervention_id).
UPDATE interventions AS settler
SET carried_over_deferred_amount = source.deferred_cash_amount
FROM interventions AS source
WHERE source.deferred_settled_by_intervention_id = settler.id
  AND source.deferred_cash_amount IS NOT NULL
  AND settler.carried_over_deferred_amount IS NULL;
