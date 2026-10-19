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
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock,
  UserCog,
  UserPlus,
  Thermometer,
  Trash2,
  Check,
  ChevronDown,
  Phone,
  KeyRound,
  Plus,
} from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../../src/lib/api";
import { parseBrusselsDateTimeString } from "../../../src/lib/date";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { Input } from "../../../src/ui/components/Input";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";
import { WeekdayHoursPicker } from "../../../src/ui/components/WeekdayHoursPicker";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { DateRangePicker } from "../../../src/ui/components/DateRangePicker";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
import { Collapsible, COLLAPSE_EASING } from "../../../src/ui/components/Collapsible";
import Reanimated, { FadeInDown, FadeOutLeft, LinearTransition } from "react-native-reanimated";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";
import { toISODate, startOfWeek } from "../../../src/lib/date";

export default function TeamManagementScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";
  const { height: screenHeight } = useWindowDimensions();

  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [hoursPerWeekday, setHoursPerWeekday] = useState<Record<string, number>>({});
  const [hoursValidFrom, setHoursValidFrom] = useState<string | null>(null);
  const [hoursValidUntil, setHoursValidUntil] = useState<string | null>(null);
  // Seuil d'heures sup (h/semaine) : vide = 37h standard. Saisi en texte
  // pour accepter la virgule (29,36).
  const [floorInput, setFloorInput] = useState("");
  const [floorFrom, setFloorFrom] = useState(toISODate(startOfWeek(new Date(), 1)));
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
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
      Animated.timing(absenceAnim, { toValue: 1, duration: 340, useNativeDriver: false }).start(() => {
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
  const [absType, setAbsType] = useState("VA");
  const ABSENCE_TYPES = [
    { id: "Certificat", label: "Certificat" },
    { id: "VA", label: "VA" },
    { id: "RJF", label: "RJF" },
    { id: "CSS", label: "CSS" },
    { id: "Ancienneté", label: "Ancienneté" },
  ];
  const ABS_TYPE_ROW_HEIGHT = 44;
  const [absTypeOpen, setAbsTypeOpen] = useState(false);
  const absTypeAnim = useRef(new Animated.Value(0)).current;
  const toggleAbsTypeList = (open: boolean) => {
    setAbsTypeOpen(open);
    Animated.timing(absTypeAnim, { toValue: open ? 1 : 0, duration: 260, easing: COLLAPSE_EASING, useNativeDriver: false }).start();
  };

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/api/employees")).data,
  });

  const roleItems = [
    { id: "employee", label: "Employé" },
    { id: "subcontractor", label: "Sous-traitant" },
    { id: "admin", label: "Administrateur" },
  ];

  const updateMutation = useMutation({
    mutationFn: (p: any) => api.patch(`/api/employees/${editingEmp.id}`, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      // Les heures/la période de l'employé impactent les totaux du planning
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      queryClient.invalidateQueries({ queryKey: ["planning-range"] });
      queryClient.invalidateQueries({ queryKey: ["horizon-stats"] });
      queryClient.invalidateQueries({ queryKey: ["initial-stats-reprise"] });
      queryClient.invalidateQueries({ queryKey: ["timetracking", "weekly-summary"] });
      toast.success("Succès", "Profil mis à jour");
      setEditingEmp(null);
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Impossible de mettre à jour");
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
      setAbsType("VA");
      toggleAbsenceForm();
    },
  });

  // Jours ponctuels (sous-traitant) : heures pour une date précise, sans
  // répétition hebdo — ex. absent le lundi (0h), vient le mardi (8h).
  const [ovDate, setOvDate] = useState(toISODate(new Date()));
  const [ovHours, setOvHours] = useState("");
  const [ovSectionOpen, setOvSectionOpen] = useState(false);
  const [ovFormOpen, setOvFormOpen] = useState(false);
  const ovSectionAnim = useRef(new Animated.Value(0)).current;
  const toggleOvSection = (open: boolean) => {
    setOvSectionOpen(open);
    Animated.timing(ovSectionAnim, { toValue: open ? 1 : 0, duration: 300, easing: COLLAPSE_EASING, useNativeDriver: false }).start();
  };
  const toggleOvForm = (open: boolean) => setOvFormOpen(open);
  const parsedOvHours = ovHours.trim() === "" ? NaN : Number(ovHours.replace(",", "."));
  const ovHoursInvalid = !Number.isFinite(parsedOvHours) || parsedOvHours < 0 || parsedOvHours > 24;

  const { data: dayOverrides } = useQuery({
    queryKey: ["day-overrides", editingEmp?.id],
    queryFn: async () => (await api.get(`/api/employees/${editingEmp.id}/day-overrides`)).data as { id: string; date: string; hours: number }[],
    enabled: !!editingEmp?.id && editingEmp?.role === "subcontractor",
  });

  const invalidatePlanning = () => {
    queryClient.invalidateQueries({ queryKey: ["day-overrides", editingEmp?.id] });
    queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
    queryClient.invalidateQueries({ queryKey: ["planning-range"] });
    queryClient.invalidateQueries({ queryKey: ["horizon-stats"] });
    queryClient.invalidateQueries({ queryKey: ["planning", "zero-hours-on-date"] });
  };

  const dayOverrideMutation = useMutation({
    mutationFn: (p: { date: string; hours: number }) =>
      api.post(`/api/employees/${editingEmp.id}/day-overrides`, p),
    onSuccess: () => {
      invalidatePlanning();
      setOvHours("");
      toggleOvForm(false);
      toast.success("Enregistré", "Jour ponctuel ajouté");
    },
    onError: (err: any) => {
      toast.error("Erreur", err.response?.data?.detail || "Impossible d'ajouter ce jour");
    },
  });

  const deleteDayOverrideMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${editingEmp.id}/day-overrides/${id}`),
    onSuccess: () => {
      invalidatePlanning();
      toast.success("Supprimé", "Jour ponctuel supprimé");
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
    if (emp.hours_per_weekday && Object.keys(emp.hours_per_weekday).length > 0) {
      setHoursPerWeekday(emp.hours_per_weekday);
    } else {
      const perDay = Math.round((emp.weekly_hours / 5) * 100) / 100;
      setHoursPerWeekday({ "1": perDay, "2": perDay, "3": perDay, "4": perDay, "5": perDay });
    }
    setHoursValidFrom(emp.hours_valid_from || null);
    setHoursValidUntil(emp.hours_valid_until || null);
    setFloorInput(emp.weekly_floor_hours != null ? String(emp.weekly_floor_hours).replace(".", ",") : "");
    setFloorFrom(toISODate(startOfWeek(new Date(), 1)));
    setSelectedColor(emp.color);
    setSelectedRole(roleItems.find((r) => r.id === emp.role));
    setEditPhone(emp.phone || "");
    setEditEmail(emp.email || "");
    setShowAbsenceForm(false);
    setAbsStart(toISODate(new Date()));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setAbsEnd(toISODate(tomorrow));
    setOvSectionOpen(false);
    setOvFormOpen(false);
    ovSectionAnim.setValue(0);
    setOvDate(toISODate(new Date()));
    setOvHours("");
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

  const parsedFloor = floorInput.trim() === "" ? null : Number(floorInput.trim().replace(",", "."));
  const floorInvalid = parsedFloor !== null && (!Number.isFinite(parsedFloor) || parsedFloor <= 0 || parsedFloor > 80);
  const floorChanged = !!editingEmp && (parsedFloor ?? null) !== (editingEmp.weekly_floor_hours ?? null);

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
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between border-b border-border dark:border-slate-800">
        <View className="flex-row items-center">
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
        <Pressable
          onPress={() => router.push("/(app)/parametres/create-employee" as any)}
          hitSlop={10}
          className="rounded-full w-10 h-10 items-center justify-center active:opacity-60"
        >
          <UserPlus size={20} color="#3B82F6" />
        </Pressable>
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
                      shadowColor: emp.color || "#3B82F6",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.5,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                  >
                    <Avatar
                      name={emp.full_name || emp.email || "?"}
                      color={emp.color}
                      imageUrl={emp.avatar_url}
                      className="w-[52px] h-[52px]"
                    />
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
                        className={`px-2 py-0.5 rounded-full ${emp.role === "admin" ? "bg-purple-100 dark:bg-purple-900/30" : emp.role === "subcontractor" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-gray-100 dark:bg-slate-800"}`}
                      >
                        <Text
                          className={`text-xs font-bold uppercase ${emp.role === "admin" ? "text-purple-700 dark:text-purple-400" : emp.role === "subcontractor" ? "text-amber-700 dark:text-amber-400" : "text-gray-600 dark:text-slate-400"}`}
                        >
                          {emp.role === "admin" ? "Admin" : emp.role === "subcontractor" ? "Sous-traitant" : "Employé"}
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
                          {emp.weekly_floor_hours != null
                            ? ` · seuil ${String(emp.weekly_floor_hours).replace(".", ",")}h`
                            : ""}
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
              {/* Rôle */}
              <View style={{ marginBottom: 16 }}>
                <Text className={labelClass}>Rôle de l'employé</Text>
                <SlidingPillSelector
                  options={roleItems}
                  selected={selectedRole?.id}
                  onSelect={(id) => {
                    const newRole = roleItems.find((r) => r.id === id);
                    setSelectedRole(newRole);
                    if (id !== "subcontractor") {
                      setHoursValidFrom(null);
                      setHoursValidUntil(null);
                    }
                  }}
                  pillColor="#3B82F6"
                  bgColor={isDark ? "#1E293B" : "#F1F5F9"}
                  activeTextColor="#FFFFFF"
                  inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
                />
              </View>

              {/* Input Email (login) */}
              <Input
                label="Email (Login)"
                autoCapitalize="none"
                keyboardType="email-address"
                value={editEmail}
                onChangeText={setEditEmail}
                containerStyle={{ marginBottom: 16 }}
              />

              {/* Input Téléphone */}
              <Input
                label="Téléphone"
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
                containerStyle={{ marginBottom: 8 }}
              />

              {/* Color Picker */}
              <ColorPicker
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
                label="Couleur sur le planning"
                containerStyle={{ marginBottom: 16 }}
              />

              {/* Heures par jour */}
              <View style={{ marginBottom: 8 }}>
                <Text className={labelClass}>Heures par jour</Text>
                <WeekdayHoursPicker
                  value={hoursPerWeekday}
                  onChange={setHoursPerWeekday}
                  isDark={isDark}
                />
              </View>

              {/* Seuil d'heures sup — sans objet pour un sous-traitant (payé au
                  service) ou un admin */}
              {selectedRole?.id === "employee" && (
                <View style={{ marginBottom: 16, gap: 8 }}>
                  {/* Une seule ligne, comme "Heures le Lundi" : vide = 37h,
                      une valeur invalide passe le contour en rouge. */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#94A3B8" : "#334155" }}>
                      Seuil heures sup
                    </Text>
                    <TextInput
                      value={floorInput}
                      onChangeText={setFloorInput}
                      keyboardType="decimal-pad"
                      placeholder="37"
                      placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                      textContentType="none"
                      autoComplete="off"
                      autoCorrect={false}
                      style={{
                        borderWidth: 1,
                        borderColor: floorInvalid ? "#EF4444" : isDark ? "#334155" : "#CBD5E1",
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        width: 80,
                        textAlign: "center",
                        fontSize: 15,
                        fontWeight: "600",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                      }}
                    />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#94A3B8" : "#334155" }}>
                      h
                    </Text>
                  </View>
                  {floorChanged && !floorInvalid && (
                    <View style={{ gap: 6 }}>
                      <DateTimePicker
                        label="À partir de la semaine du"
                        value={floorFrom + "T00:00"}
                        onChange={(v) => setFloorFrom(v.split("T")[0])}
                        dateOnly
                      />
                      <Text className="text-xs text-muted-foreground">
                        Appliqué à partir du lundi de cette semaine. Les semaines d'avant gardent l'ancien seuil.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {selectedRole?.id === "subcontractor" && (
                <View style={{ marginBottom: 16, gap: 8 }}>
                  <Text className={labelClass}>Période d'activité</Text>
                  <Text className="text-xs text-muted-foreground -mt-1 mb-1">
                    En dehors de cette période, 0h prévues automatiquement.
                  </Text>
                  <DateRangePicker
                    startDate={hoursValidFrom}
                    endDate={hoursValidUntil}
                    onChange={(start, end) => {
                      setHoursValidFrom(start);
                      setHoursValidUntil(end);
                    }}
                  />
                </View>
              )}

              {/* Jours ponctuels : section dépliante, enregistrés tout de suite
                  (pas besoin de Sauvegarder), seulement si le rôle sous-traitant
                  est déjà enregistré côté serveur. */}
              {editingEmp?.role === "subcontractor" && selectedRole?.id === "subcontractor" && (
                <View
                  style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() => toggleOvSection(!ovSectionOpen)}
                    style={{
                      height: 50,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                        Jours ponctuels
                      </Text>
                      {(dayOverrides?.length ?? 0) > 0 && (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, backgroundColor: "#3B82F6" }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>{dayOverrides!.length}</Text>
                        </View>
                      )}
                    </View>
                    <Animated.View
                      style={{
                        transform: [{
                          rotate: ovSectionAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }),
                        }],
                      }}
                    >
                      <ChevronDown size={18} color="#94A3B8" />
                    </Animated.View>
                  </Pressable>

                  <Collapsible open={ovSectionOpen}>
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <Text className="text-xs text-muted-foreground" style={{ marginBottom: 8 }}>
                        Heures pour une date précise, sans répétition. 0 h = pas là ce jour-là.
                      </Text>

                      {(dayOverrides ?? []).map((ov) => (
                        <Reanimated.View
                          key={ov.id}
                          entering={FadeInDown.duration(260)}
                          exiting={FadeOutLeft.duration(200)}
                          layout={LinearTransition.duration(240)}
                          style={{
                            marginBottom: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isDark ? "#334155" : "#E2E8F0",
                            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                            {new Date(ov.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: ov.hours === 0 ? "#EF4444" : "#3B82F6" }}>
                              {ov.hours === 0 ? "0 h (absent)" : `${String(ov.hours).replace(".", ",")} h`}
                            </Text>
                            <Pressable onPress={() => deleteDayOverrideMutation.mutate(ov.id)} hitSlop={8}>
                              <Trash2 size={16} color="#EF4444" />
                            </Pressable>
                          </View>
                        </Reanimated.View>
                      ))}

                      {/* Bouton "Ajouter" et formulaire se relaient en fondu */}
                      <Collapsible open={!ovFormOpen} duration={260}>
                        <Pressable
                          onPress={() => toggleOvForm(true)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 11,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderStyle: "dashed",
                            borderColor: "#3B82F6",
                          }}
                        >
                          <Plus size={16} color="#3B82F6" />
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#3B82F6" }}>Ajouter</Text>
                        </Pressable>
                      </Collapsible>

                      <Collapsible open={ovFormOpen}>
                        <View style={{ gap: 10, paddingTop: 2 }}>
                          <DateTimePicker
                            label="Date"
                            value={ovDate + "T00:00"}
                            onChange={(v) => setOvDate(v.split("T")[0])}
                            dateOnly
                          />
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#94A3B8" : "#334155" }}>
                              Nombre d'heures
                            </Text>
                            <TextInput
                              value={ovHours}
                              onChangeText={setOvHours}
                              keyboardType="decimal-pad"
                              placeholder="8"
                              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                              textContentType="none"
                              autoComplete="off"
                              autoCorrect={false}
                              style={{
                                borderWidth: 1,
                                borderColor: ovHours.trim() !== "" && ovHoursInvalid ? "#EF4444" : isDark ? "#334155" : "#CBD5E1",
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                width: 80,
                                textAlign: "center",
                                fontSize: 15,
                                fontWeight: "600",
                                color: isDark ? "#FFFFFF" : "#0F172A",
                                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                              }}
                            />
                            <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#94A3B8" : "#334155" }}>
                              h
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => {
                                setOvHours("");
                                toggleOvForm(false);
                              }}
                              style={{
                                flex: 1,
                                alignItems: "center",
                                paddingVertical: 11,
                                borderRadius: 12,
                                backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#CBD5E1" : "#334155" }}>Annuler</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                if (ovHoursInvalid) {
                                  return toast.error("Oups", "Heures invalides : entre 0 et 24 h.");
                                }
                                dayOverrideMutation.mutate({ date: ovDate, hours: parsedOvHours });
                              }}
                              disabled={dayOverrideMutation.isPending}
                              style={{
                                flex: 1,
                                alignItems: "center",
                                paddingVertical: 11,
                                borderRadius: 12,
                                backgroundColor: "#3B82F6",
                                opacity: dayOverrideMutation.isPending ? 0.6 : 1,
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>Valider</Text>
                            </Pressable>
                          </View>
                        </View>
                      </Collapsible>
                    </View>
                  </Collapsible>
                </View>
              )}

              {/* Espace avant bouton */}
              <View className="h-2" />

              <Button
                className="h-14 rounded-[28px]"
                style={{ width: "90%", alignSelf: "center", borderRadius: 28 }}
                onPress={() => {
                  if (!editEmail.trim()) {
                    return toast.error("Oups", "L'email ne peut pas être vide.");
                  }
                  if (selectedRole.id === "employee" && floorInvalid) {
                    return toast.error("Oups", "Seuil invalide : entre 0 et 80 h (ex. 29,36).");
                  }
                  updateMutation.mutate({
                    hours_per_weekday: hoursPerWeekday,
                    color: selectedColor,
                    role: selectedRole.id,
                    phone: editPhone || null,
                    email: editEmail.trim(),
                    hours_valid_from: selectedRole.id === "subcontractor" ? hoursValidFrom : null,
                    hours_valid_until: selectedRole.id === "subcontractor" ? hoursValidUntil : null,
                    // Seuil envoyé seulement s'il a changé : le serveur garde
                    // l'ancien pour les semaines d'avant la date d'effet.
                    ...(selectedRole.id === "employee" && floorChanged
                      ? {
                          weekly_floor_hours: parsedFloor,
                          weekly_floor_from: toISODate(startOfWeek(new Date(floorFrom + "T12:00:00"), 1)),
                        }
                      : {}),
                  });
                }}
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
                            {abs.type && (
                              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: isDark ? "rgba(239,68,68,0.2)" : "#FEE2E2" }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#FCA5A5" : "#B91C1C" }}>
                                  {abs.type}
                                </Text>
                              </View>
                            )}
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

                <Collapsible open={showAbsenceForm} duration={340}>
                  <View
                    style={{
                      marginTop: 16,
                      gap: 16,
                      borderRadius: 32,
                      backgroundColor: "rgba(0,0,0,0.03)",
                      padding: 16,
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

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "600", marginBottom: 8, color: isDark ? "#F8FAFC" : "#09090B" }}>
                        Type d'absence
                      </Text>
                      <View
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: absTypeOpen ? "#EF4444" : isDark ? "#334155" : "#E2E8F0",
                          backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                          overflow: "hidden",
                        }}
                      >
                        <Pressable
                          onPress={() => toggleAbsTypeList(!absTypeOpen)}
                          style={{
                            height: 48,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 14,
                          }}
                        >
                          <Text style={{ fontSize: 15, fontWeight: "600", color: isDark ? "#F8FAFC" : "#09090B" }}>
                            {ABSENCE_TYPES.find((t) => t.id === absType)?.label ?? absType}
                          </Text>
                          <Animated.View
                            style={{
                              transform: [{
                                rotate: absTypeAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }),
                              }],
                            }}
                          >
                            <ChevronDown size={18} color={absTypeOpen ? "#EF4444" : "#94A3B8"} />
                          </Animated.View>
                        </Pressable>
                        <Animated.View
                          style={{
                            height: absTypeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, ABSENCE_TYPES.length * ABS_TYPE_ROW_HEIGHT + 1],
                            }),
                            opacity: absTypeAnim,
                          }}
                        >
                          <View style={{ height: 1, backgroundColor: isDark ? "#334155" : "#F1F5F9" }} />
                          {ABSENCE_TYPES.map((t) => {
                            const active = absType === t.id;
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => {
                                  setAbsType(t.id);
                                  toggleAbsTypeList(false);
                                }}
                                style={{
                                  height: ABS_TYPE_ROW_HEIGHT,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  paddingHorizontal: 14,
                                  backgroundColor: active
                                    ? isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2"
                                    : "transparent",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: active ? "700" : "500",
                                    color: active ? "#EF4444" : isDark ? "#E2E8F0" : "#334155",
                                  }}
                                >
                                  {t.label}
                                </Text>
                                {active && <Check size={16} color="#EF4444" />}
                              </Pressable>
                            );
                          })}
                        </Animated.View>
                      </View>
                    </View>

                    <Button
                      variant="destructive"
                      onPress={() =>
                        absenceMutation.mutate({
                          employee_id: editingEmp.id,
                          // absStart/absEnd sont des dates "murales" Bruxelles : il faut les
                          // convertir en UTC (pas les envoyer telles quelles) sinon la fin de
                          // journée déborde de ~1-2h sur le lendemain selon l'heure d'été/hiver.
                          start_date: parseBrusselsDateTimeString(absStart + "T00:00").toISOString(),
                          end_date: parseBrusselsDateTimeString(absEnd + "T23:59").toISOString(),
                          type: absType,
                        })
                      }
                      loading={absenceMutation.isPending}
                      className="rounded-[24px] h-12 w-full"
                    >
                      Confirmer l'absence
                    </Button>
                  </View>
                </Collapsible>
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
