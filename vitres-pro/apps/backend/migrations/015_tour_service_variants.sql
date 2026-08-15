-- Les "2 colonnes face/prix" du tableau papier ne sont pas deux prestations
-- a faire ensemble : ce sont des variantes alternees d'une seule visite
-- (ex: une fois "2F" a 30e, la fois suivante "1F" a 20e). L'admin choisit la
-- variante de la semaine a la preparation ; le terrain n'a plus qu'a
-- confirmer fait/non-visite pour cette variante unique. Il n'y a donc plus
-- de statut "partiel" ni de suivi par prestation individuelle.

ALTER TABLE tour_run_stops
  ADD COLUMN selected_service_id UUID REFERENCES tour_run_services(id) ON DELETE SET NULL;

ALTER TABLE tour_run_stops DROP CONSTRAINT IF EXISTS tour_run_stops_status_check;
ALTER TABLE tour_run_stops ADD CONSTRAINT tour_run_stops_status_check
  CHECK (status IN ('pending', 'done', 'not_visited'));
UPDATE tour_run_stops SET status = 'not_visited' WHERE status = 'partial';

ALTER TABLE tour_run_services DROP COLUMN IF EXISTS status;
ALTER TABLE tour_run_services DROP COLUMN IF EXISTS exception_reason;
ALTER TABLE tour_run_services DROP COLUMN IF EXISTS performed_at;
