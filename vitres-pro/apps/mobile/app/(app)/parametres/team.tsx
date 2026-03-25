import React, { useState, useRef } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  useWindowDimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock,
  UserCog,
  Thermometer,
  Trash2,
  Phone,
  KeyRound,
} from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../../src/lib/api";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { Input } from "../../../src/ui/components/Input";
import { Select } from "../../../src/ui/components/Select";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";
import { toISODate } from "../../../src/lib/date";

// Petit helper pour les initiales
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function TeamManagementScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";
  const { height: screenHeight } = useWindowDimensions();

  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [weeklyHours, setWeeklyHours] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [editPhone, setEditPhone] = useState("");
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [resetEmp, setResetEmp] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const modalScrollRef = useRef<ScrollView>(null);
  const absenceAnim = useRef(new Animated.Value(0)).current;

  const toggleAbsenceForm = () => {
    if (showAbsenceForm) {
      setShowAbsenceForm(false);
      Animated.timing(absenceAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    } else {
      setShowAbsenceForm(true);
      Animated.timing(absenceAnim, { toValue: 1, duration: 280, useNativeDriver: false }).start(() => {
        setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 50);
      });
    }
  };
  const [absStart, setAbsStart] = useState(toISODate(new Date()));
  const [absEnd, setAbsEnd] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toISODate(tomorrow);
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/api/employees")).data,
  });

  const roleItems = [
    { id: "admin", label: "Administrateur" },
    { id: "employee", label: "Employé" },
  ];

  const updateMutation = useMutation({
    mutationFn: (p: any) => api.patch(`/api/employees/${editingEmp.id}`, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Profil mis à jour");
      setEditingEmp(null);
    },
  });

  const { data: absences } = useQuery({
    queryKey: ["absences", editingEmp?.id],
    queryFn: async () => (await api.get(`/api/absences/employee/${editingEmp.id}`)).data,
    enabled: !!editingEmp?.id,
  });

  const absenceMutation = useMutation({
    mutationFn: (p: any) => api.post("/api/absences", p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences", editingEmp?.id] });
      toast.success("Enregistré", "Absence prise en compte");
      toggleAbsenceForm();
    },
  });

  const deleteAbsenceMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/absences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences", editingEmp?.id] });
      toast.success("Supprimé", "Absence supprimée");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (password: string) =>
      api.post(`/api/employees/${resetEmp.id}/reset-password`, { password }),
    onSuccess: () => {
      toast.success("Succès", "Mot de passe réinitialisé");
      setResetEmp(null);
      setNewPassword("");
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    },
  });

  // SUPPRESSION
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Supprimé", "L'employé a été supprimé définitivement.");
      setEditingEmp(null);
    },
    onError: (err: any) => {
      // ✅ MODIF ICI : On affiche le vrai message du serveur
      const message = err.response?.data?.detail || "Erreur inconnue";
      toast.error("Erreur", message);
    },
  });

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp);
    setWeeklyHours(emp.weekly_hours.toString());
    setSelectedColor(emp.color);
    setSelectedRole(roleItems.find((r) => r.id === emp.role));
    setEditPhone(emp.phone || "");
    setShowAbsenceForm(false);
    setAbsStart(toISODate(new Date()));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setAbsEnd(toISODate(tomorrow));
  };

  const handleDeletePress = () => {
    if (Platform.OS === "web") {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        "Supprimer l'employé",
        "Êtes-vous sûr ? Cette action est irréversible et supprimera son accès.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => deleteMutation.mutate(editingEmp.id),
          },
        ],
      );
    }
  };

  // Style commun pour les labels afin de garantir l'alignement et la typo
  const labelClass =
    "text-sm font-semibold text-foreground dark:text-white mb-1.5";

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      // ✅ Padding Top dynamique pour le Notch
      style={{
        paddingTop: isWeb ? 0 : insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/(app)/parametres")}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Gestion de l'équipe
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3B82F6" className="mt-10" />
        ) : (
          [...(employees || [])]
            .sort((a: any, b: any) => {
              // 1. Admins en premier
              const roleOrder = (r: string) => (r === "admin" ? 0 : 1);
              if (roleOrder(a.role) !== roleOrder(b.role))
                return roleOrder(a.role) - roleOrder(b.role);
              // 2. Hainaut avant Ardennes (pour les employés)
              if (a.role !== "admin") {
                const zoneOrder = (z: string) => (z === "ardennes" ? 1 : 0);
                if (zoneOrder(a.zone) !== zoneOrder(b.zone))
                  return zoneOrder(a.zone) - zoneOrder(b.zone);
              }
              // 3. Alphabétique
              return (a.full_name || "").localeCompare(b.full_name || "");
            })
            .map((emp: any) => (
              <Card
                key={emp.id}
                className="mb-4 rounded-[32px] overflow-hidden"
              >
                {/* Bande de couleur en haut */}
                <View
                  style={{ height: 6, backgroundColor: emp.color || "#3B82F6" }}
                />

                <CardContent className="p-4 flex-row items-center">
                  {/* Avatar avec ring coloré */}
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: emp.color || "#3B82F6",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: emp.color || "#3B82F6",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.5,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                  >
                    <Text className="text-white font-bold text-lg">
                      {getInitials(emp.full_name || emp.email || "?")}
                    </Text>
                  </View>

                  <View className="flex-1 ml-4">
                    <Text className="text-lg font-bold text-foreground dark:text-white">
                      {emp.full_name || "Sans nom"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {emp.email}
                    </Text>
                    {emp.phone ? (
                      <View className="flex-row items-center mt-0.5">
                        <Phone size={11} color="#94A3B8" />
                        <Text className="text-xs text-muted-foreground ml-1">
                          {emp.phone}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 8,
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Badge rôle */}
                      <View
                        className={`px-2 py-0.5 rounded-full ${emp.role === "admin" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-slate-800"}`}
                      >
                        <Text
                          className={`text-xs font-bold uppercase ${emp.role === "admin" ? "text-purple-700 dark:text-purple-400" : "text-gray-600 dark:text-slate-400"}`}
                        >
                          {emp.role === "admin" ? "Admin" : "Employé"}
                        </Text>
                      </View>
                      {/* Badge zone */}
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 99,
                          backgroundColor:
                            emp.zone === "ardennes" ? "#D1FAE5" : "#DBEAFE",
                        }}
                      >
                        <Text
                          className={`text-xs font-bold uppercase ${emp.zone === "ardennes" ? "text-emerald-700" : "text-blue-600"}`}
                        >
                          {emp.zone === "ardennes" ? "Ardennes" : "Hainaut"}
                        </Text>
                      </View>
                      {/* Heures */}
                      <View className="flex-row items-center">
                        <Clock size={12} color="#94A3B8" />
                        <Text className="text-xs text-muted-foreground ml-1">
                          {emp.weekly_hours}h/sem
                        </Text>
                      </View>
                    </View>
                  </View>
                </CardContent>
                <View className="flex-row border-t border-border dark:border-slate-800">
                  <Pressable
                    onPress={() => {
                      setResetEmp(emp);
                      setNewPassword("");
                    }}
                    className="flex-1 p-3 items-center justify-center active:bg-muted dark:active:bg-slate-800"
                  >
                    <Text className="text-primary font-bold text-sm">
                      Reset MDP
                    </Text>
                  </Pressable>
                  <View className="w-[1px] bg-border dark:bg-slate-800" />
                  <Pressable
                    onPress={() => handleOpenEdit(emp)}
                    className="flex-1 p-3 items-center justify-center active:bg-muted dark:active:bg-slate-800"
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

      {/* --- MODALE --- */}
      <Dialog
        open={!!editingEmp}
        onClose={() => setEditingEmp(null)}
        position="center"
      >
        <ScrollView
          ref={modalScrollRef}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}

          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: screenHeight * 0.85, width: "100%" }}
          contentContainerStyle={{ padding: 24 }}
        >
          <View style={{ gap: 24, width: "100%" }}>
            {/* Header Modale - Centré */}
            <View className="w-full items-center justify-center">
              <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-3">
                <UserCog size={32} color="#3B82F6" style={{ marginLeft: 6 }} />
              </View>
              <Text className="text-2xl font-extrabold text-center dark:text-white">
                Modifier Profil
              </Text>
              <Text className="text-base text-muted-foreground text-center">
                {editingEmp?.full_name}
              </Text>
            </View>

            {/* Formulaire : Suppression de px-1 pour alignement strict */}
            <View className="w-full">
              {/* Input Téléphone */}
              <Input
                label="Téléphone"
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
                containerStyle={{ marginBottom: 8 }}
              />

              {/* Input Heures */}
              <Input
                label="Heures par semaine"
                keyboardType="numeric"
                value={weeklyHours}
                onChangeText={setWeeklyHours}
                containerStyle={{ marginBottom: 8 }}
              />

              {/* Select Rôle : On utilise la prop label pour l'alignement parfait avec Input */}
              <Select
                label="Rôle de l'employé"
                items={roleItems}
                value={selectedRole}
                onChange={setSelectedRole}
                title="Choisir un rôle"
                searchable={false}
                containerStyle={{ marginBottom: 8 }}
              />

              {/* Color Picker */}
              <ColorPicker
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                label="Couleur sur le planning"
                containerStyle={{ marginBottom: 16 }}
              />

              {/* Espace avant bouton */}
              <View className="h-2" />

              <Button
                className="h-14 rounded-[28px]"
                style={{ width: "90%", alignSelf: "center", borderRadius: 28 }}
                onPress={() =>
                  updateMutation.mutate({
                    weekly_hours: Number(weeklyHours),
                    color: selectedColor,
                    role: selectedRole.id,
                    phone: editPhone || null,
                  })
                }
                loading={updateMutation.isPending}
              >
                Sauvegarder
              </Button>

              {/* Section Absence */}
              <View className="border-t border-border dark:border-slate-800 pt-6 mt-2 w-full">
                <Pressable
                  onPress={toggleAbsenceForm}
                  style={{ width: "90%", alignSelf: "center" }}
                  className="flex-row items-center justify-center bg-red-50 dark:bg-red-900/10 h-14 rounded-[28px] border border-red-100 dark:border-red-900/20 active:opacity-80"
                >
                  <Thermometer size={18} color="#EF4444" />
                  <Text className="ml-2 text-red-600 font-bold text-base">
                    Déclarer une absence
                  </Text>
                </Pressable>

                {/* Liste des absences existantes */}
                {absences && absences.length > 0 && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {absences.map((abs: any) => {
                      const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                      return (
                        <View
                          key={abs.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: isDark ? "#334155" : "#FEE2E2",
                            backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "#FFF5F5",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Thermometer size={14} color="#EF4444" />
                            <Text style={{ fontSize: 13, color: isDark ? "#FCA5A5" : "#B91C1C", fontWeight: "600" }}>
                              {fmt(abs.start_date)} → {fmt(abs.end_date)}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => deleteAbsenceMutation.mutate(abs.id)}
                            hitSlop={8}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Animated.View
                    style={{
                      marginTop: 16,
                      gap: 16,
                      overflow: "hidden",
                      maxHeight: absenceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] }),
                      opacity: absenceAnim,
                      borderRadius: 32,
                      backgroundColor: "rgba(0,0,0,0.03)",
                      padding: absenceAnim.interpolate({ inputRange: [0, 0.1], outputRange: [0, 16], extrapolate: "clamp" }),
                    }}
                  >
                    <DateTimePicker
                      label="Date de début"
                      value={absStart + "T00:00"}
                      onChange={(v) => setAbsStart(v.split("T")[0])}
                      dateOnly
                    />

                    <DateTimePicker
                      label="Date de fin"
                      value={absEnd + "T00:00"}
                      onChange={(v) => setAbsEnd(v.split("T")[0])}
                      dateOnly
                    />

                    <Button
                      variant="destructive"
                      onPress={() =>
                        absenceMutation.mutate({
                          employee_id: editingEmp.id,
                          start_date: absStart + "T00:00:00",
                          end_date: absEnd + "T23:59:59",
                          reason: "Maladie",
                        })
                      }
                      loading={absenceMutation.isPending}
                      className="rounded-[24px] h-12 w-full"
                    >
                      Confirmer l'absence
                    </Button>
                  </Animated.View>
              </View>

              {/* BOUTON SUPPRIMER  */}
              <View className="mt-4 pt-4 border-t border-border dark:border-slate-800 w-full items-center">
                <Pressable
                  onPress={handleDeletePress}
                  disabled={deleteMutation.isPending}
                  className="flex-row items-center p-3 opacity-80 active:opacity-100"
                >
                  {deleteMutation.isPending ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <>
                      <Trash2 size={18} color="#EF4444" />
                      <Text className="text-red-500 font-bold ml-2">
                        Supprimer ce compte
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Button
                variant="ghost"
                className="w-full rounded-[28px]"
                onPress={() => setEditingEmp(null)}
              >
                Annuler
              </Button>
            </View>
          </View>
        </ScrollView>
      </Dialog>

      {/* --- DIALOG CONFIRMATION SUPPRESSION (web) --- */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: "800" }} className="text-foreground dark:text-white">
            Supprimer l'employé ?
          </Text>
          <Text className="text-muted-foreground">
            Cette action est irréversible et supprimera l'accès de {editingEmp?.full_name}.
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="outline" style={{ flex: 1, borderRadius: 24 }} onPress={() => setShowDeleteConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1, borderRadius: 24 }}
              onPress={() => { setShowDeleteConfirm(false); deleteMutation.mutate(editingEmp.id); }}
            >
              Supprimer
            </Button>
          </View>
        </View>
      </Dialog>

      {/* --- DIALOG RESET MDP --- */}
      <Dialog
        open={!!resetEmp}
        onClose={() => { setResetEmp(null); setNewPassword(""); }}
        position="center"
      >
        <View style={{ padding: 24, gap: 20 }}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(59,130,246,0.1)", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={28} color="#3B82F6" />
            </View>
            <Text className="text-xl font-extrabold text-center dark:text-white">
              Réinitialiser le mot de passe
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              {resetEmp?.full_name}
            </Text>
          </View>

          <Input
            label="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="8 caractères minimum"
          />

          <Button
            style={{ borderRadius: 28 }}
            onPress={() => resetPasswordMutation.mutate(newPassword)}
            loading={resetPasswordMutation.isPending}
            disabled={newPassword.length < 8}
          >
            Confirmer
          </Button>
          <Button
            variant="ghost"
            style={{ borderRadius: 28 }}
            onPress={() => { setResetEmp(null); setNewPassword(""); }}
          >
            Annuler
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
