import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  Platform,
  Pressable,
  Switch,
  ActivityIndicator,
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
} from "lucide-react-native";
import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { MultiSelect } from "../../../src/ui/components/MultiSelect";
import { toast } from "../../../src/ui/toast";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  parseLocalDateTimeString,
  toLocalDateTimeString,
} from "../../../src/lib/date";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";

type Client = { id: string; name: string; address: string };
type Item = { label: string; price: string };

export default function AddInterventionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditMode = !!id;

  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { employees } = useEmployees();
  // 1. Charger les Clients
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data as Client[];
    },
  });

  // 2. Charger l'Intervention (SI mode Edit)
  const { data: interventionData, isLoading: isLoadingIntervention } = useQuery(
    {
      queryKey: ["intervention", id],
      queryFn: async () => {
        if (!id) return null;
        const res = await api.get(`/api/interventions/${id}`);
        return res.data;
      },
      enabled: isEditMode, // Ne se déclenche que si on a un ID
    },
  );

  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [items, setItems] = useState<Item[]>([{ label: "", price: "" }]);
  const [description, setDescription] = useState(""); // Notes globales
  const [isInvoice, setIsInvoice] = useState(false);

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalDateTimeString(d).replace(" ", "T");
  }, []);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("");

  useEffect(() => {
    // On ne remplit que si on est en mode Edit, qu'on a reçu les données de l'intervention ET les clients
    if (isEditMode && interventionData && clients) {
      setTitle(interventionData.title);
      setDescription(interventionData.description || "");
      setIsInvoice(interventionData.is_invoice);

      // Gestion des Dates
      const start = new Date(interventionData.start_time);
      const end = new Date(interventionData.end_time);
      setStartDateStr(toLocalDateTimeString(start).replace(" ", "T"));

      const diffHours = (end.getTime() - start.getTime()) / 3600000;
      setDurationHours(parseFloat(diffHours.toFixed(2)).toString());

      // Gestion du Client
      const foundClient = clients.find(
        (c) => c.id === interventionData.client_id,
      );
      if (foundClient) {
        setSelectedClient(foundClient);
      } else {
        // Fallback si le client n'est pas dans la liste chargée (rare mais possible)
        if (interventionData.client) {
          setSelectedClient(interventionData.client);
        }
      }

      // Gestion des Employés
      if (interventionData.employees) {
        setSelectedEmployeeIds(
          interventionData.employees.map((e: any) => e.id),
        );
      }

      // Gestion des Prestations (Items)
      if (interventionData.items && interventionData.items.length > 0) {
        setItems(
          interventionData.items.map((i: any) => ({
            label: i.label,
            price: i.price.toString(),
          })),
        );
      }
    }
  }, [isEditMode, interventionData, clients]);

  const totalPrice = useMemo(() => {
    return items.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);
  }, [items]);

  // Fonctions pour gérer les lignes
  const addItem = () => setItems([...items, { label: "", price: "" }]);
  const removeItem = (index: number) =>
    setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof Item, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const clientItems = useMemo(
    () => (clients ?? []).map((c) => ({ id: c.id, label: c.name })),
    [clients],
  );
  const employeeItems = useMemo(
    () =>
      (employees ?? []).map((e) => ({
        id: e.id,
        label: e.full_name || e.email,
        color: e.color,
      })),
    [employees],
  );

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode) {
        return await api.patch(`/api/interventions/${id}`, payload);
      } else {
        return await api.post("/api/interventions", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });

      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["intervention", id] }); // Rafraîchir le détail
        toast.success("Succès", "Intervention modifiée !");
        router.back(); // Retour à la page détail
      } else {
        toast.success("Succès", "Intervention créée !");
        router.push({
          pathname: "/(app)/calendar",
          params: { date: startDateStr },
        });
      }
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (!selectedClient) return toast.error("Client", "Sélectionne un client.");
    if (!title) return toast.error("Titre", "Titre requis.");

    const start = parseLocalDateTimeString(startDateStr);
    const dur = Number(durationHours);
    if (!start || !dur) return toast.error("Date", "Vérifie la date et durée.");

    const end = new Date(start.getTime() + dur * 3600000);
    const cleanItems = items.filter((i) => i.label.trim() !== "");

    mutation.mutate({
      title,
      description,
      client_id: selectedClient.id,
      employee_ids: selectedEmployeeIds,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: totalPrice,
      is_invoice: isInvoice,
      items: cleanItems.map((i) => ({
        label: i.label,
        price: Number(i.price) || 0,
      })),
    });
  };

  // Afficher un loader pendant le chargement des données d'édition
  if (isEditMode && isLoadingIntervention) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => {
            if (isEditMode) {
              // Si on modifie, on force le retour à la fiche détail
              router.push(`/(app)/calendar/${id}`);
            } else {
              // Si on crée, on revient simplement au calendrier
              router.back();
            }
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
              {isEditMode
                ? "Mise à jour intervention"
                : "Nouvelle intervention"}
            </Text>
          </CardHeader>

          <CardContent className="p-6 pt-4 gap-5">
            {/* CLIENT */}
            <View className="gap-1">
              <Text className="text-sm font-semibold text-foreground dark:text-white ml-1">
                Pour qui ?
              </Text>
              <Select
                title="Choisir un client"
                value={
                  selectedClient
                    ? { id: selectedClient.id, label: selectedClient.name }
                    : null
                }
                items={clientItems}
                onChange={(v) => {
                  const c = clients?.find((x) => x.id === v.id);
                  if (c) setSelectedClient(c);
                }}
              />
            </View>

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

            {/* Section Prestations Détaillées */}
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
                  <Text className="text-primary font-bold ml-1.5 text-xs">
                    Ajouter
                  </Text>
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
                    <Pressable
                      onPress={() => removeItem(index)}
                      className="p-2"
                    >
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

            {/* Section Description */}
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

            {/* SWITCH FACTURATION */}
            {isAdmin && (
              <View className="flex-row items-center justify-between pt-4 mt-4 border-t border-border dark:border-slate-800">
                <View className="flex-1 pr-4 flex-row items-center gap-3">
                  <View
                    className={`p-2 rounded-full ${isInvoice ? "bg-green-100 dark:bg-green-900/30" : "bg-muted/50"}`}
                  >
                    <FileText
                      size={20}
                      color={isInvoice ? "#22C55E" : "#64748B"}
                    />
                  </View>

                  <View>
                    <Text className="text-base font-medium text-foreground dark:text-white">
                      Facturation
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">
                      Cocher si une facture doit être émise
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isInvoice}
                  onValueChange={setIsInvoice}
                  trackColor={{ false: "#767577", true: "#22C55E" }}
                  thumbColor={
                    Platform.OS === "ios"
                      ? "#fff"
                      : isInvoice
                        ? "#fff"
                        : "#f4f3f4"
                  }
                />
              </View>
            )}

            {/* ACTIONS */}
            <View className="mt-6 flex-row gap-3">
              <View
                style={{
                  flex: 1,

                  marginLeft: isWeb ? 0 : -22,
                  marginRight: isWeb ? 0 : 15,
                }}
              >
                <Button
                  variant="outline"
                  onPress={() => router.push("/(app)/calendar")}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  Annuler
                </Button>
              </View>

              <View
                style={{
                  flex: 1,
                  marginRight: isWeb ? 0 : 16,
                }}
              >
                <Button
                  onPress={handleSubmit}
                  disabled={mutation.isPending}
                  className="w-full"
                  style={{ borderRadius: 20 }}
                >
                  {mutation.isPending
                    ? "Envoi..."
                    : isEditMode
                      ? "Mettre à jour"
                      : "Valider"}
                </Button>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
