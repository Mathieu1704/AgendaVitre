import React, { useState } from "react";
import { View, ScrollView, Alert, Pressable } from "react-native";
import { Appbar, TextInput, Button, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { useColorScheme } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

export default function AddClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async (newClient: any) => {
      return await api.post("/api/clients/", newClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
    <View className={`flex-1 ${isDark ? "bg-dark-900" : "bg-gray-50"}`}>
      {/* Header */}
      <Appbar.Header
        style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title="Nouveau Client"
          titleStyle={{ fontWeight: "bold" }}
        />
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Hero Card */}
        <View
          className={`mb-6 p-6 rounded-2xl ${
            isDark ? "bg-dark-800" : "bg-white"
          } shadow-lg items-center`}
        >
          <View className="bg-primary-500 w-20 h-20 rounded-full items-center justify-center mb-4">
            <FontAwesome name="user-plus" size={32} color="#FFFFFF" />
          </View>
          <Text
            className={`text-lg font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Ajouter un nouveau client
          </Text>
          <Text
            className={`mt-2 text-center ${
              isDark ? "text-dark-400" : "text-gray-500"
            }`}
          >
            Renseignez les informations du client
          </Text>
        </View>

        {/* Formulaire */}
        <View
          className={`p-6 rounded-2xl ${
            isDark ? "bg-dark-800" : "bg-white"
          } shadow-md`}
        >
          {/* Champs obligatoires */}
          <View className="mb-6">
            <Text
              className={`text-xs font-semibold ${
                isDark ? "text-dark-400" : "text-gray-500"
              } mb-3 uppercase tracking-wide`}
            >
              Informations obligatoires
            </Text>

            <TextInput
              label="Nom du client / Entreprise"
              value={name}
              onChangeText={setName}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
              className="mb-4"
              outlineColor={isDark ? "#475569" : "#E2E8F0"}
              activeOutlineColor="#3B82F6"
              style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
              theme={{
                colors: {
                  onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                  onSurface: isDark ? "#E2E8F0" : "#1F2937",
                },
              }}
            />

            <TextInput
              label="Adresse complète"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              multiline
              numberOfLines={3}
              left={<TextInput.Icon icon="map-marker" />}
              outlineColor={isDark ? "#475569" : "#E2E8F0"}
              activeOutlineColor="#3B82F6"
              style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
              theme={{
                colors: {
                  onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                  onSurface: isDark ? "#E2E8F0" : "#1F2937",
                },
              }}
            />
          </View>

          {/* Champs optionnels */}
          <View
            className={`pt-6 border-t ${
              isDark ? "border-dark-700" : "border-gray-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                isDark ? "text-dark-400" : "text-gray-500"
              } mb-3 uppercase tracking-wide`}
            >
              Coordonnées (optionnel)
            </Text>

            <TextInput
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" />}
              className="mb-4"
              outlineColor={isDark ? "#475569" : "#E2E8F0"}
              activeOutlineColor="#3B82F6"
              style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
              theme={{
                colors: {
                  onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                  onSurface: isDark ? "#E2E8F0" : "#1F2937",
                },
              }}
            />

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" />}
              className="mb-4"
              outlineColor={isDark ? "#475569" : "#E2E8F0"}
              activeOutlineColor="#3B82F6"
              style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
              theme={{
                colors: {
                  onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                  onSurface: isDark ? "#E2E8F0" : "#1F2937",
                },
              }}
            />

            <TextInput
              label="Notes internes"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              left={<TextInput.Icon icon="note-text" />}
              outlineColor={isDark ? "#475569" : "#E2E8F0"}
              activeOutlineColor="#3B82F6"
              style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
              theme={{
                colors: {
                  onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                  onSurface: isDark ? "#E2E8F0" : "#1F2937",
                },
              }}
            />
          </View>
        </View>

        {/* Action Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={mutation.isPending}
          className="mt-6 bg-primary-500 rounded-2xl p-5 shadow-lg active:scale-98 items-center justify-center"
        >
          {mutation.isPending ? (
            <View className="flex-row items-center">
              <Text className="text-white text-lg font-bold mr-3">
                Création en cours...
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <FontAwesome name="check" size={20} color="#FFFFFF" />
              <Text className="ml-3 text-white text-lg font-bold">
                Enregistrer le Client
              </Text>
            </View>
          )}
        </Pressable>

        {/* Helper Text */}
        <Text
          className={`mt-4 text-center text-xs ${
            isDark ? "text-dark-400" : "text-gray-500"
          }`}
        >
          Les champs avec * sont obligatoires
        </Text>
      </ScrollView>
    </View>
  );
}
