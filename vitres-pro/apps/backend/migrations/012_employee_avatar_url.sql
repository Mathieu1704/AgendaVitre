-- Migration 012 : photo de profil employe
--
-- avatar_path stocke uniquement le chemin dans le bucket Supabase Storage
-- (deterministe : "<employee_id>.jpg"), jamais une URL directe : le bucket
-- est prive, les URLs servies au mobile sont signees a la volee (7 jours)
-- pour ne jamais rendre les photos accessibles publiquement sur internet.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;
