-- Solde d'heures sup/en moins : jusqu'ici, "Solder" remettait TOUJOURS tout
-- le solde a zero. Un employe qui a cumule 30h et prend 1 jour de conge
-- (ex. 7h36) ne doit pas perdre les ~22h24 restantes.
--
-- carried_forward_hours porte le reliquat non solde : la prochaine fois que
-- le solde est recalcule (_overtime_balance), il repart de ce reliquat au
-- lieu de zero. Un solde "complet" (bouton "Solder a 0") garde ce champ a 0
-- comme avant.

ALTER TABLE overtime_settlements
  ADD COLUMN IF NOT EXISTS carried_forward_hours FLOAT NOT NULL DEFAULT 0;
