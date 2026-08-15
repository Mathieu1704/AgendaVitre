export type TourBillingMode =
  | "monthly_invoice"
  | "quarterly_invoice"
  | "cash_invoiced"
  | "cash_no_invoice";

export const BILLING_LABELS: Record<TourBillingMode, string> = {
  monthly_invoice: "F · Facture mensuelle",
  quarterly_invoice: "F.T · Facture trimestrielle",
  cash_invoiced: "N · Cash facturable",
  cash_no_invoice: "NF · Cash sans facture",
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export type TourSchedule = {
  id?: string;
  kind: "interval" | "on_demand" | "annual";
  anchor_date?: string | null;
  interval_weeks?: number | null;
  active_months: number[];
  monthly_cap?: number | null;
  position: number;
};

export type TourService = {
  id?: string;
  label: string;
  price_ht: number;
  billing_mode: TourBillingMode;
  position: number;
  active: boolean;
  needs_review: boolean;
  source_data?: Record<string, unknown> | null;
  schedules: TourSchedule[];
};

export type TourStop = {
  id?: string;
  name: string;
  export_label?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  time_window?: string | null;
  estimated_minutes?: number | null;
  instructions?: string | null;
  position: number;
  active: boolean;
  needs_review: boolean;
  source_data?: Record<string, unknown> | null;
  services: TourService[];
};

export type TourSection = {
  id?: string;
  label: string;
  position: number;
  stops: TourStop[];
};

export type TourTemplate = {
  id?: string;
  name: string;
  zone: "hainaut" | "ardennes";
  weekday: number;
  default_start_time: string;
  default_end_time: string;
  active: boolean;
  archived: boolean;
  setup_complete: boolean;
  version?: number;
  source_document?: string | null;
  sections: TourSection[];
};

export type TourRunService = {
  id: string;
  source_service_id?: string | null;
  label: string;
  price_ht: number;
  billing_mode: TourBillingMode;
  position: number;
  suggested: boolean;
  selected: boolean;
  status: "pending" | "done" | "not_done";
  exception_reason?: string | null;
};

export type TourRunCash = {
  id: string;
  billing_mode: "cash_invoiced" | "cash_no_invoice";
  expected_amount: number;
  received_amount?: number | null;
  confirmed_at?: string | null;
};

export type TourRunStop = {
  id: string;
  section_label?: string | null;
  name: string;
  export_label: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  time_window?: string | null;
  estimated_minutes?: number | null;
  instructions?: string | null;
  position: number;
  selected: boolean;
  status: "pending" | "done" | "partial" | "not_visited";
  exception_reason?: string | null;
  services: TourRunService[];
  cash_confirmations: TourRunCash[];
};

export type TourRun = {
  id: string;
  template_id?: string | null;
  scheduled_date: string;
  template_version: number;
  publication_status: "draft" | "published";
  lifecycle_status: string;
  completed_at?: string | null;
  progress: { resolved: number; total: number; percent: number };
  intervention: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  employees: Array<{ id: string; full_name?: string | null; email: string; color?: string }>;
  stops: TourRunStop[];
};

export function formatEuro(value: number | null | undefined): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value ?? 0));
}

export function emptyTourTemplate(): TourTemplate {
  return {
    name: "Nouvelle tournée",
    zone: "hainaut",
    weekday: 2,
    default_start_time: "08:00:00",
    default_end_time: "16:00:00",
    active: false,
    archived: false,
    setup_complete: false,
    sections: [],
  };
}
