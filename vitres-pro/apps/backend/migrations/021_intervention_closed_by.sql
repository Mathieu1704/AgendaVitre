-- Employe qui a effectivement cloture (et donc encaisse) l'intervention.
--
-- Jusqu'ici, le cash hebdomadaire ("Heures et encaissement") comptait le
-- prix total pour CHAQUE employe assigne a l'intervention : un RDV cash a
-- deux employes ajoutait le meme montant en double. Ce champ permet de
-- l'attribuer uniquement a celui qui a appuye sur "Terminer".

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS closed_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
