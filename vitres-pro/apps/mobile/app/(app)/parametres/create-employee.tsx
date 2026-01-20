import React, { useState } from "react";
import { View, Text, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { ChevronLeft, UserPlus } from "lucide-react-native";

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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bienvenue2026!");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [isAdmin, setIsAdmin] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState("38");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Employé créé !");
      // ✅ FIX: Retour vers /parametres au lieu de .back()
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
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800 bg-background dark:bg-slate-950">
        {/* ✅ FIX: Navigation vers /parametres au lieu de .back() */}
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* CARD 1: Identifiants */}
        <Card className="mb-6">
          <CardHeader className="p-6 pb-4 border-b border-border dark:border-slate-800 bg-muted/20">
            <Text className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
              Identifiants
            </Text>
          </CardHeader>
          <CardContent className="p-6 pt-5 gap-5">
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

        {/* CARD 2: Configuration */}
        <Card className="mb-6">
          <CardHeader className="p-6 pb-4 border-b border-border dark:border-slate-800 bg-muted/20">
            <Text className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
              Configuration
            </Text>
          </CardHeader>
          <CardContent className="p-6 pt-5 gap-6">
            {/* ✅ ColorPicker (40 couleurs) */}
            <ColorPicker
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
              label="Couleur Planning"
            />

            <Input
              label="Heures par semaine"
              value={weeklyHours}
              onChangeText={setWeeklyHours}
              keyboardType="numeric"
            />

            <View className="flex-row items-center justify-between pt-2 border-t border-border dark:border-slate-800">
              <View>
                <Text className="text-base font-medium text-foreground dark:text-white">
                  Accès Administrateur
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Peut modifier le planning de tous
                </Text>
              </View>
              <Switch
                value={isAdmin}
                onValueChange={setIsAdmin}
                trackColor={{ false: "#767577", true: "#3B82F6" }}
              />
            </View>
          </CardContent>
        </Card>

        {/* Bouton Submit */}
        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="h-14 bg-primary rounded-xl"
        >
          <UserPlus size={20} color="white" />
          <Text className="ml-2 font-bold text-white text-lg">
            Créer le compte
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
