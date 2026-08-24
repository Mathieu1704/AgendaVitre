export interface Employee {
  id: string;
  email: string;
  full_name?: string;
  color: string; // Ex: "#3B82F6"
  role: "admin" | "employee" | "subcontractor";
  phone?: string;
  zone: "hainaut" | "ardennes";
  weekly_hours: number;
  hours_per_weekday?: Record<string, number>; // {"1":10,"2":8,...,"5":7}
  hours_valid_from?: string | null; // "YYYY-MM-DD" — plage de validité optionnelle (sous-traitants)
  hours_valid_until?: string | null;
  avatar_url?: string | null;
}

export interface Client {
  id: string;
  name: string;
  address: string;
}

export type PaymentMode = "cash" | "invoice" | "invoice_cash";

export interface Intervention {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO String
  end_time: string; // ISO String
  status: "planned" | "in_progress" | "done" | "cancelled" | string;
  price_estimated?: number;
  payment_mode?: PaymentMode;
  is_invoice?: boolean;
  // Split cash/facture, utilisé uniquement quand payment_mode === "invoice_cash".
  amount_cash?: number | null;
  amount_invoice?: number | null;
  // Reprise RDV : lien vers l'intervention source, non modifiable par un
  // employé au-delà des prestations quand ce champ est renseigné.
  reprise_taken?: boolean | null;
  reprise_note?: string | null;
  reprise_chain_id?: string | null;
  reprise_of_id?: string | null;
  // Paiement cash reporté (client absent) : montant dû tant que
  // deferred_settled_by_intervention_id est null.
  deferred_cash_amount?: number | null;
  deferred_settled_by_intervention_id?: string | null;
  // Solde reporté non réglé trouvé sur la chaîne de reprise de cette
  // intervention (calculé côté backend, voir GET /interventions/{id}).
  pending_deferred_amount?: number | null;
  carried_over_deferred_amount?: number | null;
  zone: "hainaut" | "ardennes";
  city?: string | null;
  recurrence_rule?: {
    freq?: string;
    interval?: number;
    count?: number;
    until?: string;
    byday?: string[] | number[];
  } | null;
  recurrence_group_id?: string | null;
  // Horodatage de la conversion d'un devis en intervention (bouton "Changer
  // en intervention") — trace visible même après que type soit "intervention".
  devis_converted_at?: string | null;
  // Première intervention créée depuis ce devis — présent seulement quand
  // devis_converted_at est renseigné (voir GET /interventions/{id}).
  converted_intervention_id?: string | null;
  client?: Client;
  employees: Employee[]; // Liste d'employés maintenant
  // Uniquement utilisées quand aucun client n'est lié (voir client.address/phone/email sinon)
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface RawCalendarEvent {
  id: string;
  source: string;
  external_id: string;
  calendar_id: string;
  summary: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  status: "raw" | "assigned" | "converted" | "ignored";
  employee_id?: string;
  linked_intervention_id?: string;
  employee?: Pick<Employee, "id" | "full_name" | "color">;
  assigned_employees: Array<{ id: string; full_name: string | null; color: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface DailyStats {
  date: string;
  capacity_hours: number;
  planned_hours: number;
  tolerance: number;
  present_employees: number;
  status: "ok" | "warning" | "overload";
}
