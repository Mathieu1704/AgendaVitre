import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform, Modal, FlatList, TextInput } from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Banknote,
  FileText,
  Wallet,
  Receipt,
  Users,
  CircleX,
  Hourglass,
  X,
  Search,
} from "lucide-react-native";

import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useInterventions } from "../../../src/hooks/useInterventions";
import { useAuth } from "../../../src/hooks/useAuth";
import { useCompanySettings } from "../../../src/hooks/useCompanySettingsSync";
import { useEmployees } from "../../../src/hooks/useEmployees";
import { startOfMonth, endOfMonth, addMonths } from "../../../src/lib/date";
import { isDeferredCashPending } from "../../../src/lib/payment";
import type { Intervention } from "../../../src/types";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MODE_META = {
  cash: { label: "Cash", color: "#EF4444", icon: Banknote },
  invoice: { label: "FAC", color: "#22C55E", icon: FileText },
  invoice_cash: { label: "FAC+Cash", color: "#F97316", icon: Wallet },
  tvac: { label: "TVAC", color: "#8B5CF6", icon: Receipt },
} as const;
type ModeKey = keyof typeof MODE_META;

type Drill = {
  title: string;
  color: string;
  items: Intervention[];
  /** Montant affiché par ligne (part cash, part facture...) ; CA par défaut. */
  amountOf?: (i: Intervention) => number;
};

function monthRange(month: Date) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

const num = (v: unknown) => Number(v) || 0;

/** Chiffre d'affaires propre au RDV : un solde reporté encaissé ici est déjà
 * compté sur le RDV d'origine (client absent), on ne le compte pas deux fois. */
function revenueOf(i: Intervention): number {
  return num(i.price_estimated) - num(i.carried_over_deferred_amount);
}

/** Répartition cash / facture d'un RDV. Un FAC+Cash dont le split n'est pas
 * renseigné est compté en facture, comme dans l'écran Facturation. */
function splitOf(i: Intervention): { cash: number; invoice: number } {
  const price = num(i.price_estimated);
  switch (i.payment_mode) {
    case "invoice":
      return { cash: 0, invoice: price };
    case "invoice_cash":
      return i.amount_invoice != null || i.amount_cash != null
        ? { cash: num(i.amount_cash), invoice: num(i.amount_invoice) }
        : { cash: 0, invoice: price };
    case "tvac":
      return { cash: price, invoice: price };
    default:
      return { cash: price, invoice: 0 };
  }
}

/** Montant lisible pour un tableau de bord : arrondi à l'euro, milliers
 * séparés (Hermes ne garantit pas toLocaleString). */
function fmt(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

/** `until` : ne garde que les RDV jusqu'à ce jour du mois, pour comparer le
 * mois en cours à la même période du mois précédent (pas au mois complet). */
function computeStats(
  list: Intervention[],
  hideCash: boolean,
  employeesById: Record<string, { full_name?: string; email?: string }>,
  until?: number,
) {
  const now = Date.now();
  const visible = list.filter(
    (i) =>
      // Hainaut uniquement : les Ardennes ne clôturent pas leurs RDV dans
      // l'app, leurs montants fausseraient tous les totaux.
      i.zone === "hainaut" &&
      i.type === "intervention" &&
      // Un renfort n'est pas un RDV en plus : c'est un employé en appui sur
      // le vrai RDV (prix 0). Le compter gonflerait le nombre de RDV et
      // fausserait le panier moyen ; il est affiché sur la ligne du RDV.
      !i.reinforcement_for_id &&
      !(hideCash && (i.payment_mode === "cash" || !i.payment_mode)) &&
      (until == null || new Date(i.start_time).getDate() <= until),
  );
  const done = visible.filter((i) => i.status === "done");
  const open = visible.filter((i) => i.status === "planned" || i.status === "in_progress");
  const upcoming = open.filter((i) => new Date(i.start_time).getTime() >= now);
  // Date passée mais jamais clôturé : soit oublié, soit pas encore traité.
  const overdue = open.filter((i) => new Date(i.start_time).getTime() < now);
  const cancelled = visible.filter((i) => i.status === "cancelled");

  type Bucket = { amount: number; count: number; items: Intervention[] };
  const bucket = (): Bucket => ({ amount: 0, count: 0, items: [] });
  const add = (b: Bucket, i: Intervention, amount: number) => {
    b.amount += amount;
    b.count += 1;
    b.items.push(i);
  };
  const byMode: Record<ModeKey, Bucket> = {
    cash: bucket(),
    invoice: bucket(),
    invoice_cash: bucket(),
    tvac: bucket(),
  };
  let revenue = 0;
  const cash = bucket();
  const cashTvac = bucket();
  const deferred = bucket();
  const invoices = { toDo: bucket(), done: bucket() };
  const tvacInvoices = { toDo: bucket(), done: bucket() };
  const byEmployee: Record<string, Bucket & { name: string }> = {};
  const unassigned = bucket();

  for (const i of done) {
    const rev = revenueOf(i);
    const mode = (i.payment_mode || "cash") as ModeKey;
    revenue += rev;
    if (byMode[mode]) add(byMode[mode], i, rev);

    const split = splitOf(i);
    if (isDeferredCashPending(i)) {
      add(deferred, i, num(i.deferred_cash_amount));
    } else if (split.cash > 0 && !(hideCash && mode === "invoice_cash")) {
      add(mode === "tvac" ? cashTvac : cash, i, split.cash);
    }

    const inv = mode === "tvac" ? tvacInvoices : invoices;
    if (mode === "tvac" || split.invoice > 0) {
      add(i.invoiced_at ? inv.done : inv.toDo, i, split.invoice);
    }

    // CA attribué en entier à celui qui a clôturé (ou à l'employé désigné
    // par l'admin à la clôture), même s'il n'était pas assigné — ex. un admin
    // qui clôture un FAC. Jamais de répartition : sans clôtureur connu, le
    // montant reste "Non attribué".
    const closerId = i.closed_by_employee_id;
    const closer: any =
      (closerId && (i.employees || []).find((e: any) => e.id === closerId)) ||
      (closerId && employeesById[closerId]);
    if (closerId && closer) {
      const entry = (byEmployee[closerId] ||= {
        name: closer.full_name || closer.email || "Sans nom",
        ...bucket(),
      });
      add(entry, i, rev);
    } else {
      add(unassigned, i, rev);
    }
  }

  const sum = (list: Intervention[]) => list.reduce((acc, i) => acc + revenueOf(i), 0);

  return {
    revenue,
    done,
    doneCount: done.length,
    avgTicket: done.length ? revenue / done.length : 0,
    upcoming,
    upcomingAmount: sum(upcoming),
    upcomingCount: upcoming.length,
    overdue,
    overdueAmount: sum(overdue),
    overdueCount: overdue.length,
    cancelled,
    cancelledAmount: sum(cancelled),
    cancelledCount: cancelled.length,
    byMode,
    cash,
    cashTvac,
    cashCollected: cash.amount + cashTvac.amount,
    deferred,
    invoices,
    tvacInvoices,
    employees: Object.values(byEmployee).sort((a, b) => b.amount - a.amount),
    unassigned,
  };
}

export default function ComptesScreen() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { data: companySettings } = useCompanySettings();
  const hideCash = companySettings?.hide_cash ?? false;

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const range = useMemo(() => monthRange(month), [month]);
  const prevRange = useMemo(() => monthRange(addMonths(month, -1)), [month]);

  const qc = useQueryClient();
  const { employees: allEmployees } = useEmployees();
  const employeesById = useMemo(() => {
    const map: Record<string, { full_name?: string; role?: string }> = {};
    for (const e of allEmployees as any[]) map[e.id] = e;
    return map;
  }, [allEmployees]);

  // Détail d'un agrégat : la liste des RDV qui le composent. La feuille est
  // refermée le temps d'ouvrir une fiche RDV (sinon elle la recouvre) et
  // rouverte au retour sur cet écran.
  const [drill, setDrill] = useState<Drill | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drillQuery, setDrillQuery] = useState("");
  useFocusEffect(
    useCallback(() => {
      if (drill) setSheetOpen(true);
    }, [drill]),
  );
  const openDrill = (d: Drill) => {
    if (d.items.length === 0) return;
    setDrillQuery("");
    setDrill(d);
    setSheetOpen(true);
  };
  const closeDrill = () => {
    setSheetOpen(false);
    setDrill(null);
  };
  const openIntervention = (item: Intervention) => {
    setSheetOpen(false);
    qc.setQueryData(["intervention", item.id], item);
    setTimeout(
      () =>
        router.push({
          pathname: "/(app)/calendar/[id]",
          params: { id: item.id, from_view: "comptes" },
        }),
      Platform.OS === "ios" ? 300 : 0,
    );
  };

  const { interventions, isLoading } = useInterventions(range);
  const { interventions: prevInterventions } = useInterventions(prevRange);

  const stats = useMemo(() => computeStats(interventions, hideCash, employeesById), [interventions, hideCash, employeesById]);
  const isCurrentMonth =
    month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const prevStats = useMemo(
    () => computeStats(prevInterventions, hideCash, employeesById, isCurrentMonth ? new Date().getDate() : undefined),
    [prevInterventions, hideCash, employeesById, isCurrentMonth],
  );

  if (!authLoading && !isAdmin) {
    return <Redirect href="/(app)" />;
  }

  const c = {
    bg: isDark ? "#020817" : "#FFFFFF",
    card: isDark ? "#0F172A" : "#FFFFFF",
    border: isDark ? "#1E293B" : "#E4E4E7",
    soft: isDark ? "#0B1220" : "#F8FAFC",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: "#94A3B8",
    track: isDark ? "#1E293B" : "#E2E8F0",
  };

  const cardStyle = {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    padding: 18,
    gap: 14,
  };

  const SectionTitle = ({ icon: Icon, title, color }: { icon: any; title: string; color: string }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={18} color={color} />
      <Text style={{ fontSize: 16, fontWeight: "800", color: c.text }}>{title}</Text>
    </View>
  );

  const Bar = ({ ratio, color }: { ratio: number; color: string }) => (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    </View>
  );

  const delta = prevStats.revenue > 0 ? (stats.revenue - prevStats.revenue) / prevStats.revenue : null;
  const projected = stats.revenue + stats.upcomingAmount + stats.overdueAmount;
  const prevMonthName = MONTHS[addMonths(month, -1).getMonth()].toLowerCase();
  const modes = (Object.keys(MODE_META) as ModeKey[]).filter(
    (m) => !(hideCash && (m === "cash" || m === "invoice_cash")),
  );
  const modeTotal = modes.reduce((acc, m) => acc + stats.byMode[m].amount, 0);
  const empMax = Math.max(1, stats.unassigned.amount, ...stats.employees.map((e) => e.amount));
  const cashOf = (i: Intervention) => splitOf(i).cash;
  const invoiceOf = (i: Intervention) => splitOf(i).invoice;

  /** Ligne d'agrégat cliquable : ouvre la liste des RDV correspondants. */
  const Tap = ({ drill: d, children, style }: { drill: Drill; children: React.ReactNode; style?: any }) => (
    <Pressable
      onPress={() => openDrill(d)}
      disabled={d.items.length === 0}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );

  /** Ligne cliquable : pastille de couleur, libellé, montant et flèche — plus
   * lisible qu'un texte souligné pour signaler qu'on peut ouvrir la liste. */
  const LinkRow = ({
    drill: d,
    dot,
    label,
    value,
    sub,
    onDark = false,
  }: {
    drill: Drill;
    dot: string;
    label: string;
    value: string;
    sub?: string;
    onDark?: boolean;
  }) => {
    const enabled = d.items.length > 0;
    return (
      <Tap
        drill={d}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: onDark ? "rgba(255,255,255,0.14)" : c.soft,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: onDark ? "white" : c.text }} numberOfLines={1}>
            {label}
          </Text>
          {!!sub && (
            <Text style={{ fontSize: 11, fontWeight: "600", color: onDark ? "rgba(255,255,255,0.75)" : c.muted }}>
              {sub}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 14, fontWeight: "800", color: onDark ? "white" : c.text }}>{value}</Text>
        {enabled && <ChevronRight size={16} color={onDark ? "rgba(255,255,255,0.8)" : c.muted} />}
      </Tap>
    );
  };

  const InvoiceRow = ({
    label,
    color,
    buckets,
  }: {
    label: string;
    color: string;
    buckets: { toDo: { amount: number; count: number; items: Intervention[] }; done: { amount: number; count: number; items: Intervention[] } };
  }) => {
    const total = buckets.toDo.amount + buckets.done.amount;
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{label}</Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color }}>{fmt(total)}</Text>
        </View>
        <Bar ratio={total > 0 ? buckets.done.amount / total : 0} color={color} />
        <View style={{ gap: 6 }}>
          <LinkRow
            drill={{ title: `${label} — à facturer`, color: "#F97316", items: buckets.toDo.items, amountOf: invoiceOf }}
            dot="#F97316"
            label="À facturer"
            sub={`${buckets.toDo.count} RDV`}
            value={fmt(buckets.toDo.amount)}
          />
          <LinkRow
            drill={{ title: `${label} — facturé`, color: "#22C55E", items: buckets.done.items, amountOf: invoiceOf }}
            dot="#22C55E"
            label="Facturé"
            sub={`${buckets.done.count} RDV`}
            value={fmt(buckets.done.amount)}
          />
        </View>
      </View>
    );
  };

  const personLabel = (id?: string | null) => {
    if (!id) return null;
    const e = employeesById[id];
    if (!e) return "inconnu";
    return `${e.full_name || "Sans nom"}${e.role === "admin" ? " (admin)" : ""}`;
  };

  const DrillRow = ({ item }: { item: Intervention }) => {
    const d = new Date(item.start_time);
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mode = MODE_META[(item.payment_mode || "cash") as ModeKey] ?? MODE_META.cash;
    const assignees = (item.employees || []).map((e: any) => e.full_name).filter(Boolean).join(", ");
    const reinforcements = reinforcementsByParent[item.id];
    const amount = drill?.amountOf ? drill.amountOf(item) : revenueOf(item);
    const closer = personLabel(item.closed_by_employee_id);
    const closerAssigned = (item.employees || []).some((e: any) => e.id === item.closed_by_employee_id);
    return (
      <Pressable
        onPress={() => openIntervention(item)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? c.soft : c.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          gap: 4,
        })}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: c.text }} numberOfLines={1}>
            {item.client?.name || item.title}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color: c.text }}>{fmt(amount)}</Text>
        </View>
        <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>
          {date} · {item.address || item.client?.address || item.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: `${mode.color}22` }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: mode.color }}>{mode.label}</Text>
          </View>
          {!!item.invoiced_at && (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "#22C55E22" }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#22C55E" }}>Facturé</Text>
            </View>
          )}
          <Text style={{ flex: 1, fontSize: 11, color: c.muted, fontWeight: "600" }} numberOfLines={2}>
            {item.status === "done"
              ? `Clôturé par ${closer ?? "inconnu"}${closer && !closerAssigned ? " — non assigné" : ""}${assignees ? ` · Assigné : ${assignees}` : ""}`
              : assignees
                ? `Assigné : ${assignees}`
                : "Aucun employé assigné"}
            {reinforcements?.length ? ` · Renfort : ${[...new Set(reinforcements)].join(", ")}` : ""}
          </Text>
        </View>
      </Pressable>
    );
  };

  // Recherche sans accents ni casse sur tout ce qu'affiche une ligne : client,
  // titre, adresse, employés assignés et qui a clôturé.
  const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = normalize(drillQuery).split(/\s+/).filter(Boolean);
  const matches = (i: Intervention) => {
    if (terms.length === 0) return true;
    const haystack = normalize(
      [
        i.client?.name,
        i.title,
        i.address,
        i.client?.address,
        ...(i.employees || []).map((e: any) => e.full_name),
        personLabel(i.closed_by_employee_id),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return terms.every((t) => haystack.includes(t));
  };
  // Employés venus en renfort, par RDV principal (affichés sur sa ligne).
  const reinforcementsByParent: Record<string, string[]> = {};
  for (const i of interventions as Intervention[]) {
    if (!i.reinforcement_for_id || i.status === "cancelled") continue;
    const names = (i.employees || []).map((e: any) => e.full_name).filter(Boolean);
    (reinforcementsByParent[i.reinforcement_for_id] ||= []).push(...names);
  }

  const drillItems = drill
    ? drill.items
        .filter(matches)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    : [];
  const drillTotal = drill ? drillItems.reduce((acc, i) => acc + (drill.amountOf ? drill.amountOf(i) : revenueOf(i)), 0) : 0;

  return (
    <View style={{ flex: 1, paddingTop: isWeb ? 0 : insets.top, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Pressable
          onPress={() => router.push("/(app)/parametres/facturation")}
          style={{ padding: 8, borderRadius: 999 }}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: c.text, marginLeft: 8 }}>
          Comptes du mois · Hainaut
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, -1))}
          style={{ padding: 8, borderRadius: 999, backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
        >
          <ChevronLeft size={20} color={c.text} />
        </Pressable>
        <Text style={{ fontWeight: "800", fontSize: 15, color: c.text }}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={() => setMonth((m) => addMonths(m, 1))}
          style={{ padding: 8, borderRadius: 999, backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
        >
          <ChevronRight size={20} color={c.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Chiffre d'affaires */}
          <View style={{ ...cardStyle, backgroundColor: "#3B82F6", borderColor: "#3B82F6" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" }}>
              Chiffre d'affaires réalisé
            </Text>
            <Tap drill={{ title: "RDV terminés", color: "#3B82F6", items: stats.done }}>
              <Text style={{ fontSize: 34, fontWeight: "900", color: "white" }}>
                {fmt(stats.revenue)}
              </Text>
            </Tap>
            {delta != null && (
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.18)",
                }}
              >
                {delta >= 0 ? <TrendingUp size={14} color="white" /> : <TrendingDown size={14} color="white" />}
                <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>
                  {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}% vs {isCurrentMonth ? `même période en ${prevMonthName}` : prevMonthName}
                </Text>
              </View>
            )}
            {projected > stats.revenue && (
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
                  <View style={{ flex: stats.revenue, backgroundColor: "white" }} />
                  <View style={{ flex: stats.overdueAmount, backgroundColor: "#FDBA74" }} />
                  <View style={{ flex: stats.upcomingAmount }} />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" }}>
                  Potentiel du mois : {fmt(projected)}
                </Text>
              </View>
            )}
            <View style={{ gap: 6 }}>
              <LinkRow
                onDark
                drill={{ title: "RDV terminés", color: "#3B82F6", items: stats.done }}
                dot="white"
                label="Terminés"
                sub={`${stats.doneCount} RDV · panier moyen ${fmt(stats.avgTicket)}`}
                value={fmt(stats.revenue)}
              />
              {stats.upcomingCount > 0 && (
                <LinkRow
                  onDark
                  drill={{ title: "RDV à venir", color: "#3B82F6", items: stats.upcoming }}
                  dot="rgba(255,255,255,0.45)"
                  label="À venir"
                  sub={`${stats.upcomingCount} RDV`}
                  value={fmt(stats.upcomingAmount)}
                />
              )}
              {stats.overdueCount > 0 && (
                <LinkRow
                  onDark
                  drill={{ title: "Passés mais pas marqués terminés", color: "#F97316", items: stats.overdue }}
                  dot="#FDBA74"
                  label="Pas marqués terminés"
                  sub={`${stats.overdueCount} RDV dont la date est passée`}
                  value={fmt(stats.overdueAmount)}
                />
              )}
            </View>
          </View>

          {/* Répartition par mode de paiement */}
          <View style={cardStyle}>
            <SectionTitle icon={Wallet} title="Par mode de paiement" color="#3B82F6" />
            <View style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: c.track }}>
              {modes.map((m) =>
                stats.byMode[m].amount > 0 ? (
                  <View
                    key={m}
                    style={{ flex: stats.byMode[m].amount / Math.max(1, modeTotal), backgroundColor: MODE_META[m].color }}
                  />
                ) : null,
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {modes.map((m) => {
                const { label, color, icon: Icon } = MODE_META[m];
                const { amount, count, items } = stats.byMode[m];
                return (
                  <Tap
                    key={m}
                    drill={{ title: `Paiement ${label}`, color, items }}
                    style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: c.soft, borderRadius: 16, padding: 12, gap: 4 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon size={14} color={color} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color, flex: 1 }}>{label}</Text>
                      {count > 0 && <ChevronRight size={14} color={c.muted} />}
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: c.text }}>
                      {fmt(amount)}
                    </Text>
                    <Text style={{ fontSize: 11, color: c.muted, fontWeight: "600" }}>
                      {count} RDV · {modeTotal > 0 ? Math.round((amount / modeTotal) * 100) : 0}%
                    </Text>
                  </Tap>
                );
              })}
            </View>
          </View>

          {/* Factures */}
          <View style={cardStyle}>
            <SectionTitle icon={FileText} title="Factures à émettre" color="#22C55E" />
            <InvoiceRow label="FAC (+ part facture FAC+Cash)" color="#22C55E" buckets={stats.invoices} />
            <InvoiceRow label="TVAC (acquittées)" color="#8B5CF6" buckets={stats.tvacInvoices} />
          </View>

          {/* Cash */}
          <View style={cardStyle}>
            <SectionTitle icon={Banknote} title="Cash encaissé par les employés" color="#EF4444" />
            <Tap
              drill={{ title: "Cash encaissé", color: "#EF4444", items: [...stats.cash.items, ...stats.cashTvac.items], amountOf: cashOf }}
            >
              <Text style={{ fontSize: 26, fontWeight: "900", color: c.text }}>
                {fmt(stats.cashCollected)}
              </Text>
            </Tap>
            {!hideCash && (
              <View style={{ gap: 6 }}>
                <LinkRow
                  drill={{ title: "Cash et FAC+Cash", color: "#EF4444", items: stats.cash.items, amountOf: cashOf }}
                  dot="#EF4444"
                  label="Cash et FAC+Cash"
                  sub={`${stats.cash.count} RDV`}
                  value={fmt(stats.cash.amount)}
                />
                <LinkRow
                  drill={{ title: "Cash TVAC", color: "#8B5CF6", items: stats.cashTvac.items, amountOf: cashOf }}
                  dot="#8B5CF6"
                  label="TVAC"
                  sub={`${stats.cashTvac.count} RDV`}
                  value={fmt(stats.cashTvac.amount)}
                />
              </View>
            )}
            {stats.deferred.count > 0 && (
              <Tap
                drill={{
                  title: "Paiements reportés",
                  color: "#F97316",
                  items: stats.deferred.items,
                  amountOf: (i) => num(i.deferred_cash_amount),
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: isDark ? "rgba(249,115,22,0.1)" : "#FFF7ED",
                }}
              >
                <Hourglass size={14} color="#F97316" />
                <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: isDark ? "#FDBA74" : "#C2410C" }}>
                  {fmt(stats.deferred.amount)} reporté(s) — client absent, pas encore encaissé ({stats.deferred.count} RDV)
                </Text>
                <ChevronRight size={14} color="#F97316" />
              </Tap>
            )}
          </View>

          {/* Employés */}
          {(stats.employees.length > 0 || stats.unassigned.count > 0) && (
            <View style={cardStyle}>
              <SectionTitle icon={Users} title="CA par employé" color="#3B82F6" />
              {stats.employees.map((e) => (
                <Tap key={e.name} drill={{ title: e.name, color: "#3B82F6", items: e.items }} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: c.text }} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: c.text }}>
                      {fmt(e.amount)}
                      <Text style={{ color: c.muted, fontWeight: "600" }}>{"  "}{e.count} RDV</Text>
                    </Text>
                    <ChevronRight size={14} color={c.muted} />
                  </View>
                  <Bar ratio={e.amount / empMax} color="#3B82F6" />
                </Tap>
              ))}
              {stats.unassigned.count > 0 && (
                <Tap drill={{ title: "Non attribué", color: "#94A3B8", items: stats.unassigned.items }} style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: c.muted, fontStyle: "italic" }}>
                      Non attribué
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: c.muted }}>
                      {fmt(stats.unassigned.amount)}
                      <Text style={{ fontWeight: "600" }}>{"  "}{stats.unassigned.count} RDV</Text>
                    </Text>
                    <ChevronRight size={14} color={c.muted} />
                  </View>
                  <Bar ratio={stats.unassigned.amount / empMax} color="#94A3B8" />
                </Tap>
              )}
              <Text style={{ fontSize: 11, color: c.muted }}>
                Attribué à celui qui a clôturé le RDV (ou à l'employé désigné par l'admin). Sinon : non attribué.
              </Text>
            </View>
          )}

          {/* Annulations */}
          {stats.cancelledCount > 0 && (
            <Tap
              drill={{ title: "RDV annulés", color: "#EF4444", items: stats.cancelled }}
              style={{ ...cardStyle, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <CircleX size={20} color="#EF4444" />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: c.text }}>
                {stats.cancelledCount} RDV annulé(s) — {fmt(stats.cancelledAmount)} non réalisés
              </Text>
              <ChevronRight size={14} color={c.muted} />
            </Tap>
          )}

          <Text style={{ fontSize: 11, color: c.muted, textAlign: "center" }}>
            Zone Hainaut uniquement. Touchez un montant pour voir les RDV concernés.
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={sheetOpen && !!drill}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDrill}
      >
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingTop: Platform.OS === "android" ? insets.top + 12 : 18,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: drill?.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: c.text }} numberOfLines={1}>
                {drill?.title}
              </Text>
              <Text style={{ fontSize: 12, color: c.muted, fontWeight: "600" }}>
                {drillItems.length} RDV · {fmt(drillTotal)} · {MONTHS[month.getMonth()]} {month.getFullYear()}
              </Text>
            </View>
            <Pressable
              onPress={closeDrill}
              style={{ padding: 8, borderRadius: 999, backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
            >
              <X size={18} color={c.text} />
            </Pressable>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 16,
              marginTop: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
            }}
          >
            <Search size={16} color={c.muted} />
            <TextInput
              value={drillQuery}
              onChangeText={setDrillQuery}
              placeholder="Rechercher client, adresse, employé…"
              placeholderTextColor={c.muted}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: c.text }}
            />
            {!!drillQuery && Platform.OS !== "ios" && (
              <Pressable onPress={() => setDrillQuery("")} hitSlop={8}>
                <X size={16} color={c.muted} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={drillItems}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ textAlign: "center", color: c.muted, marginTop: 24 }}>Aucun RDV ne correspond.</Text>
            }
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <DrillRow item={item} />}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          />
        </View>
      </Modal>
    </View>
  );
}
