import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Text,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  Platform,
  Linking,
  LayoutChangeEvent,
} from "react-native";
import {
  Calendar as RNCalendar,
  DateData,
  LocaleConfig,
} from "react-native-calendars";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDayView } from "../../../src/ui/components/calendar/CalendarDayView";
import { CalendarWeekView } from "../../../src/ui/components/calendar/CalendarWeekView";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CalendarCheck,
  Users,
  Zap,
} from "lucide-react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports internes
import { api } from "../../../src/lib/api";
import {
  toISODate,
  parseISODate,
  addMonths,
  addDays,
  startOfWeek,
  startOfDay,
  datesRange,
  startOfMonth,
  endOfMonth,
  toBrusselsDateTimeString,
} from "../../../src/lib/date";
import { Card } from "../../../src/ui/components/Card";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { Avatar } from "../../../src/ui/components/Avatar";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { PlanningHeader } from "../../../src/ui/components/PlanningHeader";
import {
  usePlanningRangeStats,
  usePlanningStats,
} from "../../../src/hooks/usePlanning";
import { useRawEventsByDate, useRawEventsByRange } from "../../../src/hooks/useRawEvents";
import { useAuth } from "../../../src/hooks/useAuth";
import { useSubZones } from "../../../src/hooks/useZones";
import { useAssignEmployees, useBulkAssignEmployees } from "../../../src/hooks/useInterventions";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { RawCalendarEvent } from "../../../src/types";

// --- CONFIGURATION LOCALE ---
LocaleConfig.locales["fr"] = {
  monthNames: [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ],
  monthNamesShort: [
    "Janv.",
    "Févr.",
    "Mars",
    "Avr.",
    "Mai",
    "Juin",
    "Juil.",
    "Août",
    "Sept.",
    "Oct.",
    "Nov.",
    "Déc.",
  ],
  dayNames: [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ],
  dayNamesShort: ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = "fr";

type ViewMode = "day" | "week" | "month" | "year";
type DisplayMode = "list" | "calendar";
type CalView = "day" | "week";

// ─── Animated Sliding Pill Selector (style iOS segmented control) ──────────
type PillOption = {
  id: string;
  label: string;
  pillColor?: string;   // override pill bg for this option
  activeTextColor?: string; // override active text color for this option
};

type SlidingPillSelectorProps = {
  options: PillOption[];
  selected: string;
  onSelect: (id: string) => void;
  pillColor: string;       // default pill bg
  bgColor: string;         // track background
  activeTextColor: string; // default active text
  inactiveTextColor: string;
  containerStyle?: object;
  itemPy?: number;
  itemPx?: number;
  fontSize?: number;
};

function SlidingPillSelector({
  options,
  selected,
  onSelect,
  pillColor,
  bgColor,
  activeTextColor,
  inactiveTextColor,
  containerStyle,
  itemPy = 8,
  itemPx = 0,
  fontSize = 13,
}: SlidingPillSelectorProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const selectedIndex = options.findIndex((o) => o.id === selected);
  const itemWidth = containerWidth > 0 ? containerWidth / options.length : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (itemWidth > 0) {
      translateX.value = withSpring(selectedIndex * itemWidth, {
        mass: 0.5,
        stiffness: 280,
        damping: 28,
      });
    }
  }, [selectedIndex, itemWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: itemWidth,
    backgroundColor:
      options[selectedIndex]?.pillColor ?? pillColor,
  }));

  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: bgColor,
          borderRadius: 100,
          padding: 3,
          position: "relative",
        },
        containerStyle,
      ]}
      onLayout={(e: LayoutChangeEvent) =>
        setContainerWidth(e.nativeEvent.layout.width - 6) // subtract 2*padding
      }
    >
      {/* Sliding pill */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 3,
              left: 3,
              bottom: 3,
              borderRadius: 100,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
            pillStyle,
          ]}
        />
      )}

      {/* Options */}
      {options.map((opt, idx) => {
        const isActive = opt.id === selected;
        const textColor = isActive
          ? (opt.activeTextColor ?? activeTextColor)
          : inactiveTextColor;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: itemPy,
              paddingHorizontal: itemPx,
              borderRadius: 100,
              zIndex: 1,
            }}
          >
            <Animated.Text
              style={{
                fontSize,
                fontWeight: "600",
                color: textColor,
              }}
            >
              {opt.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  intervention: { bg: "#EFF6FF", text: "#3B82F6", label: "Intervention" },
  devis:        { bg: "#F5F3FF", text: "#8B5CF6", label: "Devis" },
  tournee:      { bg: "#FFF7ED", text: "#F97316", label: "Tournée" },
  note:         { bg: "#F8FAFC", text: "#64748B", label: "Note" },
};

function fmtH(h: number): string {
  const rounded = Math.round(h * 2) / 2;
  const hours = Math.floor(rounded);
  const mins = Math.round((rounded % 1) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

const DailyStatsBadge = ({ dateStr, zone }: { dateStr: string; zone?: string }) => {
  const { stats, isLoading } = usePlanningStats(dateStr, zone);

  if (isLoading || !stats) return null;

  let bgClass = "bg-green-100 dark:bg-green-900/50";
  let textClass = "text-green-700 dark:text-green-400";

  if (stats.status === "warning") {
    bgClass = "bg-orange-100 dark:bg-orange-900/50";
    textClass = "text-orange-700 dark:text-orange-400";
  } else if (stats.status === "overload") {
    bgClass = "bg-red-100 dark:bg-red-900/50";
    textClass = "text-red-700 dark:text-red-400";
  }

  return (
    <View className={`px-3 py-1.5 rounded-full ${bgClass}`}>
      <Text className={`text-sm font-bold ${textClass}`}>
        {fmtH(Math.round(stats.planned_hours * 2) / 2)} / {fmtH(stats.capacity_hours)}
      </Text>
    </View>
  );
};

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const { isAdmin, userZone } = useAuth();
  const queryClient = useQueryClient();

  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Breakpoint pour Desktop
  const isDesktop = width >= 1024;

  // --- ÉTATS ---
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [calView, setCalView] = useState<CalView>("week");
  const [cursorDate, setCursorDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  // Admin : toggle Toutes/Hainaut/Ardennes. Employé : fixé à sa zone.
  const [selectedZone, setSelectedZone] = useState<"all" | "hainaut" | "ardennes">("all");
  // Filtres actifs
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [assignModal, setAssignModal] = useState<
    | { mode: "single"; interventionId: string; currentIds: string[] }
    | { mode: "zone"; date: string; subZone: string; label: string; color: string }
    | null
  >(null);
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);
  const [initialAssignIds, setInitialAssignIds] = useState<string[]>([]);

  const { employees: allEmployees } = useEmployees();
  const assignEmployees = useAssignEmployees();
  const bulkAssign = useBulkAssignEmployees();

  const { subZones } = useSubZones();
  const subZoneMap = useMemo(() => {
    const m = new Map<string, { label: string; color: string }>();
    for (const z of subZones) {
      m.set(z.code, { label: z.label, color: z.parent_zone === "ardennes" ? "#22C55E" : "#3B82F6" });
    }
    return m;
  }, [subZones]);

  useEffect(() => {
    if (params.view) {
      const v = (typeof params.view === "string" ? params.view : params.view[0]) as ViewMode;
      if (["day","week","month","year"].includes(v)) setViewMode(v);
    }
  }, []);

  useEffect(() => {
    if (params.date) {
      const dateStr =
        typeof params.date === "string" ? params.date : params.date[0];
      const isoDate = dateStr.split("T")[0];

      setSelectedDate(isoDate);
      setCursorDate(new Date(isoDate));
    }
  }, [params.date]);

  // --- DATA ---
  const { data: interventions, isLoading } = useQuery({
    queryKey: ["interventions"],
    queryFn: async () => {
      const res = await api.get("/api/interventions");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30 * 1000,
  });

  // --- HELPERS ---
  const dayKeyFromDateTime = useCallback((isoDateTime: string) => {
    try {
      return toBrusselsDateTimeString(new Date(isoDateTime)).split("T")[0];
    } catch {
      return isoDateTime.split("T")[0];
    }
  }, []);

  // Zone effective : admin peut choisir, employé est verrouillé sur sa zone
  const effectiveZone = isAdmin ? selectedZone : userZone;

  const itemsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!interventions) return map;

    for (const it of interventions) {
      if (!it?.start_time) continue;
      if (effectiveZone !== "all" && it.zone !== effectiveZone) continue;
      const k = dayKeyFromDateTime(it.start_time);
      (map[k] ||= []).push(it);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const za = a.sub_zone ?? a.zone ?? "";
        const zb = b.sub_zone ?? b.zone ?? "";
        if (za !== zb) return za.localeCompare(zb);
        return a.start_time.localeCompare(b.start_time);
      });
    }
    return map;
  }, [interventions, dayKeyFromDateTime, effectiveZone]);

  // --- FILTRES ---
  const FILTER_TYPES = [
    { id: "intervention", label: "Intervention", color: "#3B82F6" },
    { id: "devis",        label: "Devis",        color: "#8B5CF6" },
    { id: "tournee",      label: "Tournée",      color: "#F97316" },
    { id: "note",         label: "Note",         color: "#64748B" },
  ];
  const FILTER_STATUSES = [
    { id: "planned",     label: "Planifié",  color: "#3B82F6" },
    { id: "in_progress", label: "En cours",  color: "#F97316" },
    { id: "done",        label: "Terminé",   color: "#22C55E" },
  ];
  const filterItem = useCallback((item: any) => {
    if (activeTypes.size > 0 && !activeTypes.has(item.type ?? "intervention")) return false;
    if (activeStatuses.size > 0 && !activeStatuses.has(item.status)) return false;
    return true;
  }, [activeTypes, activeStatuses]);

  const toggleType = (id: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleStatus = (id: string) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const hasFilters = activeTypes.size > 0 || activeStatuses.size > 0;

  const FilterChipsBar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
      style={{ marginBottom: 8 }}
    >
      {hasFilters && (
        <Pressable
          onPress={() => { setActiveTypes(new Set()); setActiveStatuses(new Set()); }}
          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginRight: 2 }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#CBD5E1" : "#64748B" }}>✕ Tout</Text>
        </Pressable>
      )}
      {FILTER_TYPES.map(f => {
        const active = activeTypes.has(f.id);
        return (
          <Pressable key={f.id} onPress={() => toggleType(f.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: active ? f.color : isDark ? "#1E293B" : "#F1F5F9", borderWidth: 1, borderColor: active ? f.color : isDark ? "#334155" : "#E2E8F0" }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : isDark ? "#94A3B8" : "#64748B" }}>{f.label}</Text>
          </Pressable>
        );
      })}
      <View style={{ width: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginHorizontal: 4 }} />
      {FILTER_STATUSES.map(f => {
        const active = activeStatuses.has(f.id);
        return (
          <Pressable key={f.id} onPress={() => toggleStatus(f.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: active ? f.color : isDark ? "#1E293B" : "#F1F5F9", borderWidth: 1, borderColor: active ? f.color : isDark ? "#334155" : "#E2E8F0" }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : isDark ? "#94A3B8" : "#64748B" }}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // Interventions filtrées par zone pour la vue calendrier grille
  const calendarInterventions = useMemo(() => {
    if (!interventions) return [];
    if (effectiveZone === "all") return interventions;
    return interventions.filter((i: any) => i.zone === effectiveZone);
  }, [interventions, effectiveZone]);

  // Effective view (used for nav + title when in calendar mode)
  const effectiveView = displayMode === "calendar" ? calView : viewMode;

  // --- NAVIGATION ---
  const handlePrev = () => {
    setCursorDate((d) => {
      if (effectiveView === "day") return addDays(d, -1);
      if (effectiveView === "week") return addDays(d, -7);
      if (effectiveView === "year") return new Date(d.getFullYear() - 1, 0, 1);
      return addMonths(d, -1);
    });
  };

  const handleNext = () => {
    setCursorDate((d) => {
      if (effectiveView === "day") return addDays(d, 1);
      if (effectiveView === "week") return addDays(d, 7);
      if (effectiveView === "year") return new Date(d.getFullYear() + 1, 0, 1);
      return addMonths(d, 1);
    });
  };

  // --- MISE À JOUR ÉVÉNEMENT (optimistic update + rollback) ---
  const handleEventUpdate = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const prev = queryClient.getQueryData<any[]>(["interventions"]);
    queryClient.setQueryData<any[]>(["interventions"], (old) =>
      old ? old.map(i => i.id === id ? { ...i, start_time: newStart, end_time: newEnd } : i) : old
    );
    try {
      await api.patch(`/api/interventions/${id}`, { start_time: newStart, end_time: newEnd });
    } catch {
      queryClient.setQueryData(["interventions"], prev);
    }
  }, [queryClient]);

  const handleToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDate(toISODate(now));
  };

  // Titre dynamique
  const headerTitle = useMemo(() => {
    const d = cursorDate;
    const vm = effectiveView;
    if (vm === "year") return d.getFullYear().toString();
    if (vm === "day")
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    if (vm === "week") {
      const start = startOfWeek(d, 1);
      const end = addDays(start, 6);
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString(
          "fr-FR",
          { month: "long" },
        )}`;
      }
      return `${start.getDate()} ${start.toLocaleDateString("fr-FR", {
        month: "short",
      })} - ${end.getDate()} ${end.toLocaleDateString("fr-FR", {
        month: "short",
      })}`;
    }
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }, [cursorDate, effectiveView]);

  // --- COMPOSANT CARTE INTERVENTION (Mobile Optimisé) ---
  const InterventionCard = ({
    item,
    compact = false,
  }: {
    item: any;
    compact?: boolean;
  }) => {
    // Style différent selon compact ou normal
    const cardPadding = compact ? "p-2" : "p-3";
    const cardRadius = compact ? 12 : 20;

    // Heure de début et fin
    const startTime = new Date(item.start_time);
    const endTime = item.end_time
      ? new Date(item.end_time)
      : new Date(startTime.getTime() + 60 * 60 * 1000);

    // Durée affichée si time_tbd
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationH = Math.floor(durationMs / 3600000);
    const durationMin = Math.round((durationMs % 3600000) / 60000);
    const durationLabel = durationMin > 0
      ? `${durationH}h${String(durationMin).padStart(2, "0")}`
      : `${durationH}h`;

    const typeConfig = TYPE_CONFIG[item.type ?? "intervention"] ?? TYPE_CONFIG["intervention"];
    const hasClient = ["intervention", "devis"].includes(item.type ?? "intervention");

    const employees: any[] = [...(item.employees ?? [])].sort((a: any, b: any) => (a.id as string).localeCompare(b.id as string));

    return (
      <Pressable
        onPress={() => router.push(`/(app)/calendar/${item.id}?from_view=${viewMode}&from_date=${selectedDate}` as any)}
        onLongPress={() => {
          const currentIds = employees.map((e: any) => e.id);
          setAssignModal({ mode: "single", interventionId: item.id, currentIds });
          setSelectedAssignIds(currentIds);
          setInitialAssignIds(currentIds);
        }}
        delayLongPress={400}
        className={`border border-border dark:border-slate-800 shadow-sm active:scale-[0.98] mb-3 overflow-hidden`}
        style={{ borderRadius: cardRadius }}
      >
        {/* Fond en bandes verticales distinctes selon les employés */}
        {employees.length > 0 && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" }}>
            {employees.map((e: any) => (
              <View key={e.id} style={{ flex: 1, backgroundColor: (e.color ?? "#3B82F6") + "2C" }} />
            ))}
          </View>
        )}
        {/* Barre colorée avec prénoms (1 ou plusieurs employés) */}
        {employees.length > 0 && (
          <View style={{ flexDirection: "row", height: 18, width: "100%" }}>
            {employees.map((emp: any) => (
              <View key={emp.id} style={{ flex: 1, backgroundColor: emp.color ?? "#94A3B8", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "700", color: "#fff", paddingHorizontal: 4, letterSpacing: 0.2 }}>
                  {(emp.full_name ?? emp.email ?? "?").split(" ")[0]}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className={`flex-row items-center gap-3 ${cardPadding}`}>
          {/* COLONNE GAUCHE : HEURE */}
          <View
            className={`items-center justify-center ${compact ? "w-11" : "w-16"} py-2.5`}
            style={{ borderRadius: 16, backgroundColor: typeConfig.bg }}
          >
            {item.time_tbd ? (
              <>
                <Text
                  style={{ color: typeConfig.text }}
                  className={`font-bold ${compact ? "text-xs" : "text-base"}`}
                >
                  {durationLabel}
                </Text>
                {!compact && (
                  <Text className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    durée
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text
                  style={{ color: typeConfig.text }}
                  className={`font-bold ${compact ? "text-xs" : "text-base"}`}
                >
                  {startTime.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Brussels",
                  })}
                </Text>
                {!compact && (
                  <Text className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    {endTime.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Brussels",
                    })}
                  </Text>
                )}
              </>
            )}
            {!compact && item.type && item.type !== "intervention" && (
              <Text style={{ color: typeConfig.text }} className="text-[8px] font-bold uppercase mt-0.5 tracking-wide">
                {typeConfig.label}
              </Text>
            )}
          </View>

          {/* COLONNE DROITE : INFOS */}
          <View className="flex-1 justify-center">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-2">
                <Text
                  className={`font-extrabold text-foreground dark:text-white ${compact ? "text-sm" : "text-xl"}`}
                  numberOfLines={1}
                >
                  {hasClient && item.client?.address ? item.client.address : item.title}
                </Text>
                {hasClient && item.client?.address && (
                  <>
                    <Text className={`text-muted-foreground dark:text-slate-400 font-medium ${compact ? "text-[10px]" : "text-sm"} mt-0.5`} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.client?.name && (
                      <Text className={`text-muted-foreground dark:text-slate-400 ${compact ? "text-[10px]" : "text-xs"}`} numberOfLines={1}>
                        {item.client.name}
                      </Text>
                    )}
                  </>
                )}
                {hasClient && !item.client?.address && item.client?.name && (
                  <Text className={`text-muted-foreground dark:text-slate-400 font-medium ${compact ? "text-[10px]" : "text-sm"} mt-0.5`} numberOfLines={1}>
                    {item.client.name}
                  </Text>
                )}
              </View>

              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {!compact && <StatusBadge status={item.status} className="self-center" />}
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // --- COMPOSANT CARTE RAW EVENT (partagé entre toutes les vues) ---
  const RawEventCard = ({
    item,
    compact = false,
    date,
  }: {
    item: RawCalendarEvent;
    compact?: boolean;
    date: string;
  }) => {
    const startTime = new Date(item.start_time);
    const endTime = new Date(item.end_time);
    const firstEmp = item.assigned_employees?.[0] ?? item.employee;
    const employeeColor = firstEmp?.color ?? "#94A3B8";

    return (
      <Pressable
        onPress={() =>
          router.push(
            `/(app)/calendar/raw-event/${item.id}?date=${date}` as any,
          )
        }
        className="mb-2 active:scale-[0.98]"
        style={{
          borderRadius: compact ? 10 : 18,
          borderWidth: 1.5,
          borderColor: employeeColor + "55",
          backgroundColor: employeeColor + "11",
          padding: compact ? 7 : 12,
        }}
      >
        <View className="flex-row items-center gap-2">
          <View
            className={`items-center justify-center ${compact ? "w-9" : "w-16"} py-2 rounded-xl`}
            style={{ backgroundColor: employeeColor + "22" }}
          >
            <Text
              className={`font-bold ${compact ? "text-[9px]" : "text-sm"}`}
              style={{ color: employeeColor }}
            >
              {startTime.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Brussels",
              })}
            </Text>
            {!compact && (
              <Text className="text-[9px] text-muted-foreground mt-0.5 font-medium">
                {endTime.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Brussels",
                })}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text
                className={`font-bold text-foreground dark:text-white flex-1 ${compact ? "text-[10px]" : "text-sm"}`}
                numberOfLines={1}
              >
                {item.summary}
              </Text>
              <View className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
                <Text className="text-[7px] font-bold text-slate-500 dark:text-slate-300 uppercase">
                  RAW
                </Text>
              </View>
            </View>
            {!compact && (item.location || item.description) ? (
              <View className="flex-row items-center gap-1 mt-0.5 opacity-70">
                {item.location && <MapPin size={10} color="#64748B" />}
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {item.location || item.description}
                </Text>
              </View>
            ) : null}
            {item.assigned_employees && item.assigned_employees.length > 1 && (
              <View className="flex-row mt-1">
                {item.assigned_employees.slice(0, 4).map((emp) => (
                  <View
                    key={emp.id}
                    className="w-4 h-4 rounded-full items-center justify-center border border-white"
                    style={{ backgroundColor: emp.color, marginRight: -4 }}
                  >
                    <Text className="text-[6px] text-white font-bold">
                      {emp.full_name?.[0] ?? "?"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // --- HELPER : groupement status → type → sous-zone (partagé entre Jour/Semaine/Mois) ---
  const renderInterventionGroups = (list: any[], dateStr: string, compact = false) => {
    if (list.length === 0) return null;
    const STATUS_ORDER: Record<string,number> = { in_progress:0, planned:1, done:2 };
    const STATUS_LABELS: Record<string,string> = { in_progress:"En cours", planned:"Planifié", done:"Terminé" };
    const STATUS_COLORS: Record<string,string> = { in_progress:"#F97316", planned:"#3B82F6", done:"#22C55E" };
    const TYPE_ORDER: Record<string,number> = { intervention:0, devis:1, tournee:2, note:3 };
    const TYPE_LABELS: Record<string,string> = { intervention:"Intervention", devis:"Devis", tournee:"Tournée", note:"Note" };
    const TYPE_COLORS: Record<string,string> = { intervention:"#3B82F6", devis:"#8B5CF6", tournee:"#F97316", note:"#64748B" };
    const sorted = [...list].sort((a,b) => {
      const sd = (STATUS_ORDER[a.status]??9)-(STATUS_ORDER[b.status]??9); if (sd!==0) return sd;
      const td = (TYPE_ORDER[a.type??"intervention"]??9)-(TYPE_ORDER[b.type??"intervention"]??9); if (td!==0) return td;
      return (a.sub_zone??"").localeCompare(b.sub_zone??"");
    });
    const groups: { status:string; items:typeof sorted }[] = [];
    for (const item of sorted) {
      const last = groups[groups.length-1];
      if (last && last.status === item.status) last.items.push(item);
      else groups.push({ status: item.status, items: [item] });
    }
    return groups.map((group) => {
      const typeGroups: { type:string; items:typeof sorted }[] = [];
      for (const item of group.items) {
        const t = item.type ?? "intervention";
        const last = typeGroups[typeGroups.length-1];
        if (last && last.type === t) last.items.push(item);
        else typeGroups.push({ type: t, items: [item] });
      }
      const multipleTypes = typeGroups.length > 1;
      return (
        <View key={group.status} style={compact ? {} : { marginBottom: 8 }}>
          {!compact && (
            <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:6, marginTop:4 }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:STATUS_COLORS[group.status]??"#94A3B8" }} />
              <Text style={{ fontSize:11, fontWeight:"700", color:STATUS_COLORS[group.status]??"#94A3B8", textTransform:"uppercase", letterSpacing:0.5 }}>
                {STATUS_LABELS[group.status]??group.status} ({group.items.length})
              </Text>
              <View style={{ flex:1, height:1, backgroundColor:isDark?"#1E293B":"#F1F5F9", marginLeft:4 }} />
            </View>
          )}
          {typeGroups.map((tg) => {
            const szGroups: { code:string|null; items:typeof sorted }[] = [];
            for (const item of tg.items) {
              const code = item.sub_zone ?? null;
              const last = szGroups[szGroups.length-1];
              if (last && last.code === code) last.items.push(item);
              else szGroups.push({ code, items:[item] });
            }
            const hasMultipleSubZones = szGroups.length > 1 || (szGroups.length === 1 && szGroups[0].code !== null);
            return (
              <View key={tg.type}>
                {!compact && (multipleTypes || tg.type !== "intervention") && (
                  <View style={{ flexDirection:"row", alignItems:"center", gap:5, marginBottom:5, marginTop:2, marginLeft:8 }}>
                    <View style={{ width:4, height:4, borderRadius:2, backgroundColor:TYPE_COLORS[tg.type]??"#94A3B8" }} />
                    <Text style={{ fontSize:10, fontWeight:"700", color:TYPE_COLORS[tg.type]??"#94A3B8", textTransform:"uppercase", letterSpacing:0.4 }}>
                      {TYPE_LABELS[tg.type]??tg.type}
                    </Text>
                    <View style={{ flex:1, height:1, backgroundColor:isDark?"#1E293B":"#F1F5F9", marginLeft:4 }} />
                  </View>
                )}
                {szGroups.map((sg, idx) => {
                  const sz = sg.code ? subZoneMap.get(sg.code) : null;
                  return (
                    <View key={sg.code??`null-${idx}`} style={{ marginTop: idx===0 ? 0 : (compact ? 4 : 10) }}>
                      {!compact && hasMultipleSubZones && (
                        <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginBottom:6, marginLeft:8 }}>
                          <Text style={{ fontSize:11, fontWeight:"800", color:sz?.color??"#94A3B8", textTransform:"uppercase", letterSpacing:0.6 }}>
                            {sz ? sz.label : "Sans zone"}
                          </Text>
                          <View style={{ flex:1, height:1, backgroundColor:(sz?.color??"#94A3B8")+"40", marginHorizontal:6 }} />
                          {sz && sg.code && (
                            <Pressable hitSlop={10}
                              style={{ backgroundColor:sz.color+"20", borderRadius:8, paddingHorizontal:8, paddingVertical:4, flexDirection:"row", alignItems:"center", gap:4 }}
                              onPress={() => {
                                const code=sg.code!; const label=sz.label; const color=sz.color; const date=dateStr;
                                const existingIds=[...new Set(sg.items.flatMap((it:any)=>(it.employees??[]).map((e:any)=>e.id as string)))];
                                setTimeout(()=>{ setAssignModal({mode:"zone",date,subZone:code,label,color}); setSelectedAssignIds(existingIds); setInitialAssignIds(existingIds); },100);
                              }}
                            >
                              <Users size={12} color={sz.color} />
                              <Text style={{ fontSize:10, fontWeight:"700", color:sz.color }}>Assigner</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                      <View style={{ flexDirection:"row", gap:8 }}>
                        <View style={{ width:6, borderRadius:3, backgroundColor:sz?.color??"#CBD5E1" }} />
                        <View style={{ flex:1 }}>
                          {sg.items.map(item => <InterventionCard key={item.id} item={item} compact={compact} />)}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      );
    });
  };

  // --- VUE : MOIS ---
  const RenderMonth = () => {
    const calendarTheme = useMemo(() => {
      const textColor = isDark ? "#F8FAFC" : "#09090B";
      const textMuted = isDark ? "#94A3B8" : "#71717A";
      return {
        calendarBackground: "transparent",
        textSectionTitleColor: textMuted,
        selectedDayBackgroundColor: "#3B82F6",
        selectedDayTextColor: "#ffffff",
        todayTextColor: "#3B82F6",
        dayTextColor: textColor,
        textDisabledColor: isDark ? "#1E293B" : "#E4E4E7",
        dotColor: "#3B82F6",
        selectedDotColor: "#ffffff",
        arrowColor: textColor,
        monthTextColor: textColor,
        indicatorColor: "#3B82F6",
        textDayFontWeight: "500" as const,
        textMonthFontWeight: "bold" as const,
        textDayHeaderFontWeight: "600" as const,
        textDayFontSize: 16,
        "stylesheet.calendar.header": {
          header: {
            marginBottom: 10,
            marginTop: 0,
          },
        },
      };
    }, [isDark]);

    const monthStart = toISODate(startOfMonth(cursorDate));
    const monthEnd = toISODate(endOfMonth(cursorDate));
    const { rawEvents: monthRawEvents } = useRawEventsByRange(monthStart, monthEnd);

    const markedDates = useMemo(() => {
      const marks: any = {};
      const today = toISODate(new Date());
      // Points orange pour les raw events
      monthRawEvents?.forEach((ev) => {
        const dateKey = ev.start_time.split("T")[0];
        if (dateKey !== selectedDate)
          marks[dateKey] = { marked: true, dotColor: "#F59E0B" };
      });
      // Points bleus pour les interventions filtrées par zone (priorité sur orange)
      Object.keys(itemsByDate).forEach((dateKey) => {
        if (itemsByDate[dateKey].length > 0 && dateKey !== selectedDate)
          marks[dateKey] = { marked: true, dotColor: "#3B82F6" };
      });
      marks[selectedDate] = {
        selected: true,
        selectedColor: "#3B82F6",
        selectedTextColor: "#ffffff",
      };
      if (today !== selectedDate)
        marks[today] = { ...(marks[today] || {}), textColor: "#3B82F6" };
      return marks;
    }, [itemsByDate, monthRawEvents, selectedDate]);

    const dayList = (itemsByDate[selectedDate] || []).filter(filterItem);
    const dayRawEvents = monthRawEvents.filter(
      (e) => e.start_time.split("T")[0] === selectedDate,
    );

    return (
      <View>
        <View
          className="mx-4 shadow-sm bg-card dark:bg-slate-900 border border-border dark:border-slate-800"
          style={{ borderRadius: 25, overflow: "hidden" }}
        >
          <RNCalendar
            key={`${isDark ? "d" : "l"}-${toISODate(cursorDate)}`}
            current={toISODate(cursorDate)}
            onDayPress={(day: DateData) => {
              setSelectedDate(day.dateString);
              setCursorDate(new Date(day.dateString));
            }}
            markedDates={markedDates}
            firstDay={1}
            hideArrows={true}
            enableSwipeMonths={true}
            disableMonthChange={true}
            theme={calendarTheme}
            renderHeader={() => null}
          />
        </View>

        <View className="pt-6 pb-24">
          {/* ✅ DATE + HEURES : Alignés sur la même ligne */}
          <View className="flex-row items-center px-6 mb-4 gap-3">
            {isAdmin && (
              <Pressable
                onPress={() =>
                  router.push(
                    `/(app)/calendar/rate-session?date=${selectedDate}&zone=${effectiveZone}` as any
                  )
                }
                className="w-11 h-11 rounded-full items-center justify-center active:opacity-60"
                style={{ backgroundColor: "#3B82F6" + "18" }}
              >
                <Zap size={20} color="#3B82F6" />
              </Pressable>
            )}
            <Text className="text-xl font-bold text-foreground dark:text-white capitalize mr-2">
              {new Date(selectedDate).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <DailyStatsBadge dateStr={selectedDate} zone={effectiveZone} />
          </View>

          <View className="px-4">
            {dayRawEvents.length > 0 && (
              <View className="mb-3">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="w-2 h-2 rounded-full bg-amber-400" />
                  <Text className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Non structuré ({dayRawEvents.length})
                  </Text>
                </View>
                {dayRawEvents.map((item) => (
                  <RawEventCard
                    key={item.id}
                    item={item}
                    date={selectedDate}
                  />
                ))}
              </View>
            )}
            <FilterChipsBar />
            {dayList.length === 0 && dayRawEvents.length === 0 ? (
              <Text className="text-muted-foreground dark:text-slate-500 text-center py-8">
                Rien de prévu.
              </Text>
            ) : renderInterventionGroups(dayList, selectedDate)}
          </View>
        </View>
      </View>
    );
  };

  // --- VUE : SEMAINE ---
  const RenderWeek = () => {
    const start = startOfWeek(cursorDate, 1);
    const end = addDays(start, 6);
    const weekDays = datesRange(start, 7);

    const { rangeStats } = usePlanningRangeStats(
      toISODate(start),
      toISODate(end),
      effectiveZone,
    );
    const { rawEvents: weekRawEvents } = useRawEventsByRange(
      toISODate(start),
      toISODate(end),
    );
    const rawByDate = useMemo(() => {
      const map: Record<string, RawCalendarEvent[]> = {};
      for (const ev of weekRawEvents) {
        const k = ev.start_time.split("T")[0];
        (map[k] ||= []).push(ev);
      }
      return map;
    }, [weekRawEvents]);

    const WeekContent = () => (
      <>
        {weekDays.map((date) => {
          const iso = toISODate(date);
          const list = (itemsByDate[iso] || []).filter(filterItem);
          const rawList = rawByDate[iso] || [];
          const isToday = iso === toISODate(new Date());
          const stat = rangeStats ? rangeStats[iso] : null;

          let badgeBg = "bg-muted";
          let badgeText = "text-muted-foreground";
          if (stat) {
            if (stat.status === "ok") {
              badgeBg = "bg-green-100 dark:bg-green-900";
              badgeText = "text-green-700 dark:text-green-300";
            }
            if (stat.status === "warning") {
              badgeBg = "bg-orange-100 dark:bg-orange-900";
              badgeText = "text-orange-700 dark:text-orange-300";
            }
            if (stat.status === "overload") {
              badgeBg = "bg-red-100 dark:bg-red-900";
              badgeText = "text-red-700 dark:text-red-300";
            }
          }

          return (
            <View
              key={iso}
              className={`${isDesktop ? "flex-1 mx-1" : "w-[140px] mr-3"}`}
            >
              <View
                className={`p-3 rounded-t-3xl border-t border-x border-border dark:border-slate-800 ${
                  isToday ? "bg-primary/10" : "bg-card dark:bg-slate-900"
                }`}
              >
                <Text
                  className={`font-bold text-center ${
                    isToday ? "text-primary" : "text-foreground dark:text-white"
                  }`}
                >
                  {date.toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                  })}
                </Text>

                {stat && (
                  <View
                    className={`mt-2 py-1 px-2 rounded-md items-center justify-center ${badgeBg}`}
                  >
                    <Text className={`text-[10px] font-bold ${badgeText}`}>
                      {fmtH(Math.round(stat.planned_hours * 2) / 2)} / {fmtH(stat.capacity_hours)}
                    </Text>
                  </View>
                )}
              </View>
              <View className="bg-muted/30 dark:bg-slate-900/50 min-h-[400px] border-b border-x border-border dark:border-slate-800 rounded-b-3xl p-3">
                {rawList.map((item) => (
                  <RawEventCard key={item.id} item={item} compact date={iso} />
                ))}
                {renderInterventionGroups(list, iso, true)}
                {list.length === 0 && rawList.length === 0 && (
                  <Text className="text-xs text-muted-foreground text-center mt-4 opacity-50">
                    -
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </>
    );

    if (isDesktop) {
      return (
        <View className="flex-row px-4 w-full">
          <WeekContent />
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <WeekContent />
      </ScrollView>
    );
  };

  // --- VUE : JOUR ---
  const RenderDay = () => {
    const iso = toISODate(cursorDate);
    const list = (itemsByDate[iso] || []).filter(filterItem);
    const { rawEvents } = useRawEventsByDate(iso);

    const unassigned = rawEvents.filter((e) => !e.employee_id);
    const assigned = rawEvents.filter((e) => !!e.employee_id);

    const hasAnything = list.length > 0 || rawEvents.length > 0;

    return (
      <View className="px-4 w-full">
        <PlanningHeader
          dateStr={iso}
          zone={effectiveZone}
          onRateSession={
            isAdmin
              ? () => router.push(`/(app)/calendar/rate-session?date=${iso}&zone=${effectiveZone}` as any)
              : undefined
          }
        />

        {/* Lane : Non assigné (raw events sans employé) */}
        {unassigned.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-2 h-2 rounded-full bg-slate-400" />
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Non assigné ({unassigned.length})
              </Text>
            </View>
            <View className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-3 border border-dashed border-slate-200 dark:border-slate-700">
              {unassigned.map((item) => (
                <RawEventCard key={item.id} item={item} date={iso} />
              ))}
            </View>
          </View>
        )}

        {/* Interventions structurées */}
        <FilterChipsBar />
        {renderInterventionGroups(list, iso)}

        {/* Raw events assignés (dans la lane de leur employé) */}
        {assigned.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-2 h-2 rounded-full bg-green-500" />
              <Text className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
                Assignés ({assigned.length})
              </Text>
            </View>
            {assigned.map((item) => (
              <RawEventCard key={item.id} item={item} date={iso} />
            ))}
          </View>
        )}

        {!hasAnything && (
          <View className="items-center justify-center py-20 bg-muted/20 dark:bg-slate-900/30 rounded-2xl border border-dashed border-border dark:border-slate-800">
            <Clock size={48} color="#94A3B8" />
            <Text className="text-muted-foreground mt-4">
              Aucune intervention ce jour.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // --- VUE : ANNÉE ---
  const RenderYear = () => {
    const year = cursorDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    const padding = 32;
    const gap = 12;
    let cols = 1;
    if (width >= 1280) cols = 4;
    else if (width >= 1024) cols = 3;
    else if (width >= 768) cols = 2;

    const itemWidth = (width - padding - gap * (cols - 1)) / cols;

    const { rawEvents: yearRawEvents } = useRawEventsByRange(
      `${year}-01-01`,
      `${year}-12-31`,
    );

    const yearMarkers = useMemo(() => {
      const marks: any = {};
      yearRawEvents?.forEach((ev) => {
        const dateKey = ev.start_time.split("T")[0];
        marks[dateKey] = { marked: true, dotColor: "#F59E0B" };
      });
      interventions?.forEach((item: any) => {
        if (item.start_time) {
          const dateKey = dayKeyFromDateTime(item.start_time);
          marks[dateKey] = { marked: true, dotColor: "#3B82F6" };
        }
      });
      return marks;
    }, [interventions, yearRawEvents]);

    const miniTheme = useMemo(
      () => ({
        calendarBackground: "transparent",
        textSectionTitleColor: isDark ? "#64748B" : "#A1A1AA",
        dayTextColor: isDark ? "#F8FAFC" : "#09090B",
        todayTextColor: "#3B82F6",
        textDisabledColor: isDark ? "#1E293B" : "#F4F4F5",
        dotColor: "#3B82F6",
        selectedDotColor: "#3B82F6",
        monthTextColor: "transparent",
        textDayFontSize: 10,
        textDayHeaderFontSize: 10,
        textDayFontWeight: "400" as const,
        textDayHeaderFontWeight: "bold" as const,
        "stylesheet.calendar.main": {
          container: { padding: 0, backgroundColor: "transparent" },
          monthView: { marginVertical: 0 },
        },
        "stylesheet.day.basic": {
          base: {
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
          },
          text: {
            marginTop: 0,
            fontSize: 10,
            color: isDark ? "#F8FAFC" : "#09090B",
          },
        },
      }),
      [isDark],
    );

    return (
      <View className="flex-row flex-wrap px-4 gap-3 pb-24 justify-start">
        {months.map((m) => {
          const monthISO = toISODate(m);
          return (
            <Pressable
              key={monthISO}
              style={{ width: itemWidth }}
              onPress={() => {
                setCursorDate(m);
                setViewMode("month");
              }}
              className="mb-2"
            >
              <Text className="text-sm font-bold text-primary dark:text-blue-400 mb-2 pl-1 capitalize">
                {m.toLocaleDateString("fr-FR", { month: "long" })}
              </Text>

              <View
                pointerEvents="none"
                className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-2 shadow-sm"
                style={{ borderRadius: 16, overflow: "hidden" }}
              >
                <RNCalendar
                  key={`year-${monthISO}-${isDark ? "d" : "l"}`}
                  current={monthISO}
                  hideArrows={true}
                  hideExtraDays={true}
                  disableMonthChange={true}
                  firstDay={1}
                  markedDates={yearMarkers}
                  theme={miniTheme}
                  renderHeader={() => null}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* === HEADER PRINCIPAL === */}
      <View
        className="px-6 pb-2 bg-background dark:bg-slate-950 z-10"
        // ✅ Modification clé : Ajout dynamique du padding en haut
        // Si Web -> 24px (pt-6)
        // Si Mobile -> insets.top + 10px pour descendre sous l'encoche
        style={{ paddingTop: isWeb ? 24 : insets.top + 10 }}
      >
        {/* Titre + Toggle Liste/Calendrier + Btn Aujourd'hui */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-3xl font-bold text-foreground dark:text-slate-50">
            Planning
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <SlidingPillSelector
              options={[
                { id: "list",     label: "Liste" },
                { id: "calendar", label: "Calendrier" },
              ]}
              selected={displayMode}
              onSelect={(id) => setDisplayMode(id as DisplayMode)}
              pillColor="#3B82F6"
              bgColor={isDark ? "#1E293B" : "#E2E8F0"}
              activeTextColor="#FFFFFF"
              inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
              containerStyle={{ width: 160 }}
              itemPy={6}
              fontSize={12}
            />
            <Pressable
              onPress={handleToday}
              className="flex-row items-center bg-primary/10 px-3 py-2 rounded-full active:opacity-60"
            >
              <CalendarCheck size={16} color="#3B82F6" />
            </Pressable>
          </View>
        </View>

        {/* Slider (View Selector) — animated pill */}
        {displayMode === "list" ? (
          <SlidingPillSelector
            options={[
              { id: "day",   label: "Jour" },
              { id: "week",  label: "Semaine" },
              { id: "month", label: "Mois" },
              { id: "year",  label: "Année" },
            ]}
            selected={viewMode}
            onSelect={(id) => setViewMode(id as ViewMode)}
            pillColor={isDark ? "#475569" : "#FFFFFF"}
            bgColor={isDark ? "#1E293B" : "#E2E8F0"}
            activeTextColor={isDark ? "#FFFFFF" : "#09090B"}
            inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
            containerStyle={{ marginBottom: 12 }}
            itemPy={8}
          />
        ) : (
          <SlidingPillSelector
            options={[
              { id: "day",  label: "Jour" },
              { id: "week", label: "Semaine" },
            ]}
            selected={calView}
            onSelect={(id) => setCalView(id as CalView)}
            pillColor={isDark ? "#475569" : "#FFFFFF"}
            bgColor={isDark ? "#1E293B" : "#E2E8F0"}
            activeTextColor={isDark ? "#FFFFFF" : "#09090B"}
            inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
            containerStyle={{ marginBottom: 12 }}
            itemPy={8}
          />
        )}

        {/* Barre de Navigation (Flèches + Titre + Zone selector) */}
        <View className="flex-row items-center justify-between bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-3 rounded-3xl shadow-sm mb-4">
          <Pressable
            onPress={handlePrev}
            className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 active:bg-muted/50"
          >
            <ChevronLeft
              size={24}
              color={isDark ? "#FFF" : "#09090B"}
            />
          </Pressable>

          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-foreground dark:text-white capitalize">
              {headerTitle}
            </Text>
            {/* Zone selector — admins seulement */}
            {isAdmin ? (
              <SlidingPillSelector
                options={[
                  { id: "all",      label: "Toutes" },
                  { id: "hainaut",  label: "Hainaut",  pillColor: "#3B82F6", activeTextColor: "#FFFFFF" },
                  { id: "ardennes", label: "Ardennes", pillColor: "#10B981", activeTextColor: "#FFFFFF" },
                ]}
                selected={selectedZone}
                onSelect={(id) => setSelectedZone(id as "all" | "hainaut" | "ardennes")}
                pillColor={isDark ? "#475569" : "#FFFFFF"}
                bgColor={isDark ? "#0F172A" : "#F1F5F9"}
                activeTextColor={isDark ? "#FFFFFF" : "#09090B"}
                inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
                containerStyle={{ marginTop: 8 }}
                itemPy={5}
                itemPx={14}
                fontSize={12}
              />
            ) : (
              /* Badge zone fixe pour les employés */
              <View
                className="mt-1.5 px-3 py-0.5 rounded-full"
                style={{ backgroundColor: userZone === "ardennes" ? "#D1FAE5" : "#DBEAFE" }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: userZone === "ardennes" ? "#059669" : "#2563EB" }}
                >
                  {userZone === "ardennes" ? "Ardennes" : "Hainaut"}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={handleNext}
            className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 active:bg-muted/50"
          >
            <ChevronRight
              size={24}
              color={isDark ? "#FFF" : "#09090B"}
            />
          </Pressable>
        </View>

      </View>

      {/* === CONTENU === */}
      {displayMode === "calendar" ? (
        <View style={{ flex: 1 }}>
          {calView === "week" ? (
            <CalendarWeekView
              weekStart={startOfWeek(cursorDate, 1)}
              interventions={calendarInterventions}
              isDark={isDark}
              onEventUpdate={handleEventUpdate}
            />
          ) : (
            <CalendarDayView
              date={toISODate(cursorDate)}
              interventions={calendarInterventions}
              isDark={isDark}
              onEventUpdate={handleEventUpdate}
            />
          )}
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {viewMode === "month" && <RenderMonth />}
          {viewMode === "week" && <RenderWeek />}
          {viewMode === "day" && <RenderDay />}
          {viewMode === "year" && <RenderYear />}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/(app)/calendar/add")}
        className="absolute bottom-6 right-6 h-14 w-14 bg-primary items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform rounded-full"
      >
        <Plus size={28} color="white" />
      </Pressable>

      {/* Modal assignation employés */}
      <Modal
        visible={!!assignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModal(null)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "#00000066" }} onPress={() => setAssignModal(null)} />
        <View style={{
          backgroundColor: isDark ? "#0F172A" : "#fff",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#fff" : "#0F172A" }}>
                {assignModal?.mode === "zone" ? `Assigner — ${assignModal.label}` : "Assigner des employés"}
              </Text>
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                {assignModal?.mode === "zone"
                  ? "Remplace les assignations existantes"
                  : "Sélectionner un ou plusieurs employés"}
              </Text>
            </View>
            <Pressable
              onPress={() => setAssignModal(null)}
              hitSlop={12}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? "#334155" : "#F1F5F9", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 14, color: "#94A3B8", fontWeight: "700" }}>✕</Text>
            </Pressable>
          </View>

          {/* Liste employés */}
          <ScrollView style={{ maxHeight: 320 }}>
            {(allEmployees ?? []).filter((e: any) => e.role !== "admin" || true).map((emp: any) => {
              const isSelected = selectedAssignIds.includes(emp.id);
              return (
                <Pressable
                  key={emp.id}
                  onPress={() => setSelectedAssignIds(prev =>
                    prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                  )}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: isDark ? "#1E293B" : "#F8FAFC" }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: emp.color ?? "#3B82F6", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                      {(emp.full_name ?? emp.email ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: isDark ? "#fff" : "#0F172A" }}>
                    {emp.full_name ?? emp.email}
                  </Text>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2, borderColor: isSelected ? "#3B82F6" : "#CBD5E1",
                    backgroundColor: isSelected ? "#3B82F6" : "transparent",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Bouton confirmer */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Pressable
              onPress={async () => {
                if (!assignModal) return;
                try {
                  const initSet = new Set(initialAssignIds);
                  const unchanged = selectedAssignIds.length === initialAssignIds.length && selectedAssignIds.every(id => initSet.has(id));
                  const idsToSend = unchanged ? [] : selectedAssignIds;
                  if (assignModal.mode === "single") {
                    await assignEmployees.mutateAsync({ interventionId: assignModal.interventionId, employeeIds: idsToSend });
                  } else {
                    await bulkAssign.mutateAsync({ date: assignModal.date, subZone: assignModal.subZone, employeeIds: idsToSend, skipAssigned: false });
                  }
                  setAssignModal(null);
                } catch {
                  // toast handled by mutation
                }
              }}
              disabled={assignEmployees.isPending || bulkAssign.isPending}
              style={{ backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            >
              {(assignEmployees.isPending || bulkAssign.isPending)
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {(() => {
                      const initSet = new Set(initialAssignIds);
                      const unchanged = selectedAssignIds.length === initialAssignIds.length && selectedAssignIds.every(id => initSet.has(id));
                      if (unchanged) return "Retirer les employés";
                      return selectedAssignIds.length === 0 ? "Retirer les employés" : `Assigner (${selectedAssignIds.length})`;
                    })()}
                  </Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
