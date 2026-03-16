import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Trash2, Plus, Clock } from "lucide-react-native";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
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

  const { data: rates, isLoading } = useHourlyRates();
  const createRate = useCreateHourlyRate();
  const deleteRate = useDeleteHourlyRate();

  const [newRate, setNewRate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [toDelete, setToDelete] = useState<HourlyRate | null>(null);

  const handleAdd = async () => {
    const r = parseFloat(newRate.replace(",", "."));
    if (!r || r <= 0) return toast.error("Erreur", "Taux invalide.");
    await createRate.mutateAsync({ rate: r, label: newLabel.trim() || undefined });
    setNewRate("");
    setNewLabel("");
    toast.success("Ajouté", `${r} €/h ajouté.`);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    await deleteRate.mutateAsync(toDelete.id);
    setToDelete(null);
    toast.success("Supprimé", "Taux supprimé.");
  };

  const inputClass = `h-12 px-4 rounded-2xl border text-base font-medium ${
    isDark
      ? "bg-slate-900 border-slate-700 text-white"
      : "bg-white border-gray-200 text-gray-900"
  }`;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable
          onPress={() => router.back()}
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
        {/* Liste des taux existants */}
        {isLoading ? (
          <ActivityIndicator color="#3B82F6" style={{ marginVertical: 32 }} />
        ) : rates && rates.length > 0 ? (
          <View className="gap-2 mb-6">
            {rates.map((r) => (
              <Card
                key={r.id}
                className="rounded-2xl border-border dark:border-slate-800"
              >
                <CardContent className="p-4 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: "#3B82F6" + "22" }}
                    >
                      <Clock size={18} color="#3B82F6" />
                    </View>
                    <View>
                      {r.label ? (
                        <Text className="text-base font-bold text-foreground dark:text-white">
                          {r.label}
                        </Text>
                      ) : null}
                      <Text
                        className={`font-semibold ${r.label ? "text-sm text-muted-foreground" : "text-base text-foreground dark:text-white"}`}
                      >
                        {r.rate} €/h
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setToDelete(r)}
                    className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
                    style={{ backgroundColor: "#EF4444" + "18" }}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </CardContent>
              </Card>
            ))}
          </View>
        ) : (
          <View className="items-center py-10 mb-4">
            <Clock size={40} color={isDark ? "#334155" : "#CBD5E1"} />
            <Text className="text-muted-foreground mt-3 text-center">
              Aucun taux horaire défini.{"\n"}Ajoutez-en un ci-dessous.
            </Text>
          </View>
        )}

        {/* Formulaire d'ajout */}
        <Card className="rounded-2xl border-border dark:border-slate-800">
          <CardContent className="p-4 gap-3">
            <Text className="text-base font-bold text-foreground dark:text-white mb-1">
              Ajouter un taux
            </Text>
            <TextInput
              placeholder="Libellé (optionnel, ex: Standard)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newLabel}
              onChangeText={setNewLabel}
              className={inputClass}
            />
            <TextInput
              placeholder="Taux €/h (ex: 50)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newRate}
              onChangeText={setNewRate}
              keyboardType="decimal-pad"
              className={inputClass}
            />
            <Button
              onPress={handleAdd}
              disabled={createRate.isPending || !newRate}
              className="mt-1"
            >
              <View className="flex-row items-center gap-2">
                {createRate.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Plus size={16} color="white" />
                )}
                <Text className="text-white font-semibold">Ajouter</Text>
              </View>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>

      {/* Dialog confirmation suppression */}
      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} position="center">
        <View className="p-4">
          <Text className="text-lg font-bold text-foreground dark:text-white mb-2">
            Supprimer ce taux ?
          </Text>
          <Text className="text-muted-foreground mb-6">
            {toDelete?.label ? `"${toDelete.label}" — ` : ""}
            {toDelete?.rate} €/h sera supprimé. Les interventions existantes ne seront pas affectées.
          </Text>
          <View className="flex-row gap-3">
            <Button variant="outline" onPress={() => setToDelete(null)} className="flex-1">
              Annuler
            </Button>
            <Button
              onPress={handleDelete}
              disabled={deleteRate.isPending}
              className="flex-1 bg-red-500"
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
