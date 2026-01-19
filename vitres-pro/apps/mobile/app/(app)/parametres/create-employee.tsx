import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { ChevronLeft, Check, UserPlus } from "lucide-react-native";

import { Card, CardContent } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

// Palette de couleurs prédéfinie
const COLORS = [
  "#3B82F6", // Bleu (Défaut)
  "#10B981", // Vert
  "#F59E0B", // Orange
  "#EF4444", // Rouge
  "#8B5CF6", // Violet
  "#EC4899", // Rose
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

export default function CreateEmployeeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bienvenue2026!");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState("38");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Employé créé !");
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
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800 bg-background dark:bg-slate-950">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Collaborateur
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Card className="mb-6">
          <View className="p-4 border-b border-border dark:border-slate-800 bg-muted/20">
            <Text className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
              Identifiants
            </Text>
          </View>
          <CardContent className="gap-5 pt-5">
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

        <Card className="mb-6">
          <View className="p-4 border-b border-border dark:border-slate-800 bg-muted/20">
            <Text className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
              Configuration
            </Text>
          </View>
          <CardContent className="gap-6 pt-5">
            {/* Color Picker */}
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-white mb-3">
                Couleur Planning
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-10 h-10 rounded-full items-center justify-center ${selectedColor === c ? "border-2 border-white ring-2 ring-primary" : ""}`}
                  >
                    {selectedColor === c && (
                      <Check size={16} color="white" strokeWidth={3} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

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
              <Switch value={isAdmin} onValueChange={setIsAdmin} />
            </View>
          </CardContent>
        </Card>

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
