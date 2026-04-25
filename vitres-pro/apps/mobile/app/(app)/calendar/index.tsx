import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import {
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  Text,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { LocaleConfig } from "react-native-calendars";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDayView } from "../../../src/ui/components/calendar/CalendarDayView";
import { CalendarWeekView } from "../../../src/ui/components/calendar/CalendarWeekView";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarCheck,
} from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports internes
import { api } from "../../../src/lib/api";
import {
  toISODate,
  addMonths,
  addDays,
  startOfWeek,
  toBrusselsDateTimeString,
} from "../../../src/lib/date";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";
import { useSubZones } from "../../../src/hooks/useZones";
import {
  useAssignEmployees,
  useBulkAssignEmployees,
} from "../../../src/hooks/useInterventions";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { MonthView } from "../../../src/ui/components/calendar/MonthView";
import { WeekView } from "../../../src/ui/components/calendar/WeekView";
import { DayView } from "../../../src/ui/components/calendar/DayView";
import { YearView } from "../../../src/ui/components/calendar/YearView";
import { AssignModalState } from "../../../src/ui/components/calendar/InterventionGroups";

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
  pillColor?: string; // override pill bg for this option
  activeTextColor?: string; // override active text color for this option
};

type SlidingPillSelectorProps = {
  options: PillOption[];
  selected: string;
  onSelect: (id: string) => void;
  pillColor: string; // default pill bg
  bgColor: string; // track background
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
    backgroundColor: options[selectedIndex]?.pillColor ?? pillColor,
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
      onLayout={
        (e: LayoutChangeEvent) =>
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
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

  const [, startTransition] = useTransition();

  // --- ÉTATS ---
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const displayMode: DisplayMode = "list";
  const [calView, setCalView] = useState<CalView>("week");
  const [cursorDate, setCursorDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  // Admin : toggle Toutes/Hainaut/Ardennes. Employé : fixé à sa zone.
  const [selectedZone, setSelectedZone] = useState<
    "all" | "hainaut" | "ardennes"
  >("all");
  // Filtres actifs
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [assignModal, setAssignModal] = useState<
    | { mode: "single"; interventionId: string; currentIds: string[] }
    | {
        mode: "zone";
        date: string;
        subZone: string;
        label: string;
        color: string;
      }
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
      m.set(z.code, {
        label: z.label,
        color: z.parent_zone === "ardennes" ? "#22C55E" : "#3B82F6",
      });
    }
    return m;
  }, [subZones]);

  useEffect(() => {
    if (params.view) {
      const v = (
        typeof params.view === "string" ? params.view : params.view[0]
      ) as ViewMode;
      if (["day", "week", "month", "year"].includes(v)) setViewMode(v);
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

  // --- PLAGE DE DATES selon la vue active ---
  const rangeStart = useMemo(() => {
    if (viewMode === "year")
      return new Date(cursorDate.getFullYear(), 0, 1).toISOString();
    const d = new Date(cursorDate);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [viewMode, cursorDate.getFullYear(), cursorDate.getMonth()]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "year")
      return new Date(
        cursorDate.getFullYear(),
        11,
        31,
        23,
        59,
        59,
      ).toISOString();
    const d = new Date(cursorDate);
    d.setMonth(d.getMonth() + 2);
    d.setDate(0);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [viewMode, cursorDate.getFullYear(), cursorDate.getMonth()]);

  // --- DATA ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    data: interventions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["interventions", rangeStart, rangeEnd],
    queryFn: async () => {
      const res = await api.get("/api/interventions", {
        params: { start: rangeStart, end: rangeEnd },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 0,
    refetchInterval: 3000,
    refetchOnMount: true,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await api.get("/api/settings/company")).data,
    staleTime: 0,
    refetchInterval: 500,
    refetchOnMount: true,
  });
  const hideCash = companySettings?.hide_cash ?? false;

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["company-settings"] });
  }, []));

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

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
      if (hideCash && (it.payment_mode === "cash" || !it.payment_mode)) continue;
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
  }, [interventions, dayKeyFromDateTime, effectiveZone, hideCash]);

  // --- FILTRES ---
  const filterItem = useCallback(
    (item: any) => {
      if (activeTypes.size > 0 && !activeTypes.has(item.type ?? "intervention"))
        return false;
      if (activeStatuses.size > 0 && !activeStatuses.has(item.status))
        return false;
      return true;
    },
    [activeTypes, activeStatuses],
  );

  const toggleType = useCallback((id: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const toggleStatus = useCallback((id: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  // Interventions filtrées par zone pour la vue calendrier grille
  const calendarInterventions = useMemo(() => {
    if (!interventions) return [];
    return interventions.filter((i: any) => {
      if (effectiveZone !== "all" && i.zone !== effectiveZone) return false;
      if (hideCash && (i.payment_mode === "cash" || !i.payment_mode)) return false;
      return true;
    });
  }, [interventions, effectiveZone, hideCash]);

  // Effective view (used for nav + title when in calendar mode)
  const effectiveView = displayMode === "calendar" ? calView : viewMode;

  // --- NAVIGATION ---
  const handlePrev = useCallback(() => {
    setCursorDate((d) => {
      if (effectiveView === "day") return addDays(d, -1);
      if (effectiveView === "week") return addDays(d, -7);
      if (effectiveView === "year") return new Date(d.getFullYear() - 1, 0, 1);
      return addMonths(d, -1);
    });
  }, [effectiveView]);

  const handleNext = useCallback(() => {
    setCursorDate((d) => {
      if (effectiveView === "day") return addDays(d, 1);
      if (effectiveView === "week") return addDays(d, 7);
      if (effectiveView === "year") return new Date(d.getFullYear() + 1, 0, 1);
      return addMonths(d, 1);
    });
  }, [effectiveView]);

  // --- MISE À JOUR ÉVÉNEMENT (optimistic update + rollback) ---
  const handleEventUpdate = useCallback(
    async (id: string, newStart: string, newEnd: string) => {
      const prev = queryClient.getQueryData<any[]>(["interventions"]);
      queryClient.setQueryData<any[]>(["interventions"], (old) =>
        old
          ? old.map((i) =>
              i.id === id
                ? { ...i, start_time: newStart, end_time: newEnd }
                : i,
            )
          : old,
      );
      try {
        await api.patch(`/api/interventions/${id}`, {
          start_time: newStart,
          end_time: newEnd,
        });
      } catch {
        queryClient.setQueryData(["interventions"], prev);
      }
    },
    [queryClient],
  );

  const handleToday = useCallback(() => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDate(toISODate(now));
  }, []);

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

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
    >
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
            <Pressable
              onPress={handleToday}
              className="flex-row items-center bg-primary/10 px-3 py-2 rounded-full active:opacity-60"
              style={{ gap: 6 }}
            >
              <CalendarCheck size={16} color="#3B82F6" />
              <Text style={{ color: "#3B82F6", fontSize: 13, fontWeight: "600" }}>
                Aujourd'hui
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Slider (View Selector) — animated pill */}
        {displayMode === "list" ? (
          <SlidingPillSelector
            options={[
              { id: "day", label: "Jour" },
              { id: "week", label: "Semaine" },
              { id: "month", label: "Mois" },
              { id: "year", label: "Année" },
            ]}
            selected={viewMode}
            onSelect={(id) =>
              startTransition(() => setViewMode(id as ViewMode))
            }
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
              { id: "day", label: "Jour" },
              { id: "week", label: "Semaine" },
            ]}
            selected={calView}
            onSelect={(id) => startTransition(() => setCalView(id as CalView))}
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
            <ChevronLeft size={24} color={isDark ? "#FFF" : "#09090B"} />
          </Pressable>

          <View className="items-center flex-1">
            <Text className="text-lg font-bold text-foreground dark:text-white capitalize">
              {headerTitle}
            </Text>
            {/* Zone selector — admins seulement */}
            {isAdmin ? (
              <SlidingPillSelector
                options={[
                  { id: "all", label: "Toutes" },
                  {
                    id: "hainaut",
                    label: "Hainaut",
                    pillColor: "#3B82F6",
                    activeTextColor: "#FFFFFF",
                  },
                  {
                    id: "ardennes",
                    label: "Ardennes",
                    pillColor: "#10B981",
                    activeTextColor: "#FFFFFF",
                  },
                ]}
                selected={selectedZone}
                onSelect={(id) =>
                  startTransition(() =>
                    setSelectedZone(id as "all" | "hainaut" | "ardennes"),
                  )
                }
                pillColor={isDark ? "#475569" : "#FFFFFF"}
                bgColor={isDark ? "#0F172A" : "#F1F5F9"}
                activeTextColor={isDark ? "#FFFFFF" : "#09090B"}
                inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
                containerStyle={{
                  marginTop: 8,
                  ...(Platform.OS === "web"
                    ? { width: isDesktop ? 300 : "100%" }
                    : {}),
                }}
                itemPy={5}
                itemPx={Platform.OS === "web" && !isDesktop ? 4 : 14}
                fontSize={Platform.OS === "web" && !isDesktop ? 11 : 12}
              />
            ) : (
              /* Badge zone fixe pour les employés */
              <View
                className="mt-1.5 px-3 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    userZone === "ardennes" ? "#D1FAE5" : "#DBEAFE",
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: userZone === "ardennes" ? "#059669" : "#2563EB",
                  }}
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
            <ChevronRight size={24} color={isDark ? "#FFF" : "#09090B"} />
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
        <>
          {viewMode === "day" ? (
            <DayView
              cursorDate={cursorDate}
              isDark={isDark}
              isAdmin={isAdmin}
              itemsByDate={itemsByDate}
              effectiveZone={effectiveZone}
              viewMode={viewMode}
              selectedDate={selectedDate}
              filterItem={filterItem}
              subZoneMap={subZoneMap}
              activeTypes={activeTypes}
              activeStatuses={activeStatuses}
              toggleType={toggleType}
              toggleStatus={toggleStatus}
              setActiveTypes={setActiveTypes}
              setActiveStatuses={setActiveStatuses}
              setAssignModal={setAssignModal}
              setSelectedAssignIds={setSelectedAssignIds}
              setInitialAssignIds={setInitialAssignIds}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ) : (
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
              }
            >
              {viewMode === "month" && (
                <MonthView
                  cursorDate={cursorDate}
                  selectedDate={selectedDate}
                  setCursorDate={setCursorDate}
                  setSelectedDate={setSelectedDate}
                  setViewMode={setViewMode}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  itemsByDate={itemsByDate}
                  effectiveZone={effectiveZone}
                  filterItem={filterItem}
                  subZoneMap={subZoneMap}
                  viewMode={viewMode}
                  activeTypes={activeTypes}
                  activeStatuses={activeStatuses}
                  toggleType={toggleType}
                  toggleStatus={toggleStatus}
                  setActiveTypes={setActiveTypes}
                  setActiveStatuses={setActiveStatuses}
                  setAssignModal={setAssignModal}
                  setSelectedAssignIds={setSelectedAssignIds}
                  setInitialAssignIds={setInitialAssignIds}
                />
              )}
              {viewMode === "week" && (
                <WeekView
                  cursorDate={cursorDate}
                  isDark={isDark}
                  isAdmin={isAdmin}
                  isDesktop={isDesktop}
                  itemsByDate={itemsByDate}
                  effectiveZone={effectiveZone}
                  viewMode={viewMode}
                  selectedDate={selectedDate}
                  filterItem={filterItem}
                  subZoneMap={subZoneMap}
                  setAssignModal={setAssignModal}
                  setSelectedAssignIds={setSelectedAssignIds}
                  setInitialAssignIds={setInitialAssignIds}
                />
              )}
              {viewMode === "year" && (
                <YearView
                  cursorDate={cursorDate}
                  isDark={isDark}
                  interventions={interventions}
                  dayKeyFromDateTime={dayKeyFromDateTime}
                  setCursorDate={setCursorDate}
                  setViewMode={setViewMode}
                />
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* FAB — admin uniquement */}
      {isAdmin && (
        <Pressable
          onPress={() =>
            router.push(
              `/(app)/calendar/add?from_view=${viewMode}&from_date=${selectedDate}` as any,
            )
          }
          className="absolute bottom-6 right-6 h-14 w-14 bg-primary items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform rounded-full"
        >
          <Plus size={28} color="white" />
        </Pressable>
      )}

      {/* Modal assignation employés */}
      <Modal
        visible={!!assignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "#00000066" }}
          onPress={() => setAssignModal(null)}
        />
        <View
          style={{
            backgroundColor: isDark ? "#0F172A" : "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? "#1E293B" : "#F1F5F9",
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: isDark ? "#fff" : "#0F172A",
                }}
              >
                {assignModal?.mode === "zone"
                  ? `Assigner — ${assignModal.label}`
                  : "Assigner des employés"}
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
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: isDark ? "#334155" : "#F1F5F9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ fontSize: 14, color: "#94A3B8", fontWeight: "700" }}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Liste employés */}
          <ScrollView style={{ maxHeight: 320 }}>
            {(allEmployees ?? [])
              .filter((e: any) => e.role !== "admin" || true)
              .map((emp: any) => {
                const isSelected = selectedAssignIds.includes(emp.id);
                return (
                  <Pressable
                    key={emp.id}
                    onPress={() =>
                      setSelectedAssignIds((prev) =>
                        prev.includes(emp.id)
                          ? prev.filter((id) => id !== emp.id)
                          : [...prev, emp.id],
                      )
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      gap: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? "#1E293B" : "#F8FAFC",
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: emp.color ?? "#3B82F6",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        {(emp.full_name ?? emp.email ?? "?")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: "600",
                        color: isDark ? "#fff" : "#0F172A",
                      }}
                    >
                      {emp.full_name ?? emp.email}
                    </Text>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? "#3B82F6" : "#CBD5E1",
                        backgroundColor: isSelected ? "#3B82F6" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          ✓
                        </Text>
                      )}
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
                  const unchanged =
                    selectedAssignIds.length === initialAssignIds.length &&
                    selectedAssignIds.every((id) => initSet.has(id));
                  const idsToSend = unchanged ? [] : selectedAssignIds;
                  if (assignModal.mode === "single") {
                    await assignEmployees.mutateAsync({
                      interventionId: assignModal.interventionId,
                      employeeIds: idsToSend,
                    });
                  } else {
                    await bulkAssign.mutateAsync({
                      date: assignModal.date,
                      subZone: assignModal.subZone,
                      employeeIds: idsToSend,
                      skipAssigned: false,
                    });
                  }
                  setAssignModal(null);
                } catch {
                  // toast handled by mutation
                }
              }}
              disabled={assignEmployees.isPending || bulkAssign.isPending}
              style={{
                backgroundColor: "#3B82F6",
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              {assignEmployees.isPending || bulkAssign.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                >
                  {(() => {
                    const initSet = new Set(initialAssignIds);
                    const unchanged =
                      selectedAssignIds.length === initialAssignIds.length &&
                      selectedAssignIds.every((id) => initSet.has(id));
                    if (unchanged) return "Retirer les employés";
                    return selectedAssignIds.length === 0
                      ? "Retirer les employés"
                      : `Assigner (${selectedAssignIds.length})`;
                  })()}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
