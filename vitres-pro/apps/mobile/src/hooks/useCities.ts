import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface CityOut {
  city: string;
  zone: "hainaut" | "ardennes";
  color: string | null;
  position: number;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
}

export interface CityGroupOut {
  id: string;
  name: string;
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

export const cityIdentityKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]/g, "");

const punctuationScore = (value: string) =>
  (value.match(/-/g)?.length ?? 0) * 2 + (value.match(/['’]/g)?.length ?? 0);

// Défense côté affichage pendant que les anciennes données sont fusionnées en
// base. On garde la graphie la plus structurée (Braine-le-Comte plutôt que
// Braine le comte), sans masquer un éventuel conflit entre deux zones.
export const dedupeCities = (cities: CityOut[]): CityOut[] => {
  const byIdentity = new Map<string, CityOut>();
  for (const city of cities) {
    const key = `${city.zone}:${cityIdentityKey(city.city)}`;
    const current = byIdentity.get(key);
    if (
      !current ||
      punctuationScore(city.city) > punctuationScore(current.city) ||
      (punctuationScore(city.city) === punctuationScore(current.city) &&
        city.city.localeCompare(current.city, "fr") < 0)
    ) {
      byIdentity.set(key, city);
    }
  }
  return [...byIdentity.values()];
};

export const useCities = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/api/settings/cities")).data as CityOut[],
    select: dedupeCities,
    staleTime: 10 * 60 * 1000,
  });
  return { cities: data ?? [], isLoading };
};

export const useCityGroups = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["city-groups"],
    queryFn: async () => (await api.get("/api/settings/city-groups")).data as CityGroupOut[],
    staleTime: 10 * 60 * 1000,
  });
  return { cityGroups: data ?? [], isLoading };
};

export const useCreateCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ city, zone, color, group_id }: { city: string; zone: "hainaut" | "ardennes"; color?: string; group_id?: string | null }) =>
      api.post("/api/settings/cities", { city, zone, color, group_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cities"] }),
  });
};

export const usePatchCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ city, ...body }: { city: string; city_name?: string; zone?: "hainaut" | "ardennes"; color?: string; group_id?: string | null }) =>
      api.patch(`/api/settings/cities/${encodeURIComponent(city)}`, {
        city: body.city_name,
        zone: body.zone,
        color: body.color,
        group_id: body.group_id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cities"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
};

export const useCreateCityGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; zone: "hainaut" | "ardennes"; color?: string }) =>
      api.post("/api/settings/city-groups", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["city-groups"] }),
  });
};

export const usePatchCityGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string }) =>
      api.patch(`/api/settings/city-groups/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["city-groups"] });
      qc.invalidateQueries({ queryKey: ["cities"] });
    },
  });
};

export const useDeleteCityGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/city-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["city-groups"] });
      qc.invalidateQueries({ queryKey: ["cities"] });
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
