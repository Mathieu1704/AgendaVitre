import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
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
  History,
  MapPin,
  Clock,
  EyeOff,
} from "lucide-react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Input } from "../../../src/ui/components/Input";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Dialog } from "../../../src/ui/components/Dialog";
import { toast } from "../../../src/ui/toast";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { api } from "../../../src/lib/api";

export default function ParametresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();

  // États User
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Gestion Mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [hideCashModal, setHideCashModal] = useState(false);
  const [hideCash, setHideCash] = useState(false);
  const [savingHideCash, setSavingHideCash] = useState(false);
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: hideCash ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hideCash]);

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
        try {
          const res = await api.get("/api/employees/me");
          setProfile({ ...user, ...res.data });
          if (res.data.role === "admin") {
            try {
              const cs = await api.get("/api/settings/company");
              setHideCash(cs.data.hide_cash ?? false);
            } catch {}
          }
        } catch {
          try {
            const res = await api.get("/api/employees");
            const myProfile = res.data.find((e: any) => e.email === user.email);
            setProfile({ ...user, ...myProfile });
          } catch {
            setProfile(user);
          }
        }
      }
      setLoadingProfile(false);
    };
    loadProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      return toast.error("Erreur", "Minimum 8 caractères.");
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
    color = "#3B82F6",
  }: {
    icon: any;
    title: string;
    color?: string;
  }) => (
    <View className="flex-row items-center mb-1 mt-1 gap-3">
      <Icon size={24} color={color} />
      <Text className="text-lg font-bold text-foreground dark:text-white">
        {title}
      </Text>
    </View>
  );

  const isAdmin = profile?.role === "admin";

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View
        className="px-6 pb-4 bg-background dark:bg-slate-950 z-10"
        style={{ paddingTop: Platform.OS === "web" ? 24 : 10 }}
      >
        <Text className="text-3xl font-bold text-foreground dark:text-slate-50">
          Paramètres
        </Text>
      </View>

      {loadingProfile ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          >
            {/* 2. PROFIL */}
            <Pressable
              onLongPress={() => isAdmin && setHideCashModal(true)}
              delayLongPress={600}
              style={({ pressed }) => ({ opacity: 1 })}
              android_disableSound
            >
            <Card className="mb-6 rounded-[32px] overflow-hidden">
              <CardHeader className="p-6 pb-4">
                <SectionTitle
                  icon={User}
                  title="Mon Profil"
                  color={profile?.color || "#3B82F6"}
                />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <View className="flex-row items-center mb-6">
                  <Avatar
                    name={profile?.full_name || profile?.email || "?"}
                    size="lg"
                    color={profile?.color}
                  />
                  <View className="ml-4 flex-1">
                    <Text className="text-xl font-bold text-foreground dark:text-white">
                      {profile?.full_name || "Utilisateur"}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Briefcase size={14} color="#94A3B8" />
                      <Text className="text-muted-foreground ml-1 capitalize">
                        {profile?.role === "admin"
                          ? "Administrateur"
                          : "Employé"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bloc Email arrondi */}
                <View
                  className="bg-muted/50 p-4 rounded-[24px]"
                  style={{
                    borderWidth: 1,
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  }}
                >
                  <Text className="text-xs text-muted-foreground uppercase font-bold mb-1">
                    Email de connexion
                  </Text>
                  <Text className="text-base font-medium text-foreground dark:text-white">
                    {profile?.email}
                  </Text>
                </View>
              </CardContent>
            </Card>
            </Pressable>

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
                  <Card
                    className="rounded-[32px] bg-blue-500/5 border-blue-200 dark:border-blue-900 active:scale-[0.99] transition-transform overflow-hidden"
                    style={{ backgroundColor: "rgba(59,130,246,0.05)" }}
                  >
                    <CardContent className="p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        {/* Icône Ronde */}
                        <View className="bg-blue-500 rounded-full w-12 h-12 items-center justify-center">
                          <UserPlus
                            size={24}
                            color="white"
                            style={{ marginLeft: 4 }}
                          />
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
                  className="mb-3"
                >
                  {/* ✅ Card arrondie */}
                  <Card
                    className="rounded-[32px] bg-purple-500/5 border-purple-200 dark:border-purple-900 active:scale-[0.99] transition-transform overflow-hidden"
                    style={{ backgroundColor: "rgba(168,85,247,0.05)" }}
                  >
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
                {/* Zones géographiques */}
                <Pressable
                  onPress={() => router.push("/(app)/parametres/zones" as any)}
                  className="mb-3"
                >
                  <Card
                    className="rounded-[32px] bg-emerald-500/5 border-emerald-200 dark:border-emerald-900 active:scale-[0.99] transition-transform overflow-hidden"
                    style={{ backgroundColor: "rgba(16,185,129,0.05)" }}
                  >
                    <CardContent className="p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        <View className="bg-emerald-500 rounded-full w-12 h-12 items-center justify-center">
                          <MapPin size={24} color="white" />
                        </View>
                        <View className="flex-1 justify-center">
                          <Text className="text-lg font-bold text-foreground dark:text-white leading-tight">
                            Zones géographiques
                          </Text>
                          <Text className="text-sm text-muted-foreground leading-tight">
                            Gérer les sous-zones et villes
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
                {/* Taux horaires */}
                <Pressable
                  onPress={() => router.push("/(app)/parametres/tarifs" as any)}
                  className="mb-3"
                >
                  <Card
                    className="rounded-[32px] bg-orange-500/5 border-orange-200 dark:border-orange-900 active:scale-[0.99] transition-transform overflow-hidden"
                    style={{ backgroundColor: "rgba(249,115,22,0.05)" }}
                  >
                    <CardContent className="p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        <View className="bg-orange-500 rounded-full w-12 h-12 items-center justify-center">
                          <Clock size={24} color="white" />
                        </View>
                        <View className="flex-1 justify-center">
                          <Text className="text-lg font-bold text-foreground dark:text-white leading-tight">
                            Taux horaires
                          </Text>
                          <Text className="text-sm text-muted-foreground leading-tight">
                            Gérer les tarifs €/h
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
                {/* Historique des actions */}
                <Pressable
                  onPress={() => router.push("/(app)/parametres/logs" as any)}
                >
                  <Card
                    className="rounded-[32px] bg-amber-500/5 border-amber-200 dark:border-amber-900 active:scale-[0.99] transition-transform overflow-hidden"
                    style={{ backgroundColor: "rgba(245,158,11,0.05)" }}
                  >
                    <CardContent className="p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-4 flex-1">
                        <View className="bg-amber-500 rounded-full w-12 h-12 items-center justify-center">
                          <History size={24} color="white" />
                        </View>
                        <View className="flex-1 justify-center">
                          <Text className="text-lg font-bold text-foreground dark:text-white leading-tight">
                            Historique
                          </Text>
                          <Text className="text-sm text-muted-foreground leading-tight">
                            Actions, modifications, statuts
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
              onPress={() => setLogoutDialog(true)}
              className="flex-row items-center justify-center p-4 rounded-[28px] border border-destructive/30 bg-destructive/5 active:bg-destructive/10 h-14"
            >
              <LogOut size={18} color="#EF4444" />
              <Text className="ml-2 text-destructive font-bold">
                Se déconnecter
              </Text>
            </Pressable>

            {/* Lien confidentialité discret */}
            <View style={{ marginTop: 20, alignItems: "center" }}>
              <Text
                onPress={() => setPrivacyVisible(true)}
                style={{ fontSize: 12, color: isDark ? "#475569" : "#94A3B8", paddingVertical: 8 }}
              >
                Politique de confidentialité
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Modal Politique de confidentialité */}
      {privacyVisible && (
        <Dialog open onClose={() => setPrivacyVisible(false)}>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#F8FAFC" : "#09090B", marginBottom: 16 }}>
              Politique de confidentialité
            </Text>

            <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Données collectées
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? "#CBD5E1" : "#475569", lineHeight: 20, marginBottom: 16 }}>
              Cette application collecte votre adresse e-mail, votre nom et numéro de téléphone dans le cadre de votre compte employé.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Utilisation
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? "#CBD5E1" : "#475569", lineHeight: 20, marginBottom: 16 }}>
              Vos données sont utilisées uniquement pour le fonctionnement de l'application. Elles ne sont pas partagées avec des tiers ni utilisées à des fins publicitaires.
            </Text>

            <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Suppression
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? "#CBD5E1" : "#475569", lineHeight: 20, marginBottom: 20 }}>
              Pour supprimer vos données, contactez{" "}
              <Text style={{ fontWeight: "700" }}>max.berdoux@gmail.com</Text>
            </Text>

            <Pressable
              onPress={() => setPrivacyVisible(false)}
              style={({ pressed }) => ({
                height: 48, borderRadius: 24,
                backgroundColor: pressed ? "#2563EB" : "#3B82F6",
                alignItems: "center", justifyContent: "center",
              })}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Fermer</Text>
            </Pressable>
          </View>
        </Dialog>
      )}

      {/* Confirmation déconnexion */}
      {logoutDialog && (
        <Dialog open onClose={() => setLogoutDialog(false)}>
          <View className="p-5">
            <Text className="text-lg font-bold text-foreground dark:text-white mb-2">
              Se déconnecter ?
            </Text>
            <Text className="text-muted-foreground dark:text-slate-400 mb-6">
              Vous devrez vous reconnecter pour accéder à l'application.
            </Text>
            <View className="flex-row gap-3">
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => setLogoutDialog(false)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  className="h-12 rounded-[24px] border border-border dark:border-slate-700 items-center justify-center"
                >
                  <Text className="font-bold text-foreground dark:text-white">
                    Annuler
                  </Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  className="h-12 rounded-[24px] bg-red-500 items-center justify-center"
                >
                  <Text className="font-bold text-white">Se déconnecter</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Dialog>
      )}

      {/* Modale hide_cash (admin, long press sur Mon Profil) */}
      {hideCashModal && (
        <Dialog open onClose={() => setHideCashModal(false)} maxWidth={280}>
          <View style={{ alignItems: "center", paddingVertical: 28, paddingHorizontal: 32, gap: 28 }}>
            {/* Toggle custom natif */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Text style={{
                fontSize: 15, fontWeight: "700",
                color: !hideCash ? (isDark ? "#F1F5F9" : "#0F172A") : "#94A3B8",
              }}>OFF</Text>
              <Pressable
                onPress={() => setHideCash(v => !v)}
                style={{
                  width: 58, height: 32, borderRadius: 16,
                  backgroundColor: hideCash ? "#EF4444" : "#E2E8F0",
                  justifyContent: "center",
                  padding: 3,
                }}
              >
                <Animated.View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: "white",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                  transform: [{
                    translateX: toggleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 26],
                    }),
                  }],
                }} />
              </Pressable>
              <Text style={{
                fontSize: 15, fontWeight: "700",
                color: hideCash ? "#EF4444" : "#94A3B8",
              }}>ON</Text>
            </View>

            {/* Bouton confirmer */}
            <Pressable
              onPress={async () => {
                setSavingHideCash(true);
                try {
                  await api.patch("/api/settings/company", { hide_cash: hideCash });
                  queryClient.invalidateQueries({ queryKey: ["company-settings"] });
                  setHideCashModal(false);
                } catch {
                  toast.error("Erreur", "Impossible de modifier le réglage.");
                } finally {
                  setSavingHideCash(false);
                }
              }}
              disabled={savingHideCash}
              style={{
                backgroundColor: "#3B82F6",
                borderRadius: 20,
                paddingVertical: 12,
                paddingHorizontal: 40,
                opacity: savingHideCash ? 0.6 : 1,
              }}
            >
              {savingHideCash
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Confirmer</Text>}
            </Pressable>
          </View>
        </Dialog>
      )}
    </View>
  );
}
