-- Gestion numerique des tournees recurrentes.
-- Migration additive : les interventions type="tournee" existantes ne sont
-- ni modifiees ni converties. Seules les nouvelles occurrences auront une
-- ligne dans tour_runs.

CREATE TABLE IF NOT EXISTS tour_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  zone VARCHAR(20) NOT NULL CHECK (zone IN ('hainaut', 'ardennes')),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  default_start_time TIME NOT NULL,
  default_end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  source_document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_sections (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES tour_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tour_sections_template ON tour_sections(template_id);

CREATE TABLE IF NOT EXISTS tour_stops (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES tour_templates(id) ON DELETE CASCADE,
  section_id UUID REFERENCES tour_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  export_label TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  time_window TEXT,
  estimated_minutes INTEGER,
  instructions TEXT,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  source_data JSONB
);
CREATE INDEX IF NOT EXISTS idx_tour_stops_template ON tour_stops(template_id);

CREATE TABLE IF NOT EXISTS tour_services (
  id UUID PRIMARY KEY,
  stop_id UUID NOT NULL REFERENCES tour_stops(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price_ht NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billing_mode VARCHAR(30) NOT NULL CHECK (billing_mode IN ('monthly_invoice', 'quarterly_invoice', 'cash_invoiced', 'cash_no_invoice')),
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  source_data JSONB
);
CREATE INDEX IF NOT EXISTS idx_tour_services_stop ON tour_services(stop_id);

CREATE TABLE IF NOT EXISTS tour_service_schedules (
  id UUID PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES tour_services(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('interval', 'on_demand', 'annual')),
  anchor_date DATE,
  interval_weeks INTEGER CHECK (interval_weeks IS NULL OR interval_weeks > 0),
  active_months JSONB NOT NULL DEFAULT '[1,2,3,4,5,6,7,8,9,10,11,12]'::jsonb,
  monthly_cap INTEGER CHECK (monthly_cap IS NULL OR monthly_cap > 0),
  position DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tour_schedules_service ON tour_service_schedules(service_id);

CREATE TABLE IF NOT EXISTS tour_runs (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES tour_templates(id) ON DELETE SET NULL,
  intervention_id UUID NOT NULL UNIQUE REFERENCES interventions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  template_version INTEGER NOT NULL,
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tour_run_template_day UNIQUE (template_id, scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_tour_runs_template ON tour_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_tour_runs_date ON tour_runs(scheduled_date);

CREATE TABLE IF NOT EXISTS tour_run_stops (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES tour_runs(id) ON DELETE CASCADE,
  source_stop_id UUID REFERENCES tour_stops(id) ON DELETE SET NULL,
  section_label TEXT,
  name TEXT NOT NULL,
  export_label TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  time_window TEXT,
  estimated_minutes INTEGER,
  instructions TEXT,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'partial', 'not_visited')),
  exception_reason TEXT,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_run_stops_run ON tour_run_stops(run_id);

CREATE TABLE IF NOT EXISTS tour_run_services (
  id UUID PRIMARY KEY,
  run_stop_id UUID NOT NULL REFERENCES tour_run_stops(id) ON DELETE CASCADE,
  source_service_id UUID REFERENCES tour_services(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  price_ht NUMERIC(10, 2) NOT NULL DEFAULT 0,
  billing_mode VARCHAR(30) NOT NULL CHECK (billing_mode IN ('monthly_invoice', 'quarterly_invoice', 'cash_invoiced', 'cash_no_invoice')),
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  suggested BOOLEAN NOT NULL DEFAULT FALSE,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'not_done')),
  exception_reason TEXT,
  performed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_run_services_stop ON tour_run_services(run_stop_id);
CREATE INDEX IF NOT EXISTS idx_tour_run_services_source ON tour_run_services(source_service_id);

CREATE TABLE IF NOT EXISTS tour_run_cash (
  id UUID PRIMARY KEY,
  run_stop_id UUID NOT NULL REFERENCES tour_run_stops(id) ON DELETE CASCADE,
  billing_mode VARCHAR(30) NOT NULL CHECK (billing_mode IN ('cash_invoiced', 'cash_no_invoice')),
  expected_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  received_amount NUMERIC(10, 2),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tour_cash_stop_mode UNIQUE (run_stop_id, billing_mode)
);
CREATE INDEX IF NOT EXISTS idx_tour_run_cash_stop ON tour_run_cash(run_stop_id);

CREATE TABLE IF NOT EXISTS tour_billing_reviews (
  id UUID PRIMARY KEY,
  zone VARCHAR(20) NOT NULL CHECK (zone IN ('hainaut', 'ardennes')),
  period_start DATE NOT NULL,
  cadence VARCHAR(20) NOT NULL CHECK (cadence IN ('monthly', 'quarterly')),
  export_label TEXT NOT NULL,
  bucket_start DATE NOT NULL,
  selected BOOLEAN NOT NULL DEFAULT TRUE,
  override_amount NUMERIC(10, 2),
  updated_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tour_billing_review_cell UNIQUE (zone, period_start, cadence, export_label, bucket_start)
);

CREATE TABLE IF NOT EXISTS tour_billing_batches (
  id UUID PRIMARY KEY,
  zone VARCHAR(20) NOT NULL CHECK (zone IN ('hainaut', 'ardennes')),
  period_start DATE NOT NULL,
  filename TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_service_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_cash_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_billing_batches_period ON tour_billing_batches(zone, period_start, created_at DESC);
