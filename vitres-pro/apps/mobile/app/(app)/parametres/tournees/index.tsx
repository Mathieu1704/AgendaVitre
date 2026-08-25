import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarCheck, ChevronLeft, ChevronRight, Eye, FileSpreadsheet, Map, Plus } from "lucide-react-native";

import { api } from "../../../../src/lib/api";
import { TourRun, TourTemplate, WEEKDAY_LABELS } from "../../../../src/lib/tours";
import { useAuth } from "../../../../src/hooks/useAuth";
import { useTheme } from "../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../src/ui/components/Card";
import { Button } from "../../../../src/ui/components/Button";
import { MultiSelect } from "../../../../src/ui/components/MultiSelect";
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
    queryKey: ["tour-drafts", 2],
    queryFn: async () => (await api.get("/api/tours/drafts", { params: { weeks: 2 } })).data,
    enabled: isAdmin,
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
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 22 }}>
          {TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setView(tab.key)}
                style={{
                  flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
                  paddingHorizontal: 4, paddingVertical: 11, borderRadius: 999, overflow: "hidden",
                  backgroundColor: active ? "#3B82F6" : soft,
                }}
              >
                <tab.icon size={15} color={active ? "#FFFFFF" : muted} />
                <Text numberOfLines={1} style={{ flexShrink: 1, color: active ? "#FFFFFF" : (isDark ? "#F8FAFC" : "#0F172A"), fontWeight: "700", fontSize: 12 }}>{tab.label}</Text>
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
            {templatesQuery.isLoading ? <ActivityIndicator color="#3B82F6" /> : [...(templatesQuery.data ?? [])].sort((a, b) => a.zone === b.zone ? 0 : a.zone === "hainaut" ? -1 : 1).map((template) => {
              const stops = template.sections.reduce((sum, section) => sum + section.stops.length, 0);
              const services = template.sections.reduce((sum, section) => sum + section.stops.reduce((inner, stop) => inner + stop.services.length, 0), 0);
              return (
                <Card key={template.id}>
                  <CardContent style={{ padding: 16, flexDirection: wide ? "row" : "column", gap: 12, alignItems: wide ? "center" : "stretch" }}>
                    <View style={{ width: wide ? 5 : "100%", height: wide ? 44 : 5, borderRadius: 4, backgroundColor: template.zone === "hainaut" ? "#3B82F6" : "#16A34A" }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 17, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>{template.name}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: template.active ? "rgba(22,163,74,0.15)" : soft }}>
                          <Text style={{ color: template.active ? "#16A34A" : muted, fontSize: 11, fontWeight: "700" }}>{template.active ? "ACTIF" : "INACTIF"}</Text>
                        </View>
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
          <View style={{ gap: 8 }}>
            {draftsQuery.isLoading ? <ActivityIndicator color="#3B82F6" /> : (draftsQuery.data ?? []).length === 0 ? (
              <Card><CardContent style={{ padding: 20 }}><Text style={{ color: muted }}>Aucun brouillon : activez d'abord un modèle dans "Modèles".</Text></CardContent></Card>
            ) : [...(draftsQuery.data ?? [])].sort((a, b) => {
              const zoneA = templatesQuery.data?.find((item) => item.id === a.template_id)?.zone;
              const zoneB = templatesQuery.data?.find((item) => item.id === b.template_id)?.zone;
              return zoneA === zoneB ? 0 : zoneA === "hainaut" ? -1 : 1;
            }).map((run) => {
              const selected = run.stops.filter((stop) => stop.selected).length;
              const templateZone = templatesQuery.data?.find((item) => item.id === run.template_id)?.zone;
              const eligible = templateZone ? ordinaryEmployees.filter((employee) => employee.zone === templateZone) : [];
              const selectedEmployees = assignees[run.id] ?? [];
              const employeeItems = eligible.map((employee) => ({ id: employee.id, label: employee.full_name ?? employee.email, color: employee.color }));
              return (
                <Card key={run.id}>
                  <CardContent style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: wide ? "row" : "column", gap: 8, alignItems: wide ? "center" : "stretch" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>{run.intervention.title}</Text>
                        <Text style={{ color: muted, fontSize: 12, marginTop: 1 }}>{new Date(`${run.scheduled_date}T12:00:00`).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })} · {selected} coché(s)</Text>
                      </View>
                      <Pressable onPress={() => router.push(`/(app)/parametres/tournees/prepare/${run.id}` as any)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#3B82F6" }}>
                        <Eye size={14} color="#FFFFFF" />
                        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>Vérifier</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <MultiSelect
                          items={employeeItems}
                          selectedIds={selectedEmployees}
                          onChange={(ids) => setAssignees((old) => ({ ...old, [run.id]: ids }))}
                        />
                      </View>
                      <Pressable disabled={!selected || !selectedEmployees.length || publishMutation.isPending} onPress={() => publishMutation.mutate({ runId: run.id, employeeIds: selectedEmployees })} style={{ opacity: !selected || !selectedEmployees.length ? 0.4 : 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: "#16A34A" }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>Publier</Text>
                      </Pressable>
                    </View>
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
