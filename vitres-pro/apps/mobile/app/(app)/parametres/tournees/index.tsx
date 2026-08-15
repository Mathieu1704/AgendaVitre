import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarCheck, ChevronLeft, ChevronRight, FileSpreadsheet, Map, Plus } from "lucide-react-native";

import { api } from "../../../../src/lib/api";
import { TourRun, TourTemplate, WEEKDAY_LABELS } from "../../../../src/lib/tours";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useTheme } from "../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../src/ui/components/Card";
import { Button } from "../../../../src/ui/components/Button";
import { TourBillingView } from "../../../../src/ui/tours/TourBillingView";
import { toast } from "../../../../src/ui/toast";

type ViewKey = "templates" | "preparation" | "billing";

const TABS: Array<{ key: ViewKey; label: string; icon: any }> = [
  { key: "templates", label: "Modèles", icon: Map },
  { key: "preparation", label: "Préparation", icon: CalendarCheck },
  { key: "billing", label: "Facturation", icon: FileSpreadsheet },
];

export default function ToursAdminScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isAdmin, loading } = useAuth();
  const { isDark } = useTheme();
  const [view, setView] = useState<ViewKey>("templates");
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});
  const wide = width >= 900;
  const muted = isDark ? "#94A3B8" : "#64748B";
  const soft = isDark ? "#1E293B" : "#F1F5F9";

  const templatesQuery = useQuery<TourTemplate[]>({
    queryKey: ["tour-templates"],
    queryFn: async () => (await api.get("/api/tours/templates")).data,
    enabled: isAdmin,
  });
  const draftsQuery = useQuery<TourRun[]>({
    queryKey: ["tour-drafts", 8],
    queryFn: async () => (await api.get("/api/tours/drafts", { params: { weeks: 8 } })).data,
    enabled: isAdmin && view === "preparation",
  });
  const employeesQuery = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/api/employees")).data,
    enabled: isAdmin,
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/api/tours/templates/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tour-templates"] }),
    onError: (error: any) => toast.error("Archivage impossible", error?.response?.data?.detail ?? "Erreur reseau"),
  });
  const publishMutation = useMutation({
    mutationFn: async ({ runId, employeeIds }: { runId: string; employeeIds: string[] }) => api.post(`/api/tours/runs/${runId}/publish`, { employee_ids: employeeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Tournee publiee", "Elle est maintenant visible par les employes assignes.");
    },
    onError: (error: any) => toast.error("Publication impossible", error?.response?.data?.detail ?? "Erreur reseau"),
  });

  const ordinaryEmployees = useMemo(
    () => (employeesQuery.data ?? []).filter((employee) => employee.role === "employee"),
    [employeesQuery.data],
  );

  if (loading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!isAdmin) return <Redirect href="/(app)/calendar" />;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#020817" : "#FFFFFF", paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.replace("/(app)/parametres" as any)}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Tournées
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 60, maxWidth: 1500, width: "100%", alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={templatesQuery.isFetching || draftsQuery.isFetching} onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["tour-templates"] });
          queryClient.invalidateQueries({ queryKey: ["tour-drafts"] });
        }} />}
      >
        <Text style={{ color: muted, marginBottom: 14 }}>Modèles récurrents, préparation hebdomadaire et facturation.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setView(tab.key)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 7,
                  paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999,
                  backgroundColor: active ? "#3B82F6" : soft,
                }}
              >
                <tab.icon size={18} color={active ? "#FFFFFF" : muted} />
                <Text style={{ color: active ? "#FFFFFF" : (isDark ? "#F8FAFC" : "#0F172A"), fontWeight: "700" }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {view === "templates" && (
          <View style={{ gap: 12 }}>
            <Button onPress={() => router.push("/(app)/parametres/tournees/template/new" as any)} style={{ alignSelf: "flex-start", paddingHorizontal: 16 }}>
              <Plus size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: 6 }}>Nouveau modèle</Text>
            </Button>
            {templatesQuery.isLoading ? <ActivityIndicator color="#3B82F6" /> : (templatesQuery.data ?? []).map((template) => {
              const stops = template.sections.reduce((sum, section) => sum + section.stops.length, 0);
              const services = template.sections.reduce((sum, section) => sum + section.stops.reduce((inner, stop) => inner + stop.services.length, 0), 0);
              const review = template.sections.reduce((sum, section) => sum + section.stops.filter((stop) => stop.needs_review || stop.services.some((service) => service.needs_review)).length, 0);
              return (
                <Card key={template.id} style={{ borderColor: review ? "#F59E0B" : undefined }}>
                  <CardContent style={{ padding: 16, flexDirection: wide ? "row" : "column", gap: 12, alignItems: wide ? "center" : "stretch" }}>
                    <View style={{ width: wide ? 5 : "100%", height: wide ? 44 : 5, borderRadius: 4, backgroundColor: template.zone === "hainaut" ? "#3B82F6" : "#16A34A" }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 17, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>{template.name}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: template.active ? "rgba(22,163,74,0.15)" : soft }}>
                          <Text style={{ color: template.active ? "#16A34A" : muted, fontSize: 11, fontWeight: "700" }}>{template.active ? "ACTIF" : "INACTIF"}</Text>
                        </View>
                        {review > 0 && <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "700" }}>{review} à valider</Text>}
                      </View>
                      <Text style={{ color: muted, marginTop: 4 }}>{WEEKDAY_LABELS[template.weekday]} · {template.default_start_time.slice(0, 5)}–{template.default_end_time.slice(0, 5)} · {stops} commerces · {services} prestations</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={() => router.push(`/(app)/parametres/tournees/template/${template.id}` as any)} style={{ flex: wide ? undefined : 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#3B82F6", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Modifier</Text><ChevronRight size={16} color="#FFFFFF" />
                      </Pressable>
                      <Pressable onPress={() => archiveMutation.mutate(template.id!)} style={{ padding: 10, borderRadius: 12, backgroundColor: soft }}>
                        <Archive size={18} color={muted} />
                      </Pressable>
                    </View>
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}

        {view === "preparation" && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: muted }}>Les huit prochaines semaines sont générées automatiquement.</Text>
            {draftsQuery.isLoading ? <ActivityIndicator color="#3B82F6" /> : (draftsQuery.data ?? []).length === 0 ? (
              <Card><CardContent style={{ padding: 20 }}><Text style={{ color: muted }}>Aucun brouillon : activez d'abord un modèle entièrement validé.</Text></CardContent></Card>
            ) : (draftsQuery.data ?? []).map((run) => {
              const selected = run.stops.reduce((sum, stop) => sum + stop.services.filter((service) => service.selected).length, 0);
              const templateZone = templatesQuery.data?.find((item) => item.id === run.template_id)?.zone;
              const eligible = templateZone ? ordinaryEmployees.filter((employee) => employee.zone === templateZone) : [];
              const selectedEmployees = assignees[run.id] ?? [];
              return (
                <Card key={run.id}>
                  <CardContent style={{ padding: 16, gap: 12 }}>
                    <View style={{ flexDirection: wide ? "row" : "column", gap: 10, alignItems: wide ? "center" : "stretch" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>{run.intervention.title}</Text>
                        <Text style={{ color: muted, marginTop: 3 }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })} · {selected} prestation(s) suggérée(s)</Text>
                      </View>
                      <Pressable onPress={() => router.push(`/(app)/parametres/tournees/prepare/${run.id}` as any)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: soft }}>
                        <Text style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: "700" }}>Vérifier le contenu</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                      {eligible.map((employee) => {
                        const checked = selectedEmployees.includes(employee.id);
                        return (
                          <Pressable
                            key={employee.id}
                            onPress={() => setAssignees((old) => ({ ...old, [run.id]: checked ? selectedEmployees.filter((id) => id !== employee.id) : [...selectedEmployees, employee.id] }))}
                            style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: checked ? (employee.color ?? "#3B82F6") : (isDark ? "#334155" : "#E2E8F0"), backgroundColor: checked ? `${employee.color ?? "#3B82F6"}22` : "transparent" }}
                          >
                            <Text style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: checked ? "700" : "500" }}>{employee.full_name ?? employee.email}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable disabled={!selected || !selectedEmployees.length || publishMutation.isPending} onPress={() => publishMutation.mutate({ runId: run.id, employeeIds: selectedEmployees })} style={{ alignSelf: "flex-start", opacity: !selected || !selectedEmployees.length ? 0.4 : 1, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: "#16A34A" }}>
                      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Publier pour {selectedEmployees.length || 0} employé(s)</Text>
                    </Pressable>
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}

        {view === "billing" && <TourBillingView isDark={isDark} />}
      </ScrollView>
    </View>
  );
}
