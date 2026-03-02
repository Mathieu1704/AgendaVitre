import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { RawCalendarEvent } from "../types";

export function useRawEventsByDate(dateStr: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["raw-events", dateStr],
    queryFn: async () => {
      const res = await api.get(
        `/api/raw-events?date=${dateStr}&status=raw,assigned`,
      );
      return res.data as RawCalendarEvent[];
    },
    staleTime: 1000 * 30,
  });
  return { rawEvents: data ?? [], isLoading, error, refetch };
}

export function useRawEventsByRange(from: string, to: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["raw-events-range", from, to],
    queryFn: async () => {
      const res = await api.get(`/api/raw-events/range?from=${from}&to=${to}`);
      return res.data as RawCalendarEvent[];
    },
    staleTime: 1000 * 60,
  });
  return { rawEvents: data ?? [], isLoading, error };
}

export function useRawEvent(id: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["raw-event", id],
    queryFn: async () => {
      const res = await api.get(`/api/raw-events/${id}`);
      return res.data as RawCalendarEvent;
    },
  });
  return { rawEvent: data, isLoading, error };
}

export function useAssignRawEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_ids }: { id: string; employee_ids: string[] }) =>
      api.post(`/api/raw-events/${id}/assign`, { employee_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-events"] });
      qc.invalidateQueries({ queryKey: ["raw-events-range"] });
      qc.invalidateQueries({ queryKey: ["raw-event"] });
    },
  });
}

export function useIgnoreRawEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/raw-events/${id}/ignore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-events"] });
      qc.invalidateQueries({ queryKey: ["raw-events-range"] });
      qc.invalidateQueries({ queryKey: ["raw-event"] });
    },
  });
}

export function useConvertRawEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/raw-events/${id}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-events"] });
      qc.invalidateQueries({ queryKey: ["raw-events-range"] });
      qc.invalidateQueries({ queryKey: ["raw-event"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
}

export interface AiParsedEvent {
  google_id: string;
  original_summary: string;
  date: string;
  client_name: string;
  client_street: string;
  client_zip: string;
  client_city: string;
  client_phone: string;
  client_email: string;
  client_notes: string;
  start_time: string;
  end_time: string;
  is_invoice: boolean;
  total_price: number;
  full_description: string;
  services_json: Array<{ description: string; price: number }>;
}

export function useAiParseRawEvent() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/raw-events/${id}/ai-parse`).then((r) => r.data as AiParsedEvent),
  });
}

export function useAiConfirmRawEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AiParsedEvent }) =>
      api.post(`/api/raw-events/${id}/ai-confirm`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-events"] });
      qc.invalidateQueries({ queryKey: ["raw-events-range"] });
      qc.invalidateQueries({ queryKey: ["raw-event"] });
      qc.invalidateQueries({ queryKey: ["interventions"] });
    },
  });
}

export function useImportGoogleDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dateStr: string) =>
      api.post(`/api/raw-events/import/google?date=${dateStr}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-events"] });
      qc.invalidateQueries({ queryKey: ["raw-events-range"] });
    },
  });
}
