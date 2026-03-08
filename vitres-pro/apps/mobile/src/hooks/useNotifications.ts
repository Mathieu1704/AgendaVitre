import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface InAppNotification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: { intervention_id?: string; employee_id?: string; intervention_title?: string } | null;
  created_at: string;
}

export const useNotifications = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data as InAppNotification[],
    staleTime: 0,
    refetchInterval: 30000, // rafraîchir toutes les 30s
  });

  const unreadCount = (data ?? []).filter((n) => !n.is_read).length;

  return { notifications: data ?? [], isLoading, unreadCount, refetch };
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkAllRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};
