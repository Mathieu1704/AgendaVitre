import React, { useCallback, useState } from "react";
import { View, Text, Pressable, Platform, useWindowDimensions } from "react-native";
import { Calendar as CalendarIcon, X } from "lucide-react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { useTheme } from "./ThemeToggle";
import Animated, { FadeIn, ZoomIn, ZoomOut } from "react-native-reanimated";
import { cn } from "../cn";

interface MultiDatePickerProps {
  values: string[]; // ["YYYY-MM-DD", ...] dates déjà validées
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  dayColors?: Record<string, "green" | "orange" | "red">;
  onMonthChange?: (dateString: string) => void;
  minDate?: string;
  /**
   * Que faire d'un jour rouge (surcharge ou fermé) :
   *  - "block" : impossible de le sélectionner (employés) ;
   *  - "warn"  : sélection permise, avec un avertissement (admins).
   */
  redDayPolicy?: "block" | "warn";
  /** Titre de la fenêtre (par défaut : reprise de RDV). */
  title?: string;
  /**
   * Sélection d'une plage par appui long : un appui simple coche ou décoche
   * un jour, un appui long étend la sélection depuis le dernier jour touché
   * jusqu'à ce jour. Les samedis et dimanches de la plage sont sautés (ils
   * restent sélectionnables un par un).
   */
  allowRange?: boolean;
  /** Samedis et dimanches non sélectionnables, même un par un. */
  disableWeekends?: boolean;
  /** Raison affichée quand un jour rouge est refusé (par défaut : surcharge). */
  redDayReason?: string;
}

const isWeekend = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
};

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

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
  redDayPolicy,
  title = "Dates de reprise",
  allowRange = false,
  disableWeekends = false,
  redDayReason = "est en surcharge ou fermé",
}: MultiDatePickerProps) {
  // Dernier jour touché : point de départ d'une plage à l'appui long.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draftDates, setDraftDates] = useState<string[]>(values);
  // Dernier jour rouge refusé : affiché dans la fenêtre, là où l'employé
  // regarde (un toast passerait derrière le dialogue).
  const [blockedDate, setBlockedDate] = useState<string | null>(null);
  const [blockedWeekend, setBlockedWeekend] = useState(false);
  // Rang de chaque jour dans la dernière plage ajoutée : sert à décaler
  // l'apparition des pastilles, du jour de départ vers le jour d'arrivée.
  const [waveOrder, setWaveOrder] = useState<Record<string, number>>({});
  const isRed = (iso: string) => dayColors?.[iso] === "red";
  const { isDark } = useTheme();
  const isWeb = Platform.OS === "web";
  const { width: screenWidth } = useWindowDimensions();
  const dialogPosition = isWeb && screenWidth >= 768 ? "center" : "bottom";

  const openPicker = () => {
    setDraftDates(values);
    setBlockedDate(null);
    setBlockedWeekend(false);
    setRangeStart(null);
    setOpen(true);
  };

  const toggleDate = (iso: string) => {
    // Retirer une date reste toujours possible ; seul l'ajout est filtré.
    if (disableWeekends && isWeekend(iso) && !draftDates.includes(iso)) {
      setBlockedDate(null);
      setBlockedWeekend(true);
      return;
    }
    setBlockedWeekend(false);
    if (redDayPolicy === "block" && isRed(iso) && !draftDates.includes(iso)) {
      setBlockedDate(iso);
      return;
    }
    setBlockedDate(null);
    setWaveOrder({});
    setRangeStart(draftDates.includes(iso) ? null : iso);
    setDraftDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  };

  // Appui long : tout ce qui sépare le dernier jour touché de celui-ci.
  const extendTo = (iso: string) => {
    if (!allowRange) return toggleDate(iso);
    if (disableWeekends && isWeekend(iso)) {
      setBlockedDate(null);
      setBlockedWeekend(true);
      return;
    }
    setBlockedWeekend(false);
    setBlockedDate(null);
    const anchor = rangeStart ?? iso;
    const [from, to] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    const span: string[] = [];
    for (let d = from, guard = 0; d <= to && guard < 370; d = addDays(d, 1), guard++) {
      if (isWeekend(d)) continue;
      if (redDayPolicy === "block" && isRed(d)) continue;
      span.push(d);
    }
    const added = span.filter((d) => !draftDates.includes(d));
    if (anchor > iso) added.reverse();
    setWaveOrder(Object.fromEntries(added.map((d, i) => [d, i])));
    setRangeStart(iso);
    setDraftDates((prev) => Array.from(new Set([...prev, ...span])).sort());
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

  // Jour dessiné à la main quand `allowRange` est actif : le calendrier
  // standard pose ses pastilles d'un coup, sans animation possible.
  const renderDay = useCallback(
    ({ date, state, marking, onPress, onLongPress }: any) => {
      const iso: string = date.dateString;
      const tooEarly = !!minDate && iso < minDate;
      const selected = !!marking?.selected;
      const otherMonth = state === "disabled" && !tooEarly;
      let color = isDark ? "#F8FAFC" : "#09090B";
      if (marking?.dayColor) color = marking.dayColor;
      if (state === "today") color = "#3B82F6";
      if (tooEarly || otherMonth) color = isDark ? "#334155" : "#D4D4D8";
      if (selected) color = "#FFFFFF";
      return (
        <Pressable
          disabled={tooEarly}
          onPress={() => onPress?.(date)}
          onLongPress={() => onLongPress?.(date)}
          delayLongPress={300}
          style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
        >
          {selected && (
            <Animated.View
              entering={ZoomIn.delay((marking.wave ?? 0) * 45).duration(220)}
              exiting={ZoomOut.duration(140)}
              style={{ position: "absolute", width: 36, height: 36, borderRadius: 18, backgroundColor: "#3B82F6" }}
            />
          )}
          <Text style={{ fontSize: 15, color, fontWeight: selected || marking?.dayColor ? "700" : "500" }}>
            {date.day}
          </Text>
        </Pressable>
      );
    },
    [isDark, minDate],
  );

  const buildAnimatedMarks = () => {
    const marks: Record<string, any> = {};
    if (dayColors) {
      Object.entries(dayColors).forEach(([d, color]) => {
        if (minDate && d < minDate) return;
        marks[d] = { dayColor: DAY_COLOR_MAP[color]?.hex ?? "#94A3B8" };
      });
    }
    draftDates.forEach((d) => {
      marks[d] = { ...marks[d], selected: true, wave: waveOrder[d] ?? 0 };
    });
    return marks;
  };

  // Résumé sous le champ : une pastille par période plutôt qu'une par jour
  // (une plage de deux semaines donnait dix pastilles).
  const groups: { start: string; end: string; dates: string[] }[] = [];
  if (allowRange) {
    for (const d of values) {
      const last = groups[groups.length - 1];
      let cursor = last ? addDays(last.end, 1) : "";
      while (last && cursor < d && isWeekend(cursor)) cursor = addDays(cursor, 1);
      if (last && cursor === d) {
        last.end = d;
        last.dates.push(d);
      } else groups.push({ start: d, end: d, dates: [d] });
    }
  }

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
        <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
          <CalendarIcon size={18} color="#3B82F6" />
          <Text
            numberOfLines={1}
            className={cn(
              "font-medium",
              summary ? "text-foreground dark:text-white" : "text-muted-foreground",
            )}
            style={{ fontSize: 15, flexShrink: 1 }}
          >
            {summary || placeholder}
          </Text>
        </View>
      </Pressable>

      {values.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
          {(allowRange
            ? groups.map((g) => ({
                key: `${g.start}_${g.end}`,
                label: g.start === g.end ? formatFr(g.start) : `${formatFr(g.start)} → ${formatFr(g.end)}`,
                dates: g.dates,
              }))
            : values.map((iso) => ({ key: iso, label: formatFr(iso), dates: [iso] }))
          ).map((chip) => (
            <Animated.View
              key={chip.key}
              entering={FadeIn.duration(220)}
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
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#3B82F6" }}>{chip.label}</Text>
              <Pressable onPress={() => onChange(values.filter((d) => !chip.dates.includes(d)))} hitSlop={8}>
                <X size={12} color="#3B82F6" />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      {redDayPolicy === "warn" && values.some(isRed) && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#EF4444" }}>
          {`Attention, jour en surcharge ou fermé : ${values.filter(isRed).map(formatFr).join(", ")}.`}
        </Text>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} position={dialogPosition}>
        <View className="p-2">
          {!!title && (
            <Text className="text-lg font-bold mb-1 text-foreground dark:text-white text-center">
              {title}
            </Text>
          )}
          <Text className="text-xs text-muted-foreground text-center mb-4">
            {allowRange
              ? "Touchez un jour pour l'ajouter ou le retirer. Appui long sur un autre jour pour prendre toute la période."
              : "Touchez chaque date à ajouter (retouchez pour retirer)"}
          </Text>
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <Calendar
              onDayPress={(day: DateData) => toggleDate(day.dateString)}
              onDayLongPress={(day: DateData) => extendTo(day.dateString)}
              markingType="custom"
              markedDates={allowRange ? buildAnimatedMarks() : buildMarkedDates()}
              dayComponent={allowRange ? renderDay : undefined}
              firstDay={1}
              theme={calendarTheme}
              minDate={minDate}
              onMonthChange={(month: any) => onMonthChange?.(month.dateString)}
            />
          </View>
          {blockedDate && (
            <Animated.Text entering={FadeIn.duration(200)} style={{ fontSize: 13, fontWeight: "600", color: "#EF4444", textAlign: "center", marginTop: 12 }}>
              {`Le ${formatFr(blockedDate)} ${redDayReason} : choisissez un autre jour.`}
            </Animated.Text>
          )}
          {blockedWeekend && (
            <Animated.Text entering={FadeIn.duration(200)} style={{ fontSize: 13, fontWeight: "600", color: "#EF4444", textAlign: "center", marginTop: 12 }}>
              Les samedis et dimanches ne peuvent pas être sélectionnés.
            </Animated.Text>
          )}
          {redDayPolicy === "warn" && draftDates.some(isRed) && (
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#EF4444", textAlign: "center", marginTop: 12 }}>
              {`Attention, jour en surcharge ou fermé : ${draftDates.filter(isRed).map(formatFr).join(", ")}.`}
            </Text>
          )}
          {allowRange && draftDates.length > 0 && (
            <Pressable onPress={() => { setDraftDates([]); setRangeStart(null); }} style={{ alignSelf: "center", marginTop: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#3B82F6" }}>Tout effacer</Text>
            </Pressable>
          )}
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
