import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export const useInterventions = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["interventions"],
    queryFn: async () => {
      // On appelle ton API Python existante
      const res = await api.get("/api/interventions");
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

export const useAssignEmployees = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ interventionId, employeeIds }: { interventionId: string; employeeIds: string[] }) =>
      api.patch(`/api/interventions/${interventionId}`, { employee_ids: employeeIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
};

export const useBulkAssignEmployees = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, subZone, employeeIds, skipAssigned = true }: {
      date: string; subZone: string; employeeIds: string[]; skipAssigned?: boolean;
    }) => api.patch("/api/interventions/bulk-assign", {
      date, sub_zone: subZone, employee_ids: employeeIds, skip_assigned: skipAssigned,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
  });
};
