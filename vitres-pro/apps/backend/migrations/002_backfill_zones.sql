-- Migration 002: backfill des zones
-- Problème : la colonne zone sur interventions est NULL pour toutes les données importées
--            et les 5 employés ardennais n'ont pas encore leur zone 'ardennes'

-- ÉTAPE 1 : Mettre à jour les zones des employés ardennais
UPDATE employees SET zone = 'ardennes' WHERE email ILIKE ANY(ARRAY[
    'Karma3698@gmail.com',         -- Dorian Martin
    'Vitres.thony@gmail.com',      -- Anthony Vinck
    'hoyasloyd@gmail.com',         -- Loyd Hoyas
    'Lucahoyas2007@gmail.com',     -- Luca Hoyas
    'michaeltruant@hotmail.com'    -- Michael Truant
]);

-- Vérification employés
SELECT email, full_name, zone FROM employees ORDER BY zone, full_name;

-- ÉTAPE 2 : Ajouter la colonne zone sur interventions si elle n'existe pas
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS zone VARCHAR(20) DEFAULT 'hainaut';

-- ÉTAPE 3 : Déduire la zone à partir des employés assignés
-- Si tous les employés assignés sont ardennais → ardennes, sinon hainaut
UPDATE interventions i
SET zone = (
    SELECT
        CASE
            WHEN COUNT(*) FILTER (WHERE e.zone = 'ardennes') > 0
             AND COUNT(*) FILTER (WHERE e.zone = 'hainaut') = 0
            THEN 'ardennes'
            ELSE 'hainaut'
        END
    FROM intervention_employees ie
    JOIN employees e ON e.id = ie.employee_id
    WHERE ie.intervention_id = i.id
)
WHERE i.zone IS NULL;

-- ÉTAPE 4 : Fallback pour les interventions sans employés assignés
UPDATE interventions SET zone = 'hainaut' WHERE zone IS NULL;

-- Vérification résultat
SELECT zone, COUNT(*) FROM interventions GROUP BY zone ORDER BY zone;
