import React, { useMemo, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { Clock, Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { toISODate } from "../../../lib/date";
import { useRawEventsByDate } from "../../../hooks/useRawEvents";
import { PlanningHeader } from "../PlanningHeader";
import { RawEventCard } from "./RawEventCard";
import {
  FilterChipsBar,
  AssignModalState,
  buildFlatRows,
  FlatRow,
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_LABELS,
  TYPE_COLORS,
} from "./InterventionGroups";
import { InterventionCard } from "./InterventionCard";

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
  isRefreshing: boolean;
  onRefresh: () => void;
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
  isRefreshing,
  onRefresh,
}: DayViewProps) {
  const router = useRouter();
  const iso = toISODate(cursorDate);
  const list = (itemsByDate[iso] || []).filter(filterItem);
  const { rawEvents } = useRawEventsByDate(iso);

  const unassigned = rawEvents.filter((e) => !e.employee_id);
  const assigned = rawEvents.filter((e) => !!e.employee_id);
  const hasAnything = list.length > 0 || rawEvents.length > 0;

  const flatRows = useMemo(
    () => buildFlatRows(list, iso, subZoneMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, iso, subZoneMap],
  );

  const renderRow = useCallback(
    ({ item: row }: { item: FlatRow }) => {
      if (row.kind === "status-header") {
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLORS[row.status] ?? "#94A3B8" }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLORS[row.status] ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {STATUS_LABELS[row.status] ?? row.status} ({row.count})
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", marginLeft: 4 }} />
          </View>
        );
      }
      if (row.kind === "type-header") {
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5, marginTop: 2, marginLeft: 8 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: TYPE_COLORS[row.type] ?? "#94A3B8" }} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: TYPE_COLORS[row.type] ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {TYPE_LABELS[row.type] ?? row.type}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", marginLeft: 4 }} />
          </View>
        );
      }
      if (row.kind === "zone-header") {
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginLeft: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: row.color, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {row.label}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: row.color + "40", marginHorizontal: 6 }} />
            {isAdmin && (
              <Pressable
                hitSlop={10}
                style={{ backgroundColor: row.color + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}
                onPress={() => {
                  const existingIds = [...new Set(row.items.flatMap((it: any) => (it.employees ?? []).map((e: any) => e.id as string)))];
                  setTimeout(() => {
                    setAssignModal({ mode: "zone", date: iso, subZone: row.code, label: row.label, color: row.color });
                    setSelectedAssignIds(existingIds);
                    setInitialAssignIds(existingIds);
                  }, 100);
                }}
              >
                <Users size={12} color={row.color} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: row.color }}>Assigner</Text>
              </Pressable>
            )}
          </View>
        );
      }
      return (
        <InterventionCard
          item={row.item}
          viewMode={viewMode}
          selectedDate={selectedDate}
          leftBarColor={row.barColor}
          setAssignModal={setAssignModal}
          setSelectedAssignIds={setSelectedAssignIds}
          setInitialAssignIds={setInitialAssignIds}
        />
      );
    },
    [isDark, isAdmin, iso, viewMode, selectedDate, setAssignModal, setSelectedAssignIds, setInitialAssignIds],
  );

  const listHeader = useMemo(
    () => (
      <View>
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
      </View>
    ),
    [iso, effectiveZone, isAdmin, unassigned, activeTypes, activeStatuses, isDark, toggleType, toggleStatus, setActiveTypes, setActiveStatuses, router],
  );

  const listFooter = useMemo(
    () => (
      <View>
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
    ),
    [assigned, hasAnything, iso],
  );

  return (
    <FlatList
      data={flatRows}
      keyExtractor={(row) => row.key}
      renderItem={renderRow}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={12}
      maxToRenderPerBatch={6}
      windowSize={10}
    />
  );
});
