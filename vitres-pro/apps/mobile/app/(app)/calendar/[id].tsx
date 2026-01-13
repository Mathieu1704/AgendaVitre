// C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\mobile\app\(app)\calendar\[id].tsx
import React from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import {
  Appbar,
  Text,
  Button,
  Card,
  Divider,
  Chip,
  ActivityIndicator,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

export default function InterventionDetailScreen() {
  const { id } = useLocalSearchParams(); // Récupère l'ID depuis l'URL
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Récupérer les détails de l'intervention
  const {
    data: intervention,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      // Note: Il faudra créer cette route GET /api/interventions/{id} dans le backend juste après !
      // Pour l'instant on va tricher en filtrant la liste globale si tu veux,
      // ou mieux : on implémente la route Backend dédiée (recommandé).
      const res = await api.get(`/api/interventions/${id}`);
      return res.data;
    },
  });

  // 2. Mutation pour changer le statut (Start / Finish)
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const now = new Date().toISOString();
      const payload: any = { status: newStatus };

      // Logique Check-in / Check-out
      if (newStatus === "in_progress") payload.real_start_time = now;
      if (newStatus === "done") payload.real_end_time = now;

      return await api.patch(`/api/interventions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] }); // Rafraichir le calendrier
      Alert.alert("Succès", "Statut mis à jour !");
    },
    onError: (err: any) => {
      Alert.alert("Erreur", "Impossible de mettre à jour le statut.");
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (!intervention)
    return <Text style={styles.center}>Intervention introuvable.</Text>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned":
        return "#2196F3"; // Bleu
      case "in_progress":
        return "#FF9800"; // Orange
      case "done":
        return "#4CAF50"; // Vert
      default:
        return "gray";
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Détails Intervention" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {/* CARTE D'INFO PRINCIPALE */}
        <Card style={styles.card}>
          <Card.Title
            title={intervention.title}
            subtitle={intervention.status}
          />
          <Card.Content>
            <Chip
              icon="information"
              style={{
                backgroundColor: getStatusColor(intervention.status),
                marginBottom: 10,
              }}
            >
              Statut : {intervention.status.toUpperCase()}
            </Chip>

            <Text variant="titleMedium" style={{ marginTop: 10 }}>
              📅 Date prévue
            </Text>
            <Text>{new Date(intervention.start_time).toLocaleString()}</Text>

            <Divider style={styles.divider} />

            <Text variant="titleMedium">👤 Client</Text>
            <Text style={{ fontWeight: "bold" }}>
              {intervention.client?.name}
            </Text>
            <Text>{intervention.client?.address}</Text>
          </Card.Content>
        </Card>

        {/* ACTIONS CHECK-IN / CHECK-OUT */}
        <View style={styles.actions}>
          {intervention.status === "planned" && (
            <Button
              mode="contained"
              icon="play"
              buttonColor="#FF9800"
              contentStyle={{ height: 50 }}
              onPress={() => statusMutation.mutate("in_progress")}
              loading={statusMutation.isPending}
            >
              Démarrer l'intervention (Check-in)
            </Button>
          )}

          {intervention.status === "in_progress" && (
            <Button
              mode="contained"
              icon="check"
              buttonColor="#4CAF50"
              contentStyle={{ height: 50 }}
              onPress={() => statusMutation.mutate("done")}
              loading={statusMutation.isPending}
            >
              Terminer (Check-out)
            </Button>
          )}

          {intervention.status === "done" && (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{ color: "green", fontWeight: "bold", fontSize: 18 }}
              >
                ✅ Intervention Terminée
              </Text>
              {intervention.real_end_time && (
                <Text>
                  Finie à :{" "}
                  {new Date(intervention.real_end_time).toLocaleTimeString()}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 15 },
  card: { marginBottom: 20, backgroundColor: "white" },
  divider: { marginVertical: 15 },
  actions: { marginTop: 10 },
});
