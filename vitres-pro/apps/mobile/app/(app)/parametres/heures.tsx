import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  ChevronLeft,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
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

  const { data: summary, isLoading, error, refetch, isRefetching } = useWeeklySummary();
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await api.get("/api/settings/company")).data,
  });
  const hideCash = companySettings?.hide_cash ?? false;

  const confirmCash = useConfirmCashSettlement();
  const confirmOvertime = useConfirmOvertimeSettlement();
  const correctEntry = useCorrectTimeEntry();

  const [cashConfirm, setCashConfirm] = useState<WeeklySummaryEmployee | null>(null);
  const [overtimeConfirm, setOvertimeConfirm] = useState<WeeklySummaryEmployee | null>(null);
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

  const handleConfirmOvertime = async () => {
    if (!overtimeConfirm) return;
    try {
      await confirmOvertime.mutateAsync({ employee_id: overtimeConfirm.employee_id });
      toast.success("Solde d'heures remis à zéro");
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Impossible de confirmer.");
    } finally {
      setOvertimeConfirm(null);
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

              {/* Grille des 7 jours */}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {emp.daily_entries.map((day, i) => {
                  const punched = !!(day.clock_in_at && day.clock_out_at);
                  const ok = punched || day.is_absence;
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

      <ConfirmModal
        visible={!!overtimeConfirm}
        title="Solder les heures"
        message={
          overtimeConfirm
            ? `Le solde de ${formatHours(overtimeConfirm.overtime_balance_hours)} sera remis à zéro pour ${overtimeConfirm.full_name || "cet employé"}.`
            : ""
        }
        confirmText="Solder"
        onConfirm={handleConfirmOvertime}
        onCancel={() => setOvertimeConfirm(null)}
      />

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
