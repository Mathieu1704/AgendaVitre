import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import {
  User,
  Lock,
  Save,
  LogOut,
  UserPlus,
  ChevronRight,
  Users,
  Briefcase,
  Info,
} from "lucide-react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Input } from "../../../src/ui/components/Input";
import { Avatar } from "../../../src/ui/components/Avatar";
import { toast } from "../../../src/ui/toast";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { api } from "../../../src/lib/api";

export default function ParametresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const scrollRef = useRef<ScrollView>(null);

  // États User
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Gestion Mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Force le scroll en haut dès l'arrivée
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: false });
      }

      return () => {
        setNewPassword("");
        setConfirmPassword("");
      };
    }, []),
  );

  // Charger le profil réel
  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // On récupère aussi les infos étendues (role, nom) depuis notre API
        try {
          const res = await api.get("/api/employees"); // Idéalement endpoint /me, mais on filtre ici
          const myProfile = res.data.find((e: any) => e.email === user.email);
          setProfile({ ...user, ...myProfile });
        } catch (e) {
          setProfile(user); // Fallback sur user auth
        }
      }
      setLoadingProfile(false);
    };
    loadProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return toast.error("Erreur", "Minimum 6 caractères.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Erreur", "Les mots de passe ne correspondent pas.");
    }

    setLoadingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast.success("Succès", "Mot de passe mis à jour !");
      setNewPassword("");
      setConfirmPassword("");
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
    <View className="flex-row items-center mb-1 mt-1 gap-3">
      <Icon size={24} color="#3B82F6" />
      <Text className="text-lg font-bold text-foreground dark:text-white">
        {title}
      </Text>
    </View>
  );

  const isAdmin = profile?.role === "admin";

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

      {loadingProfile ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        >
          {/* 2. PROFIL */}
          <Card className="mb-6 rounded-[32px] overflow-hidden">
            <CardHeader className="p-6 pb-4">
              <SectionTitle icon={User} title="Mon Profil" />
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <View className="flex-row items-center mb-6">
                <Avatar
                  name={profile?.full_name || profile?.email || "?"}
                  size="lg"
                />
                <View className="ml-4 flex-1">
                  <Text className="text-xl font-bold text-foreground dark:text-white">
                    {profile?.full_name || "Utilisateur"}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Briefcase size={14} color="#94A3B8" />
                    <Text className="text-muted-foreground ml-1 capitalize">
                      {profile?.role === "admin" ? "Administrateur" : "Employé"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bloc Email arrondi */}
              <View className="bg-muted/50 p-4 rounded-[24px]">
                <Text className="text-xs text-muted-foreground uppercase font-bold mb-1">
                  Email de connexion
                </Text>
                <Text className="text-base font-medium text-foreground dark:text-white">
                  {profile?.email}
                </Text>
              </View>
            </CardContent>
          </Card>

          {/* === SECTION ADMIN (Visible seulement si Admin) === */}
          {isAdmin && (
            <View className="mb-8">
              <Text className="text-xs font-bold uppercase text-muted-foreground mb-3 px-4">
                Administration
              </Text>

              {/* Ajouter Employé */}
              <Pressable
                onPress={() =>
                  router.push("/(app)/parametres/create-employee" as any)
                }
                className="mb-3"
              >
                {/* ✅ Card arrondie */}
                <Card className="rounded-[32px] bg-blue-500/5 border-blue-200 dark:border-blue-900 active:scale-[0.99] transition-transform overflow-hidden">
                  <CardContent className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4 flex-1">
                      {/* Icône Ronde */}
                      <View className="bg-blue-500 rounded-full w-12 h-12 items-center justify-center">
                        <UserPlus size={24} color="white" />
                      </View>
                      {/* Textes Centrés */}
                      <View className="flex-1 justify-center">
                        <Text className="text-lg font-bold text-foreground dark:text-white leading-tight">
                          Ajouter un employé
                        </Text>
                        <Text className="text-sm text-muted-foreground leading-tight">
                          Créer un nouveau compte
                        </Text>
                      </View>
                    </View>
                    <ChevronRight
                      size={20}
                      color={isDark ? "white" : "black"}
                    />
                  </CardContent>
                </Card>
              </Pressable>

              {/* Gérer Équipe */}
              <Pressable
                onPress={() => router.push("/(app)/parametres/team" as any)}
              >
                {/* ✅ Card arrondie */}
                <Card className="rounded-[32px] bg-purple-500/5 border-purple-200 dark:border-purple-900 active:scale-[0.99] transition-transform overflow-hidden">
                  <CardContent className="p-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4 flex-1">
                      <View className="bg-purple-500 rounded-full w-12 h-12 items-center justify-center">
                        <Users size={24} color="white" />
                      </View>
                      <View className="flex-1 justify-center">
                        <Text className="text-lg font-bold text-foreground dark:text-white leading-tight">
                          Gérer l'équipe
                        </Text>
                        <Text className="text-sm text-muted-foreground leading-tight">
                          Horaires, Reset MDP...
                        </Text>
                      </View>
                    </View>
                    <ChevronRight
                      size={20}
                      color={isDark ? "white" : "black"}
                    />
                  </CardContent>
                </Card>
              </Pressable>
            </View>
          )}

          {/* 3. SECURITÉ */}
          <Card className="mb-8 rounded-[32px] overflow-hidden">
            <CardHeader className="p-6 pb-4">
              <SectionTitle icon={Lock} title="Sécurité" />
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Text className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Pour changer votre mot de passe, entrez le nouveau ci-dessous.
              </Text>

              <View className="gap-2 w-full">
                {/* Champ Nouveau MDP */}
                <View className="w-full">
                  <Input
                    placeholder="Nouveau mot de passe"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                    className="w-full"
                  />
                  {newPassword.length > 0 && newPassword.length < 8 && (
                    <View className="flex-row items-center mt-2 ml-1">
                      <Info size={14} color="#EF4444" />
                      <Text className="text-xs text-destructive ml-1.5 font-medium">
                        8 caractères minimum requis
                      </Text>
                    </View>
                  )}
                </View>

                {/* Champ Confirmation */}
                <View className="w-full">
                  <Input
                    placeholder="Confirmer le nouveau mot de passe"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    className="w-full"
                  />
                  {confirmPassword.length > 0 &&
                    newPassword !== confirmPassword && (
                      <View className="flex-row items-center mt-2 ml-1">
                        <Info size={14} color="#EF4444" />
                        <Text className="text-xs text-destructive ml-1.5 font-medium">
                          Les mots de passe ne correspondent pas
                        </Text>
                      </View>
                    )}
                </View>

                <View className="h-4 w-full" />

                {/* Bouton Mettre à jour (Arrondi) */}
                <Button
                  onPress={handleChangePassword}
                  loading={loadingPass}
                  disabled={
                    !newPassword ||
                    newPassword.length < 8 ||
                    newPassword !== confirmPassword
                  }
                  className="w-full rounded-[28px] h-14"
                >
                  <Save
                    size={18}
                    color={
                      !newPassword ||
                      newPassword.length < 8 ||
                      newPassword !== confirmPassword
                        ? "#9CA3AF"
                        : "white"
                    }
                  />
                  <Text
                    className={`ml-2 font-bold ${!newPassword || newPassword.length < 8 || newPassword !== confirmPassword ? "text-gray-400" : "text-white"}`}
                  >
                    Mettre à jour le mot de passe
                  </Text>
                </Button>
              </View>
            </CardContent>
          </Card>

          {/* 4. DÉCONNEXION (Arrondi) */}
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center justify-center p-4 rounded-[28px] border border-destructive/30 bg-destructive/5 active:bg-destructive/10 h-14"
          >
            <LogOut size={18} color="#EF4444" />
            <Text className="ml-2 text-destructive font-bold">
              Se déconnecter
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
