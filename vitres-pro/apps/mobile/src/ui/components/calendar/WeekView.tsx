import React, { useMemo, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { toISODate, startOfWeek, addDays, datesRange } from "../../../lib/date";
import { usePlanningRangeStats } from "../../../hooks/usePlanning";
import { useRawEventsByRange } from "../../../hooks/useRawEvents";
import { RawCalendarEvent } from "../../../types";
import { RawEventCard } from "./RawEventCard";
import { renderInterventionGroups, AssignModalState, InterventionGroupsCtx } from "./InterventionGroups";

function fmtH(h: number): string {
  const rounded = Math.round(h * 2) / 2;
  const hours = Math.floor(rounded);
  const mins = Math.round((rounded % 1) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

interface WeekViewProps {
  cursorDate: Date;
  isDark: boolean;
  isAdmin: boolean;
  isDesktop: boolean;
  itemsByDate: Record<string, any[]>;
  effectiveZone: string;
  viewMode: string;
  selectedDate: string;
  filterItem: (item: any) => boolean;
  subZoneMap: Map<string, { label: string; color: string }>;
  setAssignModal: React.Dispatch<React.SetStateAction<AssignModalState>>;
  setSelectedAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInitialAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const WeekView = React.memo(function WeekView({
  cursorDate,
  isDark,
  isAdmin,
  isDesktop,
  itemsByDate,
  effectiveZone,
  viewMode,
  selectedDate,
  filterItem,
  subZoneMap,
  setAssignModal,
  setSelectedAssignIds,
  setInitialAssignIds,
}: WeekViewProps) {
  const start = startOfWeek(cursorDate, 1);
  const end = addDays(start, 6);
  const weekDays = datesRange(start, 7);

  const { rangeStats } = usePlanningRangeStats(toISODate(start), toISODate(end), effectiveZone);
  const { rawEvents: weekRawEvents } = useRawEventsByRange(toISODate(start), toISODate(end));

  const rawByDate = useMemo(() => {
    const map: Record<string, RawCalendarEvent[]> = {};
    for (const ev of weekRawEvents) {
      const k = ev.start_time.split("T")[0];
      (map[k] ||= []).push(ev);
    }
    return map;
  }, [weekRawEvents]);

  const ctx: InterventionGroupsCtx = {
    isDark, isAdmin, subZoneMap, viewMode, selectedDate,
    setAssignModal, setSelectedAssignIds, setInitialAssignIds,
  };

  const weekContent = weekDays.map((date) => {
    const iso = toISODate(date);
    const list = (itemsByDate[iso] || []).filter(filterItem);
    const rawList = rawByDate[iso] || [];
    const isToday = iso === toISODate(new Date());
    const stat = rangeStats ? rangeStats[iso] : null;

    let badgeBg = "bg-muted";
    let badgeText = "text-muted-foreground";
    if (stat) {
      if (stat.status === "ok") { badgeBg = "bg-green-100 dark:bg-green-900"; badgeText = "text-green-700 dark:text-green-300"; }
      if (stat.status === "warning") { badgeBg = "bg-orange-100 dark:bg-orange-900"; badgeText = "text-orange-700 dark:text-orange-300"; }
      if (stat.status === "overload") { badgeBg = "bg-red-100 dark:bg-red-900"; badgeText = "text-red-700 dark:text-red-300"; }
    }

    return (
      <View key={iso} className={`${isDesktop ? "flex-1 mx-1" : "w-[140px] mr-3"}`}>
        <View className={`p-3 rounded-t-3xl border-t border-x border-border dark:border-slate-800 ${isToday ? "bg-primary/10" : "bg-card dark:bg-slate-900"}`}>
          <Text className={`font-bold text-center ${isToday ? "text-primary" : "text-foreground dark:text-white"}`}>
            {date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
          </Text>
          {stat && (
            <View className={`mt-2 py-1 px-2 rounded-md items-center justify-center ${badgeBg}`}>
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
          {renderInterventionGroups(list, iso, true, ctx)}
          {list.length === 0 && rawList.length === 0 && (
            <Text className="text-xs text-muted-foreground text-center mt-4 opacity-50">-</Text>
          )}
        </View>
      </View>
    );
  });

  if (isDesktop) {
    return (
      <View className="flex-row px-4 w-full">
        {weekContent}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
      {weekContent}
    </ScrollView>
  );
});
