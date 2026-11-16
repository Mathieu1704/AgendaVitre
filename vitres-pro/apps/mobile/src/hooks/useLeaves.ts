import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";

/** Demandes de congé en attente de validation (badge admin, 0 sinon). */
export const usePendingLeaveCount = () => {
  const { isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["leaves", "pending-count"],
    queryFn: async () => (await api.get("/api/leaves/pending-count")).data as { count: number },
    enabled: isAdmin,
    staleTime: 60 * 1000,
    // Même rythme que le badge Alertes.
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
  });
  return isAdmin ? data?.count ?? 0 : 0;
};
