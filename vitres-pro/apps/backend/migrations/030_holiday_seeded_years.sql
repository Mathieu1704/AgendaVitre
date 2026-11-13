-- Jours feries : les feries legaux belges sont pre-remplis dans
-- company_closures une seule fois par annee. Cette table retient les annees
-- deja pre-remplies, pour qu'un ferie retire par un admin (journee
-- travaillee exceptionnellement) ne soit jamais recree automatiquement.

CREATE TABLE IF NOT EXISTS holiday_seeded_years (
  year INTEGER PRIMARY KEY,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
