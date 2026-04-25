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
    staleTime: 0,
    refetchInterval: 3000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
    onMutate: async ({ interventionId, employeeIds }) => {
      await qc.cancelQueries({ queryKey: ["interventions"] });
      const prev = qc.getQueryData(["interventions"]);
      const allEmployees = qc.getQueryData<any[]>(["employees"]) ?? [];
      const selectedEmps = allEmployees.filter((e) => employeeIds.includes(e.id));
      qc.setQueryData<any[]>(["interventions"], (old) =>
        old ? old.map((i) => i.id === interventionId ? { ...i, employees: selectedEmps } : i) : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["interventions"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["interventions"] }),
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
