import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Users } from "lucide-react-native";
import { InterventionCard, AssignModalState } from "./InterventionCard";

// ─── Types partagés ───────────────────────────────────────────────────────────

export type { AssignModalState };

export type InterventionGroupsCtx = {
  isDark: boolean;
  isAdmin: boolean;
  subZoneMap: Map<string, { label: string; color: string }>;
  viewMode: string;
  selectedDate: string;
  setAssignModal: React.Dispatch<React.SetStateAction<AssignModalState>>;
  setSelectedAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInitialAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
};

// ─── renderInterventionGroups ─────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { in_progress: 0, planned: 1, done: 2 };
export const STATUS_LABELS: Record<string, string> = { in_progress: "En cours", planned: "Planifié", done: "Terminé", unscheduled: "À planifier" };
export const STATUS_COLORS: Record<string, string> = { in_progress: "#F97316", planned: "#3B82F6", done: "#22C55E", unscheduled: "#94A3B8" };
const TYPE_ORDER: Record<string, number> = { intervention: 0, devis: 1, tournee: 2, note: 3 };
export const TYPE_LABELS: Record<string, string> = { intervention: "Intervention", devis: "Devis", tournee: "Tournée", note: "Note" };
export const TYPE_COLORS: Record<string, string> = { intervention: "#3B82F6", devis: "#8B5CF6", tournee: "#F97316", note: "#64748B" };

// ─── FlatList support ─────────────────────────────────────────────────────────

export type FlatRow =
  | { kind: "status-header"; status: string; count: number; key: string }
  | { kind: "type-header"; type: string; key: string }
  | { kind: "zone-header"; code: string; label: string; color: string; items: any[]; dateStr: string; key: string }
  | { kind: "card"; item: any; barColor: string; key: string };

export function buildFlatRows(
  list: any[],
  dateStr: string,
  subZoneMap: Map<string, { label: string; color: string }>,
): FlatRow[] {
  if (list.length === 0) return [];

  const scheduled = list.filter((i) => !i.time_tbd);
  const unscheduled = list.filter((i) => i.time_tbd);

  const sortItems = (items: any[]) => [...items].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (sd !== 0) return sd;
    const td = (TYPE_ORDER[a.type ?? "intervention"] ?? 9) - (TYPE_ORDER[b.type ?? "intervention"] ?? 9);
    if (td !== 0) return td;
    return (a.sub_zone ?? "").localeCompare(b.sub_zone ?? "");
  });

  const sorted = sortItems(scheduled);

  const rows: FlatRow[] = [];

  const statusGroups: { status: string; items: any[] }[] = [];
  for (const item of sorted) {
    const last = statusGroups[statusGroups.length - 1];
    if (last && last.status === item.status) last.items.push(item);
    else statusGroups.push({ status: item.status, items: [item] });
  }
  if (unscheduled.length > 0) {
    statusGroups.push({ status: "unscheduled", items: sortItems(unscheduled) });
  }

  for (const sg of statusGroups) {
    rows.push({ kind: "status-header", status: sg.status, count: sg.items.length, key: `sh-${sg.status}` });

    const typeGroups: { type: string; items: any[] }[] = [];
    for (const item of sg.items) {
      const t = item.type ?? "intervention";
      const last = typeGroups[typeGroups.length - 1];
      if (last && last.type === t) last.items.push(item);
      else typeGroups.push({ type: t, items: [item] });
    }
    const multipleTypes = typeGroups.length > 1;

    for (const tg of typeGroups) {
      if (multipleTypes || tg.type !== "intervention") {
        rows.push({ kind: "type-header", type: tg.type, key: `th-${sg.status}-${tg.type}` });
      }

      const szGroups: { code: string | null; items: any[] }[] = [];
      for (const item of tg.items) {
        const code = item.sub_zone ?? null;
        const last = szGroups[szGroups.length - 1];
        if (last && last.code === code) last.items.push(item);
        else szGroups.push({ code, items: [item] });
      }
      const hasMultipleSubZones = szGroups.length > 1 || (szGroups.length === 1 && szGroups[0].code !== null);

      for (const zg of szGroups) {
        const sz = zg.code ? subZoneMap.get(zg.code) : null;
        const barColor = sz?.color ?? "#CBD5E1";

        if (hasMultipleSubZones && zg.code) {
          rows.push({
            kind: "zone-header",
            code: zg.code,
            label: sz?.label ?? "Sans zone",
            color: barColor,
            items: zg.items,
            dateStr,
            key: `zh-${sg.status}-${tg.type}-${zg.code}`,
          });
        }

        for (const item of zg.items) {
          rows.push({ kind: "card", item, barColor, key: `card-${item.id}` });
        }
      }
    }
  }

  return rows;
}

export function renderInterventionGroups(
  list: any[],
  dateStr: string,
  compact: boolean,
  ctx: InterventionGroupsCtx,
): React.ReactNode {
  if (list.length === 0) return null;

  const { isDark, isAdmin, subZoneMap, viewMode, selectedDate, setAssignModal, setSelectedAssignIds, setInitialAssignIds } = ctx;

  const sortItems = (items: any[]) => [...items].sort((a, b) => {
    const sd = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (sd !== 0) return sd;
    const td = (TYPE_ORDER[a.type ?? "intervention"] ?? 9) - (TYPE_ORDER[b.type ?? "intervention"] ?? 9);
    if (td !== 0) return td;
    return (a.sub_zone ?? "").localeCompare(b.sub_zone ?? "");
  });

  const scheduled = list.filter((i) => !i.time_tbd);
  const unscheduled = list.filter((i) => i.time_tbd);
  const sorted = sortItems(scheduled);

  const groups: { status: string; items: typeof sorted }[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.status === item.status) last.items.push(item);
    else groups.push({ status: item.status, items: [item] });
  }
  if (unscheduled.length > 0) {
    groups.push({ status: "unscheduled", items: sortItems(unscheduled) });
  }

  return groups.map((group) => {
    const typeGroups: { type: string; items: typeof sorted }[] = [];
    for (const item of group.items) {
      const t = item.type ?? "intervention";
      const last = typeGroups[typeGroups.length - 1];
      if (last && last.type === t) last.items.push(item);
      else typeGroups.push({ type: t, items: [item] });
    }
    const multipleTypes = typeGroups.length > 1;

    return (
      <View key={group.status} style={compact ? {} : { marginBottom: 8 }}>
        {!compact && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLORS[group.status] ?? "#94A3B8" }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLORS[group.status] ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {STATUS_LABELS[group.status] ?? group.status} ({group.items.length})
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", marginLeft: 4 }} />
          </View>
        )}
        {typeGroups.map((tg) => {
          const szGroups: { code: string | null; items: typeof sorted }[] = [];
          for (const item of tg.items) {
            const code = item.sub_zone ?? null;
            const last = szGroups[szGroups.length - 1];
            if (last && last.code === code) last.items.push(item);
            else szGroups.push({ code, items: [item] });
          }
          const hasMultipleSubZones = szGroups.length > 1 || (szGroups.length === 1 && szGroups[0].code !== null);

          return (
            <View key={tg.type}>
              {!compact && (multipleTypes || tg.type !== "intervention") && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5, marginTop: 2, marginLeft: 8 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: TYPE_COLORS[tg.type] ?? "#94A3B8" }} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: TYPE_COLORS[tg.type] ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {TYPE_LABELS[tg.type] ?? tg.type}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", marginLeft: 4 }} />
                </View>
              )}
              {szGroups.map((sg, idx) => {
                const sz = sg.code ? subZoneMap.get(sg.code) : null;
                return (
                  <View key={sg.code ?? `null-${idx}`} style={{ marginTop: idx === 0 ? 0 : compact ? 4 : 10 }}>
                    {!compact && hasMultipleSubZones && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginLeft: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: sz?.color ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>
                          {sz ? sz.label : "Sans zone"}
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: (sz?.color ?? "#94A3B8") + "40", marginHorizontal: 6 }} />
                        {sz && sg.code && isAdmin && (
                          <Pressable
                            hitSlop={10}
                            style={{ backgroundColor: sz.color + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}
                            onPress={() => {
                              const code = sg.code!;
                              const label = sz.label;
                              const color = sz.color;
                              const existingIds = [...new Set(sg.items.flatMap((it: any) => (it.employees ?? []).map((e: any) => e.id as string)))];
                              setTimeout(() => {
                                setAssignModal({ mode: "zone", date: dateStr, subZone: code, label, color });
                                setSelectedAssignIds(existingIds);
                                setInitialAssignIds(existingIds);
                              }, 100);
                            }}
                          >
                            <Users size={12} color={sz.color} />
                            <Text style={{ fontSize: 10, fontWeight: "700", color: sz.color }}>Assigner</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ width: 6, borderRadius: 3, backgroundColor: sz?.color ?? "#CBD5E1" }} />
                      <View style={{ flex: 1 }}>
                        {sg.items.map((item) => (
                          <InterventionCard
                            key={item.id}
                            item={item}
                            compact={compact}
                            viewMode={viewMode}
                            selectedDate={selectedDate}
                            setAssignModal={setAssignModal}
                            setSelectedAssignIds={setSelectedAssignIds}
                            setInitialAssignIds={setInitialAssignIds}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  });
}

// ─── FilterChipsBar ────────────────────────────────────────────────────────────

const FILTER_TYPES = [
  { id: "intervention", label: "Intervention", color: "#3B82F6" },
  { id: "devis",        label: "Devis",        color: "#8B5CF6" },
  { id: "tournee",      label: "Tournée",      color: "#F97316" },
  { id: "note",         label: "Note",         color: "#64748B" },
];
const FILTER_STATUSES = [
  { id: "planned",     label: "Planifié",  color: "#3B82F6" },
  { id: "in_progress", label: "En cours",  color: "#F97316" },
  { id: "done",        label: "Terminé",   color: "#22C55E" },
];

interface FilterChipsBarProps {
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  isDark: boolean;
  toggleType: (id: string) => void;
  toggleStatus: (id: string) => void;
  setActiveTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveStatuses: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const FilterChipsBar = React.memo(function FilterChipsBar({
  activeTypes,
  activeStatuses,
  isDark,
  toggleType,
  toggleStatus,
  setActiveTypes,
  setActiveStatuses,
}: FilterChipsBarProps) {
  const hasFilters = activeTypes.size > 0 || activeStatuses.size > 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
      style={{ marginBottom: 8 }}
    >
      {hasFilters && (
        <Pressable
          onPress={() => { setActiveTypes(new Set()); setActiveStatuses(new Set()); }}
          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginRight: 2 }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#CBD5E1" : "#64748B" }}>✕ Tout</Text>
        </Pressable>
      )}
      {FILTER_TYPES.map(f => {
        const active = activeTypes.has(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => toggleType(f.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: active ? f.color : isDark ? "#1E293B" : "#F1F5F9", borderWidth: 1, borderColor: active ? f.color : isDark ? "#334155" : "#E2E8F0" }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : isDark ? "#94A3B8" : "#64748B" }}>{f.label}</Text>
          </Pressable>
        );
      })}
      <View style={{ width: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginHorizontal: 4 }} />
      {FILTER_STATUSES.map(f => {
        const active = activeStatuses.has(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => toggleStatus(f.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: active ? f.color : isDark ? "#1E293B" : "#F1F5F9", borderWidth: 1, borderColor: active ? f.color : isDark ? "#334155" : "#E2E8F0" }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : isDark ? "#94A3B8" : "#64748B" }}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
