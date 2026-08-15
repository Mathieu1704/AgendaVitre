export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export type TourService = {
  id?: string;
  label: string;
  price_ht: number;
  position: number;
  active: boolean;
};

export type TourStop = {
  id?: string;
  name: string;
  note?: string | null;
  payment_text?: string | null;
  frequency_text?: string | null;
  estimated_minutes?: number | null;
  position: number;
  active: boolean;
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
  source_document?: string | null;
  sections: TourSection[];
};

export type TourRunService = {
  id: string;
  source_service_id?: string | null;
  label: string;
  price_ht: number;
  position: number;
  status: "pending" | "done" | "not_done";
  exception_reason?: string | null;
};

export type TourRunStop = {
  id: string;
  section_label?: string | null;
  name: string;
  note?: string | null;
  payment_text?: string | null;
  frequency_text?: string | null;
  estimated_minutes?: number | null;
  position: number;
  selected: boolean;
  status: "pending" | "done" | "partial" | "not_visited";
  exception_reason?: string | null;
  services: TourRunService[];
};

export type TourRun = {
  id: string;
  template_id?: string | null;
  scheduled_date: string;
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
    sections: [],
  };
}
