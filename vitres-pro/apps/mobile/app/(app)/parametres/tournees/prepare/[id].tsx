import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { formatEuro, TourRun, TourRunStop } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { DateTimePicker } from "../../../../../src/ui/components/DateTimePicker";
import { toast } from "../../../../../src/ui/toast";

// L'heure seule n'a pas de date propre : on l'accroche a une date bidon pour
// reutiliser DateTimePicker tel quel (seule la partie heure est lue/ecrite).
const toTimeValue = (time: string) => `2000-01-01T${time.slice(0, 5)}`;
const fromTimeValue = (value: string) => value.split("T")[1] ?? "08:00";

type Colors = { text: string; muted: string; border: string; header: string };

function brusselsTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Brussels" });
}

function replaceBrusselsTime(originalIso: string, value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const original = new Date(originalIso);
  const parts = new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Brussels" }).formatToParts(original);
  const currentHours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const currentMinutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return new Date(original.getTime() + ((hours * 60 + minutes) - (currentHours * 60 + currentMinutes)) * 60_000).toISOString();
}

export default function TourPreparationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isAdmin, loading } = useAuth();
  const { isDark } = useTheme();
  const colors: Colors = {
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#1E293B" : "#E4E4E7",
    header: isDark ? "#111C30" : "#EFF6FF",
  };

  const runQuery = useQuery<TourRun>({
    queryKey: ["tour-run", id],
    queryFn: async () => (await api.get(`/api/tours/runs/${id}`)).data,
    enabled: isAdmin && Boolean(id),
  });

  const selectionMutation = useMutation({
    mutationFn: async ({ stopId, selected, serviceId }: { stopId: string; selected: boolean; serviceId?: string | null }) => api.patch(`/api/tours/runs/${id}/stops/${stopId}/selection`, { selected, service_id: serviceId }),
    onMutate: ({ stopId, selected, serviceId }) => queryClient.setQueryData<TourRun>(["tour-run", id], (old) => old ? {
      ...old,
      stops: old.stops.map((stop) => stop.id === stopId ? { ...stop, selected, selected_service_id: selected ? (serviceId ?? null) : null } : stop),
    } : old),
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      toast.error("Modification impossible", error?.response?.data?.detail ?? "Erreur reseau");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tour-drafts"] }),
  });
  const scheduleMutation = useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const run = runQuery.data!;
      return api.patch(`/api/tours/runs/${id}/schedule`, {
        start_time: replaceBrusselsTime(run.intervention.start_time, start),
        end_time: replaceBrusselsTime(run.intervention.end_time, end),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      queryClient.invalidateQueries({ queryKey: ["tour-drafts"] });
    },
    onError: (error: any) => toast.error("Horaires invalides", error?.response?.data?.detail ?? "Vérifiez les heures."),
  });

  const toggleFace = (stop: TourRunStop, serviceId: string) => {
    const alreadyChosen = stop.selected && stop.selected_service_id === serviceId;
    selectionMutation.mutate({ stopId: stop.id, selected: !alreadyChosen, serviceId: alreadyChosen ? null : serviceId });
  };

  const selectedTotal = useMemo(() => runQuery.data?.stops.filter((stop) => stop.selected).reduce((sum, stop) => sum + Number(stop.services.find((service) => service.id === stop.selected_service_id)?.price_ht ?? 0), 0) ?? 0, [runQuery.data]);
  const selectedCount = useMemo(() => runQuery.data?.stops.filter((stop) => stop.selected).length ?? 0, [runQuery.data]);
  if (loading || runQuery.isLoading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!isAdmin) return <Redirect href="/(app)/calendar" />;
  if (!runQuery.data) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><Text style={{ color: colors.text }}>Brouillon introuvable.</Text></View>;
  const run = runQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#020817" : "#FFFFFF", paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.replace("/(app)/parametres/tournees" as any)}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          {run.intervention.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, maxWidth: 1200, width: "100%", alignSelf: "center" }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textTransform: "capitalize" }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: isDark ? "rgba(249,115,22,0.15)" : "#FFF7ED" }}><Text style={{ color: "#F97316", fontWeight: "700" }}>BROUILLON</Text></View>
        </View>

        <Card style={{ marginBottom: 16, maxWidth: 1200, width: "100%", alignSelf: "center" }}>
          <CardContent style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Touchez la variante à faire cette semaine par commerce</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Clock size={19} color="#3B82F6" /><Text style={{ color: colors.text, fontWeight: "700" }}>Horaires de l'occurrence</Text></View>
            <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 130 }}>
                <DateTimePicker
                  label="Début"
                  timeOnly
                  value={toTimeValue(brusselsTime(run.intervention.start_time))}
                  onChange={(value) => scheduleMutation.mutate({ start: fromTimeValue(value), end: brusselsTime(run.intervention.end_time) })}
                />
              </View>
              <View style={{ flex: 1, minWidth: 130 }}>
                <DateTimePicker
                  label="Fin"
                  timeOnly
                  value={toTimeValue(brusselsTime(run.intervention.end_time))}
                  onChange={(value) => scheduleMutation.mutate({ start: brusselsTime(run.intervention.start_time), end: fromTimeValue(value) })}
                />
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{selectedCount} commerce(s) · {formatEuro(selectedTotal)} HT</Text>
          </CardContent>
        </Card>

        <View style={{ gap: 10, maxWidth: 1200, width: "100%", alignSelf: "center" }}>
          {run.stops.map((stop) => (
            <PrepareStopCard key={stop.id} stop={stop} onSelect={(serviceId) => toggleFace(stop, serviceId)} colors={colors} isDark={isDark} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// Carte commerce en lecture seule (nom/temps/paiement/fréquence), avec la
// liste ouverte de prestations rendue comme des lignes sélectionnables : un
// tap choisit la prestation faite cette semaine (une seule à la fois).
function PrepareStopCard({ stop, onSelect, colors, isDark }: { stop: TourRunStop; onSelect: (serviceId: string) => void; colors: Colors; isDark: boolean }) {
  const meta = [stop.estimated_minutes != null ? `${stop.estimated_minutes} min` : null, stop.payment_text, stop.frequency_text].filter(Boolean).join(" · ");
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: stop.selected ? (isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.05)") : colors.header }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, marginBottom: 2 }}>{stop.name}</Text>
      {!!meta && <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>{meta}</Text>}
      <View style={{ gap: 6, marginTop: meta ? 0 : 8 }}>
        {stop.services.length === 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>Aucune prestation définie.</Text>}
        {stop.services.map((service) => {
          const selected = stop.selected && stop.selected_service_id === service.id;
          return (
            <Pressable
              key={service.id}
              onPress={() => onSelect(service.id)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: selected ? "#3B82F6" : colors.border, borderRadius: 9, backgroundColor: selected ? "rgba(59,130,246,0.12)" : "transparent", paddingHorizontal: 10, paddingVertical: 9 }}
            >
              <Text style={{ color: selected ? "#3B82F6" : colors.text, fontWeight: selected ? "700" : "500", fontSize: 13, flex: 1, minWidth: 0 }} numberOfLines={1}>{service.label || "—"}</Text>
              <Text style={{ color: selected ? "#3B82F6" : colors.muted, fontSize: 13, fontWeight: "600", marginLeft: 8 }}>{formatEuro(service.price_ht)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
