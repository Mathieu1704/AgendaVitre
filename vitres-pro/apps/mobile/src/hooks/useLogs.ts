import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface AuditLog {
  id: string;
  action_type: "created" | "deleted" | "modified" | "status_change" | "no_reprise" | string;
  employee_id?: string;
  intervention_id?: string;
  description?: string;
  created_at: string;
  employee_name?: string;
}

export const useLogs = (actionType?: string, page = 0) => {
  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (actionType) params.set("action_type", actionType);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionType ?? "all", page],
    queryFn: async () => (await api.get(`/api/logs?${params.toString()}`)).data as AuditLog[],
    staleTime: 0,
  });

  return { logs: data ?? [], isLoading, refetch };
};
