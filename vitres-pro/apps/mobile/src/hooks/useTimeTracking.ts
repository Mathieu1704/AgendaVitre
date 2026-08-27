import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface TodayTimeEntry {
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: "not_started" | "in_progress" | "done";
  worked_hours?: number | null;
}

export const useTodayTimeEntry = () =>
  useQuery({
    queryKey: ["time-entry", "today"],
    queryFn: async () =>
      (await api.get("/api/timetracking/today")).data as TodayTimeEntry,
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

export const useDayTimeEntry = (dateStr: string, enabled: boolean = true) =>
  useQuery({
    queryKey: ["time-entry", "day", dateStr],
    queryFn: async () =>
      (await api.get(`/api/timetracking/day/${dateStr}`)).data as TodayTimeEntry,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

export const useClockIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/timetracking/clock-in")).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entry", "today"] }),
  });
};

export const useClockOut = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/api/timetracking/clock-out")).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["time-entry", "today"] }),
  });
};

export interface DailyEntry {
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  is_absence: boolean;
  actual_hours: number;
  edited_by_admin: boolean;
}

export interface WeeklySummaryEmployee {
  employee_id: string;
  full_name: string | null;
  role: string;
  cash_amount: number;
  cash_settled: boolean;
  overtime_balance_hours: number;
  overtime_period_start: string;
  overtime_period_end: string;
  daily_entries: DailyEntry[];
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  employees: WeeklySummaryEmployee[];
}

export const useWeeklySummary = (weekStart?: string, includeCurrentWeek?: boolean) =>
  useQuery({
    queryKey: [
      "timetracking",
      "weekly-summary",
      weekStart ?? "current",
      includeCurrentWeek ?? false,
    ],
    queryFn: async () =>
      (
        await api.get("/api/timetracking/weekly-summary", {
          params: {
            ...(weekStart ? { week_start: weekStart } : {}),
            ...(includeCurrentWeek ? { include_current_week: true } : {}),
          },
        })
      ).data as WeeklySummary,
  });

export interface MyOvertimeBalance {
  balance_hours: number;
  period_start: string;
  period_end: string;
}

export const useMyOvertimeBalance = () =>
  useQuery({
    queryKey: ["timetracking", "my-overtime-balance"],
    queryFn: async () =>
      (await api.get("/api/timetracking/my-overtime-balance")).data as MyOvertimeBalance,
  });

export const useConfirmCashSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { employee_id: string; week_start: string }) =>
      (await api.post("/api/timetracking/cash-settlements", vars)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["timetracking", "weekly-summary"] }),
  });
};

export const useConfirmOvertimeSettlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      employee_id: string;
      include_current_week?: boolean;
      // Absent = solde total ("Solder à 0"). Fourni = solde partiel (ex. 1
      // jour de congé pris sur un solde plus large) : le reliquat continue
      // de s'accumuler au lieu d'être remis à zéro.
      hours?: number;
    }) => (await api.post("/api/timetracking/overtime-settlements", vars)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["timetracking", "weekly-summary"] }),
  });
};

export const useCorrectTimeEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      employee_id: string;
      work_date: string;
      clock_in_at: string | null;
      clock_out_at: string | null;
    }) => (await api.patch("/api/timetracking/entries", vars)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["timetracking", "weekly-summary"] }),
  });
};
