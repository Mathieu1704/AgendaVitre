import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Play, Square, CheckCircle2 } from "lucide-react-native";
import { useAuth } from "../../../hooks/useAuth";
import {
  useTodayTimeEntry,
  useClockIn,
  useClockOut,
} from "../../../hooks/useTimeTracking";
import { useTheme } from "../ThemeToggle";
import { Dialog } from "../Dialog";
import { toast } from "../../toast";
import { toISODate } from "../../../lib/date";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Petit connecteur vertical façon "chemin" entre le pointage et les RDV. */
function PathLine({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={{
        width: 2,
        height: 14,
        alignSelf: "center",
        backgroundColor: isDark ? "#334155" : "#E2E8F0",
      }}
    />
  );
}

/**
 * Nœud "Commencer ma journée" — à placer juste avant la 1ère intervention
 * du jour, uniquement pour le jour courant.
 */
export function DayStartRow({ date }: { date: string }) {
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const { data, isLoading } = useTodayTimeEntry();
  const clockIn = useClockIn();

  if (isAdmin || isLoading || !data || date !== toISODate(new Date())) return null;

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync();
      toast.success("Journée commencée", "Bon travail !");
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Impossible de pointer.");
    }
  };

  return (
    <View style={{ paddingHorizontal: 4, marginBottom: 10 }}>
      {data.status === "not_started" ? (
        <Pressable
          onPress={handleClockIn}
          disabled={clockIn.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 52,
            borderRadius: 26,
            backgroundColor: pressed ? "#059669" : "#10B981",
            opacity: clockIn.isPending ? 0.7 : 1,
          })}
        >
          {clockIn.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Play size={18} color="white" fill="white" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                Commencer ma journée
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 8,
          }}
        >
          <CheckCircle2 size={14} color="#10B981" />
          <Text style={{ color: isDark ? "#94A3B8" : "#64748B", fontWeight: "600", fontSize: 12 }}>
            Journée commencée{data.clock_in_at ? ` à ${formatTime(data.clock_in_at)}` : ""}
          </Text>
        </View>
      )}
      <PathLine isDark={isDark} />
    </View>
  );
}

/**
 * Nœud "Terminer ma journée" — à placer juste après la dernière intervention
 * du jour, uniquement pour le jour courant, et seulement une fois la journée
 * commencée.
 */
export function DayEndRow({ date }: { date: string }) {
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const { data, isLoading } = useTodayTimeEntry();
  const clockOut = useClockOut();
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (isAdmin || isLoading || !data || date !== toISODate(new Date())) return null;
  if (data.status === "not_started") return null;

  const handleClockOut = async () => {
    setConfirmEnd(false);
    try {
      await clockOut.mutateAsync();
      toast.success("Journée terminée", "À demain !");
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Impossible de pointer.");
    }
  };

  return (
    <View style={{ paddingHorizontal: 4, marginTop: 10 }}>
      <PathLine isDark={isDark} />
      <View style={{ marginTop: 10 }}>
        {data.status === "in_progress" ? (
          <Pressable
            onPress={() => setConfirmEnd(true)}
            disabled={clockOut.isPending}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 52,
              borderRadius: 26,
              backgroundColor: pressed ? "#EA580C" : "#F97316",
              opacity: clockOut.isPending ? 0.7 : 1,
            })}
          >
            {clockOut.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Square size={16} color="white" fill="white" />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                  Terminer ma journée
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
            }}
          >
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={{ color: isDark ? "#94A3B8" : "#64748B", fontWeight: "600", fontSize: 13 }}>
              Journée terminée
              {typeof data.worked_hours === "number"
                ? ` · ${data.worked_hours.toFixed(1)}h travaillées`
                : ""}
            </Text>
          </View>
        )}
      </View>

      {confirmEnd && (
        <Dialog open onClose={() => setConfirmEnd(false)} maxWidth={300}>
          <View style={{ padding: 20 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: isDark ? "#F1F5F9" : "#0F172A",
                marginBottom: 8,
              }}
            >
              Terminer votre journée ?
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? "#94A3B8" : "#64748B",
                marginBottom: 20,
                lineHeight: 18,
              }}
            >
              Cette action enregistre l'heure de fin de journée et ne peut pas être
              annulée depuis l'application.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setConfirmEnd(false)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={handleClockOut}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#F97316",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: "white" }}>Terminer</Text>
              </Pressable>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  );
}
