import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Clock, Save, Square } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { formatEuro, TourRun } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { toast } from "../../../../../src/ui/toast";

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
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const text = isDark ? "#F8FAFC" : "#0F172A";
  const muted = isDark ? "#94A3B8" : "#64748B";
  const border = isDark ? "#1E293B" : "#E4E4E7";

  const runQuery = useQuery<TourRun>({
    queryKey: ["tour-run", id],
    queryFn: async () => (await api.get(`/api/tours/runs/${id}`)).data,
    enabled: isAdmin && Boolean(id),
  });
  useEffect(() => {
    if (runQuery.data) {
      setStartTime(brusselsTime(runQuery.data.intervention.start_time));
      setEndTime(brusselsTime(runQuery.data.intervention.end_time));
    }
  }, [runQuery.data?.intervention.start_time, runQuery.data?.intervention.end_time]);

  const selectionMutation = useMutation({
    mutationFn: async ({ stopId, selected }: { stopId: string; selected: boolean }) => api.patch(`/api/tours/runs/${id}/stops/${stopId}/selection`, { selected }),
    onMutate: ({ stopId, selected }) => queryClient.setQueryData<TourRun>(["tour-run", id], (old) => old ? {
      ...old,
      stops: old.stops.map((stop) => stop.id === stopId ? { ...stop, selected } : stop),
    } : old),
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      toast.error("Modification impossible", error?.response?.data?.detail ?? "Erreur reseau");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tour-drafts"] }),
  });
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const run = runQuery.data!;
      return api.patch(`/api/tours/runs/${id}/schedule`, {
        start_time: replaceBrusselsTime(run.intervention.start_time, startTime),
        end_time: replaceBrusselsTime(run.intervention.end_time, endTime),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-run", id] });
      queryClient.invalidateQueries({ queryKey: ["tour-drafts"] });
      toast.success("Horaires enregistrés", "");
    },
    onError: (error: any) => toast.error("Horaires invalides", error?.response?.data?.detail ?? "Vérifiez les heures."),
  });

  const selectedTotal = useMemo(() => runQuery.data?.stops.filter((stop) => stop.selected).reduce((sum, stop) => sum + stop.services.reduce((inner, service) => inner + Number(service.price_ht), 0), 0) ?? 0, [runQuery.data]);
  const selectedCount = useMemo(() => runQuery.data?.stops.filter((stop) => stop.selected).length ?? 0, [runQuery.data]);
  const grouped = useMemo(() => {
    const result = new Map<string, NonNullable<typeof runQuery.data>["stops"]>();
    for (const stop of runQuery.data?.stops ?? []) {
      const section = stop.section_label || "Sans section";
      result.set(section, [...(result.get(section) ?? []), stop]);
    }
    return [...result.entries()];
  }, [runQuery.data]);

  if (loading || runQuery.isLoading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!isAdmin) return <Redirect href="/(app)/calendar" />;
  if (!runQuery.data) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><Text style={{ color: text }}>Brouillon introuvable.</Text></View>;
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 60, maxWidth: 1200, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <Text style={{ color: muted }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Text>
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: isDark ? "rgba(249,115,22,0.15)" : "#FFF7ED" }}><Text style={{ color: "#F97316", fontWeight: "700" }}>BROUILLON</Text></View>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <CardContent style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: text, fontWeight: "700" }}>Cochez les commerces à faire cette semaine</Text>
            <Text style={{ color: muted, fontSize: 12 }}>Rien n'est présélectionné automatiquement — cochez comme vous marquiez le point sur le papier.</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Clock size={19} color="#3B82F6" /><Text style={{ color: text, fontWeight: "700" }}>Horaires de l'occurrence</Text></View>
            <View style={{ flexDirection: "row", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              {[{ label: "Début", value: startTime, setter: setStartTime }, { label: "Fin", value: endTime, setter: setEndTime }].map((field) => (
                <View key={field.label} style={{ gap: 4 }}>
                  <Text style={{ color: muted, fontSize: 11 }}>{field.label}</Text>
                  <TextInput value={field.value} onChangeText={field.setter} style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, minWidth: 90 }} />
                </View>
              ))}
              <Pressable onPress={() => scheduleMutation.mutate()} style={{ marginTop: 15, padding: 10, borderRadius: 12, backgroundColor: "#3B82F6" }}><Save size={18} color="#FFFFFF" /></Pressable>
              <Text style={{ marginLeft: "auto", color: text, fontSize: 17, fontWeight: "700" }}>{selectedCount} commerce(s) · {formatEuro(selectedTotal)} HT</Text>
            </View>
          </CardContent>
        </Card>

        {grouped.map(([section, stops]) => (
          <View key={section} style={{ marginBottom: 18, gap: 9 }}>
            <Text style={{ color: text, fontSize: 18, fontWeight: "700" }}>{section}</Text>
            {stops.map((stop) => (
              <Card key={stop.id} style={{ borderColor: stop.selected ? "#3B82F6" : undefined }}>
                <Pressable onPress={() => selectionMutation.mutate({ stopId: stop.id, selected: !stop.selected })} style={{ padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  {stop.selected ? <Check size={22} color="#16A34A" /> : <Square size={22} color={muted} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: "700", fontSize: 16 }}>{stop.name}</Text>
                    {(stop.note || stop.payment_text || stop.frequency_text) && (
                      <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                        {[stop.note, stop.payment_text, stop.frequency_text].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                    <View style={{ marginTop: 6, gap: 3 }}>
                      {stop.services.map((service) => (
                        <View key={service.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: text, fontSize: 13 }}>{service.label}</Text>
                          <Text style={{ color: text, fontSize: 13, fontWeight: "600" }}>{formatEuro(service.price_ht)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
