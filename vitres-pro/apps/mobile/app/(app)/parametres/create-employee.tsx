import React, { useState } from "react";
import { View, Text, ScrollView, Switch, Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/lib/api";
import { ChevronLeft, Check, UserPlus } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { ColorPicker } from "../../../src/ui/components/ColorPicker";
import { WeekdayHoursPicker } from "../../../src/ui/components/WeekdayHoursPicker";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { toISODate } from "../../../src/lib/date";

const ROLE_OPTIONS = [
  { id: "employee", label: "Employé" },
  { id: "subcontractor", label: "Sous-traitant" },
  { id: "admin", label: "Admin" },
];

export default function CreateEmployeeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Bienvenue2026!");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [role, setRole] = useState<"admin" | "employee" | "subcontractor">("employee");
  const DEFAULT_HOURS: Record<string, number> = {
    "1": 7.6,
    "2": 7.6,
    "3": 7.6,
    "4": 7.6,
    "5": 7.6,
  };
  const [hoursPerWeekday, setHoursPerWeekday] = useState<Record<string, number>>(DEFAULT_HOURS);
  const [noFixedHours, setNoFixedHours] = useState(false);
  const previousHoursRef = React.useRef<Record<string, number>>(DEFAULT_HOURS);
  const [hoursValidFrom, setHoursValidFrom] = useState<string | null>(null);
  const [hoursValidUntil, setHoursValidUntil] = useState<string | null>(null);

  const handleToggleNoFixedHours = (value: boolean) => {
    setNoFixedHours(value);
    if (value) {
      previousHoursRef.current = hoursPerWeekday;
      setHoursPerWeekday({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 });
    } else {
      setHoursPerWeekday(previousHoursRef.current);
    }
  };
  const { employees } = useEmployees();
  const usedColors = employees.map((e: any) => e.color).filter(Boolean);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/api/employees", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Succès", "Employé créé !");
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
    if (!email || !fullName)
      return toast.error("Oups", "Nom et email requis !");

    mutation.mutate({
      full_name: fullName,
      email,
      password: password || undefined, // vide => généré automatiquement côté serveur
      color: selectedColor,
      role,
      hours_per_weekday: hoursPerWeekday,
      hours_valid_from: role === "subcontractor" ? hoursValidFrom : null,
      hours_valid_until: role === "subcontractor" ? hoursValidUntil : null,
    });
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      // ✅ Padding Top dynamique (Gestion Notch)
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
          Nouveau Collaborateur
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero Section (Identique Add Client) */}
        <View className="items-center mb-8">
          <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
            <UserPlus size={32} color="#3B82F6" style={{ marginLeft: 6 }} />
          </View>
          <Text className="text-center text-muted-foreground dark:text-slate-400 max-w-xs">
            Créez un accès pour un membre de l'équipe et définissez ses droits.
          </Text>
        </View>

        {/* CARD 1: Identifiants */}
        <Card className="rounded-[32px] overflow-hidden">
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Identifiants
            </Text>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4" style={{ gap: 16 }}>
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
              label="Mot de passe provisoire (optionnel)"
              placeholder="Laisser vide pour générer automatiquement"
              value={password}
              onChangeText={setPassword}
            />
          </CardContent>
        </Card>

        {/* CARD 2: Configuration */}
        <Card className="mt-4 rounded-[32px] overflow-hidden">
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Configuration
            </Text>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4" style={{ gap: 16 }}>
            <ColorPicker
              selectedColor={selectedColor}
              onColorChange={setSelectedColor}
              label="Couleur Planning"
              usedColors={usedColors}
            />

            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-semibold text-foreground dark:text-white">
                  Heures par jour
                </Text>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Text className="text-xs text-muted-foreground dark:text-slate-400">
                    Sans horaire fixe (0h)
                  </Text>
                  <Switch
                    value={noFixedHours}
                    onValueChange={handleToggleNoFixedHours}
                    trackColor={{ false: "#767577", true: "#22C55E" }}
                  />
                </View>
              </View>
              <WeekdayHoursPicker
                value={hoursPerWeekday}
                onChange={setHoursPerWeekday}
                isDark={isDark}
                disabled={noFixedHours}
              />
            </View>

            {/* Rôle */}
            <View className="pt-2 border-t border-border dark:border-slate-800">
              <Text className="text-base font-medium text-foreground dark:text-white mb-1">
                Rôle
              </Text>
              <Text className="text-xs text-muted-foreground mb-3">
                {role === "admin"
                  ? "Peut modifier le planning de tous"
                  : role === "subcontractor"
                    ? "Voit ses interventions (adresse, horaires) sans aucun prix, ne peut ni reprendre de RDV ni déplacer un RDV"
                    : "Voit et gère ses propres interventions"}
              </Text>
              <SlidingPillSelector
                options={ROLE_OPTIONS}
                selected={role}
                onSelect={(id) => {
                  const newRole = id as "admin" | "employee" | "subcontractor";
                  setRole(newRole);
                  if (newRole !== "subcontractor") {
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

            {role === "subcontractor" && (
              <View className="pt-2 border-t border-border dark:border-slate-800" style={{ gap: 10 }}>
                <Text className="text-sm font-semibold text-foreground dark:text-white">
                  Période d'activité (optionnel)
                </Text>
                <Text className="text-xs text-muted-foreground -mt-1 mb-1">
                  En dehors de cette période, ce collaborateur sera automatiquement compté à 0h prévues, sans action de votre part.
                </Text>

                {hoursValidFrom ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <DateTimePicker
                        label="Actif à partir du"
                        value={hoursValidFrom + "T00:00"}
                        onChange={(v) => setHoursValidFrom(v.split("T")[0])}
                        dateOnly
                      />
                    </View>
                    <Pressable onPress={() => setHoursValidFrom(null)} hitSlop={8} style={{ marginBottom: 14 }}>
                      <Text className="text-xs text-red-500 font-semibold">Retirer</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setHoursValidFrom(toISODate(new Date()))}>
                    <Text className="text-primary text-sm font-semibold">+ Définir une date de début</Text>
                  </Pressable>
                )}

                {hoursValidUntil ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <DateTimePicker
                        label="Actif jusqu'au"
                        value={hoursValidUntil + "T00:00"}
                        onChange={(v) => setHoursValidUntil(v.split("T")[0])}
                        dateOnly
                      />
                    </View>
                    <Pressable onPress={() => setHoursValidUntil(null)} hitSlop={8} style={{ marginBottom: 14 }}>
                      <Text className="text-xs text-red-500 font-semibold">Retirer</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setHoursValidUntil(toISODate(new Date()))}>
                    <Text className="text-primary text-sm font-semibold">+ Définir une date de fin</Text>
                  </Pressable>
                )}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Bouton Submit */}
        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="mt-8 h-14 rounded-[28px]"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 font-bold text-white text-lg">
            Créer le compte
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
