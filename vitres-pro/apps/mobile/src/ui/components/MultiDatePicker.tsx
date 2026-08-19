import React, { useState } from "react";
import { View, Text, Pressable, Platform, useWindowDimensions } from "react-native";
import { Calendar as CalendarIcon, X } from "lucide-react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { useTheme } from "./ThemeToggle";
import { cn } from "../cn";

interface MultiDatePickerProps {
  values: string[]; // ["YYYY-MM-DD", ...] dates déjà validées
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  dayColors?: Record<string, "green" | "orange" | "red">;
  onMonthChange?: (dateString: string) => void;
  minDate?: string;
}

const DAY_COLOR_MAP = {
  green: { hex: "#22C55E" },
  orange: { hex: "#F97316" },
  red: { hex: "#EF4444" },
};

const formatFr = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
};

export function MultiDatePicker({
  values,
  onChange,
  label,
  placeholder = "Sélectionner une ou plusieurs dates",
  dayColors,
  onMonthChange,
  minDate,
}: MultiDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftDates, setDraftDates] = useState<string[]>(values);
  const { isDark } = useTheme();
  const isWeb = Platform.OS === "web";
  const { width: screenWidth } = useWindowDimensions();
  const dialogPosition = isWeb && screenWidth >= 768 ? "center" : "bottom";

  const openPicker = () => {
    setDraftDates(values);
    setOpen(true);
  };

  const toggleDate = (iso: string) => {
    setDraftDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  };

  const buildMarkedDates = () => {
    const marks: Record<string, any> = {};
    if (dayColors) {
      Object.entries(dayColors).forEach(([d, color]) => {
        if (minDate && d < minDate) return;
        const hex = DAY_COLOR_MAP[color]?.hex ?? "#94A3B8";
        marks[d] = { customStyles: { text: { color: hex, fontWeight: "700" } } };
      });
    }
    draftDates.forEach((d) => {
      marks[d] = {
        customStyles: {
          container: { backgroundColor: "#3B82F6", borderRadius: 16 },
          text: { color: "#fff", fontWeight: "bold" },
        },
      };
    });
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

  const summary =
    values.length > 0 ? `${values.length} date${values.length > 1 ? "s" : ""} sélectionnée${values.length > 1 ? "s" : ""}` : null;

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

      {values.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {values.map((iso) => (
            <View
              key={iso}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 10,
                backgroundColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#3B82F6" }}>
                {formatFr(iso)}
              </Text>
              <Pressable onPress={() => onChange(values.filter((d) => d !== iso))} hitSlop={8}>
                <X size={12} color="#3B82F6" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} position={dialogPosition}>
        <View className="p-2">
          <Text className="text-lg font-bold mb-1 text-foreground dark:text-white text-center">
            Dates de reprise
          </Text>
          <Text className="text-xs text-muted-foreground text-center mb-4">
            Touchez chaque date à ajouter (retouchez pour retirer)
          </Text>
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <Calendar
              onDayPress={(day: DateData) => toggleDate(day.dateString)}
              markingType="custom"
              markedDates={buildMarkedDates()}
              firstDay={1}
              theme={calendarTheme}
              minDate={minDate}
              onMonthChange={(month: any) => onMonthChange?.(month.dateString)}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <Button variant="outline" onPress={() => setOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button
              onPress={() => {
                onChange(draftDates);
                setOpen(false);
              }}
              disabled={draftDates.length === 0}
              className="flex-1"
            >
              {`Valider (${draftDates.length})`}
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  );
}
