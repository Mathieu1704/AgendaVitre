-- Cash a remettre "en temps reel" : jusqu'ici, "Paye" figeait le montant de
-- la semaine au moment du clic et marquait la semaine reglee. Regle un
-- jeudi, le cash encaisse le vendredi n'etait plus jamais compte (la semaine
-- suivante repartait de zero).
--
-- Desormais chaque reglement marque les RDV precis qu'il couvre
-- (cash_settlement_id) ; le cash a remettre = RDV cash termines pas encore
-- couverts par un reglement. Plusieurs reglements par semaine sont possibles.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS cash_settlement_id UUID
  REFERENCES cash_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_interventions_cash_settlement_id
  ON interventions(cash_settlement_id);

ALTER TABLE cash_settlements
  DROP CONSTRAINT IF EXISTS uq_cash_settlement_employee_week;

-- Le rattachement des RDV deja regles aux anciens reglements se fait par
-- scripts/backfill_cash_settlement_links.py (meme regle de calcul que le
-- backend, qui ne peut pas s'exprimer simplement en SQL).
