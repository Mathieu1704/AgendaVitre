import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock, UserCog, Thermometer } from "lucide-react-native";
import { Calendar } from "react-native-calendars";

import { api } from "../../../src/lib/api";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Dialog } from "../../../src/ui/components/Dialog";
import { Input } from "../../../src/ui/components/Input";
import { Select } from "../../../src/ui/components/Select";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";
import { toISODate } from "../../../src/lib/date";

export default function TeamManagementScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

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

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp);
    setWeeklyHours(emp.weekly_hours.toString());
    setSelectedColor(emp.color);
    setSelectedRole(roleItems.find((r) => r.id === emp.role));
    setShowAbsenceForm(false);
  };

  // Style commun pour les labels afin de garantir l'alignement et la typo
  const labelClass =
    "text-sm font-semibold text-foreground dark:text-white ml-1 mb-1.5";

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
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
            <Card key={emp.id} className="mb-4">
              <CardContent className="p-4 flex-row items-center">
                <Avatar name={emp.full_name || emp.email} size="md" />
                <View className="flex-1 ml-4">
                  <Text className="text-lg font-bold text-foreground dark:text-white">
                    {emp.full_name || "Sans nom"}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {emp.email}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-3">
                    <View
                      className={`px-2 py-0.5 rounded ${emp.role === "admin" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-slate-800"}`}
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
                <View
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: emp.color }}
                />
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
          className="max-h-[85vh]"
          contentContainerStyle={{ padding: 24 }}
        >
          <View className="gap-6 w-full">
            {/* Header Modale */}
            <View className="items-center">
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

            {/* Formulaire */}
            <View className="gap-5 w-full px-1">
              {/* Input Heures (Typo gérée par le composant Input lui-même) */}
              <Input
                label="Heures hebdomadaires"
                keyboardType="numeric"
                value={weeklyHours}
                onChangeText={setWeeklyHours}
              />

              {/* Select Rôle */}
              <View className="w-full">
                <Text className={labelClass}>Rôle de l'employé</Text>
                <Select
                  items={roleItems}
                  value={selectedRole}
                  onChange={setSelectedRole}
                />
              </View>

              {/* Color Picker */}
              <View className="w-full">
                <Text className={labelClass}>Couleur sur le planning</Text>
                <ColorPicker
                  selectedColor={selectedColor}
                  onColorChange={setSelectedColor}
                  label="" // On laisse vide car on affiche notre propre label au dessus
                />
              </View>

              {/* Espace avant bouton */}
              <View className="h-4" />

              <Button
                className="w-full"
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
              <View className="border-t border-border dark:border-slate-800 pt-6 mt-2">
                <Pressable
                  onPress={() => setShowAbsenceForm(!showAbsenceForm)}
                  className="flex-row items-center justify-center bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20"
                >
                  <Thermometer size={18} color="#EF4444" />
                  <Text className="ml-2 text-red-600 font-bold">
                    Déclarer une absence
                  </Text>
                </Pressable>

                {showAbsenceForm && (
                  <View className="mt-4 gap-4 bg-muted/20 p-4 rounded-2xl">
                    <View>
                      <Text className="text-xs font-bold uppercase text-muted-foreground mb-2 ml-1">
                        Date de début
                      </Text>
                      <View className="rounded-xl overflow-hidden border border-border bg-white shadow-sm">
                        <Calendar
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
                          }}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-xs font-bold uppercase text-muted-foreground mb-2 ml-1">
                        Date de fin
                      </Text>
                      <View className="rounded-xl overflow-hidden border border-border bg-white shadow-sm">
                        <Calendar
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
                    >
                      Confirmer l'absence
                    </Button>
                  </View>
                )}
              </View>

              <Button
                variant="ghost"
                className="w-full"
                onPress={() => setEditingEmp(null)}
              >
                Annuler
              </Button>
            </View>
          </View>
        </ScrollView>
      </Dialog>
    </View>
  );
}
