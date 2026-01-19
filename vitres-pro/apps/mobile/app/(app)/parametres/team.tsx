import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  MoreVertical,
  ShieldAlert,
  Clock,
  RefreshCcw,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { Card } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Avatar } from "../../../src/ui/components/Avatar";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";

export default function TeamManagementScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  // On récupère tous les employés
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.get("/api/employees");
      return res.data;
    },
  });

  const handleResetPassword = (employeeEmail: string) => {
    // Note: Pour resetter le MDP d'un AUTRE user depuis le client,
    // Supabase Auth côté client ne le permet pas facilement sans email.
    // L'idéal est de passer par une fonction Admin Backend.
    // Pour l'instant, on affiche juste l'info.
    Alert.alert(
      "Réinitialisation",
      "Fonctionnalité en cours de sécurisation backend. Pour l'instant, demandez à l'employé d'utiliser 'Mot de passe oublié' ou recréez le compte.",
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Gestion de l'équipe
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3B82F6" className="mt-10" />
        ) : (
          employees?.map((emp: any) => (
            <Card key={emp.id} className="mb-4 overflow-hidden">
              <View className="flex-row items-center p-4">
                <Avatar
                  name={emp.full_name || emp.email}
                  size="md"
                  className="mr-4"
                />
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground dark:text-white">
                    {emp.full_name || "Sans nom"}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {emp.email}
                  </Text>

                  <View className="flex-row items-center mt-2 gap-3">
                    <View
                      className={`px-2 py-0.5 rounded text-xs ${emp.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      <Text className="text-xs font-bold uppercase">
                        {emp.role}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Clock size={12} color="#94A3B8" />
                      <Text className="text-xs text-muted-foreground ml-1">
                        {emp.weekly_hours}h/sem
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: emp.color }}
                />
              </View>

              {/* Actions Rapides Admin */}
              <View className="flex-row border-t border-border dark:border-slate-800">
                <Pressable
                  onPress={() => handleResetPassword(emp.email)}
                  className="flex-1 p-3 items-center justify-center active:bg-muted"
                >
                  <Text className="text-primary font-bold text-sm">
                    Reset MDP
                  </Text>
                </Pressable>
                <View className="w-[1px] bg-border dark:bg-slate-800" />
                <Pressable
                  onPress={() =>
                    toast.info(
                      "Bientôt",
                      "Modification des heures bientôt dispo",
                    )
                  }
                  className="flex-1 p-3 items-center justify-center active:bg-muted"
                >
                  <Text className="text-foreground dark:text-white font-bold text-sm">
                    Modifier
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
