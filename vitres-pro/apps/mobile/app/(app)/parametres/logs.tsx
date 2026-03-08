import React, { useState } from "react";
import {
  View, ScrollView, Text, Pressable, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft, PlusCircle, Trash2, Pencil,
  ArrowRightLeft, RefreshCw, AlertTriangle, History,
} from "lucide-react-native";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useLogs, type AuditLog } from "../../../src/hooks/useLogs";

type Filter = "all" | "created" | "deleted" | "modified" | "status_change" | "no_reprise";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",          label: "Tous" },
  { key: "status_change", label: "Statuts" },
  { key: "created",      label: "Créations" },
  { key: "deleted",      label: "Suppressions" },
  { key: "modified",     label: "Modifs" },
  { key: "no_reprise",   label: "Non repris" },
];

const ACTION_ICON: Record<string, React.ReactNode> = {
  created:       <PlusCircle size={16} color="#22C55E" />,
  deleted:       <Trash2 size={16} color="#EF4444" />,
  modified:      <Pencil size={16} color="#3B82F6" />,
  status_change: <ArrowRightLeft size={16} color="#F97316" />,
  no_reprise:    <AlertTriangle size={16} color="#EF4444" />,
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  created:       { bg: "#F0FDF4", text: "#16A34A" },
  deleted:       { bg: "#FEF2F2", text: "#DC2626" },
  modified:      { bg: "#EFF6FF", text: "#2563EB" },
  status_change: { bg: "#FFF7ED", text: "#EA580C" },
  no_reprise:    { bg: "#FEF2F2", text: "#DC2626" },
};

const ACTION_LABELS: Record<string, string> = {
  created:       "Créée",
  deleted:       "Supprimée",
  modified:      "Modifiée",
  status_change: "Statut",
  no_reprise:    "Non repris",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `il y a ${diffD}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function LogItem({ log, onPress }: { log: AuditLog; onPress?: () => void }) {
  const colors = ACTION_COLORS[log.action_type] ?? { bg: "#F8FAFC", text: "#64748B" };
  const icon = ACTION_ICON[log.action_type] ?? <RefreshCw size={16} color="#64748B" />;
  const label = ACTION_LABELS[log.action_type] ?? log.action_type;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "flex-start", gap: 12,
        paddingVertical: 12, paddingHorizontal: 4,
        borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: colors.bg,
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <View style={{
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
            backgroundColor: colors.bg,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text, textTransform: "uppercase" }}>
              {label}
            </Text>
          </View>
          {log.employee_name && (
            <Text style={{ fontSize: 12, color: "#94A3B8", fontWeight: "600" }}>
              {log.employee_name}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 13, color: "#334155", lineHeight: 18 }} numberOfLines={2}>
          {log.description || "—"}
        </Text>
        <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
          {timeAgo(log.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function LogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");

  const { logs, isLoading, refetch } = useLogs(filter === "all" ? undefined : filter);

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-3 flex-row items-center border-b border-border dark:border-slate-800">
        <Pressable
          onPress={() => router.push("/(app)/parametres")}
          className="p-2 rounded-full active:bg-muted mr-1"
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Pressable>
        <History size={20} color="#3B82F6" />
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2 flex-1">
          Historique
        </Text>
        <Pressable onPress={() => refetch()} className="p-2 rounded-full active:bg-muted">
          <RefreshCw size={18} color="#64748B" />
        </Pressable>
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                borderWidth: 1.5,
                borderColor: active ? "#3B82F6" : "#E2E8F0",
                backgroundColor: active ? "#EFF6FF" : "transparent",
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ fontWeight: "600", fontSize: 13, color: active ? "#3B82F6" : "#94A3B8" }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Liste */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : logs.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <View className="bg-slate-100 dark:bg-slate-800 p-5 rounded-full">
            <History size={40} color="#94A3B8" />
          </View>
          <Text className="text-lg font-bold text-foreground dark:text-white text-center">
            Aucune action enregistrée
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {logs.map((log) => (
            <LogItem
              key={log.id}
              log={log}
              onPress={
                log.intervention_id
                  ? () => router.push(`/(app)/calendar/${log.intervention_id}` as any)
                  : undefined
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
