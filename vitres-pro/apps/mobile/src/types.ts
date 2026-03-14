export interface Employee {
  id: string;
  email: string;
  full_name?: string;
  color: string; // Ex: "#3B82F6"
  role: "admin" | "employee";
  phone?: string;
  zone: "hainaut" | "ardennes";
  weekly_hours: number;
  hours_per_weekday?: Record<string, number>; // {"1":10,"2":8,...,"5":7}
}

export interface Client {
  id: string;
  name: string;
  address: string;
}

export interface Intervention {
  id: string;
  title: string;
  description?: string;
  start_time: string; // ISO String
  end_time: string; // ISO String
  status: "planned" | "in_progress" | "done" | string;
  price_estimated?: number;
  zone: "hainaut" | "ardennes";
  recurrence_rule?: {
    freq?: string;
    interval?: number;
    count?: number;
    until?: string;
    byday?: string[] | number[];
  } | null;
  recurrence_group_id?: string | null;
  client?: Client;
  employees: Employee[]; // Liste d'employés maintenant
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
