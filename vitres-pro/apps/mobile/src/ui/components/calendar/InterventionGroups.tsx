import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
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
  effectiveZone: string;
  setAssignModal: React.Dispatch<React.SetStateAction<AssignModalState>>;
  setSelectedAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInitialAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
};

// ─── renderInterventionGroups ─────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { in_progress: 0, planned: 1, done: 2, cancelled: 3 };
export const STATUS_LABELS: Record<string, string> = { in_progress: "En cours", planned: "Planifié", done: "Terminé", cancelled: "Annulé", unscheduled: "À planifier", note: "Note" };
export const STATUS_COLORS: Record<string, string> = { in_progress: "#F97316", planned: "#3B82F6", done: "#22C55E", cancelled: "#EF4444", unscheduled: "#94A3B8", note: "#64748B" };
export const TYPE_LABELS: Record<string, string> = { intervention: "Intervention", devis: "Devis", tournee: "Tournée", note: "Note" };
export const TYPE_COLORS: Record<string, string> = { intervention: "#3B82F6", devis: "#8B5CF6", tournee: "#F97316", note: "#64748B" };

// Ordonne les interventions d'un statut en suivant, pour chaque employé, son
// fil chronologique complet. Quand un rdv a plusieurs employés, on continue
// avec celui dont le PROCHAIN rdv commence le plus tôt (égalité → alphabétique
// sur le prénom) ; les autres sont mis en attente et repris dès que le fil
// suivi est épuisé — jamais interrompus par une chaîne d'employés différente.
function orderByEmployeeChains(items: any[]): any[] {
  const byTime = (a: any, b: any) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

  const queues = new Map<string, any[]>();
  const labels = new Map<string, string>();
  for (const item of items) {
    const emps: any[] = item.employees ?? [];
    if (emps.length === 0) {
      const key = `__none__${item.id}`;
      queues.set(key, [item]);
      labels.set(key, "");
      continue;
    }
    for (const e of emps) {
      const key = e.id ?? e.full_name ?? "?";
      const arr = queues.get(key);
      if (arr) arr.push(item);
      else {
        queues.set(key, [item]);
        labels.set(key, e.full_name ?? "");
      }
    }
  }
  for (const arr of queues.values()) arr.sort(byTime);

  const emitted = new Set<any>();
  const output: any[] = [];

  const nextOf = (key: string): any | undefined => {
    const q = queues.get(key);
    if (!q) return undefined;
    while (q.length > 0 && emitted.has(q[0])) q.shift();
    return q[0];
  };

  const pickEarliest = (keys: string[]): string | undefined => {
    let best: string | undefined;
    let bestItem: any;
    for (const k of keys) {
      const it = nextOf(k);
      if (!it) continue;
      if (!bestItem) {
        best = k;
        bestItem = it;
        continue;
      }
      const t = new Date(it.start_time).getTime();
      const bt = new Date(bestItem.start_time).getTime();
      if (t < bt || (t === bt && (labels.get(k) ?? "").localeCompare(labels.get(best!) ?? "") < 0)) {
        best = k;
        bestItem = it;
      }
    }
    return best;
  };

  for (;;) {
    const starters = [...queues.keys()].filter((k) => nextOf(k) !== undefined);
    if (starters.length === 0) break;
    let active: string | undefined = pickEarliest(starters);
    const waiting = new Set<string>();

    while (active) {
      const item = nextOf(active);
      if (!item) {
        active = pickEarliest([...waiting]);
        if (active) waiting.delete(active);
        continue;
      }
      if (!emitted.has(item)) {
        emitted.add(item);
        output.push(item);
      }
      const emps: any[] = item.employees ?? [];
      if (emps.length > 1) {
        const memberKeys = emps.map((e: any) => e.id ?? e.full_name ?? "?");
        for (const k of memberKeys) if (k !== active) waiting.add(k);
        const candidates = memberKeys.filter((k) => nextOf(k) !== undefined);
        const chosen = pickEarliest(candidates);
        if (chosen) waiting.delete(chosen);
        active = chosen;
      }
    }
  }

  return output;
}

// Une note n'a pas de statut de planification propre : jamais affichée sous
// "À planifier"/"Planifié"/etc. Elle est insérée juste avant le premier rdv
// (n'importe quel statut) qui implique tous ses employés ; à défaut, avant le
// premier rdv impliquant au moins un de ses employés. Si aucun de ses employés
// n'a de rdv ce jour-là, elle atterrit dans une section "Note" à part.
function placeNotes(
  notes: any[],
  statusGroups: { status: string; items: any[] }[],
  rest: any[],
): void {
  const byTime = (a: any, b: any) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  const orphans: any[] = [];

  for (const note of notes) {
    const empIds: string[] = (note.employees ?? []).map((e: any) => e.id).filter(Boolean);
    let target: any | undefined;
    if (empIds.length > 0) {
      const withAll = rest.filter((it) =>
        empIds.every((id) => (it.employees ?? []).some((e: any) => e.id === id)),
      );
      const pool = withAll.length > 0
        ? withAll
        : rest.filter((it) => (it.employees ?? []).some((e: any) => empIds.includes(e.id)));
      if (pool.length > 0) target = [...pool].sort(byTime)[0];
    }
    if (!target) {
      orphans.push(note);
      continue;
    }
    for (const sg of statusGroups) {
      const idx = sg.items.indexOf(target);
      if (idx !== -1) {
        sg.items.splice(idx, 0, note);
        break;
      }
    }
  }

  if (orphans.length > 0) {
    statusGroups.push({ status: "note", items: [...orphans].sort(byTime) });
  }
}

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

  const byTime = (a: any, b: any) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

  // Les notes n'ont pas de statut de planification propre — voir placeNotes.
  const notes = list.filter((i) => i.type === "note");
  const nonNotes = list.filter((i) => i.type !== "note");

  // Annulé prime sur le reste (même sans heure définie) — ne doit jamais
  // atterrir dans "À planifier" à cause de time_tbd.
  const cancelled = nonNotes.filter((i) => i.status === "cancelled");
  const rest = nonNotes.filter((i) => i.status !== "cancelled");
  const scheduled = rest.filter((i) => !i.time_tbd);
  const unscheduled = rest.filter((i) => i.time_tbd);

  const rows: FlatRow[] = [];

  const byStatus = new Map<string, any[]>();
  for (const item of scheduled) {
    const arr = byStatus.get(item.status);
    if (arr) arr.push(item);
    else byStatus.set(item.status, [item]);
  }
  const statusGroups: { status: string; items: any[] }[] = [...byStatus.entries()]
    .sort(([sa], [sb]) => (STATUS_ORDER[sa] ?? 9) - (STATUS_ORDER[sb] ?? 9))
    .map(([status, items]) => ({ status, items: orderByEmployeeChains(items) }));

  if (cancelled.length > 0) {
    statusGroups.push({ status: "cancelled", items: [...cancelled].sort(byTime) });
  }
  if (unscheduled.length > 0) {
    statusGroups.push({ status: "unscheduled", items: [...unscheduled].sort(byTime) });
  }

  placeNotes(notes, statusGroups, nonNotes);

  // Comme pour renderInterventionGroups : les blocs sont des suites
  // consécutives, un même couple (statut, type) peut donc revenir plus loin.
  // La position est intégrée aux clés pour qu'elles restent uniques.
  for (const [sgIdx, sg] of statusGroups.entries()) {
    rows.push({ kind: "status-header", status: sg.status, count: sg.items.length, key: `sh-${sg.status}-${sgIdx}` });

    const typeGroups: { type: string; items: any[] }[] = [];
    for (const item of sg.items) {
      const t = item.type ?? "intervention";
      const last = typeGroups[typeGroups.length - 1];
      if (last && last.type === t) last.items.push(item);
      else typeGroups.push({ type: t, items: [item] });
    }
    const multipleTypes = typeGroups.length > 1;

    for (const [tgIdx, tg] of typeGroups.entries()) {
      if (multipleTypes || tg.type !== "intervention") {
        rows.push({ kind: "type-header", type: tg.type, key: `th-${sg.status}-${sgIdx}-${tg.type}-${tgIdx}` });
      }

      // Heure définie (statut planifié/en cours/etc., pas "à planifier") : on
      // trie déjà par heure, l'affichage par zone n'apporte plus rien.
      const timeDefined = sg.status !== "unscheduled";

      const szGroups: { code: string | null; items: any[] }[] = [];
      for (const item of tg.items) {
        const code = timeDefined ? null : (item.sub_zone ?? null);
        const last = szGroups[szGroups.length - 1];
        if (last && last.code === code) last.items.push(item);
        else szGroups.push({ code, items: [item] });
      }
      const hasMultipleSubZones = !timeDefined && (szGroups.length > 1 || (szGroups.length === 1 && szGroups[0].code !== null));

      for (const [zgIdx, zg] of szGroups.entries()) {
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
            key: `zh-${sg.status}-${sgIdx}-${tg.type}-${tgIdx}-${zg.code}-${zgIdx}`,
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

  const { isDark, isAdmin, subZoneMap, viewMode, selectedDate, effectiveZone, setAssignModal, setSelectedAssignIds, setInitialAssignIds } = ctx;

  const byTime = (a: any, b: any) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

  // Les notes n'ont pas de statut de planification propre — voir placeNotes.
  const notes = list.filter((i) => i.type === "note");
  const nonNotes = list.filter((i) => i.type !== "note");

  // Annulé prime sur le reste (même sans heure définie) — ne doit jamais
  // atterrir dans "À planifier" à cause de time_tbd.
  const cancelled = nonNotes.filter((i) => i.status === "cancelled");
  const rest = nonNotes.filter((i) => i.status !== "cancelled");
  const scheduled = rest.filter((i) => !i.time_tbd);
  const unscheduled = rest.filter((i) => i.time_tbd);

  const byStatus = new Map<string, any[]>();
  for (const item of scheduled) {
    const arr = byStatus.get(item.status);
    if (arr) arr.push(item);
    else byStatus.set(item.status, [item]);
  }
  const groups: { status: string; items: any[] }[] = [...byStatus.entries()]
    .sort(([sa], [sb]) => (STATUS_ORDER[sa] ?? 9) - (STATUS_ORDER[sb] ?? 9))
    .map(([status, items]) => ({ status, items: orderByEmployeeChains(items) }));

  if (cancelled.length > 0) {
    groups.push({ status: "cancelled", items: [...cancelled].sort(byTime) });
  }
  if (unscheduled.length > 0) {
    groups.push({ status: "unscheduled", items: [...unscheduled].sort(byTime) });
  }

  placeNotes(notes, groups, nonNotes);

  // Les blocs sont construits par suites consécutives, pas par valeur unique :
  // dans le groupe « À planifier », qui mélange tous les statuts, un même type
  // peut réapparaître dans un bloc ultérieur. La position rend la clé unique.
  return groups.map((group, groupIdx) => {
    const typeGroups: { type: string; items: any[] }[] = [];
    for (const item of group.items) {
      const t = item.type ?? "intervention";
      const last = typeGroups[typeGroups.length - 1];
      if (last && last.type === t) last.items.push(item);
      else typeGroups.push({ type: t, items: [item] });
    }
    const multipleTypes = typeGroups.length > 1;

    return (
      <View key={`${group.status}-${groupIdx}`} style={compact ? {} : { marginBottom: 8 }}>
        {!compact && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLORS[group.status] ?? "#94A3B8" }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLORS[group.status] ?? "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {STATUS_LABELS[group.status] ?? group.status} ({group.items.length})
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", marginLeft: 4 }} />
          </View>
        )}
        {typeGroups.map((tg, tgIdx) => {
          // Heure définie (statut planifié/en cours/etc., pas "à planifier") : on
          // trie déjà par heure, l'affichage par zone n'apporte plus rien.
          const timeDefined = group.status !== "unscheduled";

          const szGroups: { code: string | null; items: any[] }[] = [];
          for (const item of tg.items) {
            const code = timeDefined ? null : (item.sub_zone ?? null);
            const last = szGroups[szGroups.length - 1];
            if (last && last.code === code) last.items.push(item);
            else szGroups.push({ code, items: [item] });
          }
          const hasMultipleSubZones = !timeDefined && (szGroups.length > 1 || (szGroups.length === 1 && szGroups[0].code !== null));

          return (
            <View key={`${tg.type}-${tgIdx}`}>
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
                  <View key={`${sg.code ?? "null"}-${idx}`} style={{ marginTop: idx === 0 ? 0 : compact ? 4 : 10 }}>
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
                            effectiveZone={effectiveZone}
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
  { id: "planned",     label: "Planifié",     color: "#3B82F6" },
  { id: "done",        label: "Terminé",      color: "#22C55E" },
  { id: "unscheduled", label: "À planifier",  color: "#94A3B8" },
];

interface FilterChipsBarProps {
  activeTypes: Set<string>;
  activeStatuses: Set<string>;
  isDark: boolean;
  toggleType: (id: string) => void;
  toggleStatus: (id: string) => void;
  setActiveTypes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveStatuses: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeEmployeeId: string | null;
  setActiveEmployeeId: (id: string | null) => void;
  employees: { id: string; full_name?: string | null; color: string }[];
  // Un sous-traitant n'a rien à faire des devis/tournées ni des statuts —
  // seuls "Intervention" et "Note" le concernent, sans filtre de statut.
  isSubcontractor?: boolean;
}

export const FilterChipsBar = React.memo(function FilterChipsBar({
  activeTypes,
  activeStatuses,
  isDark,
  toggleType,
  toggleStatus,
  setActiveTypes,
  setActiveStatuses,
  activeEmployeeId,
  setActiveEmployeeId,
  employees,
  isSubcontractor,
}: FilterChipsBarProps) {
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const hasFilters = activeTypes.size > 0 || activeStatuses.size > 0 || activeEmployeeId !== null;
  const activeEmp = employees.find(e => e.id === activeEmployeeId);
  const activeEmpName = activeEmp?.full_name?.split(" ")[0] ?? activeEmp?.full_name ?? null;
  const visibleTypes = isSubcontractor
    ? FILTER_TYPES.filter(f => f.id === "intervention" || f.id === "note")
    : FILTER_TYPES;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8, gap: 6 }}
        style={{ marginBottom: 8 }}
      >
        {hasFilters && (
          <Pressable
            onPress={() => { setActiveTypes(new Set()); setActiveStatuses(new Set()); setActiveEmployeeId(null); }}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginRight: 2 }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: isDark ? "#CBD5E1" : "#64748B" }}>✕ Tout</Text>
          </Pressable>
        )}
        {visibleTypes.map(f => {
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
        {employees.length > 0 && (
          <>
            <View style={{ width: 1, backgroundColor: isDark ? "#334155" : "#E2E8F0", marginHorizontal: 4 }} />
            <Pressable
              onPress={() => setEmpDropdownOpen(true)}
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
                backgroundColor: activeEmployeeId ? (activeEmp?.color || "#3B82F6") : isDark ? "#1E293B" : "#F1F5F9",
                borderWidth: 1,
                borderColor: activeEmployeeId ? (activeEmp?.color || "#3B82F6") : isDark ? "#334155" : "#E2E8F0",
                flexDirection: "row", alignItems: "center", gap: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: activeEmployeeId ? "#fff" : isDark ? "#94A3B8" : "#64748B" }}>
                {activeEmpName ?? "Employé"} ▾
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Modal visible={empDropdownOpen} transparent animationType="fade" onRequestClose={() => setEmpDropdownOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }} onPress={() => setEmpDropdownOpen(false)}>
          <View style={{
            width: 240,
            backgroundColor: isDark ? "#1E293B" : "#fff",
            borderRadius: 16, padding: 8,
            shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
          }}>
            {activeEmployeeId && (
              <Pressable
                onPress={() => { setActiveEmployeeId(null); setEmpDropdownOpen(false); }}
                style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginBottom: 4, backgroundColor: isDark ? "#334155" : "#F1F5F9" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#CBD5E1" : "#64748B" }}>✕ Retirer le filtre</Text>
              </Pressable>
            )}
            {employees.map(emp => {
              const active = activeEmployeeId === emp.id;
              const firstName = emp.full_name?.split(" ")[0] ?? emp.full_name ?? "?";
              const chipColor = emp.color || "#3B82F6";
              return (
                <Pressable
                  key={emp.id}
                  onPress={() => { setActiveEmployeeId(emp.id); setEmpDropdownOpen(false); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: active ? chipColor + "22" : "transparent",
                    flexDirection: "row", alignItems: "center", gap: 10,
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chipColor }} />
                  <Text style={{ fontSize: 13, fontWeight: active ? "700" : "500", color: active ? chipColor : isDark ? "#E2E8F0" : "#1E293B" }}>
                    {emp.full_name ?? firstName}
                  </Text>
                  {active && <Text style={{ marginLeft: "auto", color: chipColor, fontSize: 13, fontWeight: "700" }}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
});
