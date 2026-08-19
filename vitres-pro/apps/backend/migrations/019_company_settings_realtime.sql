-- Diffusion temps reel de company_settings.
--
-- Le drapeau hide_cash sert a masquer les montants en especes sur tous les
-- appareils d'un coup. L'app interrogeait donc /api/settings/company deux fois
-- par seconde depuis l'ecran Reglages pour propager le changement, soit ~120
-- requetes par minute pour lire un seul booleen.
--
-- En publiant la table sur le canal Realtime de Supabase, chaque appareil
-- connecte recoit le changement en push (~100 ms) sans aucun sondage.
--
-- REPLICA IDENTITY FULL : sans cela, les evenements UPDATE ne transportent que
-- la cle primaire et l'app ne verrait pas la nouvelle valeur de hide_cash.

ALTER TABLE company_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'company_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_settings;
  END IF;
END $$;
