import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export const useAbsentEmployeeIds = (date: string | null | undefined) => {
  const { data } = useQuery({
    queryKey: ["absences", "on-date", date],
    queryFn: async () => (await api.get("/api/absences/on-date", { params: { date } })).data as string[],
    enabled: !!date,
    staleTime: 60 * 1000,
  });
  return data ?? [];
};
