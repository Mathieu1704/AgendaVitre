import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export const useClients = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 min — les clients changent rarement
  });

  return {
    clients: Array.isArray(data) ? data : [],
    isLoading,
    error,
  };
};
