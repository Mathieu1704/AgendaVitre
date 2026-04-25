import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  InputAccessoryView,
  Keyboard,
  Platform,
  Switch,
} from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Zap,
  Check,
  PlusCircle,
  Trash2,
  Timer,
} from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useInterventions } from "../../../src/hooks/useInterventions";
import {
  useHourlyRates,
  useCreateHourlyRate,
  useDeleteHourlyRate,
} from "../../../src/hooks/useHourlyRates";
import { api } from "../../../src/lib/api";
import { toBrusselsDateTimeString } from "../../../src/lib/date";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Dialog } from "../../../src/ui/components/Dialog";
import { Button } from "../../../src/ui/components/Button";

function RatePill({
  r,
  isSelected,
  isDark,
  onPress,
  onLongPress,
}: {
  r: any;
  isSelected: boolean;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          scale.value = withTiming(0.88, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 80 });
        }}
        delayLongPress={500}
        className="px-4 py-2.5 rounded-full"
        style={{
          backgroundColor: isSelected
            ? "#3B82F6"
            : isDark
              ? "#1E293B"
              : "#F1F5F9",
        }}
      >
        <Text
          className="text-sm font-semibold"
          style={{
            color: isSelected ? "white" : isDark ? "#94A3B8" : "#64748B",
          }}
        >
          {r
            ? r.time_only
              ? `${r.label ? r.label : "Temps interne"}`
              : `${r.label ? r.label + " — " : ""}${r.rate} €/h`
            : "Aucun"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function fmtZone(subZone: string): string {
  return subZone
    .split("_")
    .slice(1)
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

function fmtH(h: number): string {
  const rounded = Math.round(h * 2) / 2;
  const hours = Math.floor(rounded);
  const mins = Math.round((rounded % 1) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

export default function RateSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const qc = useQueryClient();
  const { date, zone } = useLocalSearchParams<{
    date: string;
    zone?: string;
  }>();

  const { interventions, isLoading } = useInterventions();
  const { data: hourlyRates } = useHourlyRates();
  const createRate = useCreateHourlyRate();
  const deleteRate = useDeleteHourlyRate();
  const rates = (hourlyRates as any[]) || [];

  // États pour ajout de taux
  const [showAddRate, setShowAddRate] = useState(false);
  const [newRateLabel, setNewRateLabel] = useState("");
  const [newRateValue, setNewRateValue] = useState("");
  const [newRateTimeOnly, setNewRateTimeOnly] = useState(false);

  // État pour suppression
  const [rateToDelete, setRateToDelete] = useState<any>(null);

  const filteredList = useMemo(() => {
    return interventions
      .filter((i: any) => {
        if (i.type !== "intervention") return false;
        if (i.time_tbd) return false;
        const iDate = toBrusselsDateTimeString(new Date(i.start_time)).split(
          "T",
        )[0];
        if (iDate !== date) return false;
        if (zone && zone !== "all" && i.zone !== zone) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const za = a.sub_zone ?? "";
        const zb = b.sub_zone ?? "";
        if (za !== zb) return za.localeCompare(zb);
        return (
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
      });
  }, [interventions, date, zone]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    {},
  );

  useFocusEffect(
    useCallback(() => {
      setCurrentIndex(0);
    }, []),
  );

  useEffect(() => {
    const init: Record<string, string | null> = {};
    filteredList.forEach((i: any) => {
      init[i.id] = i.hourly_rate_id ?? null;
    });
    setAssignments(init);
  }, [filteredList.length]);

  const isDone = currentIndex >= filteredList.length;
  const current = filteredList[currentIndex] as any | undefined;

  const selectedRateId = current ? (assignments[current.id] ?? null) : null;
  const selectedRate = rates.find((r: any) => r.id === selectedRateId) ?? null;

  const price = current ? parseFloat(current.price_estimated) || 0 : 0;
  const durationFromIntervention =
    current?.start_time && current?.end_time
      ? (new Date(current.end_time).getTime() -
          new Date(current.start_time).getTime()) /
        3600000
      : null;
  const computedHoursRaw = selectedRate
    ? selectedRate.time_only
      ? durationFromIntervention
      : price > 0
        ? Math.round((price / selectedRate.rate) * 2) / 2
        : null
    : null;
  const computedHoursStr =
    computedHoursRaw != null ? fmtH(computedHoursRaw) : null;

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (computedHoursStr) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [computedHoursStr]);

  const totalHours = useMemo(() => {
    return filteredList.reduce((sum: number, i: any) => {
      const rateId = assignments[i.id];
      if (!rateId) return sum;
      const rate = rates.find((r: any) => r.id === rateId);
      if (!rate) return sum;
      if (rate.time_only) {
        if (i.start_time && i.end_time) {
          return sum + (new Date(i.end_time).getTime() - new Date(i.start_time).getTime()) / 3600000;
        }
        return sum;
      }
      const p = parseFloat(i.price_estimated) || 0;
      if (p <= 0 || rate.rate <= 0) return sum;
      return sum + Math.round((p / rate.rate) * 2) / 2;
    }, 0);
  }, [assignments, filteredList, rates]);

  const selectRate = (rateId: string | null) => {
    if (!current) return;
    setAssignments((prev) => ({ ...prev, [current.id]: rateId }));
  };

  const handleValidate = () => {
    if (current) {
      api
        .patch(`/api/interventions/${current.id}`, {
          hourly_rate_id: assignments[current.id] ?? null,
        })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["interventions"] });
          qc.invalidateQueries({ queryKey: ["planning-stats"] });
        });
    }
    setCurrentIndex((i) => i + 1);
  };

  const handleSkip = () => setCurrentIndex((i) => i + 1);
  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));

  const handleAddRate = async () => {
    const r = newRateTimeOnly ? 0 : parseFloat(newRateValue.replace(",", "."));
    if (!newRateTimeOnly && (!r || r <= 0)) return;
    const created = await createRate.mutateAsync({
      rate: r,
      label: newRateLabel.trim() || undefined,
      time_only: newRateTimeOnly,
    });
    setNewRateLabel("");
    setNewRateValue("");
    setNewRateTimeOnly(false);
    setShowAddRate(false);
    // Sélectionner automatiquement le nouveau taux
    if (current && created?.id) {
      setAssignments((prev) => ({ ...prev, [current.id]: created.id }));
    }
  };

  const handleDeleteRate = async () => {
    if (!rateToDelete) return;
    await deleteRate.mutateAsync(rateToDelete.id);
    // Désassigner ce taux partout dans assignments
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k] === rateToDelete.id) next[k] = null;
      });
      return next;
    });
    setRateToDelete(null);
  };

  const inputStyle = {
    height: 44,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: "500" as const,
    textAlignVertical: "center" as const,
    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    borderColor: isDark ? "#334155" : "#E2E8F0",
    color: isDark ? "#F1F5F9" : "#09090B",
  };

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ paddingTop: insets.top }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (filteredList.length === 0) {
    return (
      <View
        className="flex-1 bg-white dark:bg-slate-950"
        style={{
          paddingTop: insets.top,
          backgroundColor: isDark ? "#020817" : "#FFFFFF",
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-row items-center px-4 py-3 gap-3">
          <Pressable
            onPress={() => router.push("/(app)/calendar" as any)}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
          >
            <ChevronLeft size={22} color={isDark ? "white" : "#09090B"} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground dark:text-white">
            Session taux
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Zap size={48} color={isDark ? "#334155" : "#CBD5E1"} />
          <Text className="text-lg font-bold text-foreground dark:text-white mt-4 text-center">
            Aucune intervention à traiter
          </Text>
          <Text className="text-muted-foreground text-center mt-2">
            Pas d'interventions normales pour ce jour.
          </Text>
        </View>
      </View>
    );
  }

  // === ÉCRAN DE FIN ===
  if (isDone) {
    const treated = filteredList.filter(
      (i: any) => assignments[i.id] != null,
    ).length;
    return (
      <View
        className="flex-1 bg-white dark:bg-slate-950"
        style={{
          paddingTop: insets.top,
          backgroundColor: isDark ? "#020817" : "#FFFFFF",
        }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-green-500/10 items-center justify-center mb-6">
            <Check size={40} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-foreground dark:text-white text-center">
            Session terminée !
          </Text>
          <Text className="text-muted-foreground text-center mt-2 mb-8">
            {treated} intervention{treated > 1 ? "s" : ""} traitée
            {treated > 1 ? "s" : ""}
          </Text>
          <View className="bg-blue-500/10 rounded-3xl px-8 py-5 items-center mb-8 w-full">
            <Text className="text-4xl font-extrabold text-blue-500">
              {fmtH(totalHours)}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              assignées sur la journée
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/calendar" as any)}
            className="bg-blue-500 px-6 py-4 items-center w-full" style={{ borderRadius: 999 }}
          >
            <Text className="text-white font-bold text-base">
              Retour au planning
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // === CARTE PRINCIPALE ===
  const progress =
    filteredList.length > 0 ? (currentIndex / filteredList.length) * 100 : 0;
  const address =
    current.client?.address ||
    [current.client?.street, current.client?.city].filter(Boolean).join(", ") ||
    null;
  const clientName = current.client?.name ?? null;
  const items = current.items || [];

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
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable
          onPress={() => router.push("/(app)/calendar" as any)}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
        >
          <ChevronLeft size={22} color={isDark ? "white" : "#09090B"} />
        </Pressable>
        <Text className="text-base font-bold text-foreground dark:text-white flex-1">
          Session taux
        </Text>
        <Text className="text-sm font-semibold text-muted-foreground">
          {currentIndex + 1} / {filteredList.length}
        </Text>
      </View>

      {/* Barre de progression */}
      <View className="h-1.5 bg-muted mx-4 rounded-full mb-4">
        <View
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Carte intervention */}
        <Card className="rounded-3xl mb-4 border-border dark:border-slate-800">
          <CardContent className="p-5">
            <View className="flex-row items-center gap-1.5 mb-3">
              <View
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: current.sub_zone ? "#3B82F6" : "#94A3B8",
                }}
              />
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: current.sub_zone ? "#3B82F6" : "#94A3B8" }}
              >
                {current.sub_zone
                  ? fmtZone(current.sub_zone)
                  : "Sans sous-zone"}
              </Text>
            </View>
            <Text className="text-xl font-bold text-foreground dark:text-white leading-snug">
              {current.title}
            </Text>
            {address && (
              <Text className="text-base font-medium text-foreground dark:text-slate-200 mt-1">
                {address}
              </Text>
            )}
            {clientName && (
              <Text className="text-sm text-muted-foreground mt-0.5">
                {clientName}
              </Text>
            )}
            {current.description ? (
              <Text className="text-xs text-muted-foreground mt-1 italic">
                {current.description}
              </Text>
            ) : null}

            {items.length > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: isDark ? "#334155" : "#E4E4E7",
                  paddingTop: 12,
                  marginTop: 16,
                  gap: 6,
                }}
              >
                {items.map((item: any, idx: number) => (
                  <View
                    key={item.id ?? idx}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text className="text-sm text-muted-foreground flex-1 mr-2">
                      {item.label}
                    </Text>
                    <Text className="text-sm font-medium text-foreground dark:text-white">
                      {parseFloat(item.price).toFixed(0)} €
                    </Text>
                  </View>
                ))}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "#334155" : "#E4E4E7",
                    marginTop: 8,
                    paddingTop: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text className="text-sm font-bold text-foreground dark:text-white">
                    Total estimé
                  </Text>
                  <Text className="text-sm font-bold text-blue-500">
                    {price.toFixed(0)} €
                  </Text>
                </View>
              </View>
            ) : price > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: isDark ? "#334155" : "#E4E4E7",
                  paddingTop: 12,
                  marginTop: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text className="text-sm font-bold text-foreground dark:text-white">
                  Prix estimé
                </Text>
                <Text className="text-sm font-bold text-blue-500">
                  {price.toFixed(0)} €
                </Text>
              </View>
            ) : (
              <Text className="text-sm text-muted-foreground mt-3">
                Aucun prix renseigné
              </Text>
            )}
          </CardContent>
        </Card>

        {/* Sélecteur de taux */}
        <Card className="rounded-3xl border-border dark:border-slate-800">
          <CardContent className="p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-foreground dark:text-white">
                Taux horaire
              </Text>
              <Pressable
                onPress={() => setShowAddRate(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: isDark
                    ? "rgba(59,130,246,0.15)"
                    : "rgba(59,130,246,0.1)",
                }}
              >
                <PlusCircle size={16} color="#3B82F6" />
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: "#3B82F6" }}
                >
                  Nouveau taux
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {[null, ...rates].map((r: any) => (
                <RatePill
                  key={r?.id ?? "none"}
                  r={r}
                  isSelected={selectedRateId === (r?.id ?? null)}
                  isDark={isDark}
                  onPress={() => selectRate(r?.id ?? null)}
                  onLongPress={() => r && setRateToDelete(r)}
                />
              ))}
            </ScrollView>

            {computedHoursStr && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: "#3B82F614",
                }}
              >
                <View>
                  <Text
                    className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                    style={{
                      color: selectedRate?.time_only ? "#8B5CF6" : "#3B82F6",
                    }}
                  >
                    Heures de travail
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {selectedRate?.time_only
                      ? "Repris des horaires"
                      : `${price.toFixed(0)} € ÷ ${selectedRate?.rate} €/h`}
                  </Text>
                </View>
                <Text
                  className="text-2xl font-extrabold"
                  style={{
                    color: selectedRate?.time_only ? "#8B5CF6" : "#3B82F6",
                  }}
                >
                  {computedHoursStr}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* Footer fixe */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-background px-4 pt-2"
        style={{ paddingBottom: 6 }}
      >
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 2 }}>
          <Pressable
            onPress={handlePrev}
            disabled={currentIndex === 0}
            style={{
              width: 48,
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? "#334155" : "#E4E4E7",
              alignItems: "center",
              justifyContent: "center",
              opacity: currentIndex === 0 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={18} color={isDark ? "white" : "#09090B"} />
          </Pressable>
          <Pressable
            onPress={handleSkip}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? "#334155" : "#E4E4E7",
              alignItems: "center",
            }}
          >
            <Text className="text-sm font-semibold text-muted-foreground">
              Passer →
            </Text>
          </Pressable>
          <Pressable
            onPress={handleValidate}
            style={{
              flex: 2,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: "#3B82F6",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "white" }}>
              ✓ Valider
            </Text>
          </Pressable>
        </View>
        {totalHours > 0 && (
          <View className="flex-row items-center justify-center gap-2 mt-1">
            <Text className="text-sm text-muted-foreground">
              Total journée :
            </Text>
            <Text className="text-base font-bold text-foreground dark:text-white">
              {fmtH(totalHours)}
            </Text>
            <Text className="text-sm text-muted-foreground">assignées</Text>
          </View>
        )}
      </View>

      {/* Dialog : Ajouter un taux */}
      <Dialog
        open={showAddRate}
        onClose={() => {
          setShowAddRate(false);
          setNewRateLabel("");
          setNewRateValue("");
          setNewRateTimeOnly(false);
        }}
        position="center"
      >
        <View className="p-4">
          <Text className="text-lg font-bold text-foreground dark:text-white mb-4">
            Nouveau taux horaire
          </Text>
          <TextInput
            placeholder="Libellé (ex: Standard)"
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={newRateLabel}
            onChangeText={setNewRateLabel}
            style={[inputStyle, { marginBottom: 10 }]}
          />
          {/* Toggle time_only */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Timer
                size={15}
                color={
                  newRateTimeOnly ? "#8B5CF6" : isDark ? "#64748B" : "#94A3B8"
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
              value={newRateTimeOnly}
              onValueChange={setNewRateTimeOnly}
              trackColor={{
                false: Platform.OS === "ios" ? "transparent" : (isDark ? "#334155" : "#E2E8F0"),
                true: "#8B5CF6",
              }}
              ios_backgroundColor={isDark ? "#3A3A3C" : "#E5E5EA"}
              thumbColor={Platform.OS === "ios" ? undefined : "#fff"}
            />
          </View>
          {newRateTimeOnly ? (
            <View
              style={{
                backgroundColor: isDark ? "#1E1040" : "#F5F3FF",
                borderRadius: 12,
                padding: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 12, color: "#8B5CF6" }}>
                Comptabilise les heures de travail uniquement.
              </Text>
            </View>
          ) : (
            <TextInput
              placeholder="Taux €/h (ex: 50)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={newRateValue}
              onChangeText={(v) => setNewRateValue(v.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              inputAccessoryViewID="rate-input-accessory"
              style={[inputStyle, { marginBottom: 16 }]}
            />
          )}
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => {
                setShowAddRate(false);
                setNewRateLabel("");
                setNewRateValue("");
                setNewRateTimeOnly(false);
              }}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onPress={handleAddRate}
              disabled={
                (!newRateTimeOnly && !newRateValue) ||
                (newRateTimeOnly && !newRateLabel.trim()) ||
                createRate.isPending
              }
              className="flex-1"
            >
              {createRate.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Ajouter</Text>
              )}
            </Button>
          </View>
        </View>
      </Dialog>

      {/* Dialog : Confirmer suppression */}
      <Dialog
        open={!!rateToDelete}
        onClose={() => setRateToDelete(null)}
        position="center"
      >
        <View className="p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Trash2 size={20} color="#EF4444" />
            <Text className="text-lg font-bold text-foreground dark:text-white">
              Supprimer ce taux ?
            </Text>
          </View>
          <Text className="text-muted-foreground mb-6">
            {rateToDelete?.label ? `"${rateToDelete.label}" — ` : ""}
            {rateToDelete?.time_only
              ? "Temps de travail"
              : `${rateToDelete?.rate} €/h`}{" "}
            sera supprimé définitivement.
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => setRateToDelete(null)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onPress={handleDeleteRate}
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
