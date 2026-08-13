-- Migration 008 : case "a la demande" (+33%) par prestation
--
-- Prix de base reste dans `price` (inchange) ; on_demand est un booleen
-- persistant a cote. La majoration +33% est calculee a la volee partout ou
-- un total est somme (jamais ecrite en dur dans price).

ALTER TABLE intervention_items ADD COLUMN IF NOT EXISTS on_demand BOOLEAN NOT NULL DEFAULT false;
