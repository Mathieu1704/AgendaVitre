import React, { useMemo, useState } from "react";
import { View, ScrollView, Text, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

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

type Client = { id: string; name: string; address: string };

export default function AddInterventionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { employees } = useEmployees();
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data as Client[];
    },
  });

  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [price, setPrice] = useState("");

  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalDateTimeString(d).replace(" ", "T");
  }, []);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("");

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
      return await api.post("/api/interventions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      toast.success("Succès", "Intervention enregistrée ✅");
      router.push({
        pathname: "/(app)/calendar",
        params: { date: startDateStr },
      });
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (!selectedClient)
      return toast.error("Manquant", "Sélectionne un client.");
    if (selectedEmployeeIds.length === 0)
      return toast.error("Manquant", "Assigne au moins un employé.");

    const start = parseLocalDateTimeString(startDateStr);
    if (!start || Number.isNaN(start.getTime()))
      return toast.error("Date invalide", "Format YYYY-MM-DDTHH:MM");

    const dur = Number(durationHours);
    if (!dur || dur <= 0)
      return toast.error("Durée invalide", "Mets une durée correcte.");

    const end = new Date(start.getTime() + dur * 60 * 60 * 1000);

    const payload = {
      title,
      client_id: selectedClient.id,
      employee_ids: selectedEmployeeIds,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: Number(price) || 0,
      status: "planned",
    };

    mutation.mutate(payload);
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="max-w-2xl w-full self-center rounded-[40px] overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <Text className="text-2xl font-extrabold text-foreground dark:text-white text-center">
              Planifier
            </Text>
            <Text className="mt-1 text-muted-foreground text-center font-medium">
              Nouvelle intervention
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

              <View className="flex-row gap-3">
                <Input
                  label="Durée (heures)"
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="numeric"
                  containerStyle={{
                    flex: 1,
                    marginLeft: isWeb ? 0 : -22,
                    marginRight: isWeb ? 0 : 15,
                  }}
                />

                <Input
                  label="Prix estimé (€)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  containerStyle={{
                    flex: 1,
                    marginRight: isWeb ? 0 : 7,
                  }}
                />
              </View>
            </View>

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
                  {mutation.isPending ? "Envoi..." : "Valider"}
                </Button>
              </View>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
