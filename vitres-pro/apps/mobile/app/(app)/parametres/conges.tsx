import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Button } from "../../../src/ui/components/Button";
import { MultiDatePicker } from "../../../src/ui/components/MultiDatePicker";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";
import { api } from "../../../src/lib/api";
import { useClosuresByRange } from "../../../src/hooks/useClosures";
import { useMarkNotificationRead, useNotifications } from "../../../src/hooks/useNotifications";

type Balance = {
  employee_id: string;
  employee_name: string;
  year: number;
  entitled: number;
  months: number[];
  taken: number;
  planned: number;
  pending: number;
  remaining: number;
};

type LeaveRequest = {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  start_date: string;
  end_date: string;
  days: number;
  status: "pending" | "approved" | "refused" | "cancelled";
  /** "admin" : congé encodé directement depuis la fiche employé, sans demande. */
  source?: "request" | "admin";
  comment?: string | null;
  decision_note?: string | null;
};

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

const STATUS: Record<LeaveRequest["status"], { label: string; color: string }> = {
  pending: { label: "En attente", color: "#F97316" },
  approved: { label: "Accepté", color: "#16A34A" },
  refused: { label: "Refusé", color: "#DC2626" },
  cancelled: { label: "Annulé", color: "#64748B" },
};

const fmtDays = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

const fmtPeriod = (r: LeaveRequest) =>
  r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}`;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const nextDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Regroupe des jours en blocs consécutifs : chaque bloc devient une demande. */
const isWeekend = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
};

/** `d` suit-il `prev` sans autre jour de semaine entre les deux ? Un vendredi
 * et le lundi suivant comptent comme consécutifs : le week-end ne coupe pas
 * une période de congé en deux demandes. */
const followsAcrossWeekend = (prev: string, d: string) => {
  let cursor = nextDay(prev);
  for (let guard = 0; cursor < d && guard < 3; guard++) {
    if (!isWeekend(cursor)) return false;
    cursor = nextDay(cursor);
  }
  return cursor === d;
};

const groupConsecutive = (dates: string[]): { start: string; end: string }[] => {
  const groups: { start: string; end: string }[] = [];
  for (const d of [...dates].sort()) {
    const last = groups[groups.length - 1];
    if (last && followsAcrossWeekend(last.end, d)) last.end = d;
    else groups.push({ start: d, end: d });
  }
  return groups;
};

const errorDetail = (e: any) => e?.response?.data?.detail || "Vérifie ta connexion et réessaie.";

export default function CongesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { isAdmin, isSubcontractor } = useAuth();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [adminTab, setAdminTab] = useState<"requests" | "overview">("requests");
  const [dates, setDates] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  // Valeurs en cours de saisie dans la colonne « Droit », par employé.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Fériés et fermetures de l'entreprise, d'aujourd'hui à la fin de l'année
  // prochaine : affichés en rouge et non sélectionnables (ils ne coûtent pas
  // de jour de congé).
  const closures = useClosuresByRange(todayIso(), `${new Date().getFullYear() + 1}-12-31`);
  const closedDayColors = useMemo(() => {
    const colors: Record<string, "red"> = {};
    for (const c of closures) {
      for (let d = c.start_date, guard = 0; d <= c.end_date && guard < 400; d = nextDay(d), guard++) {
        colors[d] = "red";
      }
    }
    return colors;
  }, [closures]);

  // L'employé voit ici le résultat de ses demandes : les notifications de
  // décision deviennent lues, ce qui éteint son badge « Congés ».
  const { notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  useEffect(() => {
    for (const n of notifications) {
      if (n.type === "leave_decision" && !n.is_read) markRead.mutate(n.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const border = isDark ? "#334155" : "#E2E8F0";
  const surface = isDark ? "#0F172A" : "#F8FAFC";
  const textColor = isDark ? "#FFFFFF" : "#09090B";
  const muted = isDark ? "#94A3B8" : "#64748B";

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["leaves"] });
    // Un congé accepté ou annulé change les absences, donc la capacité du planning.
    queryClient.invalidateQueries({ queryKey: ["absences"] });
    queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
    queryClient.invalidateQueries({ queryKey: ["planning-range"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["leaves", "balance", year],
    queryFn: async () => (await api.get("/api/leaves/balance", { params: { year } })).data as Balance,
    enabled: !isSubcontractor,
    refetchOnMount: "always",
  });

  // Congés encodés par un admin depuis la fiche employé : ils comptent dans le
  // solde, on les montre donc aussi dans « Mes demandes ». Si la route n'est
  // pas encore déployée, la liste reste simplement sans eux.
  const { data: encoded } = useQuery({
    queryKey: ["leaves", "encoded", year],
    queryFn: async () => (await api.get("/api/leaves/encoded", { params: { year } })).data as LeaveRequest[],
    enabled: !isSubcontractor,
    refetchOnMount: "always",
    retry: false,
  });

  const { data: requests } = useQuery({
    queryKey: ["leaves", "requests"],
    queryFn: async () => (await api.get("/api/leaves/requests")).data as LeaveRequest[],
    refetchOnMount: "always",
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["leaves", "overview", year],
    queryFn: async () => (await api.get("/api/leaves/overview", { params: { year } })).data as Balance[],
    enabled: isAdmin,
    refetchOnMount: "always",
  });

  const createRequest = useMutation({
    // Une demande par bloc de jours consécutifs, envoyées l'une après l'autre :
    // si l'une est refusée, les jours déjà envoyés sont retirés de la sélection
    // pour qu'un second essai ne les redemande pas.
    mutationFn: async () => {
      let sent = 0;
      for (const g of groupConsecutive(dates)) {
        try {
          await api.post("/api/leaves/requests", {
            start_date: g.start,
            end_date: g.end,
            comment: comment.trim() || undefined,
          });
        } catch (e) {
          setDates((prev) => prev.filter((d) => d >= g.start));
          refreshAll();
          throw e;
        }
        sent++;
      }
      return sent;
    },
    onSuccess: (sent) => {
      toast.success(
        sent > 1 ? `${sent} demandes envoyées` : "Demande envoyée",
        "À valider par un admin.",
      );
      setComment("");
      setDates([]);
      refreshAll();
    },
    onError: (e: any) => toast.error("Demande refusée", errorDetail(e)),
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "refuse" | "cancel" }) =>
      api.post(`/api/leaves/requests/${id}/${action}`, {}),
    onSuccess: (_res, { action }) => {
      toast.success(
        action === "approve" ? "Congé accepté" : action === "refuse" ? "Congé refusé" : "Congé annulé",
        action === "approve" ? "L'employé est retiré du planning ces jours-là." : "",
      );
      refreshAll();
    },
    onError: (e: any) => toast.error("Erreur", errorDetail(e)),
  });

  // Tirer l'écran vers le bas : relit solde, demandes, vue d'ensemble et
  // fermetures (ex. un admin vient d'accepter un congé sur un autre appareil).
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = async () => {
    setPulling(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["leaves"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["closures"], type: "active" }),
      ]);
    } finally {
      setPulling(false);
    }
  };

  // Refus et annulations ne sont pas réversibles depuis l'app : on confirme.
  const confirmThen = (title: string, message: string, confirmLabel: string, run: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) run();
      return;
    }
    Alert.alert(title, message, [
      { text: "Retour", style: "cancel" },
      { text: confirmLabel, style: "destructive", onPress: run },
    ]);
  };

  const askRefuse = (r: LeaveRequest) =>
    confirmThen(
      "Refuser ce congé ?",
      `${r.employee_name ?? "L'employé"} — ${fmtPeriod(r)} (${fmtDays(r.days)} j). L'employé sera prévenu.`,
      "Refuser",
      () => decide.mutate({ id: r.id, action: "refuse" }),
    );

  const askCancelApproved = (r: LeaveRequest) =>
    confirmThen(
      "Annuler ce congé ?",
      `${r.employee_name ?? "L'employé"} — ${fmtPeriod(r)}. Les ${fmtDays(r.days)} jour(s) reviennent dans son solde et il redevient disponible dans le planning.`,
      "Annuler le congé",
      () => decide.mutate({ id: r.id, action: "cancel" }),
    );

  const askWithdraw = (r: LeaveRequest) =>
    confirmThen(
      "Retirer cette demande ?",
      fmtPeriod(r),
      "Retirer",
      () => decide.mutate({ id: r.id, action: "cancel" }),
    );

  const saveEntitlement = useMutation({
    mutationFn: ({ employee_id, days }: { employee_id: string; days: number }) =>
      api.put("/api/leaves/entitlements", { employee_id, year, days }),
    onSuccess: () => refreshAll(),
    onError: (e: any) => toast.error("Erreur", errorDetail(e)),
  });

  const commitDraft = (row: Balance) => {
    const raw = drafts[row.employee_id];
    if (raw === undefined) return;
    const days = parseFloat(raw.replace(",", "."));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[row.employee_id];
      return next;
    });
    if (!Number.isFinite(days) || days < 0) return toast.error("Valeur invalide", "Entre un nombre de jours.");
    if (days === row.entitled) return;
    saveEntitlement.mutate({ employee_id: row.employee_id, days });
  };

  const submit = () => {
    if (dates.length === 0) return toast.error("Dates", "Choisis au moins un jour.");
    createRequest.mutate();
  };

  const myId = balance?.employee_id;
  const myRequests = [
    ...(requests ?? []).filter((r) => !isAdmin || r.employee_id === myId),
    ...(encoded ?? []),
  ].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const pendingForAdmin = (requests ?? []).filter((r) => r.status === "pending");

  // Jours hors solde de chaque demande en attente : on répartit le solde
  // restant (droit - pris - prévu) entre les demandes de l'employé, dans
  // l'ordre de leurs dates. Un dépassement n'est pas bloqué, il est signalé
  // pour que l'admin décide (congé sans solde, récupération...).
  const overBalanceById = (() => {
    const out: Record<string, number> = {};
    const remainingByEmp: Record<string, number> = {};
    for (const row of overview ?? []) remainingByEmp[row.employee_id] = row.remaining;
    if (!isAdmin && balance) remainingByEmp[balance.employee_id] = balance.remaining;
    const pending = [...(requests ?? [])]
      .filter((r) => r.status === "pending" && r.start_date.startsWith(String(year)))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (const r of pending) {
      if (!(r.employee_id in remainingByEmp)) continue;
      const available = Math.max(0, remainingByEmp[r.employee_id]);
      const excess = Math.max(0, r.days - available);
      if (excess > 0) out[r.id] = excess;
      remainingByEmp[r.employee_id] -= r.days;
    }
    return out;
  })();

  // Avant l'envoi : jours choisis dans l'année affichée, comparés au solde
  // encore libre (restant moins ce qui est déjà en attente). Les week-ends et
  // fermetures n'étant pas sélectionnables, chaque date choisie compte.
  const requestedThisYear = dates.filter((d) => d.startsWith(String(year))).length;
  const freeDays = balance ? Math.max(0, balance.remaining - balance.pending) : 0;
  const outsideBalance = balance ? Math.max(0, requestedThisYear - freeDays) : 0;
  const othersHandled = (requests ?? []).filter((r) => r.status !== "pending" && r.employee_id !== myId);

  const card = {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: surface,
    padding: 16,
    marginBottom: 16,
  } as const;

  // Les listes de demandes défilent dans leur carte au-delà de ~3 demandes,
  // pour que l'écran ne s'allonge pas indéfiniment.
  const listStyle = { maxHeight: 330 } as const;

  const sectionTitle = (label: string) => (
    <Text style={{ fontSize: 12, fontWeight: "700", color: muted, textTransform: "uppercase", marginBottom: 10 }}>
      {label}
    </Text>
  );

  const stat = (label: string, value: number, color?: string) => (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: color ?? textColor }}>{fmtDays(value)}</Text>
      <Text style={{ fontSize: 11, fontWeight: "600", color: muted, textAlign: "center" }}>{label}</Text>
    </View>
  );

  // Appui long sur une carte : retirer une demande en attente ou annuler un
  // congé accepté (avec confirmation), sans gros bouton dans la liste.
  const requestRow = (
    r: LeaveRequest,
    opts: { showName: boolean; actions?: React.ReactNode; onLongPress?: () => void },
  ) => (
    <Animated.View
      key={r.id}
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(180)}
      layout={LinearTransition.duration(260)}
      style={{ marginBottom: 8 }}
    >
      <Pressable
        onLongPress={opts.onLongPress}
        disabled={!opts.onLongPress}
        delayLongPress={400}
        style={({ pressed }) => ({
          borderRadius: 16, borderWidth: 1, borderColor: border, padding: 12, gap: 6,
          opacity: pressed && opts.onLongPress ? 0.6 : 1,
        })}
      >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          {opts.showName && (
            <Text style={{ fontSize: 15, fontWeight: "700", color: textColor }}>{r.employee_name}</Text>
          )}
          <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{fmtPeriod(r)}</Text>
          <Text style={{ fontSize: 12, color: muted }}>{`${fmtDays(r.days)} jour${r.days > 1 ? "s" : ""}`}</Text>
        </View>
        <View style={{ borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: `${STATUS[r.status].color}22` }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: STATUS[r.status].color }}>{STATUS[r.status].label}</Text>
        </View>
      </View>
      {r.source === "admin" && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: muted, fontStyle: "italic" }}>Encodé par l'admin</Text>
      )}
      {!!r.comment && <Text style={{ fontSize: 13, color: muted }}>{r.comment}</Text>}
      {!!r.decision_note && <Text style={{ fontSize: 13, color: muted }}>{`Motif : ${r.decision_note}`}</Text>}
      {r.status === "pending" && !!overBalanceById[r.id] && (
        <View style={{ borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#F9731622" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#EA580C" }}>
            {`Dont ${fmtDays(overBalanceById[r.id])} jour${overBalanceById[r.id] > 1 ? "s" : ""} hors solde`}
          </Text>
        </View>
      )}
      {opts.actions}
      </Pressable>
    </Animated.View>
  );

  const cell = (value: string, width: number, extra?: object, key?: string | number) => (
    <View key={key} style={{ width, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 12, color: textColor, ...extra }}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/parametres")}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">Congés</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={10}>
          <ChevronLeft size={20} color={muted} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: textColor, marginHorizontal: 8 }}>{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={10}>
          <ChevronRight size={20} color={muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onPullRefresh}
            tintColor="#3B82F6"
            colors={["#3B82F6"]}
          />
        }
      >
        {/* Solde personnel */}
        {!isSubcontractor && (
          <Animated.View
            style={card}
            entering={FadeInDown.delay(0).duration(320)}
            layout={LinearTransition.duration(260)}
          >
            {sectionTitle(`Mon solde ${year}`)}
            {balanceLoading || !balance ? (
              <ActivityIndicator />
            ) : (
              <Animated.View key={year} entering={FadeIn.duration(300)} style={{ flexDirection: "row" }}>
                {stat(`Total ${year}`, balance.entitled)}
                {stat("Pris", balance.taken)}
                {stat("Prévu", balance.planned)}
                {stat("En attente", balance.pending, "#F97316")}
                {stat("Restant", balance.remaining, balance.remaining <= 0 ? "#DC2626" : "#16A34A")}
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Nouvelle demande */}
        {!isSubcontractor && (
          <Animated.View
            style={card}
            entering={FadeInDown.delay(70).duration(320)}
            layout={LinearTransition.duration(260)}
          >
            {sectionTitle("Demander un congé")}
            <View style={{ gap: 12 }}>
              <MultiDatePicker
                values={dates}
                onChange={setDates}
                placeholder="Choisir les jours"
                title=""
                allowRange
                disableWeekends
                dayColors={closedDayColors}
                redDayPolicy="block"
                redDayReason="est un jour férié ou de fermeture"
                minDate={todayIso()}
              />
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Remarque (facultatif)"
                placeholderTextColor={muted}
                style={{
                  height: 48, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, fontSize: 15,
                  borderColor: border, backgroundColor: isDark ? "#0F172A" : "#FFFFFF", color: textColor,
                }}
              />
              {outsideBalance > 0 && (
                <Animated.View
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(160)}
                  style={{ borderRadius: 14, padding: 12, backgroundColor: "#F9731622" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#EA580C" }}>
                    {`${requestedThisYear} jour${requestedThisYear > 1 ? "s" : ""} demandé${requestedThisYear > 1 ? "s" : ""}, ${fmtDays(freeDays)} disponible${freeDays > 1 ? "s" : ""} : ${fmtDays(outsideBalance)} jour${outsideBalance > 1 ? "s" : ""} hors solde.`}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#EA580C", marginTop: 2 }}>
                    La demande peut être envoyée, l'admin décidera.
                  </Text>
                </Animated.View>
              )}
              <Button onPress={submit} loading={createRequest.isPending}>
                Envoyer la demande
              </Button>
              <Text style={{ fontSize: 12, color: muted }}>
                Les week-ends, jours fériés et jours non travaillés ne sont pas décomptés.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Mes demandes */}
        {!isSubcontractor && myRequests.length > 0 && (
          <Animated.View
            style={card}
            entering={FadeInDown.delay(140).duration(320)}
            layout={LinearTransition.duration(260)}
          >
            {sectionTitle("Mes demandes")}
            <Text style={{ fontSize: 12, color: muted, marginTop: -6, marginBottom: 10 }}>
              {isAdmin
                ? "Appui long sur une demande pour la retirer ou annuler le congé."
                : "Appui long sur une demande en attente pour la retirer."}
            </Text>
            <ScrollView style={listStyle} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar>
            {myRequests.map((r) =>
              requestRow(r, {
                showName: false,
                // Un admin peut annuler ses propres congés acceptés ; ils
                // n'apparaissent pas dans « Déjà traitées » (pas de doublon).
                // Encodé par l'admin : se gère depuis la fiche employé.
                onLongPress: r.source === "admin" ? undefined :
                  r.status === "pending"
                    ? () => askWithdraw(r)
                    : r.status === "approved" && isAdmin
                      ? () => askCancelApproved(r)
                      : undefined,
              }),
            )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Administration */}
        {isAdmin && (
          <Animated.View
            style={card}
            entering={FadeInDown.delay(210).duration(320)}
            layout={LinearTransition.duration(260)}
          >
            {sectionTitle("Administration")}
            <SlidingPillSelector
              options={[
                { id: "requests", label: `À valider (${pendingForAdmin.length})` },
                { id: "overview", label: "Vue d'ensemble" },
              ]}
              selected={adminTab}
              onSelect={(id) => setAdminTab(id as "requests" | "overview")}
              pillColor="#3B82F6"
              bgColor={isDark ? "#1E293B" : "#E2E8F0"}
              activeTextColor="#FFFFFF"
              inactiveTextColor={textColor}
              containerStyle={{ marginBottom: 14 }}
              itemPy={10}
            />

            {adminTab === "requests" && (
              <Animated.View key={"requests"} entering={FadeInLeft.duration(240)}>
                {pendingForAdmin.length === 0 && (
                  <Text style={{ fontSize: 14, color: muted, marginBottom: 8 }}>Aucune demande en attente.</Text>
                )}
                <ScrollView style={listStyle} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar>
                {pendingForAdmin.map((r) =>
                  requestRow(r, {
                    showName: true,
                    actions: (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button className="flex-1" onPress={() => decide.mutate({ id: r.id, action: "approve" })}>
                          Accepter
                        </Button>
                        <Button className="flex-1" variant="destructive" onPress={() => askRefuse(r)}>
                          Refuser
                        </Button>
                      </View>
                    ),
                  }),
                )}
                </ScrollView>
                {othersHandled.length > 0 && (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: muted, marginVertical: 8 }}>DÉJÀ TRAITÉES</Text>
                    <Text style={{ fontSize: 12, color: muted, marginTop: -4, marginBottom: 8 }}>
                      Appui long sur un congé accepté pour l'annuler.
                    </Text>
                    <ScrollView style={listStyle} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar>
                    {othersHandled.map((r) =>
                      requestRow(r, {
                        showName: true,
                        onLongPress: r.status === "approved" ? () => askCancelApproved(r) : undefined,
                      }),
                    )}
                    </ScrollView>
                  </>
                )}
              </Animated.View>
            )}

            {adminTab === "overview" && (
              <Animated.View key={"overview"} entering={FadeInRight.duration(240)}>
                <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                  Touchez la colonne Total pour encoder le nombre de jours accordés sur l'année.
                </Text>
                {overviewLoading || !overview ? (
                  <ActivityIndicator />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: border }}>
                        {cell("Nom", 130, { fontWeight: "700", alignSelf: "flex-start" })}
                        {cell("Total", 64, { fontWeight: "700" })}
                        {MONTHS.map((m) => cell(m, 44, { fontWeight: "700", color: muted }, m))}
                        {cell("Pris", 48, { fontWeight: "700" })}
                        {cell("Prévu", 48, { fontWeight: "700" })}
                        {cell("Attente", 54, { fontWeight: "700" })}
                        {cell("Solde", 54, { fontWeight: "700" })}
                      </View>
                      {overview.map((row) => (
                        <View key={row.employee_id} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: border }}>
                          <View style={{ width: 130, paddingVertical: 8, paddingHorizontal: 4, justifyContent: "center" }}>
                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: textColor }}>
                              {row.employee_name}
                            </Text>
                          </View>
                          <View style={{ width: 64, padding: 4, justifyContent: "center" }}>
                            <TextInput
                              value={drafts[row.employee_id] ?? fmtDays(row.entitled)}
                              onChangeText={(v) => setDrafts((prev) => ({ ...prev, [row.employee_id]: v }))}
                              onBlur={() => commitDraft(row)}
                              onSubmitEditing={() => commitDraft(row)}
                              keyboardType="decimal-pad"
                              selectTextOnFocus
                              style={{
                                height: 32, borderRadius: 8, borderWidth: 1, borderColor: border, textAlign: "center",
                                fontSize: 12, fontWeight: "700", color: textColor, padding: 0,
                                backgroundColor: isDark ? "#020817" : "#FFFFFF",
                              }}
                            />
                          </View>
                          {row.months.map((v, i) =>
                            cell(v ? fmtDays(v) : "–", 44, { color: v ? textColor : muted, fontWeight: v ? "700" : "400" }, i),
                          )}
                          {cell(fmtDays(row.taken), 48)}
                          {cell(fmtDays(row.planned), 48)}
                          {cell(fmtDays(row.pending), 54, { color: row.pending ? "#F97316" : muted })}
                          {cell(fmtDays(row.remaining), 54, { fontWeight: "800", color: row.remaining <= 0 ? "#DC2626" : "#16A34A" })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </Animated.View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
