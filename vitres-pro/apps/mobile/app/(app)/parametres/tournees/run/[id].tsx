import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onlineManager, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, Check, CheckCircle2, ChevronLeft, Circle, Clock, MapPin, RotateCcw, Square, XCircle } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { enqueue } from "../../../../../src/lib/offline/outbox";
import { hasPendingWrites } from "../../../../../src/lib/offline/outbox";
import { BILLING_LABELS, formatEuro, TourRun, TourRunStop } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { ConfirmModal } from "../../../../../src/ui/components/ConfirmModal";
import { toast } from "../../../../../src/ui/toast";

type StopDraft = {
  notDoneIds: string[];
  reasons: Record<string, string>;
  generalReason: string;
  cash: Record<string, string>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "À faire",
  done: "Réalisé",
  partial: "Partiel",
  not_visited: "Non visité",
};

function expectedCash(stop: TourRunStop, notDoneIds: string[]) {
  const values: Record<string, number> = {};
  for (const service of stop.services) {
    if (!service.selected || notDoneIds.includes(service.id)) continue;
    if (service.billing_mode === "cash_invoiced" || service.billing_mode === "cash_no_invoice") {
      values[service.billing_mode] = (values[service.billing_mode] ?? 0) + Number(service.price_ht);
    }
  }
  return values;
}

function optimisticResolve(run: TourRun, stopId: string, status: "done" | "partial" | "not_visited", draft: StopDraft): TourRun {
  const now = new Date().toISOString();
  const stops = run.stops.map((stop) => {
    if (stop.id !== stopId) return stop;
    const notDone = status === "not_visited" ? stop.services.filter((service) => service.selected).map((service) => service.id) : draft.notDoneIds;
    const services = stop.services.map((service) => !service.selected ? service : {
      ...service,
      status: notDone.includes(service.id) ? "not_done" as const : "done" as const,
      exception_reason: notDone.includes(service.id) ? (draft.reasons[service.id] || draft.generalReason) : null,
    });
    const cashValues = expectedCash(stop, notDone);
    return {
      ...stop,
      status,
      exception_reason: status === "not_visited" ? draft.generalReason : null,
      services,
      cash_confirmations: Object.entries(cashValues).map(([mode, expected]) => ({
        id: `local-${stop.id}-${mode}`,
        billing_mode: mode as "cash_invoiced" | "cash_no_invoice",
        expected_amount: expected,
        received_amount: Number((draft.cash[mode] ?? String(expected)).replace(",", ".")),
        confirmed_at: now,
      })),
    };
  });
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
  const { width } = useWindowDimensions();
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const wide = width >= 820;
  const [drafts, setDrafts] = useState<Record<string, StopDraft>>({});
  const [busyStop, setBusyStop] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const text = isDark ? "#F8FAFC" : "#0F172A";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const border = isDark ? "#1E293B" : "#E4E4E7";
  const soft = isDark ? "#1E293B" : "#F1F5F9";
  const input = isDark ? "#0B1220" : "#F8FAFC";

  const runQuery = useQuery<TourRun>({
    queryKey: ["tour-run", id],
    queryFn: async () => (await api.get(`/api/tours/runs/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: () => onlineManager.isOnline() && !hasPendingWrites() ? 15_000 : false,
  });
  const run = runQuery.data;

  const getDraft = (stop: TourRunStop): StopDraft => drafts[stop.id] ?? {
    notDoneIds: stop.services.filter((service) => service.selected && service.status === "not_done").map((service) => service.id),
    reasons: Object.fromEntries(stop.services.filter((service) => service.exception_reason).map((service) => [service.id, service.exception_reason ?? ""])),
    generalReason: stop.exception_reason ?? "",
    cash: Object.fromEntries(stop.cash_confirmations.map((cash) => [cash.billing_mode, String(cash.received_amount ?? cash.expected_amount)])),
  };
  const updateDraft = (stop: TourRunStop, patch: Partial<StopDraft>) => setDrafts((old) => ({ ...old, [stop.id]: { ...getDraft(stop), ...patch } }));

  const resolveStop = async (stop: TourRunStop, status: "done" | "partial" | "not_visited") => {
    const draft = getDraft(stop);
    const selectedServices = stop.services.filter((service) => service.selected);
    const notDoneIds = status === "partial" ? draft.notDoneIds : status === "not_visited" ? selectedServices.map((service) => service.id) : [];
    if (status === "partial") {
      if (!notDoneIds.length || notDoneIds.length >= selectedServices.length) return toast.error("Sélection invalide", "Un passage partiel exige au moins une prestation faite et une non faite.");
      const missing = notDoneIds.find((serviceId) => !(draft.reasons[serviceId] || draft.generalReason).trim());
      if (missing) return toast.error("Justification requise", "Indiquez pourquoi chaque prestation décochée n'a pas été faite.");
    }
    if (status === "not_visited" && !draft.generalReason.trim()) return toast.error("Justification requise", "Indiquez pourquoi le commerce n'a pas été visité.");
    const cashExpected = expectedCash(stop, notDoneIds);
    const cashReceived: Record<string, number> = {};
    for (const [mode, amount] of Object.entries(cashExpected)) {
      const value = Number((draft.cash[mode] ?? String(amount)).replace(",", "."));
      if (!Number.isFinite(value) || value < 0) return toast.error("Encaissement requis", `Confirmez le montant ${BILLING_LABELS[mode as keyof typeof BILLING_LABELS]}.`);
      cashReceived[mode] = value;
    }
    setBusyStop(stop.id);
    const optimisticDraft = { ...draft, notDoneIds, cash: Object.fromEntries(Object.entries(cashReceived).map(([mode, value]) => [mode, String(value)])) };
    queryClient.setQueryData<TourRun>(["tour-run", id], (old) => old ? optimisticResolve(old, stop.id, status, optimisticDraft) : old);
    try {
      await enqueue({
        kind: "tour-stop-resolve",
        method: "POST",
        url: `/api/tours/runs/${id}/stops/${stop.id}/resolve`,
        body: {
          status,
          reason: draft.generalReason.trim() || null,
          not_done_service_ids: notDoneIds,
          service_reasons: draft.reasons,
          cash_received: cashReceived,
        },
        label: `${stop.name} · ${STATUS_LABELS[status]}`,
      });
      setDrafts((old) => { const next = { ...old }; delete next[stop.id]; return next; });
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
  const canClose = Boolean(run && run.stops.filter((stop) => stop.selected).every((stop) => stop.status !== "pending" && stop.cash_confirmations.every((cash) => cash.confirmed_at && cash.received_amount != null)));

  const backToCalendar = () => router.replace("/(app)/calendar" as any);

  if (runQuery.isLoading && !run) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!run) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF", padding: 20, gap: 12 }}>
        <AlertCircle size={28} color="#EF4444" />
        <Text style={{ color: text, textAlign: "center" }}>Cette tournée n'est pas disponible hors ligne ou vous n'y avez pas accès.</Text>
        <Pressable onPress={backToCalendar} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: soft }}><Text style={{ color: text, fontWeight: "700" }}>Retour au planning</Text></Pressable>
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 80, maxWidth: 1450, width: "100%", alignSelf: "center" }}>
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: muted, marginBottom: 8 }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })} · {run.employees.map((employee) => employee.full_name ?? employee.email).join(", ")}</Text>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: border, overflow: "hidden", marginBottom: 6 }}><View style={{ width: `${run.progress.percent}%`, height: "100%", backgroundColor: run.progress.percent === 100 ? "#16A34A" : "#F97316" }} /></View>
          <Text style={{ color: muted, textAlign: "right" }}>{run.progress.resolved}/{run.progress.total} commerces résolus</Text>
        </View>
        {grouped.map(([section, stops]) => (
          <View key={section} style={{ marginBottom: 20, gap: 9 }}>
            <Text style={{ color: text, fontSize: 17, fontWeight: "700", marginTop: 5 }}>{section}</Text>
            {stops.map((stop) => (
              <StopChecklist
                key={stop.id}
                stop={stop}
                draft={getDraft(stop)}
                updateDraft={(patch) => updateDraft(stop, patch)}
                resolve={(status) => resolveStop(stop, status)}
                disabled={finished || cancelled || busyStop === stop.id}
                wide={wide}
                colors={{ text, muted, border, soft, input }}
              />
            ))}
          </View>
        ))}

        {(finished || cancelled) && isAdmin ? (
          <Pressable onPress={() => reopenMutation.mutate()} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#F97316", paddingHorizontal: 17, paddingVertical: 12, borderRadius: 12 }}>
            <RotateCcw size={18} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Réouvrir la tournée</Text>
          </Pressable>
        ) : !finished && !cancelled && (
          <View style={{ flexDirection: wide ? "row" : "column", justifyContent: "flex-end", gap: 9 }}>
            {isAdmin && <Pressable onPress={() => setShowCancel(true)} style={{ alignItems: "center", borderWidth: 1, borderColor: "#EF4444", paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12 }}><Text style={{ color: "#EF4444", fontWeight: "700" }}>Annuler l'occurrence</Text></Pressable>}
            <Pressable disabled={!canClose || closeMutation.isPending} onPress={() => closeMutation.mutate()} style={{ alignItems: "center", backgroundColor: "#16A34A", opacity: canClose ? 1 : 0.4, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{canClose ? "Clôturer la tournée" : "Résolvez tous les commerces et encaissements"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <ConfirmModal visible={showCancel} title="Annuler cette occurrence ?" message="Elle restera dans le planning et l'historique, avec le statut annulé." confirmText="Annuler l'occurrence" cancelText="Retour" isDestructive onCancel={() => setShowCancel(false)} onConfirm={() => cancelMutation.mutate()} />
    </View>
  );
}

function StopChecklist({ stop, draft, updateDraft, resolve, disabled, wide, colors }: { stop: TourRunStop; draft: StopDraft; updateDraft: (patch: Partial<StopDraft>) => void; resolve: (status: "done" | "partial" | "not_visited") => void; disabled: boolean; wide: boolean; colors: { text: string; muted: string; border: string; soft: string; input: string } }) {
  const services = stop.services.filter((service) => service.selected);
  const cash = expectedCash(stop, draft.notDoneIds);
  const statusColor = stop.status === "done" ? "#16A34A" : stop.status === "partial" ? "#F97316" : stop.status === "not_visited" ? "#EF4444" : colors.muted;
  return (
    <Card style={{ borderColor: stop.status === "pending" ? undefined : statusColor }}>
      <View style={{ padding: 14, flexDirection: wide ? "row" : "column", gap: 14 }}>
        <View style={{ width: wide ? 236 : undefined }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={{ flex: 1, color: colors.text, fontWeight: "700", fontSize: 16 }}>{stop.name}</Text>
            {stop.status === "done" ? <CheckCircle2 size={19} color={statusColor} /> : stop.status === "not_visited" ? <XCircle size={19} color={statusColor} /> : <Circle size={19} color={statusColor} />}
          </View>
          <Text style={{ color: statusColor, fontWeight: "700", fontSize: 12, marginTop: 3 }}>{STATUS_LABELS[stop.status]}</Text>
          {stop.time_window && <View style={{ flexDirection: "row", gap: 5, marginTop: 8 }}><Clock size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>{stop.time_window}</Text></View>}
          {stop.address && <View style={{ flexDirection: "row", gap: 5, marginTop: 5 }}><MapPin size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>{stop.address}</Text></View>}
          {stop.instructions && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 7, fontStyle: "italic" }}>{stop.instructions}</Text>}
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          {services.map((service) => {
            const notDone = draft.notDoneIds.includes(service.id);
            return (
              <View key={service.id} style={{ gap: 5 }}>
                <Pressable disabled={disabled} onPress={() => updateDraft({ notDoneIds: notDone ? draft.notDoneIds.filter((item) => item !== service.id) : [...draft.notDoneIds, service.id] })} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                  {notDone ? <Square size={19} color="#EF4444" /> : <Check size={19} color="#16A34A" />}
                  <Text style={{ flex: 1, color: colors.text, textDecorationLine: notDone ? "line-through" : "none" }}>{service.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{BILLING_LABELS[service.billing_mode].split(" · ")[0]}</Text>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{formatEuro(service.price_ht)}</Text>
                </Pressable>
                {notDone && <TextInput value={draft.reasons[service.id] ?? ""} onChangeText={(value) => updateDraft({ reasons: { ...draft.reasons, [service.id]: value } })} placeholder="Justification obligatoire" placeholderTextColor={colors.muted} style={{ marginLeft: 27, color: colors.text, borderWidth: 1, borderColor: "#EF4444", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.input }} />}
              </View>
            );
          })}
          {Object.entries(cash).map(([mode, amount]) => (
            <View key={mode} style={{ marginTop: 5, padding: 10, borderRadius: 10, backgroundColor: colors.soft, borderWidth: 1, borderColor: "#F59E0B", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Banknote size={18} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 12 }}>{BILLING_LABELS[mode as keyof typeof BILLING_LABELS]}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Attendu : {formatEuro(amount)}</Text>
              </View>
              <TextInput value={draft.cash[mode] ?? String(amount)} onChangeText={(value) => updateDraft({ cash: { ...draft.cash, [mode]: value } })} keyboardType="decimal-pad" style={{ width: 85, borderWidth: 1, borderColor: "#F59E0B", borderRadius: 10, padding: 8, color: colors.text, backgroundColor: colors.input, fontWeight: "700" }} />
            </View>
          ))}
        </View>
        <View style={{ width: wide ? 276 : undefined, gap: 8 }}>
          <TextInput value={draft.generalReason} onChangeText={(value) => updateDraft({ generalReason: value })} placeholder="Motif général (obligatoire si non visité)" placeholderTextColor={colors.muted} multiline style={{ minHeight: 56, color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 9, textAlignVertical: "top" }} />
          <Pressable disabled={disabled} onPress={() => resolve("done")} style={{ padding: 10, borderRadius: 10, backgroundColor: "#16A34A", opacity: disabled ? 0.5 : 1, alignItems: "center" }}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Tout réalisé</Text></Pressable>
          <View style={{ flexDirection: "row", gap: 7 }}>
            <Pressable disabled={disabled || draft.notDoneIds.length === 0} onPress={() => resolve("partial")} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#F97316", opacity: disabled || !draft.notDoneIds.length ? 0.4 : 1, alignItems: "center" }}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Partiel</Text></Pressable>
            <Pressable disabled={disabled} onPress={() => resolve("not_visited")} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: "#EF4444", opacity: disabled ? 0.5 : 1, alignItems: "center" }}><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Non visité</Text></Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}
