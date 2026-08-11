import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const zoneParam = zone && zone !== "all" ? `&zone=${zone}` : "";
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["planning-stats", dateStr, zone ?? "all"],
    queryFn: async () => {
      const res = await api.get(
        `/api/planning/daily-stats?date_str=${dateStr}${zoneParam}`,
      );
      return res.data as DailyStats;
    },
    placeholderData: () => {
      // La vue planning charge déjà les statistiques de toute sa plage. Ce
      // repli donne immédiatement la barre horaire hors ligne, même si ce jour
      // précis n'avait jamais été sélectionné auparavant.
      const ranges = queryClient.getQueriesData<Record<string, DailyStats>>({
        queryKey: ["planning-range"],
      });
      const effectiveZone = zone ?? "all";
      for (const [key, range] of ranges) {
        if (
          key.length === 4 &&
          key[3] === effectiveZone &&
          typeof key[1] === "string" &&
          typeof key[2] === "string" &&
          key[1] <= dateStr &&
          key[2] >= dateStr &&
          range?.[dateStr]
        ) {
          return range[dateStr];
        }
      }
      return undefined;
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  return { stats: data, isLoading, error, refetch };
};
