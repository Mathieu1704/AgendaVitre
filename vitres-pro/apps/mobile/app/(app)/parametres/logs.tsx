import React, { useState, useEffect, useRef } from "react";
import {
  View, ScrollView, Text, Pressable, ActivityIndicator, Animated,
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

const STATUS_LABELS: Record<string, string> = {
  planned:    "Planifiée",
  in_progress: "En cours",
  done:       "Terminée",
  cancelled:  "Annulée",
};

const FIELD_LABELS: Record<string, string> = {
  title:             "titre",
  start_time:        "date/heure de début",
  end_time:          "date/heure de fin",
  status:            "statut",
  hourly_rate_id:    "taux horaire",
  price_estimated:   "prix estimé",
  price_real:        "prix réel",
  notes:             "notes",
  employee_ids:      "employés assignés",
  items:             "prestations",
  sub_zone:          "sous-zone",
  time_tbd:          "heure à définir",
  reprise_taken:     "reprise RDV",
  reprise_note:      "note reprise",
  payment_mode:      "mode de paiement",
  payment_collected: "encaissement",
  type:              "type",
  zone:              "zone",
  client_id:         "client",
};

function humanizeDescription(description: string): string {
  if (!description) return description;

  // "Statut: in_progress → done" ou "Statut : in_progress → done"
  const statusMatch = description.match(/^Statut\s*:\s*(\w+)\s*→\s*(\w+)$/);
  if (statusMatch) {
    const from = STATUS_LABELS[statusMatch[1]] ?? statusMatch[1];
    const to   = STATUS_LABELS[statusMatch[2]] ?? statusMatch[2];
    return `Statut : ${from} → ${to}`;
  }

  // "Modifiée: hourly_rate_id, title" ou "Modifiée : ..."
  const modifiedMatch = description.match(/^Modifi[eé]e\s*:\s*(.+)$/);
  if (modifiedMatch) {
    const fields = modifiedMatch[1].split(",").map((f) => {
      const key = f.trim();
      return FIELD_LABELS[key] ?? key;
    });
    return `Modifiée : ${fields.join(", ")}`;
  }

  return description;
}

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
          {humanizeDescription(log.description) || "—"}
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
  const [page, setPage] = useState(0);
  const [allLogs, setAllLogs] = useState<import("../../../src/hooks/useLogs").AuditLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  const actionType = filter === "all" ? undefined : filter;
  const { logs, isLoading, isFetching, hasMore, refetch } = useLogs(actionType, page);

  // Animation rotation icône refresh
  useEffect(() => {
    if (isFetching || isRefreshing) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 700, useNativeDriver: true })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
  }, [isFetching, isRefreshing]);

  // Reset quand le filtre change
  useEffect(() => {
    setPage(0);
    setAllLogs([]);
  }, [filter]);

  // Accumulation des pages
  useEffect(() => {
    if (!isLoading && !isFetching) {
      if (page === 0) {
        setAllLogs(logs);
        setIsRefreshing(false);
      } else {
        setAllLogs((prev) => [...prev, ...logs]);
      }
    }
  }, [logs, isLoading, isFetching, page]);

  const handleRefetch = () => {
    setIsRefreshing(true);
    setPage(0);
    refetch();
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
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
        <Pressable onPress={handleRefetch} disabled={isFetching} className="p-2 rounded-full active:bg-muted">
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={18} color={isFetching ? "#3B82F6" : "#64748B"} />
          </Animated.View>
        </Pressable>
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
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
      {isLoading && page === 0 && !isRefreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : allLogs.length === 0 && !isRefreshing ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: isDark ? "#1E293B" : "#F1F5F9", padding: 20, borderRadius: 999 }}>
            <History size={40} color="#94A3B8" />
          </View>
          <Text className="text-lg font-bold text-foreground dark:text-white text-center">
            Aucune action enregistrée
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {allLogs.map((log) => (
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
          {hasMore && (
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              disabled={isFetching}
              style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#E2E8F0",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isFetching ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#3B82F6" }}>
                  Charger plus
                </Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
