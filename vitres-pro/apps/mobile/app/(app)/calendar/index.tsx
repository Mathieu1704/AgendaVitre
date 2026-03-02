import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Linking,
} from "react-native";
import {
  Calendar as RNCalendar,
  DateData,
  LocaleConfig,
} from "react-native-calendars";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CalendarCheck,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
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

const DailyStatsBadge = ({ dateStr }: { dateStr: string }) => {
  const { stats, isLoading } = usePlanningStats(dateStr);

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
        {stats.planned_hours}h / {stats.capacity_hours}h
      </Text>
    </View>
  );
};

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();

  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Breakpoint pour Desktop
  const isDesktop = width >= 1024;

  // --- ÉTATS ---
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursorDate, setCursorDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));

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

  const itemsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!interventions) return map;

    for (const it of interventions) {
      if (!it?.start_time) continue;
      const k = dayKeyFromDateTime(it.start_time);
      (map[k] ||= []).push(it);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [interventions, dayKeyFromDateTime]);

  // --- NAVIGATION ---
  const handlePrev = () => {
    setCursorDate((d) => {
      if (viewMode === "day") return addDays(d, -1);
      if (viewMode === "week") return addDays(d, -7);
      if (viewMode === "year") return new Date(d.getFullYear() - 1, 0, 1);
      return addMonths(d, -1);
    });
  };

  const handleNext = () => {
    setCursorDate((d) => {
      if (viewMode === "day") return addDays(d, 1);
      if (viewMode === "week") return addDays(d, 7);
      if (viewMode === "year") return new Date(d.getFullYear() + 1, 0, 1);
      return addMonths(d, 1);
    });
  };

  const handleToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDate(toISODate(now));
  };

  // Titre dynamique
  const headerTitle = useMemo(() => {
    const d = cursorDate;
    if (viewMode === "year") return d.getFullYear().toString();
    if (viewMode === "day")
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    if (viewMode === "week") {
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
  }, [cursorDate, viewMode]);

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

    const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
      intervention: { bg: "#EFF6FF", text: "#3B82F6" },
      devis:        { bg: "#F5F3FF", text: "#8B5CF6" },
      tournee:      { bg: "#FFF7ED", text: "#F97316" },
      note:         { bg: "#F8FAFC", text: "#64748B" },
    };
    const typeStyle = TYPE_STYLE[item.type ?? "intervention"] ?? TYPE_STYLE["intervention"];
    const hasClient = ["intervention", "devis"].includes(item.type ?? "intervention");

    return (
      <Pressable
        onPress={() => router.push(`/(app)/calendar/${item.id}` as any)}
        className={`bg-card dark:bg-slate-900 border border-border dark:border-slate-800 shadow-sm active:scale-[0.98] mb-3 ${cardPadding}`}
        style={{ borderRadius: cardRadius }}
      >
        <View className="flex-row items-center gap-3">
          {/* COLONNE GAUCHE : HEURE */}
          <View
            className={`items-center justify-center ${compact ? "w-11" : "w-16"} py-2.5`}
            style={{ borderRadius: 16, backgroundColor: typeStyle.bg }}
          >
            <Text
              style={{ color: typeStyle.text }}
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
          </View>

          {/* COLONNE DROITE : INFOS */}
          <View className="flex-1 justify-center">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-2">
                <Text
                  className={`font-extrabold text-foreground dark:text-white ${
                    compact ? "text-sm" : "text-xl"
                  }`}
                  numberOfLines={1}
                >
                  {hasClient && item.client?.name
                    ? item.client.name
                    : item.title}
                </Text>

                {/* Sous-titre : titre seulement si un vrai nom client est affiché */}
                {hasClient && item.client?.name && (
                  <Text
                    className={`text-muted-foreground dark:text-slate-400 font-medium ${
                      compact ? "text-[10px]" : "text-sm"
                    } mt-0.5`}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                )}
              </View>

              {!compact && <StatusBadge status={item.status} />}
            </View>

            {/* Adresse (si client avec adresse, même anonyme) */}
            {!compact && hasClient && item.client?.address && (
              <View className="flex-row items-center mt-1.5 opacity-80">
                <MapPin size={12} color="#64748B" className="mr-1" />
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {item.client.address}
                </Text>
              </View>
            )}
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
      // Points bleus pour les interventions (priorité sur orange)
      interventions?.forEach((item: any) => {
        if (item.start_time) {
          const dateKey = dayKeyFromDateTime(item.start_time);
          if (dateKey !== selectedDate)
            marks[dateKey] = { marked: true, dotColor: "#3B82F6" };
        }
      });
      marks[selectedDate] = {
        selected: true,
        selectedColor: "#3B82F6",
        selectedTextColor: "#ffffff",
      };
      if (today !== selectedDate)
        marks[today] = { ...(marks[today] || {}), textColor: "#3B82F6" };
      return marks;
    }, [interventions, monthRawEvents, selectedDate]);

    const dayList = itemsByDate[selectedDate] || [];
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
          <View className="flex-row items-center px-6 mb-4">
            <Text className="text-xl font-bold text-foreground dark:text-white capitalize mr-3">
              {new Date(selectedDate).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>

            {/* Badge aligné juste à droite */}
            <DailyStatsBadge dateStr={selectedDate} />
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
            {dayList.length === 0 && dayRawEvents.length === 0 ? (
              <Text className="text-muted-foreground dark:text-slate-500 text-center py-8">
                Rien de prévu.
              </Text>
            ) : (
              dayList.map((item) => (
                <InterventionCard key={item.id} item={item} />
              ))
            )}
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
          const list = itemsByDate[iso] || [];
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
                      {stat.planned_hours}h / {stat.capacity_hours}h
                    </Text>
                  </View>
                )}
              </View>
              <View className="bg-muted/30 dark:bg-slate-900/50 min-h-[400px] border-b border-x border-border dark:border-slate-800 rounded-b-3xl p-3">
                {rawList.map((item) => (
                  <RawEventCard key={item.id} item={item} compact date={iso} />
                ))}
                {list.map((item) => (
                  <InterventionCard key={item.id} item={item} compact />
                ))}
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
    const list = itemsByDate[iso] || [];
    const { rawEvents } = useRawEventsByDate(iso);

    const unassigned = rawEvents.filter((e) => !e.employee_id);
    const assigned = rawEvents.filter((e) => !!e.employee_id);

    const hasAnything = list.length > 0 || rawEvents.length > 0;

    return (
      <View className="px-4 w-full">
        <PlanningHeader dateStr={iso} />

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
        {list.length > 0 && (
          <View className="mb-4">
            {assigned.length > 0 || unassigned.length > 0 ? (
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-2 h-2 rounded-full bg-blue-500" />
                <Text className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                  Interventions
                </Text>
              </View>
            ) : null}
            {list.map((item) => (
              <InterventionCard key={item.id} item={item} />
            ))}
          </View>
        )}

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
        {/* Titre + Btn Aujourd'hui */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-3xl font-bold text-foreground dark:text-slate-50">
            Planning
          </Text>
          <Pressable
            onPress={handleToday}
            className="flex-row items-center bg-primary/10 px-3 py-2 rounded-full active:opacity-60"
          >
            <CalendarCheck size={16} color="#3B82F6" />
            <Text className="ml-2 text-primary font-bold text-xs uppercase">
              Aujourd'hui
            </Text>
          </Pressable>
        </View>

        {/* Slider (View Selector) */}
        {/* ✅ Parent : rounded-full pour un effet "pilule" parfait */}
        <View className="flex-row bg-muted dark:bg-slate-800 p-1 rounded-full mb-4">
          {[
            { id: "day", label: "Jour" },
            { id: "week", label: "Semaine" },
            { id: "month", label: "Mois" },
            { id: "year", label: "Année" },
          ].map((mode) => (
            <Pressable
              key={mode.id}
              onPress={() => setViewMode(mode.id as ViewMode)}
              // ✅ Enfant : rounded-full aussi pour épouser la forme du parent
              className={`flex-1 py-1.5 items-center rounded-full ${
                viewMode === mode.id
                  ? "bg-background dark:bg-slate-600 shadow-sm"
                  : "bg-transparent"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  viewMode === mode.id
                    ? "text-foreground dark:text-white"
                    : "text-muted-foreground dark:text-slate-400"
                }`}
              >
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Barre de Navigation (Flèches + Titre) */}
        {/* ✅ Modification : rounded-3xl pour plus de rondeur */}
        <View className="flex-row items-center justify-between bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-3 rounded-3xl shadow-sm mb-4">
          <Pressable
            onPress={handlePrev}
            className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 active:bg-muted/50"
          >
            <ChevronLeft
              size={24}
              className="text-foreground dark:text-white"
              color={isDark ? "#FFF" : "#09090B"}
            />
          </Pressable>

          <Text className="text-lg font-bold text-foreground dark:text-white capitalize">
            {headerTitle}
          </Text>

          <Pressable
            onPress={handleNext}
            className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 active:bg-muted/50"
          >
            <ChevronRight
              size={24}
              className="text-foreground dark:text-white"
              color={isDark ? "#FFF" : "#09090B"}
            />
          </Pressable>
        </View>
      </View>

      {/* === CONTENU === */}
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

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/(app)/calendar/add")}
        className="absolute bottom-6 right-6 h-14 w-14 bg-primary items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform rounded-full"
      >
        <Plus size={28} color="white" />
      </Pressable>
    </View>
  );
}
