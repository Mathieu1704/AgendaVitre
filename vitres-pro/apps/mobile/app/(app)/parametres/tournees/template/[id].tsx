import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Plus, PlusCircle, Save, Trash2, X } from "lucide-react-native";

import { useAuth } from "../../../../../src/hooks/useAuth";
import { api } from "../../../../../src/lib/api";
import { TourStop, TourTemplate, emptyTourTemplate } from "../../../../../src/lib/tours";
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

function cloneTemplate(value: TourTemplate): TourTemplate {
  return JSON.parse(JSON.stringify(value));
}

// Ligne compacte unique (Temps/Paiement/Fréquence/Note) : le libellé devient
// le placeholder plutôt qu'un texte au-dessus, pour tenir sur une seule
// ligne même avec beaucoup de commerces listés.
function CompactMetaRow({ stop, setStop, colors }: { stop: TourStop; setStop: (fn: (value: TourStop) => void) => void; colors: Colors }) {
  const [minutesText, setMinutesText] = useState(stop.estimated_minutes == null ? "" : String(stop.estimated_minutes));
  useEffect(() => { setMinutesText(stop.estimated_minutes == null ? "" : String(stop.estimated_minutes)); }, [stop.estimated_minutes]);
  const fieldStyle = { minWidth: 0, color: colors.text, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.input };
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
      <TextInput
        value={minutesText}
        onChangeText={setMinutesText}
        onBlur={() => {
          const trimmed = minutesText.trim();
          const parsed = Number(trimmed.replace(",", "."));
          setStop((next) => { next.estimated_minutes = trimmed && Number.isFinite(parsed) ? parsed : null; });
        }}
        keyboardType="number-pad"
        placeholder="Min"
        placeholderTextColor={colors.muted}
        style={[fieldStyle, { flex: 0.6 }]}
      />
      <TextInput
        value={stop.payment_text ?? ""}
        onChangeText={(value) => setStop((next) => { next.payment_text = value || null; })}
        placeholder="Paiement"
        placeholderTextColor={colors.muted}
        style={[fieldStyle, { flex: 1 }]}
      />
      <TextInput
        value={stop.frequency_text ?? ""}
        onChangeText={(value) => setStop((next) => { next.frequency_text = value || null; })}
        placeholder="Fréquence"
        placeholderTextColor={colors.muted}
        style={[fieldStyle, { flex: 1 }]}
      />
      <TextInput
        value={stop.note ?? ""}
        onChangeText={(value) => setStop((next) => { next.note = value || null; })}
        placeholder="Note"
        placeholderTextColor={colors.muted}
        style={[fieldStyle, { flex: 1.4 }]}
      />
    </View>
  );
}

// Variante numérique : garde le texte brut tant que l'utilisateur tape (une
// chaîne vide reste vide) pour ne pas retomber sur "0" à chaque frappe —
// la valeur n'est reconvertie en nombre qu'à la perte du focus.
function MetaNumberField({ label, value, onCommit, colors, minWidth = 90 }: { label: string; value: number | null; onCommit: (v: number | null) => void; colors: Colors; minWidth?: number }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => { setText(value == null ? "" : String(value)); }, [value]);
  return (
    <View style={{ flexGrow: 1, minWidth }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const trimmed = text.trim();
          if (!trimmed) { onCommit(null); return; }
          const parsed = Number(trimmed.replace(",", "."));
          onCommit(Number.isFinite(parsed) ? parsed : null);
        }}
        keyboardType="number-pad"
        placeholderTextColor={colors.muted}
        style={{ color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: colors.input }}
      />
    </View>
  );
}

// Une ligne de prestation : libellé + prix librement éditables, comme le
// pattern "Prestations" déjà utilisé sur l'écran d'ajout d'intervention.
function ServiceRow({ label, price, onChangeLabel, onCommitPrice, onRemove, colors }: { label: string; price: number; onChangeLabel: (v: string) => void; onCommitPrice: (v: number | null) => void; onRemove: () => void; colors: Colors }) {
  const [priceText, setPriceText] = useState(String(price ?? ""));
  useEffect(() => { setPriceText(String(price ?? "")); }, [price]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <TextInput
        value={label}
        onChangeText={onChangeLabel}
        placeholder="Libellé (ex: 2 F)"
        placeholderTextColor={colors.muted}
        style={{ flex: 2, minWidth: 0, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: colors.input }}
      />
      <TextInput
        value={priceText}
        onChangeText={setPriceText}
        onBlur={() => {
          const trimmed = priceText.trim();
          const parsed = Number(trimmed.replace(",", "."));
          onCommitPrice(trimmed && Number.isFinite(parsed) ? parsed : 0);
        }}
        keyboardType="decimal-pad"
        placeholder="Prix"
        placeholderTextColor={colors.muted}
        style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: colors.input }}
      />
      <Pressable onPress={onRemove} hitSlop={8}><X size={16} color="#EF4444" /></Pressable>
    </View>
  );
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
  const [generalOpen, setGeneralOpen] = useState(isNew);
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

  const addStop = () => mutate((next) => {
    next.stops.push({ name: "Nouveau commerce", position: next.stops.length, active: true, services: [{ label: "", price_ht: 0, position: 0, active: true }] });
  });

  const totalStops = useMemo(() => draft.stops.length, [draft]);

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
          <Pressable onPress={() => setGeneralOpen((value) => !value)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, paddingBottom: generalOpen ? 0 : 18 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Paramètres généraux</Text>
              {!generalOpen && (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
                  {draft.name} · {draft.zone === "hainaut" ? "Hainaut" : "Ardennes"} · {DAY_LETTERS[draft.weekday - 1]} · {draft.active ? "actif" : "inactif"}
                </Text>
              )}
            </View>
            {generalOpen ? <ChevronDown size={20} color={colors.muted} /> : <ChevronRight size={20} color={colors.muted} />}
          </Pressable>
          {generalOpen && (
          <CardContent style={{ padding: 18, paddingTop: 14, gap: 14 }}>
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
                options={[{ id: "hainaut", label: "Hainaut" }]}
                selected="hainaut"
                onSelect={() => mutate((next) => { next.zone = "hainaut"; })}
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
          )}
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, maxWidth: 1300, width: "100%", alignSelf: "center" }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>Commerces</Text>
        </View>

        <View style={{ maxWidth: 1300, width: "100%", alignSelf: "center", gap: 10, marginBottom: 22 }}>
          {draft.stops.map((stop, stopIndex) => (
            <StopCard key={`${stop.id ?? "stop"}-${stopIndex}`} stop={stop} stopIndex={stopIndex} stopCount={draft.stops.length} mutate={mutate} colors={colors} />
          ))}
        </View>
        <Pressable onPress={addStop} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 5, padding: 9, marginTop: 4, maxWidth: 1300, width: "100%" }}><Plus size={17} color="#3B82F6" /><Text style={{ color: "#3B82F6", fontWeight: "700" }}>Ajouter un commerce</Text></Pressable>
      </ScrollView>
    </View>
  );
}

function StopCard({ stop, stopIndex, stopCount, mutate, colors }: { stop: TourStop; stopIndex: number; stopCount: number; mutate: (fn: (next: TourTemplate) => void) => void; colors: Colors }) {
  const setStop = (fn: (value: TourStop) => void) => mutate((next: TourTemplate) => fn(next.stops[stopIndex]));

  const setServiceLabel = (serviceIndex: number, value: string) => setStop((next) => { next.services[serviceIndex].label = value; });
  const setServicePrice = (serviceIndex: number, value: number | null) => setStop((next) => { next.services[serviceIndex].price_ht = value ?? 0; });
  const removeService = (serviceIndex: number) => setStop((next) => {
    next.services.splice(serviceIndex, 1);
    next.services.forEach((service, index) => { service.position = index; });
  });
  const addService = () => setStop((next) => {
    next.services.push({ label: "", price_ht: 0, position: next.services.length, active: true });
  });

  const hasSingleService = stop.services.length <= 1;
  const singlePrice = stop.services[0]?.price_ht ?? 0;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.soft }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TextInput
          value={stop.name}
          onChangeText={(value) => setStop((next) => { next.name = value; })}
          placeholder="Nom du commerce"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, minWidth: 0, color: colors.text, fontWeight: "700", fontSize: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.input }}
        />
        <Pressable disabled={stopIndex === 0} onPress={() => mutate((next) => { const items = next.stops; const target = stopIndex - 1; if (target < 0) return; [items[stopIndex], items[target]] = [items[target], items[stopIndex]]; items.forEach((item, position) => { item.position = position; }); })}><ArrowUp size={17} color={stopIndex === 0 ? colors.border : colors.muted} /></Pressable>
        <Pressable disabled={stopIndex === stopCount - 1} onPress={() => mutate((next) => { const items = next.stops; const target = stopIndex + 1; if (target >= items.length) return; [items[stopIndex], items[target]] = [items[target], items[stopIndex]]; items.forEach((item, position) => { item.position = position; }); })}><ArrowDown size={17} color={stopIndex === stopCount - 1 ? colors.border : colors.muted} /></Pressable>
        <Pressable onPress={() => mutate((next) => { next.stops.splice(stopIndex, 1); })}><Trash2 size={17} color="#EF4444" /></Pressable>
      </View>

      <CompactMetaRow stop={stop} setStop={setStop} colors={colors} />

      {hasSingleService ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <MetaNumberField
              label="Prix"
              value={singlePrice}
              onCommit={(value) => setStop((next) => {
                if (next.services.length === 0) next.services.push({ label: "", price_ht: 0, position: 0, active: true });
                next.services[0].price_ht = value ?? 0;
              })}
              colors={colors}
              minWidth={110}
            />
          </View>
          <Pressable onPress={addService} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(59,130,246,0.1)", paddingHorizontal: 10, paddingVertical: 9, borderRadius: 999 }}>
            <PlusCircle size={14} color="#3B82F6" />
            <Text style={{ color: "#3B82F6", fontWeight: "700", fontSize: 12 }}>Variante</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Prestations</Text>
            <Pressable onPress={addService} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(59,130,246,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
              <PlusCircle size={14} color="#3B82F6" />
              <Text style={{ color: "#3B82F6", fontWeight: "700", fontSize: 12 }}>Ajouter</Text>
            </Pressable>
          </View>
          {stop.services.map((service, serviceIndex) => (
            <ServiceRow
              key={serviceIndex}
              label={service.label}
              price={service.price_ht}
              onChangeLabel={(value) => setServiceLabel(serviceIndex, value)}
              onCommitPrice={(value) => setServicePrice(serviceIndex, value)}
              onRemove={() => removeService(serviceIndex)}
              colors={colors}
            />
          ))}
        </>
      )}
    </View>
  );
}
