import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/lib/api";
import { ChevronLeft, Check, UserPlus } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";

export default function CreateEmployeeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bienvenue2026!");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [isAdmin, setIsAdmin] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Employé créé !");
      router.push("/(app)/parametres");
    },
    onError: (err: any) => {
      toast.error(
        "Erreur",
        err.response?.data?.detail || "Impossible de créer",
      );
    },
  });

  const handleSubmit = () => {
    if (!email || !password || !fullName)
      return toast.error("Oups", "Tout remplir !");

    mutation.mutate({
      full_name: fullName,
      email,
      password,
      color: selectedColor,
      role: isAdmin ? "admin" : "employee",
      weekly_hours: Number(weeklyHours) || 38,
    });
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      // ✅ Padding Top dynamique (Gestion Notch)
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      {/* Header Simple (Aligné sur Add Client) */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/(app)/parametres")}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Collaborateur
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero Section (Identique Add Client) */}
        <View className="items-center mb-8">
          <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
            <UserPlus size={32} color="#3B82F6" />
          </View>
          <Text className="text-center text-muted-foreground dark:text-slate-400 max-w-xs">
            Créez un accès pour un membre de l'équipe et définissez ses droits.
          </Text>
        </View>

        {/* CARD 1: Identifiants */}
        <Card className="rounded-[32px] overflow-hidden">
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Identifiants
            </Text>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4 gap-4">
            <Input
              label="Nom Complet"
              placeholder="Ex: Thomas Dubuisson"
              value={fullName}
              onChangeText={setFullName}
              containerStyle={{ marginBottom: 8 }} // Espace aéré
            />
            <Input
              label="Email (Login)"
              placeholder="thomas@agenda.be"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              containerStyle={{ marginBottom: 8 }} // Espace aéré
            />
            <Input
              label="Mot de passe provisoire"
              value={password}
              onChangeText={setPassword}
            />
          </CardContent>
        </Card>

        {/* CARD 2: Configuration */}
        <Card className="mt-4 rounded-[32px] overflow-hidden">
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Configuration
            </Text>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4 gap-4">
            <ColorPicker
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
              label="Couleur Planning"
              containerStyle={{ marginBottom: 8 }}
            />

            <Input
              label="Heures par semaine"
              value={weeklyHours}
              onChangeText={setWeeklyHours}
              keyboardType="numeric"
              containerStyle={{ marginBottom: 8 }}
              placeholder="Ex: 38"
            />

            {/* Switch Admin */}
            <View className="flex-row items-center justify-between pt-2 border-t border-border dark:border-slate-800">
              <View className="flex-1 pr-4">
                <Text className="text-base font-medium text-foreground dark:text-white">
                  Accès Administrateur
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Peut modifier le planning de tous
                </Text>
              </View>
              <Switch
                value={isAdmin}
                onValueChange={setIsAdmin}
                trackColor={{ false: "#767577", true: "#22C55E" }}
              />
            </View>
          </CardContent>
        </Card>

        {/* Bouton Submit */}
        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="mt-8 h-14 rounded-[28px]"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 font-bold text-white text-lg">
            Créer le compte
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
