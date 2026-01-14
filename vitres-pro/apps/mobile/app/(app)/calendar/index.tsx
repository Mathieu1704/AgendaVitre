// apps/mobile/app/(app)/calendar/index.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Divider,
  FAB,
  Menu,
  Modal,
  Portal,
  Text,
} from "react-native-paper";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useColorScheme } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { api } from "../../../src/lib/api";
import { supabase } from "../../../src/lib/supabase";

// ✅ important: configure LocaleConfig FR une seule fois
import "../../../src/lib/calendarLocale";

import {
  addDays,
  addMonths,
  datesRange,
  endOfMonth,
  parseISODate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "../../../src/lib/date";

type Intervention = {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  status: "planned" | "in_progress" | "done" | string;
  client?: { name: string; address: string };
};

type ViewMode = "day" | "week" | "month" | "year" | "schedule" | "4days";

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Jour" },
  { key: "4days", label: "4 jours" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
  { key: "schedule", label: "Planning" },
];

function normalizeCursorForView(mode: ViewMode, d: Date) {
  const x = startOfDay(d);
  if (mode === "week") return startOfWeek(x, 1);
  if (mode === "month" || mode === "schedule") return startOfMonth(x);
  if (mode === "year") return new Date(x.getFullYear(), 0, 1, 0, 0, 0, 0);
  return x; // day / 4days
}

function statusLabel(status: string) {
  if (status === "planned") return "Planifié";
  if (status === "in_progress") return "En cours";
  if (status === "done") return "Terminé";
  return status;
}

function statusColor(status: string) {
  if (status === "done") return "#16A34A";
  if (status === "in_progress") return "#EA580C";
  return "#2563EB";
}

export default function CalendarScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isCompact = width < 420;

  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursorDate, setCursorDate] = useState<Date>(() =>
    normalizeCursorForView("month", today)
  );

  const [selectedDateISO, setSelectedDateISO] = useState<string>(
    toISODate(today)
  );
  const [viewMenuVisible, setViewMenuVisible] = useState(false);

  // Overlay interventions (comme Google Calendar)
  const [dayOverlayVisible, setDayOverlayVisible] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["interventions"],
    queryFn: async () => {
      const res = await api.get("/api/interventions/");
      return (Array.isArray(res.data) ? res.data : []) as Intervention[];
    },
  });

  const interventions = data ?? [];

  const itemsByDate = useMemo(() => {
    const map: Record<string, Intervention[]> = {};
    for (const it of interventions) {
      if (!it?.id || !it?.start_time) continue;
      const k = it.start_time.split("T")[0];
      if (!k) continue;
      (map[k] ||= []).push(it);
    }
    for (const k of Object.keys(map)) {
      map[k].sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }
    return map;
  }, [interventions]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const k of Object.keys(itemsByDate)) {
      marks[k] = { marked: true, dotColor: "#3B82F6" };
    }
    marks[selectedDateISO] = {
      ...(marks[selectedDateISO] || {}),
      selected: true,
      selectedColor: "#3B82F6",
    };
    return marks;
  }, [itemsByDate, selectedDateISO]);

  const calendarTheme = useMemo(
    () => ({
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      calendarBackground: isDark ? "#1E293B" : "#FFFFFF",
      textSectionTitleColor: isDark ? "#94A3B8" : "#64748B",
      selectedDayBackgroundColor: "#3B82F6",
      selectedDayTextColor: "#FFFFFF",
      todayTextColor: "#3B82F6",
      dayTextColor: isDark ? "#E2E8F0" : "#1F2937",
      textDisabledColor: isDark ? "#475569" : "#D1D5DB",
      dotColor: "#3B82F6",
      selectedDotColor: "#FFFFFF",
      monthTextColor: isDark ? "#FFFFFF" : "#111827",
      textMonthFontWeight: "bold" as const,
      textDayFontSize: 16,
      textMonthFontSize: 18,
    }),
    [isDark]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  const setMode = (m: ViewMode) => {
    setViewMode(m);
    setCursorDate((prev) => normalizeCursorForView(m, prev));
    setViewMenuVisible(false);
  };

  const goToday = () => {
    setSelectedDateISO(toISODate(today));
    setCursorDate(normalizeCursorForView(viewMode, today));
  };

  const goPrev = () => {
    setCursorDate((d) => {
      if (viewMode === "day") return addDays(d, -1);
      if (viewMode === "4days") return addDays(d, -4);
      if (viewMode === "week") return addDays(d, -7);
      if (viewMode === "month" || viewMode === "schedule")
        return addMonths(d, -1);
      if (viewMode === "year") return new Date(d.getFullYear() - 1, 0, 1);
      return d;
    });
  };

  const goNext = () => {
    setCursorDate((d) => {
      if (viewMode === "day") return addDays(d, +1);
      if (viewMode === "4days") return addDays(d, +4);
      if (viewMode === "week") return addDays(d, +7);
      if (viewMode === "month" || viewMode === "schedule")
        return addMonths(d, +1);
      if (viewMode === "year") return new Date(d.getFullYear() + 1, 0, 1);
      return d;
    });
  };

  const rangeTitle = useMemo(() => {
    const frLong = (d: Date, opt: Intl.DateTimeFormatOptions) =>
      d.toLocaleDateString("fr-FR", opt);

    if (viewMode === "year") return String(cursorDate.getFullYear());

    if (viewMode === "month" || viewMode === "schedule") {
      return frLong(cursorDate, { month: "long", year: "numeric" });
    }

    if (viewMode === "week") {
      const start = startOfWeek(cursorDate, 1);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startStr = frLong(start, { day: "numeric" });
      const endStr = frLong(
        end,
        sameMonth
          ? { day: "numeric", month: "long", year: "numeric" }
          : { day: "numeric", month: "long" }
      );
      const monthYear = frLong(end, { year: "numeric" });
      return `${startStr} – ${endStr} ${sameMonth ? "" : monthYear}`.trim();
    }

    if (viewMode === "4days") {
      const start = cursorDate;
      const end = addDays(start, 3);
      const startStr = frLong(start, { day: "numeric", month: "short" });
      const endStr = frLong(end, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${startStr} – ${endStr}`;
    }

    // day
    return frLong(cursorDate, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [cursorDate, viewMode]);

  const openDayOverlay = useCallback(
    (iso: string) => {
      setSelectedDateISO(iso);
      setDayOverlayVisible(true);
    },
    [setSelectedDateISO]
  );

  const closeDayOverlay = () => setDayOverlayVisible(false);

  const selectedInterventions = itemsByDate[selectedDateISO] || [];

  const InterventionRow = ({ item }: { item: Intervention }) => {
    const time = new Date(item.start_time).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <Pressable
        onPress={() => {
          closeDayOverlay();
          router.push(`/(app)/calendar/${item.id}` as any);
        }}
        style={{
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
          borderWidth: 1,
          borderColor: isDark ? "#334155" : "#E2E8F0",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <FontAwesome name="clock-o" size={16} color="#3B82F6" />
            <Text style={{ marginLeft: 8, fontWeight: "800", fontSize: 16 }}>
              {time}
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: `${statusColor(item.status)}20`,
            }}
          >
            <Text
              style={{
                color: statusColor(item.status),
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>

        <Text style={{ marginTop: 8, fontSize: 16, fontWeight: "700" }}>
          {item.title}
        </Text>

        <Text style={{ marginTop: 4, opacity: 0.75 }}>
          {item.client?.name ?? "Client inconnu"}
          {item.client?.address ? ` · ${item.client.address}` : ""}
        </Text>
      </Pressable>
    );
  };

  // ---- RENDERS DES VUES ----

  const renderMonth = () => (
    <View style={{ flex: 1, padding: 16 }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1200,
          alignSelf: "center",
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
          borderWidth: 1,
          borderColor: isDark ? "#334155" : "#E2E8F0",
        }}
      >
        <Calendar
          current={toISODate(cursorDate)}
          firstDay={1}
          onDayPress={(day: DateData) => openDayOverlay(day.dateString)}
          onMonthChange={(m) => setCursorDate(new Date(m.year, m.month - 1, 1))}
          enableSwipeMonths
          hideArrows
          markedDates={markedDates}
          theme={calendarTheme}
        />
      </View>
    </View>
  );

  const renderDay = () => {
    const iso = selectedDateISO;
    const list = itemsByDate[iso] || [];
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 900,
            alignSelf: "center",
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
          }}
        >
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "800" }}>
              {new Date(iso).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>

            <Pressable
              onPress={() => openDayOverlay(iso)}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: "#3B82F6", fontWeight: "700" }}>
                Ouvrir les interventions (overlay)
              </Text>
            </Pressable>

            <Divider style={{ marginVertical: 14 }} />

            {list.length === 0 ? (
              <Text style={{ opacity: 0.7 }}>
                Aucune intervention ce jour-là.
              </Text>
            ) : (
              list.map((it) => <InterventionRow key={it.id} item={it} />)
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderColumns = (count: number) => {
    const start =
      viewMode === "week" ? startOfWeek(cursorDate, 1) : startOfDay(cursorDate);

    const days = datesRange(start, count);

    return (
      <View style={{ flex: 1, padding: 16 }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 1200,
            alignSelf: "center",
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
          }}
        >
          {/* ✅ scroll horizontal interne => jamais “coupé” */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: 12 }}
          >
            {days.map((d) => {
              const iso = toISODate(d);
              const list = itemsByDate[iso] || [];
              const dayName = d.toLocaleDateString("fr-FR", {
                weekday: "short",
              });
              const dayNum = d.toLocaleDateString("fr-FR", { day: "numeric" });

              return (
                <View
                  key={iso}
                  style={{
                    width: Math.max(130, isDesktop ? 160 : 140),
                    marginRight: 12,
                    borderRadius: 16,
                    padding: 12,
                    backgroundColor:
                      iso === selectedDateISO
                        ? isDark
                          ? "#0B1220"
                          : "#EFF6FF"
                        : isDark
                        ? "#0F172A"
                        : "#F8FAFC",
                    borderWidth: 1,
                    borderColor:
                      iso === selectedDateISO
                        ? "#3B82F6"
                        : isDark
                        ? "#334155"
                        : "#E2E8F0",
                  }}
                >
                  <Pressable
                    onPress={() => openDayOverlay(iso)}
                    style={{ marginBottom: 10 }}
                  >
                    <Text style={{ fontWeight: "800" }}>
                      {dayName} {dayNum}
                    </Text>
                    <Text style={{ opacity: 0.65, marginTop: 2, fontSize: 12 }}>
                      {list.length} intervention{list.length > 1 ? "s" : ""}
                    </Text>
                  </Pressable>

                  {list.length === 0 ? (
                    <Text style={{ opacity: 0.6, fontSize: 12 }}>—</Text>
                  ) : (
                    list.slice(0, 4).map((it) => {
                      const t = new Date(it.start_time).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      );
                      return (
                        <Pressable
                          key={it.id}
                          onPress={() => {
                            closeDayOverlay();
                            router.push(`/(app)/calendar/${it.id}` as any);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 14,
                            marginBottom: 8,
                            backgroundColor: isDark ? "#111827" : "#FFFFFF",
                            borderWidth: 1,
                            borderColor: isDark ? "#334155" : "#E2E8F0",
                          }}
                        >
                          <Text style={{ fontWeight: "800", fontSize: 12 }}>
                            {t}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={{ marginTop: 2, fontWeight: "700" }}
                          >
                            {it.title}
                          </Text>
                          <Text
                            style={{ marginTop: 2, fontSize: 11, opacity: 0.7 }}
                            numberOfLines={1}
                          >
                            {it.client?.name ?? "Client"}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}

                  {list.length > 4 && (
                    <Text style={{ opacity: 0.7, fontSize: 12 }}>
                      +{list.length - 4} autres…
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderYear = () => {
    const year = cursorDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));

    const cols = width >= 1200 ? 4 : width >= 900 ? 3 : 2;
    const cardW = Math.floor(
      (Math.min(width, 1200) - 16 * 2 - (cols - 1) * 12) / cols
    );

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            width: "100%",
            maxWidth: 1200,
            alignSelf: "center",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {months.map((m) => (
            <View
              key={m.getMonth()}
              style={{
                width: cardW,
                borderRadius: 18,
                overflow: "hidden",
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderWidth: 1,
                borderColor: isDark ? "#334155" : "#E2E8F0",
              }}
            >
              <View style={{ padding: 12 }}>
                <Text style={{ fontWeight: "800" }}>
                  {m.toLocaleDateString("fr-FR", { month: "long" })}
                </Text>
              </View>

              <Calendar
                current={toISODate(m)}
                firstDay={1}
                hideArrows
                disableMonthChange
                hideExtraDays
                onDayPress={(day) => openDayOverlay(day.dateString)}
                markedDates={markedDates}
                theme={{
                  ...calendarTheme,
                  textDayFontSize: 12,
                  textMonthFontSize: 12,
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderSchedule = () => {
    const monthStart = startOfMonth(cursorDate);
    const monthEnd = endOfMonth(cursorDate);

    const inMonth = interventions.filter((it) => {
      const k = it.start_time.split("T")[0];
      const d = parseISODate(k);
      return d >= monthStart && d <= monthEnd;
    });

    const grouped = new Map<string, Intervention[]>();
    for (const it of inMonth) {
      const k = it.start_time.split("T")[0];
      (grouped.get(k) ?? grouped.set(k, []).get(k)!)?.push(it);
    }

    const keys = Array.from(grouped.keys()).sort();
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={{ width: "100%", maxWidth: 900, alignSelf: "center" }}>
          {keys.length === 0 ? (
            <Text style={{ opacity: 0.7 }}>
              Aucune intervention ce mois-ci.
            </Text>
          ) : (
            keys.map((k) => {
              const list = (grouped.get(k) || []).sort(
                (a, b) =>
                  new Date(a.start_time).getTime() -
                  new Date(b.start_time).getTime()
              );

              return (
                <View key={k} style={{ marginBottom: 18 }}>
                  <Pressable onPress={() => openDayOverlay(k)}>
                    <Text style={{ fontSize: 16, fontWeight: "900" }}>
                      {new Date(k).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </Text>
                  </Pressable>
                  <View style={{ marginTop: 10 }}>
                    {list.map((it) => (
                      <InterventionRow key={it.id} item={it} />
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (viewMode === "month") return renderMonth();
    if (viewMode === "day") return renderDay();
    if (viewMode === "week") return renderColumns(7);
    if (viewMode === "4days") return renderColumns(4);
    if (viewMode === "year") return renderYear();
    return renderSchedule();
  };

  // ---- UI états ----
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-dark-900">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 12, opacity: 0.7 }}>
          Chargement du planning…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-dark-900 px-6">
        <FontAwesome name="exclamation-circle" size={64} color="#EF4444" />
        <Text style={{ fontSize: 20, fontWeight: "900", marginTop: 12 }}>
          Erreur de chargement
        </Text>
        <Text style={{ opacity: 0.7, marginTop: 6, textAlign: "center" }}>
          Impossible de récupérer les interventions
        </Text>
        <Button
          mode="contained"
          onPress={() => refetch()}
          style={{ marginTop: 16 }}
        >
          Réessayer
        </Button>
      </View>
    );
  }

  // ---- RENDER PRINCIPAL ----
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#0F172A" : "#F3F4F6" }}>
      {/* ✅ Header “Google Calendar” : flèches + Today + titre + vue + logout */}
      <Appbar.Header
        style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
      >
        <Appbar.Action icon="chevron-left" onPress={goPrev} />
        <Appbar.Action icon="chevron-right" onPress={goNext} />

        {isCompact ? (
          <Appbar.Action icon="calendar-today" onPress={goToday} />
        ) : (
          <Button
            mode="outlined"
            onPress={goToday}
            style={{ marginRight: 8 }}
            compact
          >
            Aujourd’hui
          </Button>
        )}

        <Appbar.Content title={rangeTitle} />

        <Menu
          visible={viewMenuVisible}
          onDismiss={() => setViewMenuVisible(false)}
          anchor={
            <Button
              mode="text"
              onPress={() => setViewMenuVisible(true)}
              compact
            >
              {VIEW_OPTIONS.find((v) => v.key === viewMode)?.label ?? "Vue"} ▾
            </Button>
          }
        >
          {VIEW_OPTIONS.map((opt) => (
            <Menu.Item
              key={opt.key}
              onPress={() => setMode(opt.key)}
              title={opt.label}
              leadingIcon={opt.key === viewMode ? "check" : undefined}
            />
          ))}
        </Menu>

        <Appbar.Action icon="logout" onPress={handleLogout} />
      </Appbar.Header>

      {/* ✅ Corps plein écran (plus de scroll obligatoire) */}
      <View style={{ flex: 1 }}>{renderBody()}</View>

      {/* ✅ FAB Add */}
      <FAB
        icon="plus"
        onPress={() => router.push("/(app)/calendar/add")}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          backgroundColor: "#3B82F6",
          borderRadius: 16,
        }}
        customSize={64}
      />

      {/* ✅ Overlay interventions (clic jour => pop par dessus, sans scroll page) */}
      <Portal>
        <Modal
          visible={dayOverlayVisible}
          onDismiss={closeDayOverlay}
          style={{
            justifyContent: isDesktop ? "center" : "flex-end",
            padding: 12,
          }}
          contentContainerStyle={{
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderRadius: 20,
            padding: 16,
            width: isDesktop ? 560 : "100%",
            alignSelf: "center",
            maxHeight: isDesktop ? "80%" : "70%",
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                {new Date(selectedDateISO).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Text style={{ opacity: 0.7, marginTop: 4 }}>
                {selectedInterventions.length} intervention
                {selectedInterventions.length > 1 ? "s" : ""}
              </Text>
            </View>

            <Pressable onPress={closeDayOverlay} style={{ padding: 8 }}>
              <FontAwesome
                name="close"
                size={18}
                color={isDark ? "#E2E8F0" : "#111827"}
              />
            </Pressable>
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedInterventions.length === 0 ? (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ opacity: 0.75 }}>Aucune intervention.</Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 12 }}
                  onPress={() => {
                    closeDayOverlay();
                    router.push("/(app)/calendar/add");
                  }}
                >
                  Ajouter une intervention
                </Button>
              </View>
            ) : (
              selectedInterventions.map((it) => (
                <InterventionRow key={it.id} item={it} />
              ))
            )}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}
