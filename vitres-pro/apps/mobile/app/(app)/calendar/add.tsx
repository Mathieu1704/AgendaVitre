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

export default function AddInterventionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditMode = !!id;

  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { employees } = useEmployees();

  const { data: clients, refetch: refetchClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data as Client[];
    },
  });

  const { data: interventionData, isLoading: isLoadingIntervention } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/api/interventions/${id}`);
      return res.data;
    },
    enabled: isEditMode,
  });

  // --- States ---
  const [intervType, setIntervType] = useState<IntervType>("intervention");
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

  // --- New client modal ---
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
    mutationFn: async (data: any) => {
      const res = await api.post("/api/clients", data);
      return res.data as Client;
    },
    onSuccess: async (newClient) => {
      await refetchClients();
      setSelectedClient(newClient);
      setShowNewClient(false);
      setNewClientName(""); setNewClientStreet(""); setNewClientZip("");
      setNewClientCity(""); setNewClientPhone(""); setNewClientEmail(""); setNewClientNotes("");
      toast.success("Client créé", newClient.name || newClient.address || "Client anonyme");
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
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

  // --- Load edit data ---
  useEffect(() => {
    if (isEditMode && interventionData && clients) {
      setTitle(interventionData.title);
      setDescription(interventionData.description || "");
      setIsInvoice(interventionData.is_invoice);
      if (interventionData.type) setIntervType(interventionData.type as IntervType);

      const start = new Date(interventionData.start_time);
      const end = new Date(interventionData.end_time);
      setStartDateStr(toBrusselsDateTimeString(start));
      const diffHours = (end.getTime() - start.getTime()) / 3600000;
      setDurationHours(parseFloat(diffHours.toFixed(2)).toString());

      const foundClient = clients.find((c) => c.id === interventionData.client_id);
      if (foundClient) setSelectedClient(foundClient);
      else if (interventionData.client) setSelectedClient(interventionData.client);

      if (interventionData.employees) {
        setSelectedEmployeeIds(interventionData.employees.map((e: any) => e.id));
      }
      if (interventionData.items && interventionData.items.length > 0) {
        setItems(interventionData.items.map((i: any) => ({ label: i.label, price: i.price.toString() })));
      }
    }
  }, [isEditMode, interventionData, clients]);

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

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode) return await api.patch(`/api/interventions/${id}`, payload);
      else return await api.post("/api/interventions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["intervention", id] });
        toast.success("Succès", "Intervention modifiée !");
        router.push(`/(app)/calendar/${id}` as any);
      } else {
        toast.success("Succès", "Intervention créée !");
        router.push({ pathname: "/(app)/calendar", params: { date: startDateStr } });
      }
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (NEEDS_CLIENT.includes(intervType) && !selectedClient)
      return toast.error("Client", "Sélectionne un client.");
    if (!title) return toast.error("Titre", "Titre requis.");
    const start = parseBrusselsDateTimeString(startDateStr);
    const dur = Number(durationHours);
    if (!start || !dur) return toast.error("Date", "Vérifie la date et durée.");
    const end = new Date(start.getTime() + dur * 3600000);
    const cleanItems = items.filter((i) => i.label.trim() !== "");
    mutation.mutate({
      type: intervType,
      title,
      description,
      client_id: selectedClient?.id ?? null,
      employee_ids: selectedEmployeeIds,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: totalPrice,
      is_invoice: isInvoice,
      items: cleanItems.map((i) => ({ label: i.label, price: Number(i.price) || 0 })),
    });
  };

  if (isEditMode && isLoadingIntervention) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const typeNeedsClient = NEEDS_CLIENT.includes(intervType);
  const typeNeedsItems = NEEDS_ITEMS.includes(intervType);

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => {
            if (isEditMode) router.push(`/(app)/calendar/${id}`);
            else router.back();
          }}
          className="p-2 rounded-full hover:bg-muted active:bg-muted"
        >
          <ChevronLeft size={24} className="text-foreground dark:text-white" />
        </Pressable>
        <Text className="text-lg font-bold ml-2 text-foreground dark:text-white">
          {isEditMode ? "Modifier l'intervention" : "Nouvelle intervention"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="max-w-2xl w-full self-center rounded-[40px] overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <Text className="text-2xl font-extrabold text-foreground dark:text-white text-center">
              {isEditMode ? "Modifier" : "Planifier"}
            </Text>
            <Text className="mt-1 text-muted-foreground text-center font-medium">
              {isEditMode ? "Mise à jour intervention" : "Nouvelle intervention"}
            </Text>
          </CardHeader>

          <CardContent className="p-6 pt-4 gap-5">

            {/* TYPE (admin only) */}
            {isAdmin && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">
                  Type
                </Text>
                <View className="flex-row gap-2 flex-wrap">
                  {(Object.keys(TYPE_CONFIG) as IntervType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const active = intervType === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setIntervType(t)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: active ? cfg.color : "#E2E8F0",
                          backgroundColor: active ? cfg.bg : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "600",
                            fontSize: 13,
                            color: active ? cfg.color : "#94A3B8",
                          }}
                        >
                          {cfg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* CLIENT (si intervention ou devis) */}
            {typeNeedsClient && (
              <View className="gap-1">
                <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">
                  Pour qui ?
                </Text>
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
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: "#EFF6FF",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                    }}
                  >
                    <UserPlus size={20} color="#3B82F6" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* EMPLOYES */}
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground dark:text-white">
                Qui intervient ?
              </Text>
              <MultiSelect
                items={employeeItems}
                selectedIds={selectedEmployeeIds}
                onChange={setSelectedEmployeeIds}
              />
            </View>

            {/* DETAILS */}
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

            {/* PRESTATIONS (si intervention ou devis) */}
            {typeNeedsItems && (
              <View className="mt-2 pt-4 border-t border-border dark:border-slate-800">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    Prestations
                  </Text>
                  <Pressable
                    onPress={addItem}
                    className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full"
                  >
                    <PlusCircle size={16} color="#3B82F6" />
                    <Text className="text-primary font-bold ml-1.5 text-xs">Ajouter</Text>
                  </Pressable>
                </View>

                {items.map((item, index) => (
                  <View key={index} className="flex-row gap-2 items-center mb-2">
                    <View className="flex-[2]">
                      <Input
                        placeholder="Ex: RDC, Velux..."
                        value={item.label}
                        onChangeText={(t) => updateItem(index, "label", t)}
                      />
                    </View>
                    <View className="flex-1">
                      <Input
                        placeholder="Prix"
                        keyboardType="numeric"
                        value={item.price}
                        onChangeText={(t) => updateItem(index, "price", t)}
                      />
                    </View>
                    {items.length > 1 && (
                      <Pressable onPress={() => removeItem(index)} className="p-2">
                        <Trash2 size={20} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <View className="flex-row justify-between items-center mt-2">
                  <Text className="font-bold text-lg text-foreground dark:text-white">
                    Total Estimé
                  </Text>
                  <Text className="font-extrabold text-2xl text-primary">
                    {totalPrice.toFixed(2)} €
                  </Text>
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

            {/* FACTURATION (admin + types avec client seulement) */}
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
                  onPress={() => router.push("/(app)/calendar")}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  Annuler
                </Button>
              </View>
              <View style={{ flex: 1, marginRight: isWeb ? 0 : 16 }}>
                <Button
                  onPress={handleSubmit}
                  disabled={mutation.isPending}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  {mutation.isPending ? "Envoi..." : isEditMode ? "Mettre à jour" : "Valider"}
                </Button>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

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
            {/* NOM */}
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "name" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "name" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>NOM / ENTREPRISE</Text>
              <TextInput
                value={newClientName}
                onChangeText={setNewClientName}
                placeholder="Ex: Jean Dupont"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("name")}
                onBlur={() => setNcFocused(null)}
                style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
            </View>

            {/* RUE */}
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "street" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "street" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>RUE ET NUMÉRO *</Text>
              <TextInput
                value={newClientStreet}
                onChangeText={setNewClientStreet}
                placeholder="10 Rue de la Paix"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("street")}
                onBlur={() => setNcFocused(null)}
                style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
            </View>

            {/* CP + VILLE */}
            <View className="flex-row gap-3">
              <View style={{ flex: 1, borderWidth: 1.5, borderColor: ncFocused === "zip" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
                <Text style={{ fontSize: 11, color: ncFocused === "zip" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>CP</Text>
                <TextInput
                  value={newClientZip}
                  onChangeText={setNewClientZip}
                  placeholder="7000"
                  keyboardType="numeric"
                  placeholderTextColor="#CBD5E1"
                  onFocus={() => setNcFocused("zip")}
                  onBlur={() => setNcFocused(null)}
                  style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                />
              </View>
              <View style={{ flex: 2, borderWidth: 1.5, borderColor: ncFocused === "city" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
                <Text style={{ fontSize: 11, color: ncFocused === "city" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>VILLE *</Text>
                <TextInput
                  value={newClientCity}
                  onChangeText={setNewClientCity}
                  placeholder="Mons"
                  placeholderTextColor="#CBD5E1"
                  onFocus={() => setNcFocused("city")}
                  onBlur={() => setNcFocused(null)}
                  style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                />
              </View>
            </View>

            {/* TÉLÉPHONE */}
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "phone" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "phone" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>TÉLÉPHONE *</Text>
              <TextInput
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                placeholder="0487 12 34 56"
                keyboardType="phone-pad"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("phone")}
                onBlur={() => setNcFocused(null)}
                style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
            </View>

            {/* EMAIL */}
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "email" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "email" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>EMAIL</Text>
              <TextInput
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="client@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("email")}
                onBlur={() => setNcFocused(null)}
                style={[{ fontSize: 15, color: "#0f172a" }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
            </View>

            {/* NOTES */}
            <View style={{ borderWidth: 1.5, borderColor: ncFocused === "notes" ? "#3B82F6" : "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F8FAFC" }}>
              <Text style={{ fontSize: 11, color: ncFocused === "notes" ? "#3B82F6" : "#94A3B8", fontWeight: "600", marginBottom: 4 }}>NOTES INTERNES</Text>
              <TextInput
                value={newClientNotes}
                onChangeText={setNewClientNotes}
                placeholder="Code porte, préférences..."
                multiline
                numberOfLines={3}
                placeholderTextColor="#CBD5E1"
                onFocus={() => setNcFocused("notes")}
                onBlur={() => setNcFocused(null)}
                style={[{ fontSize: 15, color: "#0f172a", minHeight: 60 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
              />
            </View>
          </View>

          <Button
            onPress={handleCreateClient}
            loading={createClientMutation.isPending}
            className="mt-4"
            style={{ borderRadius: 16 }}
          >
            <Check size={18} color="white" />
            <Text className="text-white font-bold ml-2">Créer le client</Text>
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
