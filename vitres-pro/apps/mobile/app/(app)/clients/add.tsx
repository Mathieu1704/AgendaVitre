import React, { useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { UserPlus, Check, ChevronLeft } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function AddClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async (newClient: any) => {
      return await api.post("/api/clients", newClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Succès", "Client créé avec succès !");
      router.back();
    },
    onError: (error: any) => {
      toast.error("Erreur", error.response?.data?.detail || "Erreur inconnue");
    },
  });

  const handleSubmit = () => {
    if (!name || !address) {
      toast.error("Erreur", "Le nom et l'adresse sont obligatoires.");
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
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header Simple */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Client
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero */}
        <View className="items-center mb-8">
          <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
            <UserPlus size={32} color="#3B82F6" />
          </View>
          <Text className="text-center text-muted-foreground dark:text-slate-400 max-w-xs">
            Remplissez les informations ci-dessous pour créer une fiche client.
          </Text>
        </View>

        <Card>
          <CardHeader className="p-6 pb-4">
            <Text className="text-sm font-bold uppercase text-muted-foreground dark:text-slate-500 tracking-wider">
              Informations Principales
            </Text>
          </CardHeader>
          <CardContent className="p-6 pt-0 gap-4">
            <Input
              label="Nom / Entreprise *"
              placeholder="Ex: Jean Dupont"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Adresse complète *"
              placeholder="10 Rue de la Paix, Paris"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              className="h-20 py-2"
            />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="p-6 pb-4">
            <Text className="text-sm font-bold uppercase text-muted-foreground dark:text-slate-500 tracking-wider">
              Coordonnées & Notes
            </Text>
          </CardHeader>
          <CardContent className="p-6 pt-0 gap-4">
            <Input
              label="Téléphone"
              placeholder="06 12 34 56 78"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Email"
              placeholder="client@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Notes internes"
              placeholder="Code porte, préférences..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              className="h-24 py-2"
            />
          </CardContent>
        </Card>

        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="mt-8"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 text-white font-bold text-lg">
            Enregistrer le client
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
