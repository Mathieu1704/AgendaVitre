import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  ChevronLeft,
  Calculator,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { useCompanySettings } from "../../../src/hooks/useCompanySettingsSync";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { Button } from "../../../src/ui/components/Button";
import { ConfirmModal } from "../../../src/ui/components/ConfirmModal";
import { Dialog } from "../../../src/ui/components/Dialog";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { toast } from "../../../src/ui/toast";
import { formatPrice } from "../../../src/lib/price";
import {
  toBrusselsDateTimeString,
  parseBrusselsDateTimeString,
} from "../../../src/lib/date";
import {
  useWeeklySummary,
  useConfirmCashSettlement,
  useConfirmOvertimeSettlement,
  useCorrectTimeEntry,
  WeeklySummaryEmployee,
  DailyEntry,
} from "../../../src/hooks/useTimeTracking";

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function formatHours(h: number): string {
  const sign = h < 0 ? "-" : "+";
  const abs = Math.abs(h);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  return `${sign}${hours}h${minutes.toString().padStart(2, "0")}`;
}

export default function HeuresEncaissementScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [includeCurrentWeek, setIncludeCurrentWeek] = useState(false);
  const { data: summary, isLoading, error, refetch, isRefetching } = useWeeklySummary(
    undefined,
    includeCurrentWeek,
  );
  const { data: companySettings } = useCompanySettings();
  const hideCash = companySettings?.hide_cash ?? false;

  const confirmCash = useConfirmCashSettlement();
  const confirmOvertime = useConfirmOvertimeSettlement();
  const correctEntry = useCorrectTimeEntry();

  const [cashConfirm, setCashConfirm] = useState<WeeklySummaryEmployee | null>(null);
  const [overtimeConfirm, setOvertimeConfirm] = useState<WeeklySummaryEmployee | null>(null);
  const [partialHoursStr, setPartialHoursStr] = useState("");
  const [editingDay, setEditingDay] = useState<{
    employee: WeeklySummaryEmployee;
    day: DailyEntry;
  } | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  const openDayEditor = (employee: WeeklySummaryEmployee, day: DailyEntry) => {
    const base = day.date;
    setEditClockIn(
      day.clock_in_at
        ? toBrusselsDateTimeString(new Date(day.clock_in_at))
        : `${base}T08:00`,
    );
    setEditClockOut(
      day.clock_out_at
        ? toBrusselsDateTimeString(new Date(day.clock_out_at))
        : `${base}T16:00`,
    );
    setEditingDay({ employee, day });
  };

  const handleSaveDay = async () => {
    if (!editingDay) return;
    try {
      await correctEntry.mutateAsync({
        employee_id: editingDay.employee.employee_id,
        work_date: editingDay.day.date,
        clock_in_at: parseBrusselsDateTimeString(editClockIn).toISOString(),
        clock_out_at: parseBrusselsDateTimeString(editClockOut).toISOString(),
      });
      toast.success("Pointage corrigé");
      setEditingDay(null);
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Correction impossible.");
    }
  };

  const handleConfirmCash = async () => {
    if (!cashConfirm || !summary) return;
    try {
      await confirmCash.mutateAsync({
        employee_id: cashConfirm.employee_id,
        week_start: summary.week_start,
      });
      toast.success("Cash marqué comme payé");
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Impossible de confirmer.");
    } finally {
      setCashConfirm(null);
    }
  };

  const handleConfirmOvertime = async (hours?: number) => {
    if (!overtimeConfirm) return;
    try {
      await confirmOvertime.mutateAsync({
        employee_id: overtimeConfirm.employee_id,
        include_current_week: includeCurrentWeek,
        ...(hours != null ? { hours } : {}),
      });
      toast.success(
        hours != null ? `${formatHours(hours)} soldées` : "Solde d'heures remis à zéro",
      );
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Impossible de confirmer.");
    } finally {
      setOvertimeConfirm(null);
      setPartialHoursStr("");
    }
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-4 pb-2 border-b border-border dark:border-slate-800">
        <View className="flex-row items-center">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/(app)/parametres")}
          >
            <ChevronLeft size={24} color={isDark ? "white" : "black"} />
          </Button>
          <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
            Heures & Encaissement
          </Text>
        </View>
        {summary && (
          <Text className="text-sm text-muted-foreground mt-1 ml-14">
            Semaine du {summary.week_start} au {summary.week_end}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#3B82F6" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8 gap-3">
          <AlertTriangle size={32} color="#EF4444" />
          <Text className="text-center text-foreground dark:text-white font-bold">
            Impossible de charger les données
          </Text>
          <Text className="text-center text-muted-foreground text-sm">
            {(error as any)?.response?.data?.detail || (error as any)?.message || "Erreur réseau."}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: "#3B82F6" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#3B82F6" />
          }
        >
          <Pressable
            onPress={() => setIncludeCurrentWeek((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 56,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: includeCurrentWeek ? "#3B82F6" : (isDark ? "#334155" : "#E2E8F0"),
              backgroundColor: includeCurrentWeek ? "rgba(59,130,246,0.1)" : (isDark ? "#0F172A" : "#F8FAFC"),
            }}
          >
            <Calculator size={20} color={includeCurrentWeek ? "#3B82F6" : "#94A3B8"} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: includeCurrentWeek ? "#3B82F6" : (isDark ? "#F1F5F9" : "#0F172A"),
              }}
            >
              Calculer avec la semaine en cours
            </Text>
          </Pressable>
          {includeCurrentWeek && (
            <Text style={{ marginTop: -8, fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
              Solde provisoire — la semaine n'est pas encore terminée.
            </Text>
          )}

          {(summary?.employees ?? []).length === 0 && (
            <Text className="text-center text-muted-foreground mt-10">
              Aucun employé.
            </Text>
          )}

          {(summary?.employees ?? []).map((emp) => (
            <View
              key={emp.employee_id}
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: isDark ? "#1E293B" : "#E4E4E7",
                backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                padding: 18,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>
                  {emp.full_name || "Sans nom"}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase" }}>
                  {emp.role === "subcontractor" ? "Sous-traitant" : "Employé"}
                </Text>
              </View>

              {/* Cash */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "#0B1220" : "#F8FAFC",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: "rgba(249,115,22,0.12)",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Wallet size={18} color="#F97316" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600" }}>Cash à remettre</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {hideCash ? (
                        <EyeOff size={14} color={isDark ? "#64748B" : "#94A3B8"} />
                      ) : (
                        <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>
                          {formatPrice(emp.cash_amount)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                {emp.cash_settled ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={16} color="#10B981" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#10B981" }}>Réglé</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setCashConfirm(emp)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
                      backgroundColor: pressed ? "#059669" : "#10B981",
                    })}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Payé</Text>
                  </Pressable>
                )}
              </View>

              {/* Heures sup/moins */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: isDark ? "#0B1220" : "#F8FAFC",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: "rgba(59,130,246,0.12)",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Clock size={18} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: "#94A3B8", fontWeight: "600" }}>
                      Heures sup / en moins
                    </Text>
                    <Text
                      style={{
                        fontSize: 16, fontWeight: "700",
                        color: emp.overtime_balance_hours >= 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {formatHours(emp.overtime_balance_hours)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setOvertimeConfirm(emp)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
                    backgroundColor: pressed ? "#2563EB" : "#3B82F6",
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Soldé</Text>
                </Pressable>
              </View>

              {/* Grille des jours ouvrés (lun-ven) */}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {emp.daily_entries.slice(0, 5).map((day, i) => {
                  // Vert = pointé (début + fin réels). Un congé n'est par définition
                  // pas un pointage, donc il reste rouge comme n'importe quel jour
                  // sans pointage — même si l'absence est parfaitement légitime.
                  const ok = !!(day.clock_in_at && day.clock_out_at);
                  return (
                    <Pressable
                      key={day.date}
                      onPress={() => openDayEditor(emp, day)}
                      style={{ alignItems: "center", gap: 4 }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#94A3B8" }}>
                        {DAY_LABELS[i]}
                      </Text>
                      <View
                        style={{
                          width: 26, height: 26, borderRadius: 13,
                          alignItems: "center", justifyContent: "center",
                          backgroundColor: ok
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(239,68,68,0.12)",
                        }}
                      >
                        {ok ? (
                          <CheckCircle2 size={14} color="#10B981" />
                        ) : (
                          <AlertTriangle size={13} color="#EF4444" />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ConfirmModal
        visible={!!cashConfirm}
        title="Confirmer le paiement"
        message={
          cashConfirm
            ? `Confirmer que ${cashConfirm.full_name || "cet employé"} a bien remis ${formatPrice(cashConfirm.cash_amount)} ?`
            : ""
        }
        confirmText="Confirmer"
        onConfirm={handleConfirmCash}
        onCancel={() => setCashConfirm(null)}
      />

      {overtimeConfirm && (
        <Dialog
          open
          onClose={() => {
            setOvertimeConfirm(null);
            setPartialHoursStr("");
          }}
          maxWidth={340}
        >
          <View style={{ padding: 20, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A", textAlign: "center" }}>
              Solder les heures
            </Text>
            <Text style={{ color: "#64748B", textAlign: "center", lineHeight: 20 }}>
              Solde actuel de {overtimeConfirm.full_name || "cet employé"} :{" "}
              {formatHours(overtimeConfirm.overtime_balance_hours)}
            </Text>

            <Pressable
              onPress={() => handleConfirmOvertime()}
              disabled={confirmOvertime.isPending}
              style={{
                height: 48, borderRadius: 24,
                backgroundColor: "#3B82F6",
                alignItems: "center", justifyContent: "center",
                opacity: confirmOvertime.isPending ? 0.7 : 1,
              }}
            >
              <Text style={{ fontWeight: "700", color: "white" }}>Solder à 0</Text>
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0" }} />
              <Text style={{ color: "#94A3B8", fontSize: 12 }}>ou un nombre précis</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0" }} />
            </View>

            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                value={partialHoursStr}
                onChangeText={setPartialHoursStr}
                placeholder="ex. 7,6"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={[
                  {
                    flex: 1, height: 44, borderRadius: 16,
                    borderWidth: 1.5, borderColor: isDark ? "#334155" : "#DBEAFE",
                    paddingHorizontal: 14, fontSize: 15, fontWeight: "600",
                    color: isDark ? "#F1F5F9" : "#0F172A",
                  },
                  Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
                ]}
              />
              <Pressable
                onPress={() => {
                  const hours = parseFloat(partialHoursStr.replace(",", "."));
                  if (!hours || hours <= 0) {
                    return toast.error("Heures", "Indique un nombre d'heures valide.");
                  }
                  handleConfirmOvertime(hours);
                }}
                disabled={confirmOvertime.isPending || !partialHoursStr}
                style={{
                  height: 44, paddingHorizontal: 16, borderRadius: 16,
                  backgroundColor: isDark ? "#334155" : "#E2E8F0",
                  alignItems: "center", justifyContent: "center",
                  opacity: confirmOvertime.isPending || !partialHoursStr ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>
                  Solder
                </Text>
              </Pressable>
            </View>
          </View>
        </Dialog>
      )}

      {editingDay && (
        <Dialog open onClose={() => setEditingDay(null)} maxWidth={340}>
          <View style={{ padding: 20, gap: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>
              Corriger le pointage du {editingDay.day.date}
            </Text>
            <DateTimePicker
              label="Heure de début"
              value={editClockIn}
              onChange={setEditClockIn}
              timeOnly
            />
            <DateTimePicker
              label="Heure de fin"
              value={editClockOut}
              onChange={setEditClockOut}
              timeOnly
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setEditingDay(null)}
                style={{
                  flex: 1, height: 44, borderRadius: 22,
                  borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveDay}
                disabled={correctEntry.isPending}
                style={{
                  flex: 1, height: 44, borderRadius: 22,
                  backgroundColor: "#3B82F6",
                  alignItems: "center", justifyContent: "center",
                  opacity: correctEntry.isPending ? 0.7 : 1,
                }}
              >
                {correctEntry.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontWeight: "700", color: "white" }}>Enregistrer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  );
}
