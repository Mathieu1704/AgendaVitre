import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export const useClients = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data || [];
    },
  });

  return {
    clients: Array.isArray(data) ? data : [],
    isLoading,
    error,
  };
};
