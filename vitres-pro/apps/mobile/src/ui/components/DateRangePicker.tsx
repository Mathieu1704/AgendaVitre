import React, { useState } from "react";
import { View, Text, Pressable, Platform, useWindowDimensions } from "react-native";
import { Calendar as CalendarIcon } from "lucide-react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { useTheme } from "./ThemeToggle";
import { cn } from "../cn";

interface DateRangePickerProps {
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
  label?: string;
  placeholder?: string;
}

const formatFr = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DateRangePicker({ startDate, endDate, onChange, label, placeholder = "Sélectionner une période" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(startDate);
  const [draftEnd, setDraftEnd] = useState<string | null>(endDate);
  const { isDark } = useTheme();
  const isWeb = Platform.OS === "web";
  const { width: screenWidth } = useWindowDimensions();
  const dialogPosition = isWeb && screenWidth >= 768 ? "center" : "bottom";

  const openPicker = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setOpen(true);
  };

  const handleDayPress = (day: DateData) => {
    const iso = day.dateString;
    // Nouveau cycle de sélection : pas de début, ou plage déjà complète
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso);
      setDraftEnd(null);
      return;
    }
    // Tap avant le début déjà choisi -> redémarre depuis cette date
    if (iso < draftStart) {
      setDraftStart(iso);
      setDraftEnd(null);
      return;
    }
    setDraftEnd(iso);
  };

  const buildMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (draftStart && !draftEnd) {
      marks[draftStart] = { startingDay: true, endingDay: true, color: "#3B82F6", textColor: "#fff" };
      return marks;
    }
    if (draftStart && draftEnd) {
      const [sy, sm, sd] = draftStart.split("-").map(Number);
      const [ey, em, ed] = draftEnd.split("-").map(Number);
      const cursor = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      while (cursor <= end) {
        const iso = toISO(cursor);
        marks[iso] = {
          color: "#3B82F6",
          textColor: "#fff",
          startingDay: iso === draftStart,
          endingDay: iso === draftEnd,
        };
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return marks;
  };

  const calendarTheme = {
    calendarBackground: isDark ? "#1E293B" : "#FFFFFF",
    textSectionTitleColor: isDark ? "#94A3B8" : "#64748B",
    selectedDayBackgroundColor: "#3B82F6",
    selectedDayTextColor: "#ffffff",
    todayTextColor: "#3B82F6",
    dayTextColor: isDark ? "#F8FAFC" : "#09090B",
    textDisabledColor: isDark ? "#334155" : "#E4E4E7",
    monthTextColor: isDark ? "#F8FAFC" : "#09090B",
    textDayFontWeight: "500" as const,
    textMonthFontWeight: "bold" as const,
    textDayHeaderFontWeight: "600" as const,
    textDayFontSize: 15,
  };

  const summary = startDate
    ? `${formatFr(startDate)} → ${formatFr(endDate || startDate)}`
    : null;

  return (
    <View style={{ gap: 6, width: "100%" }}>
      {label && (
        <Text className="text-sm font-semibold text-foreground dark:text-white">{label}</Text>
      )}

      <Pressable
        onPress={openPicker}
        style={{ borderRadius: 16, overflow: "hidden" }}
        className={cn(
          "h-12 flex-row items-center justify-between px-4 border",
          "bg-background border-border",
          "dark:bg-slate-900 dark:border-slate-700",
          "active:opacity-80",
        )}
      >
        <View className="flex-row items-center gap-3">
          <CalendarIcon size={18} color="#3B82F6" />
          <Text
            className={cn(
              "font-medium",
              summary ? "text-foreground dark:text-white" : "text-muted-foreground",
            )}
            style={{ fontSize: 15 }}
          >
            {summary || placeholder}
          </Text>
        </View>
      </Pressable>

      <Dialog open={open} onClose={() => setOpen(false)} position={dialogPosition}>
        <View className="p-2">
          <Text className="text-lg font-bold mb-1 text-foreground dark:text-white text-center">
            Période d'activité
          </Text>
          <Text className="text-xs text-muted-foreground text-center mb-4">
            Touchez une date de début, puis une date de fin
          </Text>
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <Calendar
              current={draftStart || undefined}
              onDayPress={handleDayPress}
              markingType="period"
              markedDates={buildMarkedDates()}
              firstDay={1}
              theme={calendarTheme}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <Button
              variant="outline"
              onPress={() => {
                setDraftStart(null);
                setDraftEnd(null);
              }}
              className="flex-1"
            >
              Effacer
            </Button>
            <Button
              onPress={() => {
                // Un seul jour sélectionné = période limitée à ce jour-là (début = fin)
                onChange(draftStart, draftEnd || draftStart);
                setOpen(false);
              }}
              className="flex-1"
            >
              Valider
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  );
}
