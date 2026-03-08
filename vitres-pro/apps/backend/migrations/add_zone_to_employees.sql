-- Migration: ajouter la colonne zone sur employees
-- Valeur par défaut : 'hainaut' (zone principale)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS zone VARCHAR(20) NOT NULL DEFAULT 'hainaut';

-- Melissa Caniglia = admin Ardennes
UPDATE employees SET zone = 'ardennes' WHERE email ILIKE 'caniglia.melissa@gmail.com';
