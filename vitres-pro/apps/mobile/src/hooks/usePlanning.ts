import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DailyStats } from "../types";

export const usePlanningRangeStats = (startStr: string, endStr: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["planning-range", startStr, endStr],
    queryFn: async () => {
      // Backend attend: /api/planning/range-stats?start_str=...&end_str=...
      const res = await api.get(
        `/api/planning/range-stats?start_str=${startStr}&end_str=${endStr}`,
      );
      return res.data as Record<string, DailyStats>;
    },
    staleTime: 1000 * 60 * 1,
  });

  return { rangeStats: data, isLoading, error };
};

export const usePlanningStats = (dateStr: string) => {
  // dateStr doit être au format "YYYY-MM-DD"
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["planning-stats", dateStr],
    queryFn: async () => {
      const res = await api.get(
        `/api/planning/daily-stats?date_str=${dateStr}`,
      );
      return res.data as DailyStats;
    },
    // On ne veut pas que ça clignote à chaque milliseconde,
    // mais on veut que ça se mette à jour si on ajoute une intervention.
    staleTime: 1000 * 60 * 1, // 1 minute de cache
  });

  return {
    stats: data,
    isLoading,
    error,
    refetch,
  };
};
