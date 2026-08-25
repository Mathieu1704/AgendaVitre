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
type Cols = { name: number; face: number; price: number; minutes: number; payment: number; frequency: number };

const CHAR_WIDTH = 7.3;
const CELL_PADDING = 28;
const measure = (text: string) => Math.round(text.length * CHAR_WIDTH) + CELL_PADDING;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Auto-fit façon Excel : chaque colonne prend la largeur du texte le plus
// long qu'elle contient (en-tête compris), bornée pour rester utilisable.
function computeColumnWidths(stops: TourRunStop[]): Cols {
  const widths = { name: measure("Commerce"), face: measure("Face 1"), price: measure("Prix 1"), minutes: measure("Temps"), payment: measure("Paiement"), frequency: measure("Fréquence") };
  for (const stop of stops) {
    widths.name = Math.max(widths.name, measure(stop.name || ""));
    widths.minutes = Math.max(widths.minutes, measure(stop.estimated_minutes != null ? String(stop.estimated_minutes) : ""));
    widths.payment = Math.max(widths.payment, measure(stop.payment_text ?? ""));
    widths.frequency = Math.max(widths.frequency, measure(stop.frequency_text ?? ""));
    for (const service of stop.services.slice(0, 2)) {
      widths.face = Math.max(widths.face, measure(service.label || ""));
      widths.price = Math.max(widths.price, measure(formatEuro(service.price_ht)));
    }
  }
  return {
    name: clamp(widths.name, 120, 280),
    face: clamp(widths.face, 70, 160),
    price: clamp(widths.price, 60, 110),
    minutes: clamp(widths.minutes, 55, 90),
    payment: clamp(widths.payment, 90, 240),
    frequency: clamp(widths.frequency, 90, 240),
  };
}

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
  const grouped = useMemo(() => {
    const result = new Map<string, TourRunStop[]>();
    for (const stop of runQuery.data?.stops ?? []) {
      const section = stop.section_label || "Sans section";
      result.set(section, [...(result.get(section) ?? []), stop]);
    }
    return [...result.entries()];
  }, [runQuery.data]);
  const cols = useMemo(() => computeColumnWidths(runQuery.data?.stops ?? []), [runQuery.data]);
  const tableWidth = cols.name + (cols.face + cols.price) * 2 + cols.minutes + cols.payment + cols.frequency;

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

        {grouped.map(([section, stops]) => (
          <View key={section} style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 8, maxWidth: 1200, width: "100%", alignSelf: "center" }}>{section}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxWidth: "100%" }}>
              <View style={{ width: tableWidth }}>
                <View style={{ flexDirection: "row", backgroundColor: colors.header, paddingTop: 6 }}>
                  <View style={{ width: cols.name }} />
                  <View style={{ width: cols.face * 2, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 3 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>NOMBRE DE FACE</Text></View>
                  <View style={{ width: cols.price * 2, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 3 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>PRIX PRESTATION</Text></View>
                  <View style={{ width: cols.minutes }} />
                  <View style={{ width: cols.payment }} />
                  <View style={{ width: cols.frequency }} />
                </View>
                <View style={{ flexDirection: "row", backgroundColor: colors.header, paddingVertical: 8, borderRadius: 10, marginBottom: 4 }}>
                  <View style={{ width: cols.name, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Commerce</Text></View>
                  <View style={{ width: cols.face, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Face 1</Text></View>
                  <View style={{ width: cols.face, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Face 2</Text></View>
                  <View style={{ width: cols.price, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Prix 1</Text></View>
                  <View style={{ width: cols.price, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Prix 2</Text></View>
                  <View style={{ width: cols.minutes, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Temps</Text></View>
                  <View style={{ width: cols.payment, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Paiement</Text></View>
                  <View style={{ width: cols.frequency, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Fréquence</Text></View>
                </View>
                {stops.map((stop) => {
                  const face1 = stop.services[0];
                  const face2 = stop.services[1];
                  return (
                    <View key={stop.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: stop.selected ? (isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.05)") : "transparent" }}>
                      <View style={{ width: cols.name, paddingHorizontal: 6 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{stop.name}</Text></View>
                      <FaceCell service={face1} width={cols.face} selected={stop.selected && stop.selected_service_id === face1?.id} onPress={() => face1 && toggleFace(stop, face1.id)} colors={colors} />
                      <FaceCell service={face2} width={cols.face} selected={stop.selected && stop.selected_service_id === face2?.id} onPress={() => face2 && toggleFace(stop, face2.id)} colors={colors} />
                      <PriceCell service={face1} width={cols.price} selected={stop.selected && stop.selected_service_id === face1?.id} onPress={() => face1 && toggleFace(stop, face1.id)} colors={colors} />
                      <PriceCell service={face2} width={cols.price} selected={stop.selected && stop.selected_service_id === face2?.id} onPress={() => face2 && toggleFace(stop, face2.id)} colors={colors} />
                      <View style={{ width: cols.minutes, paddingHorizontal: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{stop.estimated_minutes ?? ""}</Text></View>
                      <View style={{ width: cols.payment, paddingHorizontal: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{stop.payment_text ?? ""}</Text></View>
                      <View style={{ width: cols.frequency, paddingHorizontal: 6 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{stop.frequency_text ?? ""}</Text></View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function FaceCell({ service, selected, onPress, colors, width }: { service: { id: string; label: string; price_ht: number } | undefined; selected: boolean; onPress: () => void; colors: Colors; width: number }) {
  if (!service) return <View style={{ width }} />;
  return (
    <Pressable onPress={onPress} style={{ width: width - 2, marginRight: 2, borderRadius: 9, borderWidth: 1, borderColor: selected ? "#3B82F6" : colors.border, backgroundColor: selected ? "rgba(59,130,246,0.15)" : "transparent", paddingHorizontal: 8, paddingVertical: 7 }}>
      <Text style={{ color: selected ? "#3B82F6" : colors.text, fontWeight: selected ? "700" : "500", fontSize: 12 }} numberOfLines={1}>{service.label || "—"}</Text>
    </Pressable>
  );
}

function PriceCell({ service, selected, onPress, colors, width }: { service: { id: string; label: string; price_ht: number } | undefined; selected: boolean; onPress: () => void; colors: Colors; width: number }) {
  if (!service) return <View style={{ width }} />;
  return (
    <Pressable onPress={onPress} style={{ width: width - 2, marginRight: 2, borderRadius: 9, borderWidth: 1, borderColor: selected ? "#3B82F6" : colors.border, backgroundColor: selected ? "rgba(59,130,246,0.15)" : "transparent", paddingHorizontal: 8, paddingVertical: 7 }}>
      <Text style={{ color: selected ? "#3B82F6" : colors.muted, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{formatEuro(service.price_ht)}</Text>
    </Pressable>
  );
}
