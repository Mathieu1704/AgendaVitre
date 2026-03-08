import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  Platform,
  Pressable,
  Switch,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import {
  PlusCircle,
  Trash2,
  Check,
  FileText,
  ChevronLeft,
  UserPlus,
  X,
  Repeat,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { MultiSelect } from "../../../src/ui/components/MultiSelect";
import { toast } from "../../../src/ui/toast";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dialog } from "../../../src/ui/components/Dialog";

import {
  toBrusselsDateTimeString,
  parseBrusselsDateTimeString,
} from "../../../src/lib/date";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";

type Client = { id: string; name: string | null; address: string | null; phone?: string | null };
type Item = { label: string; price: string };
type IntervType = "intervention" | "devis" | "tournee" | "note";

const TYPE_CONFIG: Record<IntervType, { label: string; color: string; bg: string }> = {
  intervention: { label: "Intervention", color: "#3B82F6", bg: "#EFF6FF" },
  devis:        { label: "Devis",         color: "#8B5CF6", bg: "#F5F3FF" },
  tournee:      { label: "Tournée",       color: "#F97316", bg: "#FFF7ED" },
  note:         { label: "Note",          color: "#64748B", bg: "#F8FAFC" },
};

const NEEDS_CLIENT: IntervType[] = ["intervention", "devis"];
const NEEDS_ITEMS: IntervType[] = ["intervention", "devis"];

type RecurrenceType = "none" | "weekly" | "biweekly" | "monthly" | "custom";
type RecurrenceUnit = "day" | "week" | "month";

interface Recurrence {
  type: RecurrenceType;
  interval: number;     // pour custom
  unit: RecurrenceUnit; // pour custom
  count: number;        // nombre d'occurrences total
}

const DEFAULT_RECURRENCE: Recurrence = { type: "none", interval: 1, unit: "week", count: 1 };

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none:     "Une seule fois",
  weekly:   "Toutes les semaines",
  biweekly: "Toutes les 2 semaines",
  monthly:  "Tous les mois",
  custom:   "Personnaliser...",
};

function generateDates(startStr: string, durationHours: number, rec: Recurrence): { start: Date; end: Date }[] {
  const base = parseBrusselsDateTimeString(startStr);
  if (!base) return [];
  const dur = durationHours * 3600000;
  const dates: { start: Date; end: Date }[] = [];
  const count = rec.type === "none" ? 1 : Math.max(1, rec.count);
  for (let i = 0; i < count; i++) {
    const s = new Date(base);
    if (i > 0) {
      if (rec.type === "weekly")   s.setDate(s.getDate() + 7 * i);
      else if (rec.type === "biweekly") s.setDate(s.getDate() + 14 * i);
      else if (rec.type === "monthly") s.setMonth(s.getMonth() + i);
      else if (rec.type === "custom") {
        if (rec.unit === "day")   s.setDate(s.getDate() + rec.interval * i);
        else if (rec.unit === "week")  s.setDate(s.getDate() + 7 * rec.interval * i);
        else if (rec.unit === "month") s.setMonth(s.getMonth() + rec.interval * i);
      }
    }
    dates.push({ start: s, end: new Date(s.getTime() + dur) });
  }
  return dates;
}

export default function AddInterventionScreen() {
  const router = useRouter();
  const { id, reprise_of } = useLocalSearchParams<{ id?: string; reprise_of?: string }>();
  const isEditMode = !!id && !reprise_of;
  const isRepriseMode = !!reprise_of;

  const { isAdmin, userZone } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { employees } = useEmployees();

  const { data: clients, refetch: refetchClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get("/api/clients")).data as Client[],
  });

  // Données pour edit normal
  const { data: interventionData, isLoading: isLoadingIntervention } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      if (!id) return null;
      return (await api.get(`/api/interventions/${id}`)).data;
    },
    enabled: isEditMode,
  });

  // Données pour reprise (source originale)
  const { data: repriseSource, isLoading: isLoadingReprise } = useQuery({
    queryKey: ["intervention-reprise", reprise_of],
    queryFn: async () => {
      if (!reprise_of) return null;
      return (await api.get(`/api/interventions/${reprise_of}`)).data;
    },
    enabled: isRepriseMode,
  });

  // --- States formulaire ---
  const [intervType, setIntervType] = useState<IntervType>("intervention");
  const [zone, setZone] = useState<"hainaut" | "ardennes">("hainaut");
  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([{ label: "", price: "" }]);
  const [description, setDescription] = useState("");
  const [isInvoice, setIsInvoice] = useState(false);

  const defaultStart = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const datePart = toBrusselsDateTimeString(tomorrow).split("T")[0];
    return `${datePart}T09:00`;
  }, []);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("");

  // --- Récurrence ---
  const [recurrence, setRecurrence] = useState<Recurrence>(DEFAULT_RECURRENCE);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrenceCountStr, setRecurrenceCountStr] = useState("4");
  const [customIntervalStr, setCustomIntervalStr] = useState("1");
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>("week");

  // --- Reprise : mode "non repris" ---
  const [noRepriseMode, setNoRepriseMode] = useState(false);
  const [noRepriseNote, setNoRepriseNote] = useState("");

  // --- Nouveau client ---
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientStreet, setNewClientStreet] = useState("");
  const [newClientZip, setNewClientZip] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [ncFocused, setNcFocused] = useState<string | null>(null);

  const createClientMutation = useMutation({
    mutationFn: async (data: any) => (await api.post("/api/clients", data)).data as Client,
    onSuccess: async (newClient) => {
      await refetchClients();
      setSelectedClient(newClient);
      setShowNewClient(false);
      setNewClientName(""); setNewClientStreet(""); setNewClientZip("");
      setNewClientCity(""); setNewClientPhone(""); setNewClientEmail(""); setNewClientNotes("");
      toast.success("Client créé", newClient.name || newClient.address || "Client anonyme");
    },
    onError: (err: any) => toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue"),
  });

  const handleCreateClient = () => {
    if (!newClientStreet.trim() && !newClientCity.trim() && !newClientPhone.trim())
      return toast.error("Données manquantes", "Renseigne au moins l'adresse ou le téléphone.");
    const addressParts = [newClientStreet, newClientZip, newClientCity].filter(Boolean);
    createClientMutation.mutate({
      name: newClientName.trim() || null,
      street: newClientStreet || null,
      zip_code: newClientZip || null,
      city: newClientCity || null,
      address: addressParts.join(", ") || null,
      phone: newClientPhone || null,
      email: newClientEmail || null,
      notes: newClientNotes || null,
    });
  };

  // Charger les données d'édition normale
  useEffect(() => {
    if (isEditMode && interventionData && clients) {
      setTitle(interventionData.title);
      setDescription(interventionData.description || "");
      setIsInvoice(interventionData.is_invoice);
      if (interventionData.type) setIntervType(interventionData.type as IntervType);
      if (interventionData.zone) setZone(interventionData.zone as "hainaut" | "ardennes");
      const start = new Date(interventionData.start_time);
      const end = new Date(interventionData.end_time);
      setStartDateStr(toBrusselsDateTimeString(start));
      setDurationHours(parseFloat(((end.getTime() - start.getTime()) / 3600000).toFixed(2)).toString());
      const foundClient = clients.find((c) => c.id === interventionData.client_id);
      if (foundClient) setSelectedClient(foundClient);
      else if (interventionData.client) setSelectedClient(interventionData.client);
      if (interventionData.employees)
        setSelectedEmployeeIds(interventionData.employees.map((e: any) => e.id));
      if (interventionData.items && interventionData.items.length > 0)
        setItems(interventionData.items.map((i: any) => ({ label: i.label, price: i.price.toString() })));
    }
  }, [isEditMode, interventionData, clients]);

  // Pré-remplir depuis la source reprise (= semaine suivante)
  useEffect(() => {
    if (isRepriseMode && repriseSource && clients) {
      setTitle(repriseSource.title);
      setDescription(repriseSource.description || "");
      setIsInvoice(repriseSource.is_invoice);
      if (repriseSource.type) setIntervType(repriseSource.type as IntervType);
      if (repriseSource.zone) setZone(repriseSource.zone as "hainaut" | "ardennes");

      const origStart = new Date(repriseSource.start_time);
      const origEnd = new Date(repriseSource.end_time);
      const nextDate = new Date(origStart);
      nextDate.setDate(nextDate.getDate() + 7); // par défaut +1 semaine
      setStartDateStr(toBrusselsDateTimeString(nextDate));
      setDurationHours(parseFloat(((origEnd.getTime() - origStart.getTime()) / 3600000).toFixed(2)).toString());

      const foundClient = clients.find((c) => c.id === repriseSource.client_id);
      if (foundClient) setSelectedClient(foundClient);
      else if (repriseSource.client) setSelectedClient(repriseSource.client);

      if (repriseSource.employees)
        setSelectedEmployeeIds(repriseSource.employees.map((e: any) => e.id));
      if (repriseSource.items && repriseSource.items.length > 0)
        setItems(repriseSource.items.map((i: any) => ({ label: i.label, price: i.price.toString() })));
    }
  }, [isRepriseMode, repriseSource, clients]);

  const totalPrice = useMemo(
    () => items.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0),
    [items],
  );

  const addItem = () => setItems([...items, { label: "", price: "" }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof Item, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const clientItems = useMemo(
    () => (clients ?? []).map((c) => ({ id: c.id, label: c.name || c.address || "Client anonyme" })),
    [clients],
  );
  const employeeItems = useMemo(
    () => (employees ?? []).map((e) => ({ id: e.id, label: e.full_name || e.email, color: e.color })),
    [employees],
  );

  // --- Mutation principale (création / édition) ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (NEEDS_CLIENT.includes(intervType) && !selectedClient)
      return toast.error("Client", "Sélectionne un client.");
    if (!title) return toast.error("Titre", "Titre requis.");
    const dur = Number(durationHours);
    if (!dur) return toast.error("Durée", "Durée requise.");

    setIsSubmitting(true);
    try {
      const cleanItems = items.filter((i) => i.label.trim() !== "");
      const basePayload = {
        type: intervType,
        title,
        description,
        zone: isAdmin ? zone : userZone,
        client_id: selectedClient?.id ?? null,
        employee_ids: selectedEmployeeIds,
        price_estimated: totalPrice,
        is_invoice: isInvoice,
        items: cleanItems.map((i) => ({ label: i.label, price: Number(i.price) || 0 })),
      };

      if (isEditMode) {
        const start = parseBrusselsDateTimeString(startDateStr);
        if (!start) return toast.error("Date", "Vérifie la date.");
        const end = new Date(start.getTime() + dur * 3600000);
        await api.patch(`/api/interventions/${id}`, {
          ...basePayload,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["interventions"] });
        queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
        queryClient.invalidateQueries({ queryKey: ["intervention", id] });
        toast.success("Succès", "Intervention modifiée !");
        router.push(`/(app)/calendar/${id}` as any);
        return;
      }

      // Calcul des occurrences (reprise ou création simple avec récurrence)
      const occurrences = generateDates(startDateStr, dur, recurrence);
      if (occurrences.length === 0) return toast.error("Date", "Vérifie la date.");

      const groupId = occurrences.length > 1 ? crypto.randomUUID() : undefined;

      for (const occ of occurrences) {
        await api.post("/api/interventions", {
          ...basePayload,
          start_time: occ.start.toISOString(),
          end_time: occ.end.toISOString(),
          recurrence_rule: occurrences.length > 1 ? {
            freq: recurrence.type === "custom" ? recurrence.unit : recurrence.type.replace("biweekly", "week"),
            interval: recurrence.type === "biweekly" ? 2 : recurrence.type === "custom" ? recurrence.interval : 1,
            count: occurrences.length,
          } : null,
          recurrence_group_id: groupId ?? null,
        });
      }

      // Si reprise : marquer l'originale comme done
      if (isRepriseMode && reprise_of) {
        const now = new Date().toISOString();
        await api.patch(`/api/interventions/${reprise_of}`, {
          status: "done",
          real_end_time: now,
          reprise_taken: true,
        });
        queryClient.invalidateQueries({ queryKey: ["intervention", reprise_of] });
      }

      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });

      const msg = occurrences.length > 1
        ? `${occurrences.length} interventions créées !`
        : isRepriseMode ? "RDV de reprise planifié !" : "Intervention créée !";
      toast.success("Succès", msg);

      if (isRepriseMode && reprise_of) {
        router.push(`/(app)/calendar/${reprise_of}` as any);
      } else {
        router.push({ pathname: "/(app)/calendar", params: { date: startDateStr } });
      }
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- "RDV non repris" ---
  const [isSubmittingNoReprise, setIsSubmittingNoReprise] = useState(false);

  const handleNoReprise = async () => {
    if (!reprise_of) return;
    setIsSubmittingNoReprise(true);
    try {
      await api.post(`/api/interventions/${reprise_of}/no-reprise`, { note: noRepriseNote.trim() });
      queryClient.invalidateQueries({ queryKey: ["intervention", reprise_of] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Enregistré", "Intervention clôturée sans reprise.");
      router.push(`/(app)/calendar/${reprise_of}` as any);
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmittingNoReprise(false);
    }
  };

  if ((isEditMode && isLoadingIntervention) || (isRepriseMode && isLoadingReprise)) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const typeNeedsClient = NEEDS_CLIENT.includes(intervType);
  const typeNeedsItems = NEEDS_ITEMS.includes(intervType);

  const recurrenceLabel = recurrence.type === "custom"
    ? `Tous les ${recurrence.interval} ${recurrence.unit === "day" ? "jours" : recurrence.unit === "week" ? "semaines" : "mois"}`
    : RECURRENCE_LABELS[recurrence.type];

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => {
            if (isEditMode) router.push(`/(app)/calendar/${id}`);
            else if (isRepriseMode) router.push(`/(app)/calendar/${reprise_of}` as any);
            else router.back();
          }}
          className="p-2 rounded-full hover:bg-muted active:bg-muted"
        >
          <ChevronLeft size={24} className="text-foreground dark:text-white" />
        </Pressable>
        <Text className="text-lg font-bold ml-2 text-foreground dark:text-white">
          {isRepriseMode ? "Planifier la reprise" : isEditMode ? "Modifier l'intervention" : "Nouvelle intervention"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="max-w-2xl w-full self-center rounded-[40px] overflow-hidden">

          {/* BANNIÈRE "RDV NON REPRIS" (mode reprise uniquement) */}
          {isRepriseMode && (
            <View style={{ padding: 16, paddingBottom: 0 }}>
              {!noRepriseMode ? (
                <Pressable
                  onPress={() => setNoRepriseMode(true)}
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center",
                    backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA",
                    borderRadius: 16, padding: 14, gap: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#EF4444" />
                  <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>
                    RDV non repris
                  </Text>
                </Pressable>
              ) : (
                <View style={{
                  backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FECACA",
                  borderRadius: 20, padding: 16, gap: 12,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={18} color="#EF4444" />
                    <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15, flex: 1 }}>
                      RDV non repris
                    </Text>
                    <Pressable onPress={() => setNoRepriseMode(false)} style={{ padding: 4 }}>
                      <X size={18} color="#94A3B8" />
                    </Pressable>
                  </View>
                  <TextInput
                    value={noRepriseNote}
                    onChangeText={setNoRepriseNote}
                    placeholder="Note optionnelle (raison, contexte...)"
                    placeholderTextColor="#CBD5E1"
                    multiline
                    numberOfLines={3}
                    style={[{
                      fontSize: 14, color: "#0f172a", backgroundColor: "white",
                      borderRadius: 12, padding: 12, minHeight: 70,
                      borderWidth: 1, borderColor: "#FECACA",
                    }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                  />
                  <Pressable
                    onPress={handleNoReprise}
                    disabled={isSubmittingNoReprise}
                    style={{
                      backgroundColor: "#EF4444", borderRadius: 12, padding: 14,
                      alignItems: "center", opacity: isSubmittingNoReprise ? 0.6 : 1,
                    }}
                  >
                    {isSubmittingNoReprise
                      ? <ActivityIndicator color="white" />
                      : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                          Confirmer sans reprise
                        </Text>
                    }
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <CardHeader className="p-6 pb-2">
            <Text className="text-2xl font-extrabold text-foreground dark:text-white text-center">
              {isRepriseMode ? "Reprise RDV" : isEditMode ? "Modifier" : "Planifier"}
            </Text>
            <Text className="mt-1 text-muted-foreground text-center font-medium">
              {isRepriseMode
                ? "Planifie le prochain RDV pour ce client"
                : isEditMode ? "Mise à jour intervention" : "Nouvelle intervention"}
            </Text>
          </CardHeader>

          <CardContent className="p-6 pt-4 gap-5">

            {/* TYPE (admin only) */}
            {isAdmin && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">Type</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {(Object.keys(TYPE_CONFIG) as IntervType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const active = intervType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setIntervType(t)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: active ? cfg.color : "#E2E8F0",
                          backgroundColor: active ? cfg.bg : "transparent",
                        }}
                      >
                        <Text style={{ fontWeight: "600", fontSize: 13, color: active ? cfg.color : "#94A3B8" }}>
                          {cfg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ZONE (admin seulement) */}
            {isAdmin && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">Zone</Text>
                <View className="flex-row gap-2">
                  {(["hainaut", "ardennes"] as const).map((z) => {
                    const active = zone === z;
                    const color = z === "ardennes" ? "#10B981" : "#3B82F6";
                    const bg    = z === "ardennes" ? "#D1FAE5" : "#DBEAFE";
                    return (
                      <Pressable
                        key={z}
                        onPress={() => setZone(z)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: active ? color : "#E2E8F0",
                          backgroundColor: active ? bg : "transparent",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontWeight: "600", fontSize: 14, color: active ? color : "#94A3B8" }}>
                          {z === "ardennes" ? "Ardennes" : "Hainaut"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* CLIENT */}
            {typeNeedsClient && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">Pour qui ?</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Select
                      title="Choisir un client"
                      value={selectedClient ? { id: selectedClient.id, label: selectedClient.name || selectedClient.address || "Client anonyme" } : null}
                      items={clientItems}
                      onChange={(v) => {
                        const c = clients?.find((x) => x.id === v.id);
                        if (c) setSelectedClient(c);
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => setShowNewClient(true)}
                    style={{
                      width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF",
                      alignItems: "center", justifyContent: "center",
                      borderWidth: 1, borderColor: "#BFDBFE",
                    }}
                  >
                    <UserPlus size={20} color="#3B82F6" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* EMPLOYES */}
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground dark:text-white">Qui intervient ?</Text>
              <MultiSelect
                items={employeeItems}
                selectedIds={selectedEmployeeIds}
                onChange={setSelectedEmployeeIds}
              />
            </View>

            {/* TITRE + DATE + DURÉE */}
            <View className="gap-4 mt-2">
              <Input
                label="Titre"
                value={title}
                onChangeText={setTitle}
                containerStyle={{ marginBottom: isWeb ? 0 : 10 }}
              />
              <DateTimePicker
                value={startDateStr}
                onChange={setStartDateStr}
                label="Début de l'intervention"
              />
              <Input
                label="Durée (heures)"
                value={durationHours}
                onChangeText={setDurationHours}
                keyboardType="numeric"
              />
            </View>

            {/* RÉCURRENCE (pas en mode édition) */}
            {!isEditMode && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">Récurrence</Text>
                <View className="flex-row gap-2 flex-wrap">
                  {(["none", "weekly", "biweekly", "monthly", "custom"] as RecurrenceType[]).map((t) => {
                    const active = recurrence.type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => {
                          if (t === "custom") {
                            setShowRecurrenceModal(true);
                          } else {
                            setRecurrence({ ...recurrence, type: t });
                          }
                        }}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
                          borderWidth: 1.5,
                          borderColor: active ? "#3B82F6" : "#E2E8F0",
                          backgroundColor: active ? "#EFF6FF" : "transparent",
                          flexDirection: "row", alignItems: "center", gap: 4,
                        }}
                      >
                        {t !== "none" && <Repeat size={11} color={active ? "#3B82F6" : "#94A3B8"} />}
                        <Text style={{ fontWeight: "600", fontSize: 12, color: active ? "#3B82F6" : "#94A3B8" }}>
                          {t === "custom" && recurrence.type === "custom" ? recurrenceLabel : RECURRENCE_LABELS[t]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Nombre d'occurrences si récurrence active */}
                {recurrence.type !== "none" && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 }}>
                    <RefreshCw size={14} color="#3B82F6" />
                    <Text style={{ fontSize: 13, color: "#64748B" }}>Nombre de répétitions :</Text>
                    <TextInput
                      value={recurrenceCountStr}
                      onChangeText={(v) => {
                        setRecurrenceCountStr(v);
                        const n = parseInt(v);
                        if (!isNaN(n) && n > 0) setRecurrence(r => ({ ...r, count: n }));
                      }}
                      keyboardType="numeric"
                      style={[{
                        width: 60, borderWidth: 1.5, borderColor: "#DBEAFE",
                        borderRadius: 10, padding: 8, textAlign: "center",
                        fontSize: 15, fontWeight: "700", color: "#3B82F6",
                        backgroundColor: "#F0F9FF",
                      }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                    />
                    <Text style={{ fontSize: 13, color: "#64748B" }}>
                      fois ({recurrence.count} intervention{recurrence.count > 1 ? "s" : ""})
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* PRESTATIONS */}
            {typeNeedsItems && (
              <View className="mt-2 pt-4 border-t border-border dark:border-slate-800">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-sm font-semibold text-foreground dark:text-white">Prestations</Text>
                  <Pressable onPress={addItem} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full">
                    <PlusCircle size={16} color="#3B82F6" />
                    <Text className="text-primary font-bold ml-1.5 text-xs">Ajouter</Text>
                  </Pressable>
                </View>
                {items.map((item, index) => (
                  <View key={index} className="flex-row gap-2 items-center mb-2">
                    <View className="flex-[2]">
                      <Input placeholder="Ex: RDC, Velux..." value={item.label} onChangeText={(t) => updateItem(index, "label", t)} />
                    </View>
                    <View className="flex-1">
                      <Input placeholder="Prix" keyboardType="numeric" value={item.price} onChangeText={(t) => updateItem(index, "price", t)} />
                    </View>
                    {items.length > 1 && (
                      <Pressable onPress={() => removeItem(index)} className="p-2">
                        <Trash2 size={20} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}
                <View className="flex-row justify-between items-center mt-2">
                  <Text className="font-bold text-lg text-foreground dark:text-white">Total Estimé</Text>
                  <Text className="font-extrabold text-2xl text-primary">{totalPrice.toFixed(2)} €</Text>
                </View>
              </View>
            )}

            {/* NOTES */}
            <View>
              <Input
                label="Notes"
                placeholder="Infos supplémentaires..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                className="h-20 py-2"
              />
            </View>

            {/* FACTURATION */}
            {isAdmin && typeNeedsClient && (
              <View className="flex-row items-center justify-between pt-4 mt-4 border-t border-border dark:border-slate-800">
                <View className="flex-1 pr-4 flex-row items-center gap-3">
                  <View className={`p-2 rounded-full ${isInvoice ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50"}`}>
                    <FileText size={20} color={isInvoice ? "#22C55E" : "#64748B"} />
                  </View>
                  <View>
                    <Text className="text-base font-medium text-foreground dark:text-white">Facturation</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">Cocher si une facture doit être émise</Text>
                  </View>
                </View>
                <Switch
                  value={isInvoice}
                  onValueChange={setIsInvoice}
                  trackColor={{ false: "#767577", true: "#22C55E" }}
                  thumbColor={Platform.OS === "ios" ? "#fff" : isInvoice ? "#fff" : "#f4f3f4"}
                />
              </View>
            )}

            {/* ACTIONS */}
            <View className="mt-6 flex-row gap-3">
              <View style={{ flex: 1, marginLeft: isWeb ? 0 : -22, marginRight: isWeb ? 0 : 15 }}>
                <Button
                  variant="outline"
                  onPress={() => {
                    if (isRepriseMode) router.push(`/(app)/calendar/${reprise_of}` as any);
                    else router.push("/(app)/calendar");
                  }}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  Annuler
                </Button>
              </View>
              <View style={{ flex: 1, marginRight: isWeb ? 0 : 16 }}>
                <Button
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  {isSubmitting ? "Envoi..." : isRepriseMode ? "Planifier le RDV" : isEditMode ? "Mettre à jour" : "Valider"}
                </Button>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

      {/* MODAL RÉCURRENCE PERSONNALISÉE */}
      <Dialog open={showRecurrenceModal} onClose={() => setShowRecurrenceModal(false)} position="center">
        <View className="p-6 gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground dark:text-white">Récurrence personnalisée</Text>
            <Pressable onPress={() => setShowRecurrenceModal(false)} className="p-1">
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground dark:text-white">Répéter toutes les</Text>
            <View className="flex-row gap-3 items-center">
              <TextInput
                value={customIntervalStr}
                onChangeText={(v) => setCustomIntervalStr(v)}
                keyboardType="numeric"
                style={[{
                  width: 60, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
                  padding: 10, textAlign: "center", fontSize: 16, color: "#0f172a",
                }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
              <View className="flex-row gap-2 flex-1 flex-wrap">
                {([["day", "Jour(s)"], ["week", "Semaine(s)"], ["month", "Mois"]] as [RecurrenceUnit, string][]).map(([u, label]) => (
                  <Pressable
                    key={u}
                    onPress={() => setCustomUnit(u)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: customUnit === u ? "#3B82F6" : "#E2E8F0",
                      backgroundColor: customUnit === u ? "#EFF6FF" : "transparent",
                    }}
                  >
                    <Text style={{ fontWeight: "600", fontSize: 13, color: customUnit === u ? "#3B82F6" : "#94A3B8" }}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text className="text-sm font-semibold text-foreground dark:text-white mt-2">Nombre d'occurrences</Text>
            <TextInput
              value={recurrenceCountStr}
              onChangeText={(v) => setRecurrenceCountStr(v)}
              keyboardType="numeric"
              style={[{
                borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10,
                padding: 10, fontSize: 16, color: "#0f172a",
              }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
            />
          </View>

          <Button
            onPress={() => {
              const interval = parseInt(customIntervalStr) || 1;
              const count = parseInt(recurrenceCountStr) || 4;
              setRecurrence({ type: "custom", interval, unit: customUnit, count });
              setShowRecurrenceModal(false);
            }}
            className="rounded-[20px]"
          >
            <Check size={16} color="white" />
            <Text className="text-white font-bold ml-2">Confirmer</Text>
          </Button>
        </View>
      </Dialog>

      {/* MODAL NOUVEAU CLIENT */}
      <Dialog open={showNewClient} onClose={() => setShowNewClient(false)} position="bottom">
        <View className="p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-foreground dark:text-white">Nouveau client</Text>
            <Pressable onPress={() => setShowNewClient(false)} className="p-1">
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          <View className="gap-3">
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "name" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "name" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>NOM / ENTREPRISE</Text>
              <TextInput value={newClientName} onChangeText={setNewClientName} placeholder="Ex: Jean Dupont" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("name")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
            </View>
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "street" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "street" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>RUE ET NUMÉRO *</Text>
              <TextInput value={newClientStreet} onChangeText={setNewClientStreet} placeholder="10 Rue de la Paix" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("street")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
            </View>
            <View className="flex-row gap-3">
              <View style={{ flex: 1, borderWidth: 1.5, borderColor: ncFocused === "zip" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
                <Text style={{ fontSize: 11, color: ncFocused === "zip" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>CP</Text>
                <TextInput value={newClientZip} onChangeText={setNewClientZip} placeholder="7000" keyboardType="numeric" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("zip")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
              </View>
              <View style={{ flex: 2, borderWidth: 1.5, borderColor: ncFocused === "city" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
                <Text style={{ fontSize: 11, color: ncFocused === "city" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>VILLE *</Text>
                <TextInput value={newClientCity} onChangeText={setNewClientCity} placeholder="Mons" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("city")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
              </View>
            </View>
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "phone" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "phone" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>TÉLÉPHONE *</Text>
              <TextInput value={newClientPhone} onChangeText={setNewClientPhone} placeholder="0487 12 34 56" keyboardType="phone-pad" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("phone")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
            </View>
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "email" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "email" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>EMAIL</Text>
              <TextInput value={newClientEmail} onChangeText={setNewClientEmail} placeholder="client@email.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("email")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
            </View>
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "notes" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "notes" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>NOTES INTERNES</Text>
              <TextInput value={newClientNotes} onChangeText={setNewClientNotes} placeholder="Code porte, préférences..." multiline numberOfLines={3} placeholderTextColor="#CBD5E1" onFocus={() => setNcFocused("notes")} onBlur={() => setNcFocused(null)} style={[{ fontSize: 15, color: "#0f172a", minHeight: 60 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]} />
            </View>
          </View>

          <Button onPress={handleCreateClient} loading={createClientMutation.isPending} className="mt-4" style={{ borderRadius: 16 }}>
            <Check size={18} color="white" />
            <Text className="text-white font-bold ml-2">Créer le client</Text>
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
