import React, { useMemo } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Calendar as RNCalendar } from "react-native-calendars";
import { toISODate } from "../../../lib/date";
import { useRawEventsByRange } from "../../../hooks/useRawEvents";

interface YearViewProps {
  cursorDate: Date;
  isDark: boolean;
  interventions: any[] | undefined;
  dayKeyFromDateTime: (s: string) => string;
  setCursorDate: React.Dispatch<React.SetStateAction<Date>>;
  setViewMode: React.Dispatch<React.SetStateAction<any>>;
}

export const YearView = React.memo(function YearView({
  cursorDate,
  isDark,
  interventions,
  dayKeyFromDateTime,
  setCursorDate,
  setViewMode,
}: YearViewProps) {
  const { width } = useWindowDimensions();
  const year = cursorDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  const padding = 32;
  const gap = 12;
  let cols = 1;
  if (width >= 1280) cols = 4;
  else if (width >= 1024) cols = 3;
  else if (width >= 768) cols = 2;
  const itemWidth = (width - padding - gap * (cols - 1)) / cols;

  const { rawEvents: yearRawEvents } = useRawEventsByRange(`${year}-01-01`, `${year}-12-31`);

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
  }, [interventions, yearRawEvents, dayKeyFromDateTime]);

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
        base: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
        text: { marginTop: 0, fontSize: 10, color: isDark ? "#F8FAFC" : "#09090B" },
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
});
