import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { TourService, TourStop, TourTemplate, WEEKDAY_LABELS, emptyTourTemplate } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { toast } from "../../../../../src/ui/toast";

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

function Choice({ selected, label, onPress, colors }: { selected: boolean; label: string; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: selected ? "#3B82F6" : colors.border, backgroundColor: selected ? "rgba(59,130,246,0.15)" : "transparent" }}>
      <Text style={{ color: selected ? "#3B82F6" : colors.text, fontWeight: selected ? "700" : "500", fontSize: 12 }}>{label}</Text>
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
    next.sections[sectionIndex].stops.push({ name: "Nouveau commerce", position: next.sections[sectionIndex].stops.length, active: true, services: [] });
  });
  const addService = (sectionIndex: number, stopIndex: number) => mutate((next) => {
    next.sections[sectionIndex].stops[stopIndex].services.push({ label: "Nouvelle prestation", price_ht: 0, position: next.sections[sectionIndex].stops[stopIndex].services.length, active: true });
  });

  const totalStops = useMemo(() => draft.sections.reduce((sum, section) => sum + section.stops.length, 0), [draft]);

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
          <Text style={{ color: colors.muted, flex: 1 }}>{totalStops} commerce(s) · chaque sauvegarde s'applique aux futurs brouillons.</Text>
          <Pressable disabled={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#3B82F6", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, opacity: saveMutation.isPending ? 0.6 : 1 }}>
            <Save size={18} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}</Text>
          </Pressable>
        </View>

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
              <Choice selected={draft.active} label={draft.active ? "Modèle actif" : "Modèle inactif"} onPress={() => mutate((next) => { next.active = !next.active; })} colors={colors} />
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
                      <View key={`${stop.id ?? "stop"}-${stopIndex}`} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 13, overflow: "hidden" }}>
                        <Pressable onPress={() => setOpenStops((old) => { const next = new Set(old); next.has(stopKey) ? next.delete(stopKey) : next.add(stopKey); return next; })} style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.input }}>
                          {stopOpen ? <ChevronDown size={17} color={colors.text} /> : <ChevronRight size={17} color={colors.text} />}
                          <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{stop.name}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{stop.services.length} prestations</Text>
                          <Pressable disabled={stopIndex === 0} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections[sectionIndex].stops, stopIndex, -1)); }}><ArrowUp size={16} color={stopIndex === 0 ? colors.border : colors.muted} /></Pressable>
                          <Pressable disabled={stopIndex === section.stops.length - 1} onPress={(event) => { event.stopPropagation(); mutate((next) => move(next.sections[sectionIndex].stops, stopIndex, 1)); }}><ArrowDown size={16} color={stopIndex === section.stops.length - 1 ? colors.border : colors.muted} /></Pressable>
                          <Pressable onPress={(event) => { event.stopPropagation(); mutate((next) => { next.sections[sectionIndex].stops.splice(stopIndex, 1); }); }}><Trash2 size={16} color="#EF4444" /></Pressable>
                        </Pressable>
                        {stopOpen && <StopEditor stop={stop} sectionIndex={sectionIndex} stopIndex={stopIndex} mutate={mutate} addService={addService} colors={colors} wide={wide} />}
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

function StopEditor({ stop, sectionIndex, stopIndex, mutate, addService, colors, wide }: { stop: TourStop; sectionIndex: number; stopIndex: number; mutate: (fn: (next: TourTemplate) => void) => void; addService: (s: number, st: number) => void; colors: Colors; wide: boolean }) {
  const setStop = (fn: (value: TourStop) => void) => mutate((next: TourTemplate) => fn(next.sections[sectionIndex].stops[stopIndex]));
  return (
    <View style={{ padding: 13, gap: 12 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 9 }}>
        <TextField label="Nom du commerce" value={stop.name} onChangeText={(value) => setStop((next) => { next.name = value; })} colors={colors} />
        <TextField label="Durée (min)" value={stop.estimated_minutes == null ? "" : String(stop.estimated_minutes)} keyboardType="number-pad" onChangeText={(value) => setStop((next) => { next.estimated_minutes = value ? Number(value) : null; })} colors={colors} />
      </View>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 9 }}>
        <TextField label="Paiement (ex: F -> mens., N, NF)" value={stop.payment_text} onChangeText={(value) => setStop((next) => { next.payment_text = value || null; })} colors={colors} />
        <TextField label="Fréquence (informatif)" value={stop.frequency_text} onChangeText={(value) => setStop((next) => { next.frequency_text = value || null; })} colors={colors} />
      </View>
      <TextField label="Note / créneau" value={stop.note} multiline onChangeText={(value) => setStop((next) => { next.note = value || null; })} colors={colors} />
      <Choice selected={stop.active} label={stop.active ? "Commerce actif" : "Commerce inactif"} onPress={() => setStop((next) => { next.active = !next.active; })} colors={colors} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Prestations</Text>
      {stop.services.map((service: TourService, serviceIndex: number) => <ServiceEditor key={`${service.id ?? "service"}-${serviceIndex}`} service={service} serviceIndex={serviceIndex} serviceCount={stop.services.length} sectionIndex={sectionIndex} stopIndex={stopIndex} mutate={mutate} colors={colors} wide={wide} />)}
      <Pressable onPress={() => addService(sectionIndex, stopIndex)} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, padding: 8 }}><Plus size={17} color="#16A34A" /><Text style={{ color: "#16A34A", fontWeight: "700" }}>Ajouter une prestation</Text></Pressable>
    </View>
  );
}

function ServiceEditor({ service, serviceIndex, serviceCount, sectionIndex, stopIndex, mutate, colors, wide }: { service: TourService; serviceIndex: number; serviceCount: number; sectionIndex: number; stopIndex: number; mutate: (fn: (next: TourTemplate) => void) => void; colors: Colors; wide: boolean }) {
  const setService = (fn: (value: TourService) => void) => mutate((next: TourTemplate) => fn(next.sections[sectionIndex].stops[stopIndex].services[serviceIndex]));
  const remove = () => mutate((next: TourTemplate) => { next.sections[sectionIndex].stops[stopIndex].services.splice(serviceIndex, 1); });
  return (
    <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, gap: 10 }}>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 8 }}>
        <TextField label="Libellé (ex: 2 F, 1 F)" value={service.label} onChangeText={(value) => setService((next) => { next.label = value; })} colors={colors} />
        <TextField label="Prix HT (€)" value={String(service.price_ht)} keyboardType="decimal-pad" onChangeText={(value) => setService((next) => { next.price_ht = Number(value.replace(",", ".")) || 0; })} colors={colors} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
        <Pressable disabled={serviceIndex === 0} onPress={() => mutate((next: TourTemplate) => moveItems(next.sections[sectionIndex].stops[stopIndex].services, serviceIndex, -1))} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><ArrowUp size={18} color={serviceIndex === 0 ? colors.border : colors.muted} /></Pressable>
        <Pressable disabled={serviceIndex === serviceCount - 1} onPress={() => mutate((next: TourTemplate) => moveItems(next.sections[sectionIndex].stops[stopIndex].services, serviceIndex, 1))} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><ArrowDown size={18} color={serviceIndex === serviceCount - 1 ? colors.border : colors.muted} /></Pressable>
        <Pressable onPress={remove} style={{ padding: 11, borderRadius: 10, backgroundColor: colors.soft }}><Trash2 size={18} color="#EF4444" /></Pressable>
      </View>
    </View>
  );
}

function moveItems(items: Array<{ position: number }>, index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  items.forEach((item, position) => { item.position = position; });
}
