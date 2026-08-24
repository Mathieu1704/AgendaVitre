-- Groupes de villes facultatifs sous les zones fixes Hainaut / Ardennes.
-- Migration idempotente : les villes existantes restent sans groupe.

BEGIN;

CREATE TABLE IF NOT EXISTS city_groups (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    zone VARCHAR(20) NOT NULL CHECK (zone IN ('hainaut', 'ardennes')),
    color VARCHAR(20),
    position INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_city_groups_zone_name UNIQUE (zone, name)
);

ALTER TABLE cities
    ADD COLUMN IF NOT EXISTS group_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_cities_group_id'
    ) THEN
        ALTER TABLE cities
            ADD CONSTRAINT fk_cities_group_id
            FOREIGN KEY (group_id)
            REFERENCES city_groups(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_cities_group_id ON cities(group_id);

COMMIT;
