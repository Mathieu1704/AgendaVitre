-- Renfort : lien leger entre une intervention "renfort" (nouvelle, assignee
-- a l'employe B, time_tbd=true) et l'intervention "source" (tache preexistante
-- assignee a A) qu'elle vient epauler. SET NULL si la source est supprimee :
-- le renfort ne doit pas disparaitre avec elle.

ALTER TABLE interventions
  ADD COLUMN reinforcement_for_id UUID REFERENCES interventions(id) ON DELETE SET NULL;

CREATE INDEX idx_interventions_reinforcement_for_id
  ON interventions(reinforcement_for_id);
