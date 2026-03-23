import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Calendar as RNCalendar, DateData } from "react-native-calendars";
import { Zap } from "lucide-react-native";
import { useRouter } from "expo-router";
import { toISODate, startOfMonth, endOfMonth } from "../../../lib/date";
import { useRawEventsByRange } from "../../../hooks/useRawEvents";
import { DailyStatsBadge } from "../DailyStatsBadge";
import { RawEventCard } from "./RawEventCard";
import { FilterChipsBar, renderInterventionGroups, AssignModalState, InterventionGroupsCtx } from "./InterventionGroups";

interface MonthViewProps {
  cursorDate: Date;
  selectedDate: string;
  setCursorDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  setViewMode: React.Dispatch<React.SetStateAction<any>>;
  isDark: boolean;
  isAdmin: boolean;
  itemsByDate: Record<string, any[]>;
  effectiveZone: string;
  userZone?: string;
  filterItem: (item: any) => boolean;
  subZoneMap: Map<string, { label: string; color: string }>;
  viewMode: string;
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  toggleType: (id: string) => void;
  toggleStatus: (id: string) => void;
  setActiveTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveStatuses: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAssignModal: React.Dispatch<React.SetStateAction<AssignModalState>>;
  setSelectedAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInitialAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const MonthView = React.memo(function MonthView({
  cursorDate,
  selectedDate,
  setCursorDate,
  setSelectedDate,
  setViewMode,
  isDark,
  isAdmin,
  itemsByDate,
  effectiveZone,
  filterItem,
  subZoneMap,
  viewMode,
  activeTypes,
  activeStatuses,
  toggleType,
  toggleStatus,
  setActiveTypes,
  setActiveStatuses,
  setAssignModal,
  setSelectedAssignIds,
  setInitialAssignIds,
}: MonthViewProps) {
  const router = useRouter();

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
      "stylesheet.calendar.header": { header: { marginBottom: 10, marginTop: 0 } },
    };
  }, [isDark]);

  const monthStart = toISODate(startOfMonth(cursorDate));
  const monthEnd = toISODate(endOfMonth(cursorDate));
  const { rawEvents: monthRawEvents } = useRawEventsByRange(monthStart, monthEnd);

  const markedDates = useMemo(() => {
    const marks: any = {};
    const today = toISODate(new Date());
    monthRawEvents?.forEach((ev) => {
      const dateKey = ev.start_time.split("T")[0];
      if (dateKey !== selectedDate) marks[dateKey] = { marked: true, dotColor: "#F59E0B" };
    });
    Object.keys(itemsByDate).forEach((dateKey) => {
      if (itemsByDate[dateKey].length > 0 && dateKey !== selectedDate)
        marks[dateKey] = { marked: true, dotColor: "#3B82F6" };
    });
    marks[selectedDate] = { selected: true, selectedColor: "#3B82F6", selectedTextColor: "#ffffff" };
    if (today !== selectedDate) marks[today] = { ...(marks[today] || {}), textColor: "#3B82F6" };
    return marks;
  }, [itemsByDate, monthRawEvents, selectedDate]);

  const dayList = (itemsByDate[selectedDate] || []).filter(filterItem);
  const dayRawEvents = monthRawEvents.filter((e) => e.start_time.split("T")[0] === selectedDate);

  const ctx: InterventionGroupsCtx = {
    isDark, isAdmin, subZoneMap, viewMode, selectedDate,
    setAssignModal, setSelectedAssignIds, setInitialAssignIds,
  };

  return (
    <View>
      <View className="mx-4 shadow-sm bg-card dark:bg-slate-900 border border-border dark:border-slate-800" style={{ borderRadius: 25, overflow: "hidden" }}>
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
        <View className="flex-row items-center px-6 mb-4 gap-3">
          {isAdmin && (
            <Pressable
              onPress={() => router.push(`/(app)/calendar/rate-session?date=${selectedDate}&zone=${effectiveZone}` as any)}
              className="w-11 h-11 rounded-full items-center justify-center active:opacity-60"
              style={{ backgroundColor: "#3B82F6" + "18" }}
            >
              <Zap size={20} color="#3B82F6" />
            </Pressable>
          )}
          <Text className="text-xl font-bold text-foreground dark:text-white capitalize mr-2">
            {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
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
                <RawEventCard key={item.id} item={item} date={selectedDate} />
              ))}
            </View>
          )}
          <FilterChipsBar
            activeTypes={activeTypes}
            activeStatuses={activeStatuses}
            isDark={isDark}
            toggleType={toggleType}
            toggleStatus={toggleStatus}
            setActiveTypes={setActiveTypes}
            setActiveStatuses={setActiveStatuses}
          />
          {dayList.length === 0 && dayRawEvents.length === 0 ? (
            <Text className="text-muted-foreground dark:text-slate-500 text-center py-8">Rien de prévu.</Text>
          ) : renderInterventionGroups(dayList, selectedDate, false, ctx)}
        </View>
      </View>
    </View>
  );
});
