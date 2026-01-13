import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert, Platform } from "react-native";
import {
  Appbar,
  TextInput,
  Button,
  Menu,
  Divider,
  Text,
  List,
  Surface,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

type Client = { id: string; name: string; address: string };

export default function AddInterventionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // États du formulaire
  const [title, setTitle] = useState("Lavage Vitres");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [price, setPrice] = useState("");

  // Gestion Dates (Simple strings pour commencer pour éviter les bugs Web)
  // Format par défaut : Demain à 09:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [startDateStr, setStartDateStr] = useState(
    tomorrow.toISOString().slice(0, 16).replace("T", " ")
  );
  const [durationHours, setDurationHours] = useState("2"); // Durée en heures

  // Gestion du Menu déroulant Clients
  const [showClientMenu, setShowClientMenu] = useState(false);

  // 1. Charger les clients pour la liste déroulante
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients/");
      return res.data as Client[];
    },
  });

  // 2. Mutation pour créer l'intervention
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/interventions/", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      Alert.alert("Succès", "Intervention planifiée !");
      router.back();
    },
    onError: (err: any) => {
      Alert.alert("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (!selectedClient) {
      Alert.alert("Manquant", "Veuillez sélectionner un client.");
      return;
    }

    // Conversion des dates (String "YYYY-MM-DD HH:MM" -> Date Object)
    const start = new Date(startDateStr);
    const end = new Date(
      start.getTime() + parseInt(durationHours) * 60 * 60 * 1000
    );

    // Payload pour FastAPI
    const payload = {
      title,
      client_id: selectedClient.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      price_estimated: parseFloat(price) || 0,
      status: "planned",
    };

    mutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Planifier Intervention" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.form}>
        {/* 1. SÉLECTEUR DE CLIENT */}
        <Text variant="titleMedium" style={styles.label}>
          Client
        </Text>
        <Menu
          visible={showClientMenu}
          onDismiss={() => setShowClientMenu(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setShowClientMenu(true)}
              style={styles.input}
              contentStyle={{ justifyContent: "flex-start" }}
              icon="account"
            >
              {selectedClient
                ? selectedClient.name
                : "Sélectionner un client..."}
            </Button>
          }
        >
          {clients?.map((client) => (
            <Menu.Item
              key={client.id}
              onPress={() => {
                setSelectedClient(client);
                setShowClientMenu(false);
              }}
              title={client.name}
              leadingIcon="account"
            />
          ))}
          {(!clients || clients.length === 0) && (
            <Menu.Item title="Aucun client trouvé" disabled />
          )}
        </Menu>

        {/* 2. INFOS GÉNÉRALES */}
        <TextInput
          label="Titre de l'intervention"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <View style={styles.row}>
          <TextInput
            label="Début (YYYY-MM-DD HH:MM)"
            value={startDateStr}
            onChangeText={setStartDateStr}
            style={[styles.input, { flex: 2, marginRight: 10 }]}
          />
          <TextInput
            label="Durée (Heures)"
            value={durationHours}
            onChangeText={setDurationHours}
            keyboardType="numeric"
            style={[styles.input, { flex: 1 }]}
          />
        </View>

        <TextInput
          label="Prix Estimé (€)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          style={styles.input}
          right={<TextInput.Affix text="€" />}
        />

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={styles.button}
        >
          Valider le Planning
        </Button>

        {selectedClient && (
          <Text style={styles.helper}>
            L'intervention sera liée à : {selectedClient.address}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  form: { padding: 20 },
  input: { marginBottom: 15, backgroundColor: "white" },
  button: { marginTop: 20, paddingVertical: 6 },
  label: { marginBottom: 5, color: "#666" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  helper: {
    marginTop: 20,
    textAlign: "center",
    color: "gray",
    fontStyle: "italic",
  },
});
