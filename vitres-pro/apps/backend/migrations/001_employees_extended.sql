-- Migration 001 — Extension du modèle employees
-- À appliquer sur la DB Supabase prod via l'éditeur SQL Supabase

-- 1. Nouveaux champs sur la table employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hours_per_weekday JSONB;
-- Exemple de valeur: {"1":10,"2":10,"3":10,"4":10,"5":7}
-- Clés = ISO weekday (1=lundi, 2=mardi, ..., 5=vendredi)

-- 2. Table montée en charge progressive (Ilyas, Luca, etc.)
CREATE TABLE IF NOT EXISTS progressive_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours_per_weekday JSONB NOT NULL
    -- Exemple: {"1":3,"2":3,"3":3,"4":3,"5":3} pour 3h/jour sur cette période
);

-- 3. Table fermetures entreprise
CREATE TABLE IF NOT EXISTS company_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR
);
