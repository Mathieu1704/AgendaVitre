import React, { useMemo, useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { MultiSelect } from "../../../src/ui/components/MultiSelect"; // ✅ Import du composant
import { toast } from "../../../src/ui/toast";

import {
  parseLocalDateTimeString,
  toLocalDateTimeString,
} from "../../../src/lib/date";
import { useEmployees } from "../../../src/hooks/useEmployees"; // ✅ Import du hook

type Client = { id: string; name: string; address: string };

export default function AddInterventionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Données
  const { employees } = useEmployees();
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients/");
      return res.data as Client[];
    },
  });

  // États Formulaire
  const [title, setTitle] = useState("Lavage Vitres");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // ✅ On stocke une liste d'IDs maintenant
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [price, setPrice] = useState("");

  // Dates
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalDateTimeString(d).replace(" ", "T");
  }, []);
  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("2");

  // Formatage pour les selects
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

  // Mutation (Envoi API)
  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      //  On envoie le tableau employee_ids au backend
      return await api.post("/api/interventions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      // On invalide aussi le planning pour que la jauge se mette à jour
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      toast.success("Succès", "Intervention enregistrée ✅");
      router.back();
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
      employee_ids: selectedEmployeeIds, // ✅ Liste
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: Number(price) || 0,
      status: "planned",
    };

    mutation.mutate(payload);
  };

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="max-w-2xl w-full self-center">
          <CardHeader>
            <Text className="text-2xl font-extrabold text-foreground dark:text-white">
              Planifier
            </Text>
            <Text className="mt-1 opacity-70 text-foreground dark:text-slate-400">
              Nouvelle intervention
            </Text>
          </CardHeader>

          <CardContent className="gap-5">
            {/* CLIENT */}
            <View>
              <Text className="text-xs font-bold uppercase opacity-60 mb-2 text-foreground dark:text-slate-400">
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

            {/* EMPLOYES (MULTI) */}
            <View>
              <Text className="text-xs font-bold uppercase opacity-60 mb-2 text-foreground dark:text-slate-400">
                Qui intervient ?
              </Text>
              <MultiSelect
                items={employeeItems}
                selectedIds={selectedEmployeeIds}
                onChange={setSelectedEmployeeIds}
                label=""
              />
            </View>

            {/* DETAILS */}
            <View className="gap-3 mt-2">
              <Text className="text-xs font-bold uppercase opacity-60 mb-1 text-foreground dark:text-slate-400">
                Quoi & Quand ?
              </Text>

              <Input label="Titre" value={title} onChangeText={setTitle} />

              <View className="flex-row gap-3">
                <View style={{ flex: 2 }}>
                  <Input
                    label="Début (AAAA-MM-JJTHH:MM)"
                    value={startDateStr}
                    onChangeText={setStartDateStr}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Durée (h)"
                    value={durationHours}
                    onChangeText={setDurationHours}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="Prix estimé (€)"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            </View>

            {/* ACTIONS */}
            <View className="mt-6 flex-row gap-3">
              <Button
                variant="outline"
                onPress={() => router.back()}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={mutation.isPending}
                className="flex-1"
              >
                {mutation.isPending ? "Envoi..." : "Valider"}
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
