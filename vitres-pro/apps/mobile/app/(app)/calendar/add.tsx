// apps/mobile/app/(app)/calendar/add.tsx
import React, { useMemo, useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { Select } from "../../../src/ui/components/Select";
import { toast } from "../../../src/ui/toast";

import {
  parseLocalDateTimeString,
  toLocalDateTimeString,
} from "../../../src/lib/date";

type Client = { id: string; name: string; address: string };

export default function AddInterventionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("Lavage Vitres");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [price, setPrice] = useState("");

  // ✅ Default: demain 09:00 au format "YYYY-MM-DDTHH:MM" (stable web + app)
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalDateTimeString(d).replace(" ", "T");
  }, []);

  const [startDateStr, setStartDateStr] = useState(defaultStart);
  const [durationHours, setDurationHours] = useState("2");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients/");
      return res.data as Client[];
    },
  });

  const clientItems = useMemo(
    () =>
      (clients ?? []).map((c) => ({
        id: c.id,
        label: c.name,
      })),
    [clients]
  );

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post("/api/interventions/", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Intervention planifiée", "C’est enregistré ✅");
      router.back();
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (!selectedClient) {
      toast.error("Manquant", "Sélectionne un client.");
      return;
    }

    // parseLocalDateTimeString accepte "YYYY-MM-DD HH:MM" ou "YYYY-MM-DDTHH:MM"
    const start = parseLocalDateTimeString(startDateStr);
    if (!start || Number.isNaN(start.getTime())) {
      toast.error("Date invalide", "Utilise le format YYYY-MM-DDTHH:MM");
      return;
    }

    const dur = Math.max(0, Number(durationHours || 0));
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error("Durée invalide", "Mets un nombre d’heures > 0.");
      return;
    }

    const end = new Date(start.getTime() + dur * 60 * 60 * 1000);

    const payload = {
      title,
      client_id: selectedClient.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: Number(price) || 0,
      status: "planned",
    };

    mutation.mutate(payload);
  };

  return (
    <View className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Card className="max-w-2xl w-full self-center">
          <CardHeader>
            <Text className="text-2xl font-extrabold text-fg dark:text-fg-dark">
              Planifier une intervention
            </Text>
            <Text className="mt-2 opacity-70 text-fg dark:text-fg-dark">
              Choisis un client, une date, une durée et valide.
            </Text>
          </CardHeader>

          <CardContent>
            <Text className="text-xs font-bold uppercase opacity-60 mb-2 text-fg dark:text-fg-dark">
              Client
            </Text>

            <Select
              title="Choisir un client"
              placeholder="Sélectionner un client…"
              value={
                selectedClient
                  ? { id: selectedClient.id, label: selectedClient.name }
                  : null
              }
              items={clientItems}
              onChange={(v) => {
                const c = (clients ?? []).find((x) => x.id === v.id);
                if (c) setSelectedClient(c);
              }}
            />

            {selectedClient?.address ? (
              <Text className="mt-2 text-xs opacity-70 text-fg dark:text-fg-dark">
                Adresse : {selectedClient.address}
              </Text>
            ) : null}

            <View className="mt-6">
              <Text className="text-xs font-bold uppercase opacity-60 mb-2 text-fg dark:text-fg-dark">
                Détails
              </Text>

              <Input
                placeholder="Titre"
                value={title}
                onChangeText={setTitle}
                className="mb-3"
              />

              <View className="flex-row gap-3">
                <View style={{ flex: 2 }}>
                  <Input
                    placeholder="Début (YYYY-MM-DDTHH:MM)"
                    value={startDateStr}
                    onChangeText={setStartDateStr}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Durée (h)"
                    value={durationHours}
                    onChangeText={setDurationHours}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                placeholder="Prix estimé (€)"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                className="mt-3"
              />
            </View>

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
                className={mutation.isPending ? "opacity-70 flex-1" : "flex-1"}
              >
                {mutation.isPending ? "Création…" : "Valider"}
              </Button>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
