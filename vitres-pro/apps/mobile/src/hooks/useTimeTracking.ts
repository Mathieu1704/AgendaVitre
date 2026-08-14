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

export const useWeeklySummary = (weekStart?: string) =>
  useQuery({
    queryKey: ["timetracking", "weekly-summary", weekStart ?? "current"],
    queryFn: async () =>
      (
        await api.get("/api/timetracking/weekly-summary", {
          params: weekStart ? { week_start: weekStart } : undefined,
        })
      ).data as WeeklySummary,
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
    mutationFn: async (vars: { employee_id: string }) =>
      (await api.post("/api/timetracking/overtime-settlements", vars)).data,
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
