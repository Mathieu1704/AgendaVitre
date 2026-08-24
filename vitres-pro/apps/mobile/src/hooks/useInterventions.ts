import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { toBrusselsDateTimeString } from "../lib/date";
import {
  patchIntervention,
  restoreInterventionSnapshots,
} from "../lib/offline/optimistic";

export const useInterventions = (range?: { start: string; end: string }) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: range
      ? ["interventions", range.start, range.end]
      : ["interventions"],
    queryFn: async () => {
      const res = await api.get("/api/interventions", {
        params: range ? { start: range.start, end: range.end } : undefined,
      });
      return res.data || [];
    },
    staleTime: 30 * 1000,
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
      await qc.cancelQueries({ queryKey: ["interventions"], type: "active" });
      const allEmployees = qc.getQueryData<any[]>(["employees"]) ?? [];
      const selectedEmps = allEmployees.filter((e) => employeeIds.includes(e.id));
      const snapshots = patchIntervention(qc, interventionId, (current) =>
        ({ ...current, employees: selectedEmps })
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.snapshots) restoreInterventionSnapshots(qc, ctx.snapshots);
    },
  });
};

// Crée une intervention légère "renfort" liée à interventionId, assignée à un
// seul employé. timeTbd=true (défaut) : l'employé fixera son heure d'arrivée
// quand il aura fini ses propres RDV. timeTbd=false + startTimeIso : l'admin
// connaît déjà un créneau précis (ex: l'employé a un trou entre deux de ses
// propres RDV). Invalidation simple plutôt que patch optimiste : c'est une
// création de nouvelle entité, pas une mise à jour d'une carte déjà en cache.
export const useCreateReinforcement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      interventionId,
      employeeId,
      timeTbd = true,
      startTimeIso,
    }: {
      interventionId: string;
      employeeId: string;
      timeTbd?: boolean;
      startTimeIso?: string;
    }) =>
      api.post(`/api/interventions/${interventionId}/reinforcement`, {
        employee_id: employeeId,
        time_tbd: timeTbd,
        start_time: timeTbd ? undefined : startTimeIso,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interventions"], type: "active" });
    },
  });
};

export const useBulkAssignEmployees = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, city, employeeIds, skipAssigned = true }: {
      date: string; city: string; employeeIds: string[]; skipAssigned?: boolean;
    }) => api.patch("/api/interventions/bulk-assign", {
      date, city, employee_ids: employeeIds, skip_assigned: skipAssigned,
    }),
    onSuccess: (_data, { date, city, employeeIds, skipAssigned = true }) => {
      const allEmployees = qc.getQueryData<any[]>(["employees"]) ?? [];
      const selectedEmps = allEmployees.filter((e) => employeeIds.includes(e.id));
      const targetTime = new Date(`${date}T12:00:00`).getTime();
      const lists = qc.getQueriesData<any[]>({ queryKey: ["interventions"] });
      for (const [key, data] of lists) {
        if (
          key.length !== 3 ||
          typeof key[1] !== "string" ||
          typeof key[2] !== "string" ||
          targetTime < Date.parse(key[1]) ||
          targetTime > Date.parse(key[2])
        ) continue;
        if (!Array.isArray(data)) continue;
        let touched = false;
        const next = data.map((item) => {
          const itemDate = item?.start_time
            ? toBrusselsDateTimeString(new Date(item.start_time)).split("T")[0]
            : "";
          if (
            item?.city !== city ||
            itemDate !== date ||
            (skipAssigned && (item.employees?.length ?? 0) > 0)
          ) {
            return item;
          }
          touched = true;
          return { ...item, employees: selectedEmps };
        });
        if (touched) qc.setQueryData(key, next);
      }
    },
  });
};
