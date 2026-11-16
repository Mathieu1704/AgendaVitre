import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";
import { useNotifications } from "./useNotifications";

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

/**
 * Badge « Congés » :
 *  - admin : demandes en attente de validation ;
 *  - employé : décisions sur ses demandes (acceptée, refusée, annulée) pas
 *    encore vues. Les employés n'ont pas d'onglet Alertes : sans ce badge,
 *    ils ne sauraient pas qu'une décision est tombée. Elles sont marquées
 *    lues à l'ouverture de l'écran Congés.
 */
export const useLeaveBadgeCount = () => {
  const { isAdmin } = useAuth();
  const pending = usePendingLeaveCount();
  const { notifications } = useNotifications();
  if (isAdmin) return pending;
  return notifications.filter((n) => n.type === "leave_decision" && !n.is_read).length;
};
