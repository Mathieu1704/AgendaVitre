import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export const useInterventions = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["interventions"],
    queryFn: async () => {
      // On appelle ton API Python existante
      const res = await api.get("/api/interventions/");
      return res.data || [];
    },
  });

  return {
    interventions: Array.isArray(data) ? data : [],
    isLoading,
    error,
    refetch,
  };
};
