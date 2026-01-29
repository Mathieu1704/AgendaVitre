import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock,
  UserCog,
  Thermometer,
  Trash2,
} from "lucide-react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../../src/lib/api";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { Input } from "../../../src/ui/components/Input";
import { Select } from "../../../src/ui/components/Select";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";
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

  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [weeklyHours, setWeeklyHours] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absStart, setAbsStart] = useState(toISODate(new Date()));
  const [absEnd, setAbsEnd] = useState(toISODate(new Date()));

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

  const absenceMutation = useMutation({
    mutationFn: (p: any) => api.post("/api/absences", p),
    onSuccess: () => {
      toast.success("Enregistré", "Absence prise en compte");
      setEditingEmp(null);
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
      console.log("Erreur suppression:", err.response?.data);
      const message = err.response?.data?.detail || "Erreur inconnue";
      toast.error("Erreur", message);
    },
  });

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp);
    setWeeklyHours(emp.weekly_hours.toString());
    setSelectedColor(emp.color);
    setSelectedRole(roleItems.find((r) => r.id === emp.role));
    setShowAbsenceForm(false);
  };

  const handleDeletePress = () => {
    if (Platform.OS === "web") {
      if (
        confirm(
          "Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible.",
        )
      ) {
        deleteMutation.mutate(editingEmp.id);
      }
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
      style={{ paddingTop: isWeb ? 0 : insets.top }}
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
          employees?.map((emp: any) => (
            <Card key={emp.id} className="mb-4 rounded-[32px] overflow-hidden">
              <CardContent className="p-4 flex-row items-center">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm"
                  style={{ backgroundColor: emp.color || "#3B82F6" }}
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
                  <View className="flex-row items-center mt-2 gap-3">
                    <View
                      className={`px-2 py-0.5 rounded-full ${emp.role === "admin" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-slate-800"}`}
                    >
                      <Text
                        className={`text-xs font-bold uppercase ${emp.role === "admin" ? "text-purple-700 dark:text-purple-400" : "text-gray-600 dark:text-slate-400"}`}
                      >
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
              </CardContent>
              <View className="flex-row border-t border-border dark:border-slate-800">
                <Pressable
                  onPress={() => toast.info("Info", "Reset via admin requis")}
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
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          className="max-h-[85vh] w-full"
          contentContainerStyle={{ padding: 24, flexGrow: 1 }}
        >
          <Pressable
            onPress={() => Keyboard.dismiss()}
            className="gap-6 w-full"
            style={{ opacity: 1 }}
          >
            {/* Header Modale - Centré */}
            <View className="w-full items-center justify-center">
              <View className="bg-primary/10 p-4 rounded-full mb-3">
                <UserCog size={32} color="#3B82F6" />
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
                style={{ width: "90%", alignSelf: "center" }}
                onPress={() =>
                  updateMutation.mutate({
                    weekly_hours: Number(weeklyHours),
                    color: selectedColor,
                    role: selectedRole.id,
                  })
                }
                loading={updateMutation.isPending}
              >
                Sauvegarder
              </Button>

              {/* Section Absence */}
              <View className="border-t border-border dark:border-slate-800 pt-6 mt-2 w-full">
                <Pressable
                  onPress={() => setShowAbsenceForm(!showAbsenceForm)}
                  style={{ width: "90%", alignSelf: "center" }}
                  className="flex-row items-center justify-center bg-red-50 dark:bg-red-900/10 h-14 rounded-[28px] border border-red-100 dark:border-red-900/20 active:opacity-80"
                >
                  <Thermometer size={18} color="#EF4444" />
                  <Text className="ml-2 text-red-600 font-bold text-base">
                    Déclarer une absence
                  </Text>
                </Pressable>

                {showAbsenceForm && (
                  <View className="mt-4 gap-4 bg-muted/20 p-4 rounded-[32px] w-full">
                    {/*  CALENDRIER 1  */}
                    <View className="w-full items-center">
                      <Text className="text-xs font-bold uppercase text-muted-foreground mb-2 text-center">
                        Date de début
                      </Text>
                      <View
                        className="overflow-hidden border border-border bg-white shadow-sm"
                        style={{ borderRadius: 20, width: 300 }}
                      >
                        <Calendar
                          enableSwipeMonths={false}
                          current={absStart}
                          onDayPress={(day) => setAbsStart(day.dateString)}
                          markedDates={{
                            [absStart]: {
                              selected: true,
                              selectedColor: "#EF4444",
                            },
                          }}
                          theme={{
                            calendarBackground: "transparent",
                            textSectionTitleColor: "#64748b",
                            arrowColor: "#EF4444",
                            todayTextColor: "#EF4444",
                          }}
                        />
                      </View>
                    </View>

                    {/* ✅ CALENDRIER 2 CENTRÉ */}
                    <View className="w-full items-center">
                      <Text className="text-xs font-bold uppercase text-muted-foreground mb-2 text-center">
                        Date de fin
                      </Text>
                      <View
                        className="overflow-hidden border border-border bg-white shadow-sm"
                        style={{ borderRadius: 20, width: 300 }} // Largeur fixe pour centrage parfait
                      >
                        <Calendar
                          enableSwipeMonths={false}
                          current={absEnd}
                          onDayPress={(day) => setAbsEnd(day.dateString)}
                          markedDates={{
                            [absEnd]: {
                              selected: true,
                              selectedColor: "#EF4444",
                            },
                          }}
                          theme={{
                            calendarBackground: "transparent",
                            textSectionTitleColor: "#64748b",
                            arrowColor: "#EF4444",
                            todayTextColor: "#EF4444",
                          }}
                        />
                      </View>
                    </View>

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
                  </View>
                )}
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
          </Pressable>
        </ScrollView>
      </Dialog>
    </View>
  );
}
