import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  FileText,
  Wallet,
  Euro,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FilePlus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { toast } from "../../../src/ui/toast";

import { useInterventions } from "../../../src/hooks/useInterventions";
import { useAuth } from "../../../src/hooks/useAuth";
import { api } from "../../../src/lib/api";
import { patchIntervention, restoreInterventionSnapshots } from "../../../src/lib/offline/optimistic";
import { startOfWeek, addDays, toISODate } from "../../../src/lib/date";
import type { Intervention } from "../../../src/types";

const PAYMENT_BADGES: Record<string, { label: string; color: string }> = {
  invoice: { label: "FAC", color: "#22C55E" },
  invoice_cash: { label: "FAC+Esp.", color: "#F97316" },
};

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

export default function FacturationScreen() {
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

  const toggleInvoiced = useCallback(
    (item: Intervention) => {
      invoiceMutation.mutate({
        id: item.id,
        invoicedAt: item.invoiced_at ? null : new Date().toISOString(),
      });
    },
    [invoiceMutation],
  );

  const renderGroup = (title: string, items: Intervention[], total: number, color: string) => (
    <Card className="mb-5 rounded-[28px] overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border dark:border-slate-800">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-bold text-foreground dark:text-white">
            {title} ({items.length})
          </Text>
          <Text className="text-base font-extrabold" style={{ color }}>
            {total.toFixed(2)} €
          </Text>
        </View>
      </CardHeader>
      <CardContent className="p-4">
        {items.length === 0 ? (
          <View className="items-center justify-center py-8 opacity-50">
            <FilePlus size={36} color={isDark ? "#475569" : "#CBD5E1"} />
            <Text className="text-muted-foreground mt-2 text-sm">Rien ici</Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((item) => {
              const badge = PAYMENT_BADGES[item.payment_mode || ""] || PAYMENT_BADGES.invoice;
              const amount = invoiceAmount(item);
              const date = new Date(item.start_time);
              const dateLabel = `${String(date.getDate()).padStart(2, "0")}/${String(
                date.getMonth() + 1,
              ).padStart(2, "0")}`;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleInvoiced(item)}
                  className="flex-row items-center justify-between p-3 border border-border dark:border-slate-800 bg-card dark:bg-slate-900 active:opacity-70"
                  style={{ borderRadius: 20 }}
                >
                  <View className="flex-row items-center flex-1 gap-3">
                    {item.invoiced_at ? (
                      <CheckCircle2 size={20} color="#22C55E" />
                    ) : (
                      <Circle size={20} color={isDark ? "#475569" : "#CBD5E1"} />
                    )}
                    <View className="flex-1">
                      <Text
                        className="font-bold text-sm text-foreground dark:text-white"
                        numberOfLines={1}
                      >
                        {item.client?.name || "Client inconnu"}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                        {dateLabel} · {item.address || item.client?.address || item.city || ""}
                      </Text>
                    </View>
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
                    <Text className="text-sm font-bold text-foreground dark:text-white">
                      {amount.toFixed(2)} €
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </CardContent>
    </Card>
  );

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
    >
      <View
        className="px-6 pb-4 bg-background dark:bg-slate-950 z-10"
        style={{ paddingTop: isWeb ? 24 : 10 }}
      >
        <Text className="text-3xl font-bold text-foreground dark:text-slate-50">
          Facturation
        </Text>
        <Text className="text-muted-foreground dark:text-slate-400 mt-1 text-sm">
          RDV facture / facture+espèces, semaine par semaine
        </Text>
      </View>

      <View className="flex-row items-center justify-between px-6 pb-3">
        <Pressable
          onPress={() => setWeekStart((d) => addDays(d, -7))}
          className="p-2 bg-muted dark:bg-slate-800 active:opacity-70"
          style={{ borderRadius: 999 }}
        >
          <ChevronLeft size={20} color={isDark ? "#FFF" : "#0F172A"} />
        </Pressable>
        <Text className="font-bold text-foreground dark:text-white text-sm">
          {formatWeekLabel(weekStart)}
        </Text>
        <Pressable
          onPress={() => setWeekStart((d) => addDays(d, 7))}
          className="p-2 bg-muted dark:bg-slate-800 active:opacity-70"
          style={{ borderRadius: 999 }}
        >
          <ChevronRight size={20} color={isDark ? "#FFF" : "#0F172A"} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4 lg:p-8"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color="#3B82F6" className="mt-8" />
        ) : (
          <>
            {renderGroup("À facturer", toInvoice, totalToInvoice, "#F97316")}
            {renderGroup("Facturées", invoiced, totalInvoiced, "#22C55E")}
          </>
        )}
      </ScrollView>
    </View>
  );
}
