import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Save, Trash2 } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { TourSection, TourStop, TourTemplate, emptyTourTemplate } from "../../../../../src/lib/tours";
import { useTheme } from "../../../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../../../src/ui/components/Card";
import { Button } from "../../../../../src/ui/components/Button";
import { Input } from "../../../../../src/ui/components/Input";
import { DateTimePicker } from "../../../../../src/ui/components/DateTimePicker";
import { SlidingPillSelector } from "../../../../../src/ui/components/SlidingPillSelector";
import { toast } from "../../../../../src/ui/toast";

const DAY_LETTERS = ["L", "M", "M", "J", "V"];
// L'heure seule n'a pas de date propre : on l'accroche a une date bidon pour
// reutiliser DateTimePicker tel quel (seule la partie heure est lue/ecrite).
const toTimeValue = (time: string) => `2000-01-01T${time.slice(0, 5)}`;
const fromTimeValue = (value: string) => `${value.split("T")[1] ?? "08:00"}:00`;

type Colors = { text: string; muted: string; border: string; soft: string; input: string; header: string };
type Cols = { name: number; face: number; price: number; minutes: number; payment: number; frequency: number; note: number; actions: number };

const CHAR_WIDTH = 7.3;
const CELL_PADDING = 28;
const measure = (text: string) => Math.round(text.length * CHAR_WIDTH) + CELL_PADDING;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Auto-fit façon Excel : chaque colonne prend la largeur du texte le plus
// long qu'elle contient (en-tête compris), bornée pour rester utilisable.
function computeColumnWidths(sections: TourSection[]): Cols {
  const widths = {
    name: measure("Commerce"),
    face: measure("Face 1"),
    price: measure("Prix 1"),
    minutes: measure("Temps"),
    payment: measure("Paiement"),
    frequency: measure("Fréquence"),
    note: measure("Note"),
  };
  for (const section of sections) {
    for (const stop of section.stops) {
      widths.name = Math.max(widths.name, measure(stop.name || ""));
      widths.minutes = Math.max(widths.minutes, measure(stop.estimated_minutes != null ? String(stop.estimated_minutes) : ""));
      widths.payment = Math.max(widths.payment, measure(stop.payment_text ?? ""));
      widths.frequency = Math.max(widths.frequency, measure(stop.frequency_text ?? ""));
      widths.note = Math.max(widths.note, measure(stop.note ?? ""));
      for (const service of stop.services.slice(0, 2)) {
        widths.face = Math.max(widths.face, measure(service.label || ""));
        widths.price = Math.max(widths.price, measure(String(service.price_ht ?? "")));
      }
    }
  }
  return {
    name: clamp(widths.name, 120, 280),
    face: clamp(widths.face, 70, 180),
    price: clamp(widths.price, 60, 110),
    minutes: clamp(widths.minutes, 55, 90),
    payment: clamp(widths.payment, 90, 240),
    frequency: clamp(widths.frequency, 90, 240),
    note: clamp(widths.note, 90, 240),
    actions: 76,
  };
}

function cloneTemplate(value: TourTemplate): TourTemplate {
  return JSON.parse(JSON.stringify(value));
}

function Cell({ width, children }: { width: number; children: React.ReactNode }) {
  return <View style={{ width, paddingHorizontal: 4, justifyContent: "center" }}>{children}</View>;
}

function CellInput({ width, value, onChangeText, colors, keyboardType, bold }: { width: number; value: string; onChangeText: (v: string) => void; colors: Colors; keyboardType?: any; bold?: boolean }) {
  return (
    <Cell width={width}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={{ color: colors.text, fontWeight: bold ? "700" : "400", fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.input }}
      />
    </Cell>
  );
}

// Champ numérique : garde le texte brut tant que l'utilisateur tape (une
// chaîne vide reste vide) pour ne pas retomber sur "0" à chaque frappe —
// la valeur n'est reconvertie en nombre qu'à la perte du focus.
function NumberCellInput({ width, value, onCommit, colors, keyboardType }: { width: number; value: number | null; onCommit: (v: number | null) => void; colors: Colors; keyboardType?: any }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => { setText(value == null ? "" : String(value)); }, [value]);
  return (
    <Cell width={width}>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const trimmed = text.trim();
          if (!trimmed) { onCommit(null); return; }
          const parsed = Number(trimmed.replace(",", "."));
          onCommit(Number.isFinite(parsed) ? parsed : null);
        }}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={{ color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.input }}
      />
    </Cell>
  );
}

function HeaderCell({ width, label, colors }: { width: number; label: string; colors: Colors }) {
  return <Cell width={width}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>{label}</Text></Cell>;
}


export default function TourTemplateEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isAdmin, loading } = useAuth();
  const { isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isNew = id === "new";
  const wide = screenWidth >= 900;
  const [draft, setDraft] = useState<TourTemplate>(() => emptyTourTemplate());
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const colors: Colors = {
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#1E293B" : "#E4E4E7",
    soft: isDark ? "#1E293B" : "#F1F5F9",
    input: isDark ? "#0B1220" : "#F8FAFC",
    header: isDark ? "#111C30" : "#EFF6FF",
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
  });
  const addStop = (sectionIndex: number) => mutate((next) => {
    next.sections[sectionIndex].stops.push({ name: "Nouveau commerce", position: next.sections[sectionIndex].stops.length, active: true, services: [{ label: "", price_ht: 0, position: 0, active: true }] });
  });

  const totalStops = useMemo(() => draft.sections.reduce((sum, section) => sum + section.stops.length, 0), [draft]);
  const cols = useMemo(() => computeColumnWidths(draft.sections), [draft.sections]);
  const tableWidth = cols.name + cols.face * 2 + cols.price * 2 + cols.minutes + cols.payment + cols.frequency + cols.note + cols.actions;

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

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 80 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
          <Text style={{ color: colors.muted, flex: 1 }}>{totalStops} commerce(s) · chaque sauvegarde s'applique aux futurs brouillons.</Text>
          <Pressable disabled={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#3B82F6", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, opacity: saveMutation.isPending ? 0.6 : 1 }}>
            <Save size={18} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}</Text>
          </Pressable>
        </View>

        <Card style={{ marginBottom: 18, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
          <CardContent style={{ padding: 18, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Paramètres généraux</Text>
            <Input label="Nom de la tournée" value={draft.name} onChangeText={(value) => mutate((next) => { next.name = value; })} />
            <View style={{ flexDirection: wide ? "row" : "column", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <DateTimePicker
                  label="Début"
                  timeOnly
                  value={toTimeValue(draft.default_start_time)}
                  onChange={(value) => mutate((next) => { next.default_start_time = fromTimeValue(value); })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DateTimePicker
                  label="Fin"
                  timeOnly
                  value={toTimeValue(draft.default_end_time)}
                  onChange={(value) => mutate((next) => { next.default_end_time = fromTimeValue(value); })}
                />
              </View>
            </View>
            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Zone</Text>
              <SlidingPillSelector
                options={[{ id: "hainaut", label: "Hainaut" }, { id: "ardennes", label: "Ardennes" }]}
                selected={draft.zone}
                onSelect={(id) => mutate((next) => { next.zone = id as "hainaut" | "ardennes"; })}
                pillColor="#3B82F6"
                bgColor={colors.soft}
                activeTextColor="#FFFFFF"
                inactiveTextColor={colors.muted}
                itemPy={11}
                fontSize={14}
              />
            </View>
            <View style={{ gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Jour fixe</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {DAY_LETTERS.map((letter, index) => {
                  const day = index + 1;
                  const active = draft.weekday === day;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => mutate((next) => { next.weekday = day; })}
                      style={{ width: 44, height: 44, borderRadius: 999, borderWidth: 1.5, borderColor: active ? "#3B82F6" : colors.border, backgroundColor: active ? "#3B82F6" : "transparent", alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 13, color: active ? "#FFFFFF" : colors.muted }}>{letter}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{draft.active ? "Modèle actif" : "Modèle inactif"}</Text>
              <Switch
                value={draft.active}
                onValueChange={(value) => mutate((next) => { next.active = value; })}
                trackColor={{ false: isDark ? "#475569" : "#94A3B8", true: "#22C55E" }}
                ios_backgroundColor={isDark ? "#475569" : "#94A3B8"}
                thumbColor="#FFFFFF"
              />
            </View>
          </CardContent>
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>Sections et commerces</Text>
          <Pressable onPress={addSection} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 }}><Plus size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Section</Text></Pressable>
        </View>

        {draft.sections.map((section, sectionIndex) => (
          <View key={`${section.id ?? "section"}-${sectionIndex}`} style={{ marginBottom: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
              <TextInput value={section.label} onChangeText={(value) => mutate((next) => { next.sections[sectionIndex].label = value; })} style={{ flex: 1, fontSize: 16, fontWeight: "700", color: colors.text, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 4 }} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>{section.stops.length} commerces</Text>
              <Pressable disabled={sectionIndex === 0} onPress={() => mutate((next) => move(next.sections, sectionIndex, -1))}><ArrowUp size={17} color={sectionIndex === 0 ? colors.border : colors.muted} /></Pressable>
              <Pressable disabled={sectionIndex === draft.sections.length - 1} onPress={() => mutate((next) => move(next.sections, sectionIndex, 1))}><ArrowDown size={17} color={sectionIndex === draft.sections.length - 1 ? colors.border : colors.muted} /></Pressable>
              <Pressable onPress={() => mutate((next) => { next.sections.splice(sectionIndex, 1); })}><Trash2 size={17} color="#EF4444" /></Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxWidth: "100%" }}>
              <View style={{ width: tableWidth }}>
                <View style={{ flexDirection: "row", backgroundColor: colors.header, paddingTop: 6 }}>
                  <View style={{ width: cols.name }} />
                  <View style={{ width: cols.face * 2, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 3 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>NOMBRE DE FACE</Text></View>
                  <View style={{ width: cols.price * 2, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 3 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>PRIX PRESTATION</Text></View>
                  <View style={{ width: cols.minutes }} />
                  <View style={{ width: cols.payment }} />
                  <View style={{ width: cols.frequency }} />
                  <View style={{ width: cols.note }} />
                  <View style={{ width: cols.actions }} />
                </View>
                <View style={{ flexDirection: "row", backgroundColor: colors.header, paddingVertical: 8, borderRadius: 10, marginBottom: 4 }}>
                  <HeaderCell width={cols.name} label="Commerce" colors={colors} />
                  <HeaderCell width={cols.face} label="Face 1" colors={colors} />
                  <HeaderCell width={cols.face} label="Face 2" colors={colors} />
                  <HeaderCell width={cols.price} label="Prix 1" colors={colors} />
                  <HeaderCell width={cols.price} label="Prix 2" colors={colors} />
                  <HeaderCell width={cols.minutes} label="Temps" colors={colors} />
                  <HeaderCell width={cols.payment} label="Paiement" colors={colors} />
                  <HeaderCell width={cols.frequency} label="Fréquence" colors={colors} />
                  <HeaderCell width={cols.note} label="Note" colors={colors} />
                  <HeaderCell width={cols.actions} label="" colors={colors} />
                </View>
                {section.stops.map((stop, stopIndex) => (
                  <StopRow key={`${stop.id ?? "stop"}-${stopIndex}`} stop={stop} sectionIndex={sectionIndex} stopIndex={stopIndex} stopCount={section.stops.length} mutate={mutate} colors={colors} cols={cols} />
                ))}
              </View>
            </ScrollView>
            <Pressable onPress={() => addStop(sectionIndex)} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, padding: 9, marginTop: 4 }}><Plus size={17} color="#3B82F6" /><Text style={{ color: "#3B82F6", fontWeight: "700" }}>Ajouter un commerce</Text></Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function StopRow({ stop, sectionIndex, stopIndex, stopCount, mutate, colors, cols }: { stop: TourStop; sectionIndex: number; stopIndex: number; stopCount: number; mutate: (fn: (next: TourTemplate) => void) => void; colors: Colors; cols: Cols }) {
  const setStop = (fn: (value: TourStop) => void) => mutate((next: TourTemplate) => fn(next.sections[sectionIndex].stops[stopIndex]));
  const face1 = stop.services[0];
  const face2 = stop.services[1];

  const setFace1Label = (value: string) => setStop((next) => {
    if (!next.services[0]) next.services[0] = { label: "", price_ht: 0, position: 0, active: true };
    next.services[0].label = value;
  });
  const setFace1Price = (value: number | null) => setStop((next) => {
    if (!next.services[0]) next.services[0] = { label: "", price_ht: 0, position: 0, active: true };
    next.services[0].price_ht = value ?? 0;
  });
  const setFace2Label = (value: string) => setStop((next) => {
    if (value.trim() === "" && next.services[1] && !next.services[1].price_ht) {
      next.services.splice(1, 1);
      return;
    }
    if (!next.services[1]) next.services[1] = { label: "", price_ht: 0, position: 1, active: true };
    next.services[1].label = value;
  });
  const setFace2Price = (value: number | null) => setStop((next) => {
    if (!next.services[1]) next.services[1] = { label: "", price_ht: 0, position: 1, active: true };
    next.services[1].price_ht = value ?? 0;
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 3, borderBottomWidth: 1, borderColor: colors.border }}>
      <CellInput width={cols.name} value={stop.name} onChangeText={(value) => setStop((next) => { next.name = value; })} colors={colors} bold />
      <CellInput width={cols.face} value={face1?.label ?? ""} onChangeText={setFace1Label} colors={colors} />
      <CellInput width={cols.face} value={face2?.label ?? ""} onChangeText={setFace2Label} colors={colors} />
      <NumberCellInput width={cols.price} value={face1 ? face1.price_ht : null} onCommit={setFace1Price} colors={colors} keyboardType="decimal-pad" />
      <NumberCellInput width={cols.price} value={face2 ? face2.price_ht : null} onCommit={setFace2Price} colors={colors} keyboardType="decimal-pad" />
      <NumberCellInput width={cols.minutes} value={stop.estimated_minutes ?? null} onCommit={(value) => setStop((next) => { next.estimated_minutes = value; })} colors={colors} keyboardType="number-pad" />
      <CellInput width={cols.payment} value={stop.payment_text ?? ""} onChangeText={(value) => setStop((next) => { next.payment_text = value || null; })} colors={colors} />
      <CellInput width={cols.frequency} value={stop.frequency_text ?? ""} onChangeText={(value) => setStop((next) => { next.frequency_text = value || null; })} colors={colors} />
      <CellInput width={cols.note} value={stop.note ?? ""} onChangeText={(value) => setStop((next) => { next.note = value || null; })} colors={colors} />
      <Cell width={cols.actions}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable disabled={stopIndex === 0} onPress={() => mutate((next) => { const items = next.sections[sectionIndex].stops; const target = stopIndex - 1; if (target < 0) return; [items[stopIndex], items[target]] = [items[target], items[stopIndex]]; items.forEach((item, position) => { item.position = position; }); })}><ArrowUp size={16} color={stopIndex === 0 ? colors.border : colors.muted} /></Pressable>
          <Pressable disabled={stopIndex === stopCount - 1} onPress={() => mutate((next) => { const items = next.sections[sectionIndex].stops; const target = stopIndex + 1; if (target >= items.length) return; [items[stopIndex], items[target]] = [items[target], items[stopIndex]]; items.forEach((item, position) => { item.position = position; }); })}><ArrowDown size={16} color={stopIndex === stopCount - 1 ? colors.border : colors.muted} /></Pressable>
          <Pressable onPress={() => mutate((next) => { next.sections[sectionIndex].stops.splice(stopIndex, 1); })}><Trash2 size={16} color="#EF4444" /></Pressable>
        </View>
      </Cell>
    </View>
  );
}
