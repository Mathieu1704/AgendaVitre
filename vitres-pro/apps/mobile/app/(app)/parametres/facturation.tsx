import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
  Animated,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Undo2,
  FilePlus,
  Clock3,
  CheckCircle2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";

import { Button } from "../../../src/ui/components/Button";
import { Card } from "../../../src/ui/components/Card";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";

import { useInterventions } from "../../../src/hooks/useInterventions";
import { useAuth } from "../../../src/hooks/useAuth";
import { api } from "../../../src/lib/api";
import { patchIntervention, restoreInterventionSnapshots } from "../../../src/lib/offline/optimistic";
import { startOfWeek, addDays } from "../../../src/lib/date";
import type { Intervention } from "../../../src/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAYMENT_BADGES: Record<string, { label: string; color: string }> = {
  invoice: { label: "FAC", color: "#22C55E" },
  invoice_cash: { label: "FAC+Esp.", color: "#F97316" },
};

const SECTIONS = {
  toInvoice: { color: "#F97316", icon: Clock3, title: "À facturer" },
  invoiced: { color: "#22C55E", icon: CheckCircle2, title: "Facturées" },
} as const;

function invoiceAmount(item: Intervention): number {
  if (item.payment_mode === "invoice_cash") {
    return item.amount_invoice != null
      ? Number(item.amount_invoice)
      : Number(item.price_estimated) || 0;
  }
  return Number(item.price_estimated) || 0;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `Semaine du ${fmt(weekStart)} au ${fmt(weekEnd)}`;
}

function BillingRow({
  item,
  accentColor,
  onToggle,
  onOpen,
}: {
  item: Intervention;
  accentColor: string;
  onToggle: (item: Intervention) => void;
  onOpen: (item: Intervention) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const collapse = useRef(new Animated.Value(1)).current;
  const measuredHeightRef = useRef<number | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const badge = PAYMENT_BADGES[item.payment_mode || ""] || PAYMENT_BADGES.invoice;
  const amount = invoiceAmount(item);
  const date = new Date(item.start_time);
  const dateLabel = `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
  const address = item.address || item.client?.address || item.city || "";
  const invoiced = !!item.invoiced_at;

  // Le swipe seul suffit : dès que le seuil est franchi, la ligne continue sa
  // course vers la gauche jusqu'à sortir de l'écran puis se replie — on ne
  // la referme jamais sur place (ça créait un gel visible), et on ne change
  // les données qu'une fois la ligne déjà invisible, pour que son saut vers
  // l'autre section ne se voie pas.
  const handleSwipeableWillOpen = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -screenWidth,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(collapse, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }).start(() => onToggle(item));
    });
  };

  const renderRightActions = () => (
    <View
      style={{
        width: 92,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: invoiced ? "#F97316" : "#22C55E",
        borderRadius: 22,
      }}
    >
      {invoiced ? <Undo2 size={18} color="#fff" /> : <Check size={18} color="#fff" />}
      <Text className="text-white text-xs font-bold mt-1">
        {invoiced ? "Annuler" : "Facturé"}
      </Text>
    </View>
  );

  return (
    <Animated.View
      onLayout={(e) => {
        if (measuredHeightRef.current == null) {
          measuredHeightRef.current = e.nativeEvent.layout.height;
          setMeasuredHeight(e.nativeEvent.layout.height);
        }
      }}
      style={{
        overflow: "hidden",
        height:
          measuredHeight != null
            ? collapse.interpolate({ inputRange: [0, 1], outputRange: [0, measuredHeight] })
            : undefined,
      }}
    >
      {/* Vue séparée : `opacity`/`transform` passent par le driver natif, pas
          `height` (non supporté nativement) — les mélanger sur la même vue
          fait planter Animated ("JS driven animation on a native node"). */}
      <Animated.View style={{ opacity, transform: [{ translateX }] }}>
        <View className="pb-3">
          <Swipeable
            renderRightActions={renderRightActions}
            overshootRight={false}
            friction={1.8}
            rightThreshold={56}
            onSwipeableWillOpen={handleSwipeableWillOpen}
          >
            <Pressable onPress={() => onOpen(item)} className="active:opacity-80">
              <Card className="overflow-hidden" style={{ borderRadius: 22 }}>
                <View style={{ height: 4, backgroundColor: accentColor }} />
                <View className="flex-row items-center justify-between px-4 py-3">
                  <View className="flex-1 pr-3">
                    <Text
                      className="text-lg font-bold text-foreground dark:text-white"
                      numberOfLines={1}
                    >
                      {item.client?.name || "Client inconnu"}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {dateLabel} · {address}
                    </Text>
                  </View>
                  <View className="items-end gap-1">
                    <View
                      className="px-2 py-0.5"
                      style={{ backgroundColor: `${badge.color}22`, borderRadius: 999 }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: badge.color }}>
                        {badge.label}
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-foreground dark:text-white">
                      {amount.toFixed(2)} €
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </Swipeable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function FacturationScreen() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), 1));
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const rangeStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [weekStart]);
  const rangeEnd = useMemo(() => {
    const d = new Date(weekEnd);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [weekEnd]);

  const { interventions, isLoading } = useInterventions({ start: rangeStart, end: rangeEnd });

  const invoiceMutation = useMutation({
    mutationFn: ({ id, invoicedAt }: { id: string; invoicedAt: string | null }) =>
      api.patch(`/api/interventions/${id}`, { invoiced_at: invoicedAt }),
    onMutate: async ({ id, invoicedAt }) => {
      const snapshots = patchIntervention(qc, id, (current) => ({
        ...current,
        invoiced_at: invoicedAt,
      }));
      return { snapshots };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.snapshots) restoreInterventionSnapshots(qc, ctx.snapshots);
      toast.error("Erreur", "Impossible de mettre à jour le statut de facturation");
    },
  });

  const toggleInvoiced = useCallback(
    (item: Intervention) => {
      // Pas de LayoutAnimation ici : la ligne a déjà joué sa propre animation
      // de sortie (BillingRow) et est invisible quand on arrive ici — une
      // LayoutAnimation globale en plus ferait doublon et donnerait du jank.
      invoiceMutation.mutate({
        id: item.id,
        invoicedAt: item.invoiced_at ? null : new Date().toISOString(),
      });
    },
    [invoiceMutation],
  );

  const openIntervention = useCallback(
    (item: Intervention) => {
      qc.setQueryData(["intervention", item.id], item);
      router.push({
        pathname: "/(app)/calendar/[id]",
        params: { id: item.id, from_view: "facturation" },
      });
    },
    [qc, router],
  );

  const changeWeek = useCallback((delta: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWeekStart((d) => addDays(d, delta));
  }, []);

  if (!authLoading && !isAdmin) {
    return <Redirect href="/(app)" />;
  }

  const billable = useMemo(() => {
    const list = (interventions || []).filter(
      (i: Intervention) =>
        i.status === "done" &&
        (i.payment_mode === "invoice" || i.payment_mode === "invoice_cash"),
    );
    list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    return list;
  }, [interventions]);

  const toInvoice = billable.filter((i) => !i.invoiced_at);
  const invoiced = billable.filter((i) => !!i.invoiced_at);

  const totalToInvoice = toInvoice.reduce((acc, i) => acc + invoiceAmount(i), 0);
  const totalInvoiced = invoiced.reduce((acc, i) => acc + invoiceAmount(i), 0);

  const renderSection = (
    key: keyof typeof SECTIONS,
    items: Intervention[],
    total: number,
  ) => {
    const { color, icon: Icon, title } = SECTIONS[key];
    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between px-4 mb-3">
          <View className="flex-row items-center gap-2">
            <Icon size={18} color={color} />
            <Text className="text-base font-extrabold text-foreground dark:text-white">
              {title} ({items.length})
            </Text>
          </View>
          <Text className="text-base font-extrabold" style={{ color }}>
            {total.toFixed(2)} €
          </Text>
        </View>
        {items.length === 0 ? (
          <View className="items-center justify-center py-6 opacity-50">
            <FilePlus size={28} color={isDark ? "#475569" : "#CBD5E1"} />
            <Text className="text-muted-foreground mt-2 text-sm">Rien ici</Text>
          </View>
        ) : (
          <View className="px-4">
            {items.map((item) => (
              <BillingRow
                key={item.id}
                item={item}
                accentColor={color}
                onToggle={toggleInvoiced}
                onOpen={openIntervention}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        className="flex-1 bg-background dark:bg-slate-950"
        style={{ paddingTop: isWeb ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
      >
        <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onPress={() => router.push("/(app)/parametres")}
          >
            <ChevronLeft size={24} color={isDark ? "white" : "black"} />
          </Button>
          <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
            Facturation
          </Text>
        </View>

        <View className="flex-row items-center justify-between px-6 py-3">
          <Pressable
            onPress={() => changeWeek(-7)}
            className="p-2 bg-muted dark:bg-slate-800 active:opacity-70"
            style={{ borderRadius: 999 }}
          >
            <ChevronLeft size={20} color={isDark ? "#FFF" : "#0F172A"} />
          </Pressable>
          <Text className="font-bold text-foreground dark:text-white text-sm">
            {formatWeekLabel(weekStart)}
          </Text>
          <Pressable
            onPress={() => changeWeek(7)}
            className="p-2 bg-muted dark:bg-slate-800 active:opacity-70"
            style={{ borderRadius: 999 }}
          >
            <ChevronRight size={20} color={isDark ? "#FFF" : "#0F172A"} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <ActivityIndicator color="#3B82F6" className="mt-8" />
          ) : (
            <>
              {renderSection("toInvoice", toInvoice, totalToInvoice)}
              {renderSection("invoiced", invoiced, totalInvoiced)}
            </>
          )}
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}
