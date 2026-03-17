import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Employee } from "../types";

export const useEmployees = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.get("/api/employees");
      return res.data as Employee[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — les employés changent très rarement
  });

  return {
    employees: data || [],
    isLoading,
    error,
  };
};
