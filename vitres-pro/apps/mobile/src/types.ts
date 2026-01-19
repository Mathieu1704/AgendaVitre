export interface Employee {
  id: string;
  email: string;
  full_name?: string;
  color: string; // Ex: "#3B82F6"
  role: "admin" | "employee";
  weekly_hours: number;
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
  client?: Client;
  employees: Employee[]; // Liste d'employés maintenant
}

export interface DailyStats {
  date: string;
  capacity_hours: number;
  planned_hours: number;
  tolerance: number;
  present_employees: number;
  status: "ok" | "warning" | "overload";
}
