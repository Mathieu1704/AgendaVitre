-- Migration 011 : fil de notes horodatees sur une intervention
--
-- Canal d'echange entre l'admin et le ou les employe(s)/sous-traitant(s)
-- assigne(s) a une intervention. Contrairement a Intervention.description
-- (champ unique ecrasable), chaque note s'accumule avec son auteur et sa
-- date d'ajout - jamais de suppression/ecrasement.

CREATE TABLE IF NOT EXISTS intervention_notes (
    id UUID PRIMARY KEY,
    intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES employees(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_notes_intervention_id ON intervention_notes(intervention_id);
