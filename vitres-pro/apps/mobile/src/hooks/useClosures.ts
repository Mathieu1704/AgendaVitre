import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface Closure {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

/** Fermetures / jours fériés chevauchant la plage [start, end] (YYYY-MM-DD). */
export const useClosuresByRange = (start: string, end: string) => {
  const { data } = useQuery({
    queryKey: ["closures", start, end],
    queryFn: async () =>
      (await api.get("/api/closures", { params: { start, end } })).data as Closure[],
    staleTime: 5 * 60 * 1000,
  });
  return data ?? [];
};

/** Fermeture couvrant une date donnée, parmi une liste déjà chargée. */
export const closureOn = (closures: Closure[], date: string) =>
  closures.find((c) => c.start_date <= date && date <= c.end_date) ?? null;

// Un férié change la capacité du planning, le pointage du jour et le solde
// d'heures sup : on rafraîchit tout ce qui en dépend.
const invalidateAfterClosureChange = (queryClient: ReturnType<typeof useQueryClient>) => {
  for (const key of [["closures"], ["planning-stats"], ["planning-range"], ["timetracking"], ["time-entry"]]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
};

export const useCreateClosure = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { start_date: string; end_date: string; reason?: string }) =>
      (await api.post("/api/closures", p)).data as Closure,
    onSuccess: () => invalidateAfterClosureChange(queryClient),
  });
};

export const useDeleteClosure = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api/closures/${id}`)).data,
    onSuccess: () => invalidateAfterClosureChange(queryClient),
  });
};
