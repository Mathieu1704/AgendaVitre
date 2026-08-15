import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onlineManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronLeft, RotateCcw, X } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { enqueue } from "../../../../../src/lib/offline/outbox";
import { hasPendingWrites } from "../../../../../src/lib/offline/outbox";
import { formatEuro, TourRun, TourRunStop } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Button } from "../../../../../src/ui/components/Button";
import { ConfirmModal } from "../../../../../src/ui/components/ConfirmModal";
import { toast } from "../../../../../src/ui/toast";

type Colors = { text: string; muted: string; border: string; header: string; input: string };

const COLS = { name: 180, variant: 140, payment: 110, status: 100, actions: 150 };

const STATUS_LABELS: Record<string, string> = {
  pending: "À faire",
  done: "Réalisé",
  not_visited: "Non visité",
};

function optimisticResolve(run: TourRun, stopId: string, status: "done" | "not_visited", reason: string | null): TourRun {
  const stops = run.stops.map((stop) => stop.id === stopId ? { ...stop, status, exception_reason: reason } : stop);
  const selected = stops.filter((stop) => stop.selected);
  const resolved = selected.filter((stop) => stop.status !== "pending");
  return {
    ...run,
    lifecycle_status: "in_progress",
    intervention: { ...run.intervention, status: "in_progress" },
    stops,
    progress: { resolved: resolved.length, total: selected.length, percent: selected.length ? Math.round(resolved.length / selected.length * 100) : 0 },
  };
}

export default function TourRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const [busyStop, setBusyStop] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [showCancel, setShowCancel] = useState(false);
  const colors: Colors = {
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#1E293B" : "#E4E4E7",
    header: isDark ? "#111C30" : "#EFF6FF",
    input: isDark ? "#0B1220" : "#F8FAFC",
  };

  const runQuery = useQuery<TourRun>({
    queryKey: ["tour-run", id],
    queryFn: async () => (await api.get(`/api/tours/runs/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: () => onlineManager.isOnline() && !hasPendingWrites() ? 15_000 : false,
  });
  const run = runQuery.data;

  const resolveStop = async (stop: TourRunStop, status: "done" | "not_visited") => {
    const reason = (reasonDrafts[stop.id] ?? "").trim();
    if (status === "not_visited" && !reason) {
      setReasonFor(stop.id);
      return toast.error("Justification requise", "Indiquez pourquoi le commerce n'a pas été visité.");
    }
    setBusyStop(stop.id);
    setReasonFor(null);
    queryClient.setQueryData<TourRun>(["tour-run", id], (old) => old ? optimisticResolve(old, stop.id, status, status === "not_visited" ? reason : null) : old);
    try {
      await enqueue({
        kind: "tour-stop-resolve",
        method: "POST",
        url: `/api/tours/runs/${id}/stops/${stop.id}/resolve`,
        body: { status, reason: status === "not_visited" ? reason : null },
        label: `${stop.name} · ${STATUS_LABELS[status]}`,
      });
      setReasonDrafts((old) => { const next = { ...old }; delete next[stop.id]; return next; });
      if (onlineManager.isOnline()) setTimeout(() => queryClient.invalidateQueries({ queryKey: ["tour-run", id] }), 900);
    } catch (error: any) {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      toast.error("Action non enregistrée", error?.message ?? "Le stockage hors ligne est indisponible.");
    } finally {
      setBusyStop(null);
    }
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      queryClient.setQueryData<TourRun>(["tour-run", id], (old) => old ? { ...old, lifecycle_status: "done", completed_at: new Date().toISOString(), intervention: { ...old.intervention, status: "done" } } as TourRun : old);
      await enqueue({ kind: "tour-close", method: "POST", url: `/api/tours/runs/${id}/close`, label: `Clôture ${run?.intervention.title}` });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Tournée clôturée", onlineManager.isOnline() ? "La clôture est enregistrée." : "Elle sera synchronisée au retour du réseau.");
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      toast.error("Clôture impossible", error?.message ?? "Erreur locale");
    },
  });
  const reopenMutation = useMutation({
    mutationFn: async () => api.post(`/api/tours/runs/${id}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tour-run", id] }),
    onError: (error: any) => toast.error("Réouverture impossible", error?.response?.data?.detail ?? "Erreur réseau"),
  });
  const cancelMutation = useMutation({
    mutationFn: async () => api.post(`/api/tours/runs/${id}/cancel`),
    onSuccess: () => {
      setShowCancel(false);
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Occurrence annulée", "L'historique reste conservé.");
    },
    onError: (error: any) => toast.error("Annulation impossible", error?.response?.data?.detail ?? "Erreur réseau"),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TourRunStop[]>();
    for (const stop of run?.stops.filter((item) => item.selected) ?? []) {
      const key = stop.section_label || "Sans section";
      map.set(key, [...(map.get(key) ?? []), stop]);
    }
    return [...map.entries()];
  }, [run]);
  const canClose = Boolean(run && run.stops.filter((stop) => stop.selected).every((stop) => stop.status !== "pending"));
  const tableWidth = COLS.name + COLS.variant + COLS.payment + COLS.status + COLS.actions;

  const backToCalendar = () => router.replace("/(app)/calendar" as any);

  if (runQuery.isLoading && !run) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!run) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF", padding: 20, gap: 12 }}>
        <AlertCircle size={28} color="#EF4444" />
        <Text style={{ color: colors.text, textAlign: "center" }}>Cette tournée n'est pas disponible hors ligne ou vous n'y avez pas accès.</Text>
        <Pressable onPress={backToCalendar} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.header }}><Text style={{ color: colors.text, fontWeight: "700" }}>Retour au planning</Text></Pressable>
      </View>
    );
  }
  const finished = run.lifecycle_status === "done";
  const cancelled = run.lifecycle_status === "cancelled";

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#020817" : "#FFFFFF", paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={backToCalendar}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2" numberOfLines={1} style={{ flex: 1 }}>
          {run.intervention.title}
        </Text>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: finished ? "rgba(22,163,74,0.15)" : cancelled ? "rgba(239,68,68,0.15)" : run.lifecycle_status === "in_progress" ? "rgba(249,115,22,0.15)" : "rgba(59,130,246,0.15)" }}>
          <Text style={{ color: finished ? "#16A34A" : cancelled ? "#EF4444" : run.lifecycle_status === "in_progress" ? "#F97316" : "#3B82F6", fontWeight: "700", fontSize: 12 }}>{finished ? "TERMINÉE" : cancelled ? "ANNULÉE" : run.lifecycle_status === "in_progress" ? "EN COURS" : "PUBLIÉE"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 80 }}>
        <View style={{ marginBottom: 16, maxWidth: 1200, width: "100%", alignSelf: "center" }}>
          <Text style={{ color: colors.muted, marginBottom: 8 }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })} · {run.employees.map((employee) => employee.full_name ?? employee.email).join(", ")}</Text>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden", marginBottom: 6 }}><View style={{ width: `${run.progress.percent}%`, height: "100%", backgroundColor: run.progress.percent === 100 ? "#16A34A" : "#F97316" }} /></View>
          <Text style={{ color: colors.muted, textAlign: "right" }}>{run.progress.resolved}/{run.progress.total} commerces résolus</Text>
        </View>

        {grouped.map(([section, stops]) => (
          <View key={section} style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 8, maxWidth: 1200, width: "100%", alignSelf: "center" }}>{section}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxWidth: "100%" }}>
              <View style={{ width: tableWidth }}>
                <View style={{ flexDirection: "row", backgroundColor: colors.header, paddingVertical: 8, borderRadius: 10, marginBottom: 4 }}>
                  <View style={{ width: COLS.name, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Commerce</Text></View>
                  <View style={{ width: COLS.variant, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Variante</Text></View>
                  <View style={{ width: COLS.payment, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Paiement</Text></View>
                  <View style={{ width: COLS.status, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Statut</Text></View>
                  <View style={{ width: COLS.actions, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Actions</Text></View>
                </View>
                {stops.map((stop) => {
                  const chosen = stop.services.find((service) => service.id === stop.selected_service_id) ?? stop.services[0];
                  const statusColor = stop.status === "done" ? "#16A34A" : stop.status === "not_visited" ? "#EF4444" : colors.muted;
                  const disabled = finished || cancelled || busyStop === stop.id;
                  return (
                    <View key={stop.id}>
                      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderColor: colors.border }}>
                        <View style={{ width: COLS.name, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{stop.name}</Text></View>
                        <View style={{ width: COLS.variant, paddingHorizontal: 6 }}>
                          {chosen && <><Text style={{ color: colors.text, fontSize: 13 }}>{chosen.label}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{formatEuro(chosen.price_ht)}</Text></>}
                        </View>
                        <View style={{ width: COLS.payment, paddingHorizontal: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{stop.payment_text ?? ""}</Text></View>
                        <View style={{ width: COLS.status, paddingHorizontal: 6 }}><Text style={{ color: statusColor, fontWeight: "700", fontSize: 12 }}>{STATUS_LABELS[stop.status]}</Text></View>
                        <View style={{ width: COLS.actions, paddingHorizontal: 6, flexDirection: "row", gap: 6 }}>
                          <Pressable disabled={disabled} onPress={() => resolveStop(stop, "done")} style={{ padding: 8, borderRadius: 9, backgroundColor: "#16A34A", opacity: disabled ? 0.5 : 1 }}><Check size={16} color="#FFFFFF" /></Pressable>
                          <Pressable disabled={disabled} onPress={() => setReasonFor(reasonFor === stop.id ? null : stop.id)} style={{ padding: 8, borderRadius: 9, backgroundColor: "#EF4444", opacity: disabled ? 0.5 : 1 }}><X size={16} color="#FFFFFF" /></Pressable>
                        </View>
                      </View>
                      {reasonFor === stop.id && (
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "#FEF2F2" }}>
                          <TextInput
                            value={reasonDrafts[stop.id] ?? ""}
                            onChangeText={(value) => setReasonDrafts((old) => ({ ...old, [stop.id]: value }))}
                            placeholder="Motif du non-visité"
                            placeholderTextColor={colors.muted}
                            style={{ flex: 1, color: colors.text, borderWidth: 1, borderColor: "#EF4444", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.input }}
                          />
                          <Pressable onPress={() => resolveStop(stop, "not_visited")} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9, backgroundColor: "#EF4444" }}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Confirmer</Text></Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))}

        <View style={{ maxWidth: 1200, width: "100%", alignSelf: "center" }}>
          {(finished || cancelled) && isAdmin ? (
            <Pressable onPress={() => reopenMutation.mutate()} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#F97316", paddingHorizontal: 17, paddingVertical: 12, borderRadius: 12 }}>
              <RotateCcw size={18} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Réouvrir la tournée</Text>
            </Pressable>
          ) : !finished && !cancelled && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 9 }}>
              {isAdmin && <Pressable onPress={() => setShowCancel(true)} style={{ alignItems: "center", borderWidth: 1, borderColor: "#EF4444", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12 }}><Text style={{ color: "#EF4444", fontWeight: "700" }}>Annuler l'occurrence</Text></Pressable>}
              <Pressable disabled={!canClose || closeMutation.isPending} onPress={() => closeMutation.mutate()} style={{ alignItems: "center", backgroundColor: "#16A34A", opacity: canClose ? 1 : 0.4, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{canClose ? "Clôturer la tournée" : "Résolvez tous les commerces"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      <ConfirmModal visible={showCancel} title="Annuler cette occurrence ?" message="Elle restera dans le planning et l'historique, avec le statut annulé." confirmText="Annuler l'occurrence" cancelText="Retour" isDestructive onCancel={() => setShowCancel(false)} onConfirm={() => cancelMutation.mutate()} />
    </View>
  );
}
