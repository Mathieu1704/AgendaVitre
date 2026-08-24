import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface CityOut {
  city: string;
  zone: "hainaut" | "ardennes";
  color: string | null;
  position: number;
}

export interface UnassignedInterventionGroup {
  title: string;
  address: string | null;
  zone: string | null;
  intervention_ids: string[];
}

export const useCities = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/api/settings/cities")).data as CityOut[],
    staleTime: 10 * 60 * 1000,
  });
  return { cities: data ?? [], isLoading };
};

export const useCreateCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ city, zone, color }: { city: string; zone: "hainaut" | "ardennes"; color?: string }) =>
      api.post("/api/settings/cities", { city, zone, color }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities"] }),
  });
};

export const usePatchCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ city, ...body }: { city: string; city_name?: string; zone?: "hainaut" | "ardennes"; color?: string }) =>
      api.patch(`/api/settings/cities/${encodeURIComponent(city)}`, {
        city: body.city_name,
        zone: body.zone,
        color: body.color,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
};

export const useDeleteCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (city: string) => api.delete(`/api/settings/cities/${encodeURIComponent(city)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities"] }),
  });
};

export const useUnassignedInterventions = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["unassigned-interventions"],
    queryFn: async () => (await api.get("/api/settings/interventions/unassigned-cities")).data as UnassignedInterventionGroup[],
    staleTime: 2 * 60 * 1000,
  });
  return { unassignedGroups: data ?? [], isLoading };
};

export const useAssignInterventionCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ intervention_ids, city }: { intervention_ids: string[]; city: string }) =>
      api.post("/api/settings/interventions/assign-city", { intervention_ids, city }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unassigned-interventions"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
};
