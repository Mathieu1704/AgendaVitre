import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DailyStats } from "../types";

export const usePlanningRangeStats = (startStr: string, endStr: string, zone?: string) => {
  const zoneParam = zone && zone !== "all" ? `&zone=${zone}` : "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["planning-range", startStr, endStr, zone ?? "all"],
    queryFn: async () => {
      const res = await api.get(
        `/api/planning/range-stats?start_str=${startStr}&end_str=${endStr}${zoneParam}`,
      );
      return res.data as Record<string, DailyStats>;
    },
    staleTime: 2 * 60 * 1000,
  });

  return { rangeStats: data, isLoading, error };
};

export const usePlanningStats = (dateStr: string, zone?: string) => {
  const zoneParam = zone && zone !== "all" ? `&zone=${zone}` : "";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["planning-stats", dateStr, zone ?? "all"],
    queryFn: async () => {
      const res = await api.get(
        `/api/planning/daily-stats?date_str=${dateStr}${zoneParam}`,
      );
      return res.data as DailyStats;
    },
    staleTime: 2 * 60 * 1000,
  });

  return { stats: data, isLoading, error, refetch };
};
