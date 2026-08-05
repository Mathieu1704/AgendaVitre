-- Migration 005 : support du mode hors-connexion (file d'attente cote mobile)
--
-- La file d'attente rejoue les ecritures faites hors reseau. Les PATCH sont
-- naturellement idempotents (ils ne touchent que les cles fournies), mais les
-- POST creent une ressource a chaque appel : rejouer un POST = doublon.
-- On journalise donc les operations client pour pouvoir les detecter.

CREATE TABLE IF NOT EXISTS client_operations (
  id           UUID PRIMARY KEY,                                    -- id genere par le client
  employee_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
  endpoint     TEXT NOT NULL,
  result_id    UUID,                                               -- id de la ressource creee, si applicable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_operations_created
  ON client_operations(created_at DESC);

-- Horodatage de modification : sert au delta-sync et au diagnostic de conflit
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
