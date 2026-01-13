import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Appbar, TextInput, Button, HelperText } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";

export default function AddClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Mutation pour envoyer les données au Backend
  const mutation = useMutation({
    mutationFn: async (newClient: any) => {
      return await api.post("/api/clients/", newClient);
    },
    onSuccess: () => {
      // 1. Invalider le cache pour forcer le rechargement de la liste
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      // 2. Revenir en arrière
      Alert.alert("Succès", "Client créé avec succès !");
      router.back();
    },
    onError: (error: any) => {
      Alert.alert(
        "Erreur",
        error.response?.data?.detail || "Impossible de créer le client"
      );
    },
  });

  const handleSubmit = () => {
    if (!name || !address) {
      Alert.alert("Erreur", "Le nom et l'adresse sont obligatoires.");
      return;
    }

    mutation.mutate({
      name,
      address,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nouveau Client" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.form}>
        <TextInput
          label="Nom du client / Entreprise *"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <TextInput
          label="Adresse complète *"
          value={address}
          onChangeText={setAddress}
          multiline
          style={styles.input}
        />

        <TextInput
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Notes internes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={mutation.isPending}
          style={styles.button}
        >
          Enregistrer le Client
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 20 },
  input: { marginBottom: 15, backgroundColor: "white" },
  button: { marginTop: 10, paddingVertical: 6 },
});
