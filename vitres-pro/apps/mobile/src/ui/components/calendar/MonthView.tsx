import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { CalendarOff } from "lucide-react-native";
import { Calendar as RNCalendar, DateData } from "react-native-calendars";
import { useRouter } from "expo-router";
import { toISODate, startOfMonth, endOfMonth } from "../../../lib/date";
import { useRawEventsByRange } from "../../../hooks/useRawEvents";
import { useAbsentEmployeeIds, useZeroHoursEmployeeIds } from "../../../hooks/useAbsences";
import { RawEventCard } from "./RawEventCard";
import { FilterChipsBar, renderInterventionGroups, AssignModalState, CityPlanningInfo, InterventionGroupsCtx } from "./InterventionGroups";
import { PlanningHeader } from "../PlanningHeader";
import { DayStartRow, DayEndRow } from "./DayTrackerBar";
import { useClosuresByRange, closureOn, useCreateClosure, useDeleteClosure } from "../../../hooks/useClosures";
import { Dialog } from "../Dialog";
import { toast } from "../../toast";

function formatDayFr(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

interface MonthViewProps {
  cursorDate: Date;
  selectedDate: string;
  setCursorDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  setViewMode: React.Dispatch<React.SetStateAction<any>>;
  isDark: boolean;
  isAdmin: boolean;
  isSubcontractor?: boolean;
  itemsByDate: Record<string, any[]>;
  effectiveZone: string;
  userZone?: string;
  filterItem: (item: any) => boolean;
  cityMap: Map<string, CityPlanningInfo>;
  viewMode: string;
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  toggleType: (id: string) => void;
  toggleStatus: (id: string) => void;
  setActiveTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveStatuses: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeEmployeeId: string | null;
  setActiveEmployeeId: (id: string | null) => void;
  employees: { id: string; full_name?: string | null; color: string }[];
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
  isSubcontractor,
  itemsByDate,
  effectiveZone,
  filterItem,
  cityMap,
  viewMode,
  activeTypes,
  activeStatuses,
  toggleType,
  toggleStatus,
  setActiveTypes,
  setActiveStatuses,
  activeEmployeeId,
  setActiveEmployeeId,
  employees,
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
  const calendarMonthKey = `${cursorDate.getFullYear()}-${String(cursorDate.getMonth() + 1).padStart(2, "0")}`;
  const { rawEvents: monthRawEvents } = useRawEventsByRange(monthStart, monthEnd);
  const closures = useClosuresByRange(monthStart, monthEnd);
  const createClosure = useCreateClosure();
  const deleteClosure = useDeleteClosure();
  // Appui long admin sur un jour : marquer / retirer un jour férié.
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayLabel, setHolidayLabel] = useState("Férié");
  const holidayDialogClosure = holidayDate ? closureOn(closures, holidayDate) : null;
  const selectedClosure = closureOn(closures, selectedDate);

  const openHolidayDialog = (dateStr: string) => {
    setHolidayLabel("Férié");
    setHolidayDate(dateStr);
  };

  const confirmHoliday = async () => {
    if (!holidayDate) return;
    try {
      if (holidayDialogClosure) {
        await deleteClosure.mutateAsync(holidayDialogClosure.id);
        toast.success("Férié retiré", "Le pointage est à nouveau possible ce jour-là.");
      } else {
        await createClosure.mutateAsync({
          start_date: holidayDate,
          end_date: holidayDate,
          reason: holidayLabel.trim() || "Férié",
        });
        toast.success("Jour férié", "Ce jour ne compte plus dans les heures.");
      }
      setHolidayDate(null);
    } catch (e: any) {
      toast.error("Erreur", e?.response?.data?.detail || "Action impossible.");
    }
  };

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
    // Jours fériés / fermetures : chiffre et point en rouge.
    closures.forEach((c) => {
      const d = new Date(`${c.start_date}T12:00:00`);
      const end = new Date(`${c.end_date}T12:00:00`);
      while (d <= end) {
        const key = toISODate(d);
        if (key !== selectedDate) marks[key] = { marked: true, dotColor: "#EF4444", textColor: "#EF4444" };
        d.setDate(d.getDate() + 1);
      }
    });
    marks[selectedDate] = { selected: true, selectedColor: "#3B82F6", selectedTextColor: "#ffffff" };
    if (today !== selectedDate) marks[today] = { ...(marks[today] || {}), textColor: "#3B82F6" };
    return marks;
  }, [itemsByDate, monthRawEvents, selectedDate, closures]);

  const dayList = (itemsByDate[selectedDate] || []).filter(filterItem);
  const dayRawEvents = monthRawEvents.filter((e) => e.start_time.split("T")[0] === selectedDate);
  const absentIds = useAbsentEmployeeIds(selectedDate);
  const absentEmployeeIds = useMemo(() => new Set(absentIds), [absentIds]);
  const zeroHoursIds = useZeroHoursEmployeeIds(selectedDate);
  const zeroHoursEmployeeIds = useMemo(() => new Set(zeroHoursIds), [zeroHoursIds]);

  const ctx: InterventionGroupsCtx = {
    isDark, isAdmin, cityMap, viewMode, selectedDate, effectiveZone,
    setAssignModal, setSelectedAssignIds, setInitialAssignIds,
  };

  return (
    <View>
      <View className="mx-4 shadow-sm bg-card dark:bg-slate-900 border border-border dark:border-slate-800" style={{ borderRadius: 25, overflow: "hidden" }}>
        <RNCalendar
          // La sélection d'un jour ne doit pas remonter tout le calendrier.
          // Une nouvelle instance n'est nécessaire que si le thème ou le mois
          // réellement affiché change.
          key={`${isDark ? "d" : "l"}-${calendarMonthKey}`}
          current={toISODate(cursorDate)}
          onDayPress={(day: DateData) => {
            setSelectedDate(day.dateString);
            if (!day.dateString.startsWith(calendarMonthKey)) {
              setCursorDate(new Date(`${day.dateString}T12:00:00`));
            }
          }}
          onDayLongPress={isAdmin ? (day: DateData) => openHolidayDialog(day.dateString) : undefined}
          markedDates={markedDates}
          firstDay={1}
          hideArrows={true}
          enableSwipeMonths={true}
          disableMonthChange={true}
          theme={calendarTheme}
          renderHeader={() => null}
        />
      </View>

      <View className="pt-6 pb-6">
        <View className="px-6 mb-2">
          <Text className="text-xl font-bold text-foreground dark:text-white capitalize mb-3">
            {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          {selectedClosure && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                marginBottom: 10,
                backgroundColor: "#EF444418",
              }}
            >
              <CalendarOff size={16} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 13, flex: 1 }}>
                {selectedClosure.reason || "Jour férié"}
                {selectedClosure.start_date !== selectedClosure.end_date
                  ? ` (du ${formatDayFr(selectedClosure.start_date)} au ${formatDayFr(selectedClosure.end_date)})`
                  : ""}
              </Text>
            </View>
          )}
          <PlanningHeader
            dateStr={selectedDate}
            zone={effectiveZone}
            onRateSession={isAdmin ? () => router.push(`/(app)/calendar/rate-session?date=${selectedDate}&zone=${effectiveZone}` as any) : undefined}
          />
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
            activeEmployeeId={activeEmployeeId}
            setActiveEmployeeId={setActiveEmployeeId}
            employees={isAdmin ? employees : []}
            isSubcontractor={isSubcontractor}
            absentEmployeeIds={absentEmployeeIds}
            zeroHoursEmployeeIds={zeroHoursEmployeeIds}
          />
          <DayStartRow date={selectedDate} />
          {dayList.length === 0 && dayRawEvents.length === 0 ? (
            <Text className="text-muted-foreground dark:text-slate-500 text-center py-8">Rien de prévu.</Text>
          ) : renderInterventionGroups(dayList, selectedDate, false, ctx)}
          <DayEndRow date={selectedDate} />
        </View>
      </View>

      {holidayDate && (
        <Dialog open onClose={() => setHolidayDate(null)} maxWidth={340}>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A", marginBottom: 4 }}>
              {holidayDialogClosure ? "Retirer le jour férié ?" : "Marquer comme jour férié ?"}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#CBD5E1" : "#334155", marginBottom: 10, textTransform: "capitalize" }}>
              {formatDayFr(holidayDate)}
            </Text>
            {holidayDialogClosure ? (
              <Text style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B", marginBottom: 20, lineHeight: 18 }}>
                « {holidayDialogClosure.reason || "Férié"} »
                {holidayDialogClosure.start_date !== holidayDialogClosure.end_date
                  ? ` — attention, c'est toute la fermeture du ${formatDayFr(holidayDialogClosure.start_date)} au ${formatDayFr(holidayDialogClosure.end_date)} qui sera retirée.`
                  : ""}
                {"\n"}Le jour redeviendra normal : les employés pourront pointer et il comptera à nouveau dans les heures.
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B", marginBottom: 12, lineHeight: 18 }}>
                  Personne ne pourra pointer ce jour-là (employés et sous-traitants) et il ne comptera pas dans les heures sup.
                </Text>
                <TextInput
                  value={holidayLabel}
                  onChangeText={setHolidayLabel}
                  placeholder="Libellé (ex. Armistice)"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                    paddingHorizontal: 12,
                    color: isDark ? "#F1F5F9" : "#0F172A",
                    marginBottom: 20,
                  }}
                />
              </>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setHolidayDate(null)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: isDark ? "#F1F5F9" : "#0F172A" }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={confirmHoliday}
                disabled={createClosure.isPending || deleteClosure.isPending}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: holidayDialogClosure ? "#64748B" : "#EF4444",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {createClosure.isPending || deleteClosure.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontWeight: "700", color: "white" }}>
                    {holidayDialogClosure ? "Retirer" : "Marquer férié"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  );
});
