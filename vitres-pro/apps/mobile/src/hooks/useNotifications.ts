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
    staleTime: 60 * 1000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
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

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/notifications"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
};
