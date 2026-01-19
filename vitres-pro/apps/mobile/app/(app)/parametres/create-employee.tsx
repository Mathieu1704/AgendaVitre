import React, { useState } from "react";
import { View, Text, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { ChevronLeft, Check, UserPlus } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function CreateEmployeeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  // Formulaire
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bienvenue2026!"); // MDP par défaut suggéré
  const [color, setColor] = useState("#10B981");
  const [isAdmin, setIsAdmin] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Employé créé ! Donnez-lui ses identifiants.");
      router.back();
    },
    onError: (err: any) => {
      toast.error(
        "Erreur",
        err.response?.data?.detail || "Impossible de créer",
      );
    },
  });

  const handleSubmit = () => {
    if (!email || !password || !fullName) {
      return toast.error("Oups", "Merci de tout remplir.");
    }
    mutation.mutate({
      full_name: fullName,
      email,
      password,
      color,
      role: isAdmin ? "admin" : "employee",
      weekly_hours: 38,
    });
  };

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Collaborateur
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="items-center mb-6">
          <View className="bg-primary/10 w-16 h-16 rounded-full items-center justify-center mb-3">
            <UserPlus size={28} color="#3B82F6" />
          </View>
          <Text className="text-muted-foreground text-center px-4">
            Vous créez le compte. Transmettez ensuite l'email et le mot de passe
            à votre employé.
          </Text>
        </View>

        <Card>
          <CardHeader>
            <Text className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Identifiants de connexion
            </Text>
          </CardHeader>
          <CardContent className="gap-4">
            <Input
              label="Nom Complet"
              placeholder="Ex: Thomas Dubuisson"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              label="Email (Login)"
              placeholder="thomas@agenda.be"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Mot de passe provisoire"
              value={password}
              onChangeText={setPassword}
            />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <Text className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Paramètres
            </Text>
          </CardHeader>
          <CardContent className="gap-4">
            <Input
              label="Couleur Planning (Hex)"
              placeholder="#RRGGBB"
              value={color}
              onChangeText={setColor}
            />

            <View className="flex-row items-center justify-between mt-2">
              <View>
                <Text className="text-base font-medium text-foreground dark:text-white">
                  Accès Administrateur
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Peut tout voir et tout modifier
                </Text>
              </View>
              <Switch value={isAdmin} onValueChange={setIsAdmin} />
            </View>
          </CardContent>
        </Card>

        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="mt-8 h-12"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 font-bold text-white">Créer le compte</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
