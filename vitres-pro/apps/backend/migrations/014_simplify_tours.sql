-- Simplification des tournees : plus de moteur de frequence ni de modes de
-- paiement structures. Le modele redevient fidele au tableau papier : texte
-- libre pour paiement/frequence, selection manuelle hebdomadaire par
-- l'admin (l'ancien "point" au crayon), pas de suggestion automatique.
-- Remplace entierement le schema de la migration 013 (aucune donnee de
-- production ne depend encore de ces tables : seed de test uniquement).

DROP TABLE IF EXISTS tour_billing_batches;
DROP TABLE IF EXISTS tour_billing_reviews;
DROP TABLE IF EXISTS tour_run_cash;
DROP TABLE IF EXISTS tour_run_services;
DROP TABLE IF EXISTS tour_run_stops;
DROP TABLE IF EXISTS tour_runs;
DROP TABLE IF EXISTS tour_service_schedules;
DROP TABLE IF EXISTS tour_services;
DROP TABLE IF EXISTS tour_stops;
DROP TABLE IF EXISTS tour_sections;
DROP TABLE IF EXISTS tour_templates;

CREATE TABLE tour_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  zone VARCHAR(20) NOT NULL CHECK (zone IN ('hainaut', 'ardennes')),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  default_start_time TIME NOT NULL,
  default_end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  source_document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tour_sections (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES tour_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX idx_tour_sections_template ON tour_sections(template_id);

CREATE TABLE tour_stops (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES tour_templates(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tour_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  note TEXT,
  payment_text TEXT,
  frequency_text TEXT,
  estimated_minutes INTEGER,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_tour_stops_template ON tour_stops(template_id);

CREATE TABLE tour_services (
  id UUID PRIMARY KEY,
  stop_id UUID NOT NULL REFERENCES tour_stops(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_ht NUMERIC(10, 2) NOT NULL DEFAULT 0,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_tour_services_stop ON tour_services(stop_id);

CREATE TABLE tour_runs (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES tour_templates(id) ON DELETE SET NULL,
  intervention_id UUID NOT NULL UNIQUE REFERENCES interventions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tour_run_template_day UNIQUE (template_id, scheduled_date)
);
CREATE INDEX idx_tour_runs_template ON tour_runs(template_id);
CREATE INDEX idx_tour_runs_date ON tour_runs(scheduled_date);

CREATE TABLE tour_run_stops (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES tour_runs(id) ON DELETE CASCADE,
  source_stop_id UUID REFERENCES tour_stops(id) ON DELETE SET NULL,
  section_label TEXT,
  name TEXT NOT NULL,
  note TEXT,
  payment_text TEXT,
  frequency_text TEXT,
  estimated_minutes INTEGER,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'partial', 'not_visited')),
  exception_reason TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tour_run_stops_run ON tour_run_stops(run_id);

CREATE TABLE tour_run_services (
  id UUID PRIMARY KEY,
  run_stop_id UUID NOT NULL REFERENCES tour_run_stops(id) ON DELETE CASCADE,
  source_service_id UUID REFERENCES tour_services(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  price_ht NUMERIC(10, 2) NOT NULL DEFAULT 0,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'not_done')),
  exception_reason TEXT,
  performed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tour_run_services_stop ON tour_run_services(run_stop_id);
CREATE INDEX idx_tour_run_services_source ON tour_run_services(source_service_id);
