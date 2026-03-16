import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export type HourlyRate = {
  id: string;
  rate: number;
  label?: string | null;
};

export const useHourlyRates = () => {
  return useQuery<HourlyRate[]>({
    queryKey: ["hourly-rates"],
    queryFn: async () => (await api.get("/api/settings/hourly-rates")).data,
  });
};

export const useCreateHourlyRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { rate: number; label?: string }) =>
      api.post("/api/settings/hourly-rates", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hourly-rates"] }),
  });
};

export const useDeleteHourlyRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/hourly-rates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hourly-rates"] }),
  });
};
