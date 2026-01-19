import React, { useState } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import {
  User,
  Building2,
  Lock,
  Save,
  LogOut,
  UserPlus,
  ChevronRight,
} from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Input } from "../../../src/ui/components/Input";
import { Avatar } from "../../../src/ui/components/Avatar";
import { toast } from "../../../src/ui/toast";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function ParametresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  // Gestion Mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);

  // Simulation user (A remplacer par un vrai hook useUser() plus tard)
  const userEmail = "admin@lvmagenda.be";

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return toast.error("Erreur", "Minimum 6 caractères.");
    }
    setLoadingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast.success("Succès", "Mot de passe mis à jour !");
      setNewPassword("");
    } catch (e: any) {
      toast.error("Erreur", e.message);
    } finally {
      setLoadingPass(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: any;
    title: string;
  }) => (
    <View className="flex-row items-center mb-4 mt-2">
      <View className="bg-primary/10 p-2 rounded-lg mr-3">
        <Icon size={20} color="#3B82F6" />
      </View>
      <Text className="text-lg font-bold text-foreground dark:text-white">
        {title}
      </Text>
    </View>
  );

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: insets.top }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6 py-4 border-b border-border dark:border-slate-800">
        <Text className="text-2xl font-bold text-foreground dark:text-white">
          Paramètres
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* 1. CARTE ADMIN : AJOUTER EMPLOYÉ */}
        <Pressable
          onPress={() =>
            router.push("/(app)/parametres/create-employee" as any)
          }
          className="mb-6"
        >
          <Card className="bg-blue-500/5 border-blue-200 dark:border-blue-900 active:opacity-90">
            <CardContent className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-4">
                <View className="bg-blue-500 rounded-full p-3">
                  <UserPlus size={24} color="white" />
                </View>
                <View>
                  <Text className="text-lg font-bold text-foreground dark:text-white">
                    Ajouter un employé
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Créer un nouveau compte
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={isDark ? "white" : "black"} />
            </CardContent>
          </Card>
        </Pressable>

        {/* 2. PROFIL */}
        <Card className="mb-6">
          <CardHeader>
            <SectionTitle icon={User} title="Mon Profil" />
          </CardHeader>
          <CardContent>
            <View className="flex-row items-center mb-6">
              <Avatar name="Moi" size="lg" />
              <View className="ml-4">
                <Text className="text-lg font-bold text-foreground dark:text-white">
                  Mon Compte
                </Text>
                <Text className="text-muted-foreground">{userEmail}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 3. SECURITÉ (Changement MDP) */}
        <Card className="mb-6">
          <CardHeader>
            <SectionTitle icon={Lock} title="Sécurité" />
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-muted-foreground mb-3">
              Modifiez votre mot de passe ici. Pas besoin de l'ancien.
            </Text>
            <View className="gap-3">
              <Input
                placeholder="Nouveau mot de passe"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button
                onPress={handleChangePassword}
                loading={loadingPass}
                variant="outline"
              >
                <Save size={16} color={isDark ? "white" : "black"} />
                <Text className="ml-2 font-semibold text-foreground dark:text-white">
                  Mettre à jour le mot de passe
                </Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* 4. DÉCONNEXION */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center p-4 rounded-xl border border-destructive/30 bg-destructive/5 active:bg-destructive/10"
        >
          <LogOut size={18} color="#EF4444" />
          <Text className="ml-2 text-destructive font-bold">
            Se déconnecter
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
