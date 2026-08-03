-- Migration 004: forfait d'heures fixe sur les taux horaires "temps de travail uniquement"

ALTER TABLE hourly_rates
  ADD COLUMN IF NOT EXISTS fixed_hours FLOAT;
