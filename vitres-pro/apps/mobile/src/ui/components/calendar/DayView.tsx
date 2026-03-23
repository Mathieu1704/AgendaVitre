import React from "react";
import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../hooks/useAuth";
import { toISODate } from "../../../lib/date";
import { useRawEventsByDate } from "../../../hooks/useRawEvents";
import { PlanningHeader } from "../PlanningHeader";
import { RawEventCard } from "./RawEventCard";
import { FilterChipsBar, renderInterventionGroups, AssignModalState, InterventionGroupsCtx } from "./InterventionGroups";

interface DayViewProps {
  cursorDate: Date;
  isDark: boolean;
  isAdmin: boolean;
  itemsByDate: Record<string, any[]>;
  effectiveZone: string;
  viewMode: string;
  selectedDate: string;
  filterItem: (item: any) => boolean;
  subZoneMap: Map<string, { label: string; color: string }>;
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

export const DayView = React.memo(function DayView({
  cursorDate,
  isDark,
  isAdmin,
  itemsByDate,
  effectiveZone,
  viewMode,
  selectedDate,
  filterItem,
  subZoneMap,
  activeTypes,
  activeStatuses,
  toggleType,
  toggleStatus,
  setActiveTypes,
  setActiveStatuses,
  setAssignModal,
  setSelectedAssignIds,
  setInitialAssignIds,
}: DayViewProps) {
  const router = useRouter();
  const iso = toISODate(cursorDate);
  const list = (itemsByDate[iso] || []).filter(filterItem);
  const { rawEvents } = useRawEventsByDate(iso);

  const unassigned = rawEvents.filter((e) => !e.employee_id);
  const assigned = rawEvents.filter((e) => !!e.employee_id);
  const hasAnything = list.length > 0 || rawEvents.length > 0;

  const ctx: InterventionGroupsCtx = {
    isDark, isAdmin, subZoneMap, viewMode, selectedDate,
    setAssignModal, setSelectedAssignIds, setInitialAssignIds,
  };

  return (
    <View className="px-4 w-full">
      <PlanningHeader
        dateStr={iso}
        zone={effectiveZone}
        onRateSession={
          isAdmin
            ? () => router.push(`/(app)/calendar/rate-session?date=${iso}&zone=${effectiveZone}` as any)
            : undefined
        }
      />

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

      <FilterChipsBar
        activeTypes={activeTypes}
        activeStatuses={activeStatuses}
        isDark={isDark}
        toggleType={toggleType}
        toggleStatus={toggleStatus}
        setActiveTypes={setActiveTypes}
        setActiveStatuses={setActiveStatuses}
      />
      {renderInterventionGroups(list, iso, false, ctx)}

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
          <Text className="text-muted-foreground mt-4">Aucune intervention ce jour.</Text>
        </View>
      )}
    </View>
  );
});
