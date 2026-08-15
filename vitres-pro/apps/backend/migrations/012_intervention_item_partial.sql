-- Migration 012 : prestation "faite en partie" (sous-traitant)
--
-- Le sous-traitant n'a pas de montant a ajuster (prix masques), contrairement
-- a l'employe qui exprime le partiel via une deduction de prix. Ce flag
-- qualitatif permet de distinguer "pas fait du tout" de "fait en partie".

ALTER TABLE intervention_items ADD COLUMN IF NOT EXISTS partial BOOLEAN NOT NULL DEFAULT false;
