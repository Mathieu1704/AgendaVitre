import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { BILLING_LABELS, TourBillingMode, TourSchedule, TourService, TourStop, TourTemplate, WEEKDAY_LABELS, emptyTourTemplate } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { toast } from "../../../../../src/ui/toast";

const ALL_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

type Colors = { text: string; muted: string; border: string; soft: string; input: string };

function cloneTemplate(value: TourTemplate): TourTemplate {
  return JSON.parse(JSON.stringify(value));
}

function TextField({ label, value, onChangeText, colors, multiline = false, keyboardType }: { label: string; value: string | null | undefined; onChangeText: (value: string) => void; colors: Colors; multiline?: boolean; keyboardType?: any }) {
  return (
    <View style={{ gap: 5, flex: 1, minWidth: 130 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={{ minHeight: multiline ? 72 : 43, color: colors.text, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function Choice({ selected, label, onPress, colors, warning = false }: { selected: boolean; label: string; onPress: () => void; colors: Colors; warning?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected ? (warning ? "#F59E0B" : "#3B82F6") : colors.border, backgroundColor: selected ? (warning ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)") : "transparent" }}>
      <Text style={{ color: selected ? (warning ? "#F59E0B" : "#3B82F6") : colors.text, fontWeight: selected ? "700" : "500", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function TourTemplateEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isAdmin, loading } = useAuth();
  const { isDark } = useTheme();
  const isNew = id === "new";
  const wide = width >= 900;
  const [draft, setDraft] = useState<TourTemplate>(() => emptyTourTemplate());
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [openStops, setOpenStops] = useState<Set<string>>(new Set());
  const [bulkAnchor, setBulkAnchor] = useState("");
  const colors: Colors = {
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#1E293B" : "#E4E4E7",
    soft: isDark ? "#1E293B" : "#F1F5F9",
    input: isDark ? "#0B1220" : "#F8FAFC",
  };

  const templateQuery = useQuery<TourTemplate>({
    queryKey: ["tour-template", id],
    queryFn: async () => (await api.get(`/api/tours/templates/${id}`)).data,
    enabled: isAdmin && !isNew,
  });
  useEffect(() => {
    if (isNew && hydratedId !== "new") {
      setDraft(emptyTourTemplate());
      setHydratedId("new");
    } else if (templateQuery.data && hydratedId !== id) {
      setDraft(cloneTemplate(templateQuery.data));
      setHydratedId(id);
    }
  }, [id, hydratedId, isNew, templateQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = cloneTemplate(draft);
      if (isNew) return (await api.post("/api/tours/templates", payload)).data;
      return (await api.put(`/api/tours/templates/${id}`, payload)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["tour-templates"] });
      await queryClient.invalidateQueries({ queryKey: ["tour-drafts"] });
      toast.success("Modèle enregistré", saved.active ? "Les futurs brouillons ont été actualisés." : "Le modèle reste inactif.");
      router.replace("/(app)/parametres/tournees" as any);
    },
    onError: (error: any) => toast.error("Enregistrement impossible", error?.response?.data?.detail ?? "Vérifiez les champs du modèle."),
  });

  const mutate = (fn: (next: TourTemplate) => void) => setDraft((old) => {
    const next = cloneTemplate(old);
    fn(next);
    return next;
  });
  const move = <T,>(items: T[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    items.forEach((item: any, position) => { item.position = position; });
  };

  const addSection = () => mutate((next) => {
    next.sections.push({ label: "Nouvelle section", position: next.sections.length, stops: [] });
    setOpenSections((old) => new Set([...old, next.sections.length - 1]));
  });
  const addStop = (sectionIndex: number) => mutate((next) => {
    next.sections[sectionIndex].stops.push({ name: "Nouveau commerce", export_label: "Nouveau commerce", position: next.sections[sectionIndex].stops.length, active: true, needs_review: false, services: [] });
  });
  const addService = (sectionIndex: number, stopIndex: number) => mutate((next) => {
    next.sections[sectionIndex].stops[stopIndex].services.push({ label: "Nouvelle prestation", price_ht: 0, billing_mode: "monthly_invoice", position: next.sections[sectionIndex].stops[stopIndex].services.length, active: true, needs_review: false, schedules: [] });
  });
  const addSchedule = (sectionIndex: number, stopIndex: number, serviceIndex: number) => mutate((next) => {
    next.sections[sectionIndex].stops[stopIndex].services[serviceIndex].schedules.push({ kind: "interval", anchor_date: null, interval_weeks: 4, active_months: [...ALL_MONTHS], monthly_cap: null, position: next.sections[sectionIndex].stops[stopIndex].services[serviceIndex].schedules.length });
  });

  const reviewCount = useMemo(() => draft.sections.reduce((sum, section) => sum + section.stops.reduce((inner, stop) => inner + Number(stop.needs_review) + stop.services.filter((service) => service.needs_review).length, 0), 0), [draft]);

  if (loading || (!isNew && templateQuery.isLoading)) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!isAdmin) return <Redirect href="/(app)/calendar" />;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#020817" : "#FFFFFF", paddingTop: insets.top }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.replace("/(app)/parametres/tournees" as any)}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          {isNew ? "Nouveau modèle" : draft.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: 80, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <Text style={{ color: colors.muted, flex: 1 }}>Chaque sauvegarde crée une nouvelle version pour les brouillons futurs.</Text>
          <Pressable disabled={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#3B82F6", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, opacity: saveMutation.isPending ? 0.6 : 1 }}>
            <Save size={18} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}</Text>
          </Pressable>
        </View>
        {reviewCount > 0 && (
          <View style={{ padding: 13, borderRadius: 12, backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#FFFBEB", borderWidth: 1, borderColor: "#F59E0B", flexDirection: "row", gap: 9, marginBottom: 14 }}>
            <AlertTriangle size={20} color="#F59E0B" />
            <Text style={{ color: isDark ? "#FDE68A" : "#92400E", flex: 1 }}>{reviewCount} donnée(s) issue(s) des Word restent ambiguës. Validez-les avant activation.</Text>
          </View>
        )}

        <Card style={{ marginBottom: 18 }}>
          <CardContent style={{ padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Paramètres généraux</Text>
            <View style={{ flexDirection: wide ? "row" : "column", gap: 10 }}>
              <TextField label="Nom de la tournée" value={draft.name} onChangeText={(value) => mutate((next) => { next.name = value; })} colors={colors} />
              <TextField label="Début" value={draft.default_start_time.slice(0, 5)} onChangeText={(value) => mutate((next) => { next.default_start_time = `${value}:00`; })} colors={colors} />
              <TextField label="Fin" value={draft.default_end_time.slice(0, 5)} onChangeText={(value) => mutate((next) => { next.default_end_time = `${value}:00`; })} colors={colors} />
            </View>
            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Zone</Text>
              <View style={{ flexDirection: "row", gap: 7 }}>
                <Choice selected={draft.zone === "hainaut"} label="Hainaut" onPress={() => mutate((next) => { next.zone = "hainaut"; })} colors={colors} />
                <Choice selected={draft.zone === "ardennes"} label="Ardennes" onPress={() => mutate((next) => { next.zone = "ardennes"; })} colors={colors} />
              </View>
            </View>
            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Jour fixe</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {Object.entries(WEEKDAY_LABELS).slice(0, 5).map(([day, label]) => <Choice key={day} selected={draft.weekday === Number(day)} label={label} onPress={() => mutate((next) => { next.weekday = Number(day); })} colors={colors} />)}
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Choice selected={draft.setup_complete} label={draft.setup_complete ? "Configuration validée" : "Configuration à terminer"} onPress={() => mutate((next) => { next.setup_complete = !next.setup_complete; if (!next.setup_complete) next.active = false; })} colors={colors} warning={!draft.setup_complete} />
              <Choice selected={draft.active} label={draft.active ? "Modèle actif" : "Modèle inactif"} onPress={() => mutate((next) => { next.active = !next.active; })} colors={colors} />
            </View>
            <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Assistant d'ancrage initial</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Choisissez une date réelle de passage. Elle sera appliquée aux règles périodiques sans modifier les prestations à la demande.</Text>
              <View style={{ flexDirection: wide ? "row" : "column", gap: 8 }}>
                <TextInput value={bulkAnchor} onChangeText={setBulkAnchor} placeholder="AAAA-MM-JJ" placeholderTextColor={colors.muted} style={{ flex: 1, color: colors.text, backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }} />
                <Pressable disabled={!/^\d{4}-\d{2}-\d{2}$/.test(bulkAnchor)} onPress={() => mutate((next) => { next.sections.forEach((section) => section.stops.forEach((stop) => stop.services.forEach((service) => service.schedules.forEach((rule) => { if (rule.kind !== "on_demand") rule.anchor_date = bulkAnchor; })))); })} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, borderRadius: 12, backgroundColor: "#16A34A", opacity: /^\d{4}-\d{2}-\d{2}$/.test(bulkAnchor) ? 1 : 0.4, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Check size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Appliquer à la tournée</Text>
                </Pressable>
              </View>
            </View>
          </CardContent>
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>Sections et commerces</Text>
          <Pressable onPress={addSection} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 }}><Plus size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Section</Text></Pressable>
        </View>

        {draft.sections.map((section, sectionIndex) => {
          const sectionOpen = openSections.has(sectionIndex);
          return (
            <Card key={`${section.id ?? "section"}-${sectionIndex}`} style={{ marginBottom: 11 }}>
              <Pressable onPress={() => setOpenSections((old) => { const next = new Set(old); next.has(sectionIndex) ? next.delete(sectionIndex) : next.add(sectionIndex); return next; })} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: isDark ? "#111C30" : "#EFF6FF", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                {sectionOpen ? <ChevronDown size={18} color={colors.text} /> : <ChevronRight size={18} color={colors.text} />}
                <TextInput value={section.label} onChangeText={(value) => mutate((next) => { next.sections[sectionIndex].label = value; })} onPressIn={(event) => event.stopPropagation()} style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 4 }} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{section.stops.length} commerces</Text>
                <Pressable disabled={sectionIndex === 0} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections, sectionIndex, -1)); }}><ArrowUp size={17} color={sectionIndex === 0 ? colors.border : colors.muted} /></Pressable>
                <Pressable disabled={sectionIndex === draft.sections.length - 1} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections, sectionIndex, 1)); }}><ArrowDown size={17} color={sectionIndex === draft.sections.length - 1 ? colors.border : colors.muted} /></Pressable>
                <Pressable onPress={(event) => { event.stopPropagation(); mutate((next) => { next.sections.splice(sectionIndex, 1); }); }}><Trash2 size={17} color="#EF4444" /></Pressable>
              </Pressable>
              {sectionOpen && (
                <CardContent style={{ padding: 12, gap: 10 }}>
                  {section.stops.map((stop, stopIndex) => {
                    const stopKey = `${sectionIndex}-${stopIndex}`;
                    const stopOpen = openStops.has(stopKey);
                    return (
                      <View key={`${stop.id ?? "stop"}-${stopIndex}`} style={{ borderWidth: 1, borderColor: stop.needs_review ? "#F59E0B" : colors.border, borderRadius: 13, overflow: "hidden" }}>
                        <Pressable onPress={() => setOpenStops((old) => { const next = new Set(old); next.has(stopKey) ? next.delete(stopKey) : next.add(stopKey); return next; })} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.input }}>
                          {stopOpen ? <ChevronDown size={17} color={colors.text} /> : <ChevronRight size={17} color={colors.text} />}
                          <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{stop.name}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{stop.services.length} prestations</Text>
                          {stop.needs_review && <AlertTriangle size={17} color="#F59E0B" />}
                          <Pressable disabled={stopIndex === 0} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections[sectionIndex].stops, stopIndex, -1)); }}><ArrowUp size={16} color={stopIndex === 0 ? colors.border : colors.muted} /></Pressable>
                          <Pressable disabled={stopIndex === section.stops.length - 1} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections[sectionIndex].stops, stopIndex, 1)); }}><ArrowDown size={16} color={stopIndex === section.stops.length - 1 ? colors.border : colors.muted} /></Pressable>
                          <Pressable onPress={(event) => { event.stopPropagation(); mutate((next) => { next.sections[sectionIndex].stops.splice(stopIndex, 1); }); }}><Trash2 size={16} color="#EF4444" /></Pressable>
                        </Pressable>
                        {stopOpen && <StopEditor stop={stop} sectionIndex={sectionIndex} stopIndex={stopIndex} mutate={mutate} addService={addService} addSchedule={addSchedule} colors={colors} wide={wide} />}
                      </View>
                    );
                  })}
                  <Pressable onPress={() => addStop(sectionIndex)} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, padding: 9 }}><Plus size={17} color="#3B82F6" /><Text style={{ color: "#3B82F6", fontWeight: "700" }}>Ajouter un commerce</Text></Pressable>
                </CardContent>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StopEditor({ stop, sectionIndex, stopIndex, mutate, addService, addSchedule, colors, wide }: { stop: TourStop; sectionIndex: number; stopIndex: number; mutate: (fn: (next: TourTemplate) => void) => void; addService: (s: number, st: number) => void; addSchedule: (s: number, st: number, sv: number) => void; colors: Colors; wide: boolean }) {
  const setStop = (fn: (value: TourStop) => void) => mutate((next: TourTemplate) => fn(next.sections[sectionIndex].stops[stopIndex]));
  return (
    <View style={{ padding: 13, gap: 12 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 9 }}>
        <TextField label="Nom" value={stop.name} onChangeText={(value) => setStop((next) => { next.name = value; if (!next.export_label) next.export_label = value; })} colors={colors} />
        <TextField label="Libellé d'export" value={stop.export_label} onChangeText={(value) => setStop((next) => { next.export_label = value; })} colors={colors} />
        <TextField label="Créneau" value={stop.time_window} onChangeText={(value) => setStop((next) => { next.time_window = value; })} colors={colors} />
        <TextField label="Durée (min)" value={stop.estimated_minutes == null ? "" : String(stop.estimated_minutes)} keyboardType="number-pad" onChangeText={(value) => setStop((next) => { next.estimated_minutes = value ? Number(value) : null; })} colors={colors} />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 9 }}>
        <TextField label="Adresse" value={stop.address} onChangeText={(value) => setStop((next) => { next.address = value; })} colors={colors} />
        <TextField label="Téléphone" value={stop.phone} onChangeText={(value) => setStop((next) => { next.phone = value; })} colors={colors} />
        <TextField label="E-mail" value={stop.email} onChangeText={(value) => setStop((next) => { next.email = value; })} colors={colors} />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 9 }}>
        <TextField label="Latitude (optionnelle)" value={stop.latitude == null ? "" : String(stop.latitude)} keyboardType="decimal-pad" onChangeText={(value) => setStop((next) => { next.latitude = value ? Number(value.replace(",", ".")) : null; })} colors={colors} />
        <TextField label="Longitude (optionnelle)" value={stop.longitude == null ? "" : String(stop.longitude)} keyboardType="decimal-pad" onChangeText={(value) => setStop((next) => { next.longitude = value ? Number(value.replace(",", ".")) : null; })} colors={colors} />
      </View>
      <TextField label="Consignes" value={stop.instructions} multiline onChangeText={(value) => setStop((next) => { next.instructions = value; })} colors={colors} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        <Choice selected={stop.active} label={stop.active ? "Commerce actif" : "Commerce inactif"} onPress={() => setStop((next) => { next.active = !next.active; })} colors={colors} />
        <Choice selected={stop.needs_review} warning label={stop.needs_review ? "Ambiguïté à valider" : "Données validées"} onPress={() => setStop((next) => { next.needs_review = !next.needs_review; })} colors={colors} />
      </View>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Prestations</Text>
      {stop.services.map((service: TourService, serviceIndex: number) => <ServiceEditor key={`${service.id ?? "service"}-${serviceIndex}`} service={service} serviceIndex={serviceIndex} serviceCount={stop.services.length} sectionIndex={sectionIndex} stopIndex={stopIndex} mutate={mutate} addSchedule={addSchedule} colors={colors} wide={wide} />)}
      <Pressable onPress={() => addService(sectionIndex, stopIndex)} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, padding: 8 }}><Plus size={17} color="#16A34A" /><Text style={{ color: "#16A34A", fontWeight: "700" }}>Ajouter une prestation</Text></Pressable>
    </View>
  );
}

function ServiceEditor({ service, serviceIndex, serviceCount, sectionIndex, stopIndex, mutate, addSchedule, colors, wide }: { service: TourService; serviceIndex: number; serviceCount: number; sectionIndex: number; stopIndex: number; mutate: (fn: (next: TourTemplate) => void) => void; addSchedule: (s: number, st: number, sv: number) => void; colors: Colors; wide: boolean }) {
  const setService = (fn: (value: TourService) => void) => mutate((next: TourTemplate) => fn(next.sections[sectionIndex].stops[stopIndex].services[serviceIndex]));
  const remove = () => mutate((next: TourTemplate) => { next.sections[sectionIndex].stops[stopIndex].services.splice(serviceIndex, 1); });
  return (
    <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: service.needs_review ? "#F59E0B" : colors.border, backgroundColor: colors.input, gap: 10 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 8, alignItems: wide ? "flex-end" : "stretch" }}>
        <TextField label="Libellé" value={service.label} onChangeText={(value) => setService((next) => { next.label = value; })} colors={colors} />
        <TextField label="Prix HT (€)" value={String(service.price_ht)} keyboardType="decimal-pad" onChangeText={(value) => setService((next) => { next.price_ht = Number(value.replace(",", ".")) || 0; })} colors={colors} />
        <Pressable disabled={serviceIndex === 0} onPress={() => mutate((next: TourTemplate) => moveItems(next.sections[sectionIndex].stops[stopIndex].services, serviceIndex, -1))} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><ArrowUp size={18} color={serviceIndex === 0 ? colors.border : colors.muted} /></Pressable>
        <Pressable disabled={serviceIndex === serviceCount - 1} onPress={() => mutate((next: TourTemplate) => moveItems(next.sections[sectionIndex].stops[stopIndex].services, serviceIndex, 1))} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><ArrowDown size={18} color={serviceIndex === serviceCount - 1 ? colors.border : colors.muted} /></Pressable>
        <Pressable onPress={remove} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><Trash2 size={18} color="#EF4444" /></Pressable>
      </View>
      {service.needs_review && service.source_data && (
        <View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.soft, borderWidth: 1, borderColor: "#F59E0B" }}>
          <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "700" }}>Source Word · ligne {String(service.source_data.row ?? "?")}</Text>
          <Text style={{ color: colors.text, fontSize: 12, marginTop: 3 }}>Prestation : {String(service.source_data.face_text ?? "—")} · Prix : {String(service.source_data.price_text ?? "—")} · Fréquence : {String(service.source_data.frequency_text ?? "—")} · Paiement : {String(service.source_data.payment_text ?? "—")}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {(Object.entries(BILLING_LABELS) as Array<[TourBillingMode, string]>).map(([mode, label]) => <Choice key={mode} selected={service.billing_mode === mode} label={label} onPress={() => setService((next) => { next.billing_mode = mode; })} colors={colors} />)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Choice selected={service.active} label={service.active ? "Active" : "Inactive"} onPress={() => setService((next) => { next.active = !next.active; })} colors={colors} />
        <Choice selected={service.needs_review} warning label={service.needs_review ? "Association ambiguë" : "Association validée"} onPress={() => setService((next) => { next.needs_review = !next.needs_review; })} colors={colors} />
      </View>
      <Text style={{ color: colors.text, fontWeight: "700" }}>Règles de fréquence</Text>
      {service.schedules.map((schedule: TourSchedule, scheduleIndex: number) => (
        <View key={`${schedule.id ?? "schedule"}-${scheduleIndex}`} style={{ padding: 10, borderRadius: 10, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <Choice selected={schedule.kind === "interval"} label="Intervalle" onPress={() => setService((next) => { next.schedules[scheduleIndex].kind = "interval"; })} colors={colors} />
            <Choice selected={schedule.kind === "annual"} label="Annuelle" onPress={() => setService((next) => { next.schedules[scheduleIndex].kind = "annual"; next.schedules[scheduleIndex].interval_weeks = null; })} colors={colors} />
            <Choice selected={schedule.kind === "on_demand"} label="À la demande" onPress={() => setService((next) => { next.schedules[scheduleIndex].kind = "on_demand"; next.schedules[scheduleIndex].anchor_date = null; next.schedules[scheduleIndex].interval_weeks = null; })} colors={colors} />
            <Pressable onPress={() => setService((next) => { next.schedules.splice(scheduleIndex, 1); })} style={{ marginLeft: "auto", padding: 7 }}><Trash2 size={16} color="#EF4444" /></Pressable>
          </View>
          {schedule.kind !== "on_demand" && (
            <View style={{ flexDirection: wide ? "row" : "column", gap: 8 }}>
              <TextField label="Date d'ancrage (AAAA-MM-JJ)" value={schedule.anchor_date} onChangeText={(value) => setService((next) => { next.schedules[scheduleIndex].anchor_date = value || null; })} colors={colors} />
              {schedule.kind === "interval" && <TextField label="Intervalle en semaines" value={schedule.interval_weeks == null ? "" : String(schedule.interval_weeks)} keyboardType="number-pad" onChangeText={(value) => setService((next) => { next.schedules[scheduleIndex].interval_weeks = value ? Number(value) : null; })} colors={colors} />}
              <TextField label="Plafond mensuel (optionnel)" value={schedule.monthly_cap == null ? "" : String(schedule.monthly_cap)} keyboardType="number-pad" onChangeText={(value) => setService((next) => { next.schedules[scheduleIndex].monthly_cap = value ? Number(value) : null; })} colors={colors} />
            </View>
          )}
          {schedule.kind !== "on_demand" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {MONTHS.map((month, monthIndex) => {
                const selected = schedule.active_months.includes(monthIndex + 1);
                return <Choice key={month} selected={selected} label={month} onPress={() => setService((next) => { const months = next.schedules[scheduleIndex].active_months; next.schedules[scheduleIndex].active_months = selected ? months.filter((value) => value !== monthIndex + 1) : [...months, monthIndex + 1].sort((a, b) => a - b); })} colors={colors} />;
              })}
            </View>
          )}
        </View>
      ))}
      <Pressable onPress={() => addSchedule(sectionIndex, stopIndex, serviceIndex)} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, padding: 7 }}><Plus size={16} color="#3B82F6" /><Text style={{ color: "#3B82F6", fontWeight: "700" }}>Ajouter une règle saisonnière</Text></Pressable>
    </View>
  );
}

function moveItems(items: Array<{ position: number }>, index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  items.forEach((item, position) => { item.position = position; });
}
