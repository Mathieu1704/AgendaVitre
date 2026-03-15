import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface SubZoneOut {
  id: string;
  code: string;
  label: string;
  parent_zone: "hainaut" | "ardennes";
  position: number;
  cities: string[];
}

export const useSubZones = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["sub-zones"],
    queryFn: async () => (await api.get("/api/settings/zones")).data as SubZoneOut[],
    staleTime: 10 * 60 * 1000,
  });
  return { subZones: data ?? [], isLoading };
};

export const useRenameZone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      api.patch(`/api/settings/zones/${id}/label`, { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub-zones"] }),
  });
};

export const useReassignCity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ city, sub_zone_id }: { city: string; sub_zone_id: string }) =>
      api.patch(`/api/settings/zones/cities/${encodeURIComponent(city)}`, { sub_zone_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-zones"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
};
