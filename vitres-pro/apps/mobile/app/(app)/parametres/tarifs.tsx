import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Trash2, Plus, Clock, Timer } from "lucide-react-native";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHourlyRates,
  useCreateHourlyRate,
  useDeleteHourlyRate,
  HourlyRate,
} from "../../../src/hooks/useHourlyRates";

export default function TarifsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["hourly-rates"] });
    }, [queryClient]),
  );

  const { data: rates, isLoading } = useHourlyRates();
  const createRate = useCreateHourlyRate();
  const deleteRate = useDeleteHourlyRate();

  const [newRate, setNewRate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTimeOnly, setNewTimeOnly] = useState(false);
  const [toDelete, setToDelete] = useState<HourlyRate | null>(null);

  const handleAdd = async () => {
    const r = newTimeOnly ? 0 : parseFloat(newRate.replace(",", "."));
    if (!newTimeOnly && (!r || r <= 0))
      return toast.error("Erreur", "Taux invalide.");
    await createRate.mutateAsync({
      rate: r,
      label: newLabel.trim() || undefined,
      time_only: newTimeOnly,
    });
    setNewRate("");
    setNewLabel("");
    setNewTimeOnly(false);
    toast.success(
      "Ajouté",
      newTimeOnly ? "Taux temps interne ajouté." : `${r} €/h ajouté.`,
    );
  };

  const doDelete = async (rate: HourlyRate) => {
    await deleteRate.mutateAsync(rate.id);
    setToDelete(null);
    toast.success("Supprimé", "Taux supprimé.");
  };

  const handleDelete = (rate: HourlyRate) => {
    if (Platform.OS === "web") {
      setToDelete(rate);
    } else {
      const label = rate.label ? `"${rate.label}" — ` : "";
      Alert.alert(
        "Supprimer ce taux ?",
        `${label}${rate.rate} €/h sera supprimé.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: () => doDelete(rate),
          },
        ],
      );
    }
  };

  const inputStyle = {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "500" as const,
    borderColor: isDark ? "#334155" : "#E2E8F0",
    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    color: isDark ? "#FFFFFF" : "#09090B",
  };

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-950"
      style={{
        paddingTop: insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.push("/(app)/parametres")}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
          style={{ backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
        >
          <ChevronLeft size={22} color={isDark ? "white" : "#09090B"} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground dark:text-white flex-1">
          Taux horaires
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Formulaire d'ajout */}
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isDark ? "#1E293B" : "#E4E4E7",
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            overflow: "hidden",
            padding: 16,
          }}
        >
          <View style={{ gap: 12 }}>
            <Text className="text-base font-bold text-foreground dark:text-white">
              Ajouter un taux
            </Text>
            <TextInput
              placeholder="Libellé (optionnel, ex: Standard)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newLabel}
              onChangeText={setNewLabel}
              style={inputStyle}
            />
            {/* Toggle temps de travail */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 4,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Timer
                  size={16}
                  color={
                    newTimeOnly ? "#8B5CF6" : isDark ? "#64748B" : "#94A3B8"
                  }
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: isDark ? "#CBD5E1" : "#374151",
                  }}
                >
                  Temps de travail uniquement
                </Text>
              </View>
              <Switch
                value={newTimeOnly}
                onValueChange={setNewTimeOnly}
                trackColor={{
                  false: Platform.OS === "ios" ? "transparent" : (isDark ? "#334155" : "#E2E8F0"),
                  true: "#8B5CF6",
                }}
                ios_backgroundColor={isDark ? "#3A3A3C" : "#E5E5EA"}
                thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
              />
            </View>
            {newTimeOnly ? (
              <View
                style={{
                  backgroundColor: isDark ? "#1E1040" : "#F5F3FF",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <Text style={{ fontSize: 13, color: "#8B5CF6" }}>
                  Ce taux comptabilise les heures de travail uniquement.
                </Text>
              </View>
            ) : (
              <TextInput
                placeholder="Taux €/h (ex: 50)"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="decimal-pad"
                style={inputStyle}
              />
            )}
            <Button
              onPress={handleAdd}
              disabled={createRate.isPending || (!newTimeOnly && !newRate) || (newTimeOnly && !newLabel.trim())}
              style={{ marginTop: 4 }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {createRate.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Plus size={16} color="white" />
                )}
                <Text className="text-white font-semibold">Ajouter</Text>
              </View>
            </Button>
          </View>
        </View>

        {/* Liste des taux existants */}
        {isLoading ? (
          <ActivityIndicator color="#3B82F6" style={{ marginVertical: 32 }} />
        ) : rates && rates.length > 0 ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            {rates.map((r) => (
              <View
                key={r.id}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isDark ? "#1E293B" : "#E4E4E7",
                  backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                  overflow: "hidden",
                  padding: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: r.time_only
                          ? "#8B5CF622"
                          : "#3B82F622",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {r.time_only ? (
                        <Timer size={18} color="#8B5CF6" />
                      ) : (
                        <Clock size={18} color="#3B82F6" />
                      )}
                    </View>
                    <View>
                      {r.label ? (
                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: "700",
                            color: isDark ? "#fff" : "#09090B",
                          }}
                        >
                          {r.label}
                        </Text>
                      ) : null}
                      {r.time_only ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: r.label ? 14 : 16,
                              fontWeight: "600",
                              color: "#8B5CF6",
                            }}
                          >
                            Temps de travail
                          </Text>
                          <View
                            style={{
                              backgroundColor: "#8B5CF620",
                              borderRadius: 8,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: "#8B5CF6",
                              }}
                            >
                              0 €
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text
                          style={{
                            fontSize: r.label ? 15 : 17,
                            fontWeight: "600",
                            color: isDark ? "#94A3B8" : "#64748B",
                          }}
                        >
                          {r.rate} €/h
                        </Text>
                      )}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(r)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: "#EF444418",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Dialog confirmation suppression — web uniquement */}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        position="center"
      >
        <View style={{ padding: 16, gap: 8 }}>
          <Text className="text-lg font-bold text-foreground dark:text-white">
            Supprimer ce taux ?
          </Text>
          <Text className="text-muted-foreground" style={{ marginBottom: 16 }}>
            {toDelete?.label ? `"${toDelete.label}" — ` : ""}
            {toDelete?.rate} €/h sera supprimé. Les interventions existantes ne
            seront pas affectées.
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              variant="outline"
              onPress={() => setToDelete(null)}
              style={{ flex: 1 }}
            >
              Annuler
            </Button>
            <Button
              onPress={() => toDelete && doDelete(toDelete)}
              disabled={deleteRate.isPending}
              variant="destructive"
              style={{ flex: 1 }}
            >
              {deleteRate.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Supprimer</Text>
              )}
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  );
}
