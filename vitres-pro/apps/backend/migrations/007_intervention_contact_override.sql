-- Migration 007 : coordonnees de contact directement sur l'intervention
--
-- Uniquement utilisees quand aucun client n'est lie (address/phone/email vivent
-- normalement sur clients) : permet de corriger/encoder une adresse mal
-- geocodee, un telephone ou un email pour un job ponctuel sans fiche client.

ALTER TABLE interventions ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS email TEXT;
