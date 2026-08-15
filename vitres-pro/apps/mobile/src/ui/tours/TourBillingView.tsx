import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, FileSpreadsheet, Square } from "lucide-react-native";

import { API_URL, api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { formatEuro } from "../../lib/tours";
import { toast } from "../toast";

type BillingCell = {
  cadence: "monthly" | "quarterly";
  export_label: string;
  bucket_start: string;
  source_amount: number;
  amount: number;
  selected: boolean;
  overridden: boolean;
};

type Matrix = {
  buckets: string[];
  headers: string[];
  rows: Array<{ export_label: string; amounts: number[] }>;
};

type BillingData = {
  monthly: Matrix;
  quarterly: Matrix;
  cells: BillingCell[];
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

async function downloadBatch(batch: { id: string; filename: string }) {
  const path = `/api/tours/billing/exports/${batch.id}/download`;
  if (Platform.OS === "web") {
    const response = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = batch.filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const [{ data }, FileSystem, Sharing] = await Promise.all([
    supabase.auth.getSession(),
    import("expo-file-system/legacy"),
    import("expo-sharing"),
  ]);
  if (!data.session?.access_token || !FileSystem.cacheDirectory) {
    throw new Error("Session ou dossier de telechargement indisponible.");
  }
  const target = `${FileSystem.cacheDirectory}${batch.filename}`;
  await FileSystem.downloadAsync(`${API_URL}${path}`, target, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target);
}

export function TourBillingView({ isDark }: { isDark: boolean }) {
  const queryClient = useQueryClient();
  const [zone, setZone] = useState<"hainaut" | "ardennes">("hainaut");
  const [period, setPeriod] = useState(currentMonth());
  const [monthText, setMonthText] = useState(currentMonth().slice(0, 7));
  const [cadence, setCadence] = useState<"monthly" | "quarterly">("monthly");
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const colors = {
    card: isDark ? "#0F172A" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
    input: isDark ? "#1E293B" : "#F8FAFC",
  };

  const matrixQuery = useQuery<BillingData>({
    queryKey: ["tour-billing", zone, period],
    queryFn: async () => (await api.get("/api/tours/billing/matrix", { params: { zone, period_start: period } })).data,
  });
  const batchesQuery = useQuery<any[]>({
    queryKey: ["tour-billing-batches", zone],
    queryFn: async () => (await api.get("/api/tours/billing/exports", { params: { zone } })).data,
  });

  const saveCell = useMutation({
    mutationFn: async (cell: BillingCell) => api.put("/api/tours/billing/review", {
      cadence: cell.cadence,
      export_label: cell.export_label,
      bucket_start: cell.bucket_start,
      selected: cell.selected,
      override_amount: cell.overridden ? cell.amount : null,
    }, { params: { zone, period_start: period } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tour-billing", zone, period] }),
    onError: (error: any) => toast.error("Erreur", error?.response?.data?.detail ?? "Correction non enregistree."),
  });

  const exportMutation = useMutation({
    mutationFn: async () => (await api.post("/api/tours/billing/exports", { zone, period_start: period })).data,
    onSuccess: async (batch) => {
      await queryClient.invalidateQueries({ queryKey: ["tour-billing", zone, period] });
      await queryClient.invalidateQueries({ queryKey: ["tour-billing-batches", zone] });
      try {
        await downloadBatch(batch);
        toast.success("Export créé", "Le lot reste disponible dans l'historique.");
      } catch (error: any) {
        toast.error("Lot créé, téléchargement impossible", error?.message ?? "Retéléchargez-le depuis l'historique.");
      }
    },
    onError: (error: any) => toast.error("Export impossible", error?.response?.data?.detail ?? error?.message),
  });

  const cells = matrixQuery.data?.cells.filter((cell) => cell.cadence === cadence) ?? [];
  const matrix = matrixQuery.data?.[cadence];
  const cellMap = useMemo(
    () => new Map(cells.map((cell) => [`${cell.export_label}|${cell.bucket_start}`, cell])),
    [cells],
  );
  const labels = useMemo(
    () => [...new Set(cells.map((cell) => cell.export_label))].sort((a, b) => a.localeCompare(b, "fr")),
    [cells],
  );

  const updateCell = (cell: BillingCell, patch: Partial<BillingCell>) => {
    const next = { ...cell, ...patch };
    queryClient.setQueryData<BillingData>(["tour-billing", zone, period], (old) => old ? {
      ...old,
      cells: old.cells.map((item) => item.cadence === cell.cadence && item.export_label === cell.export_label && item.bucket_start === cell.bucket_start ? next : item),
    } : old);
    saveCell.mutate(next);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["hainaut", "ardennes"] as const).map((value) => (
          <Pressable key={value} onPress={() => setZone(value)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: zone === value ? "#2563EB" : colors.input }}>
            <Text style={{ color: zone === value ? "#FFFFFF" : colors.text, fontWeight: "700", textTransform: "capitalize" }}>{value}</Text>
          </Pressable>
        ))}
        <TextInput
          value={monthText}
          onChangeText={(value) => /^\d{0,4}-?\d{0,2}$/.test(value) && setMonthText(value)}
          onEndEditing={() => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) setPeriod(`${monthText}-01`);
            else setMonthText(period.slice(0, 7));
          }}
          placeholder="AAAA-MM"
          placeholderTextColor={colors.muted}
          style={{ minWidth: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.input }}
        />
        {(["monthly", "quarterly"] as const).map((value) => (
          <Pressable key={value} onPress={() => setCadence(value)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: cadence === value ? "#F97316" : colors.border, backgroundColor: cadence === value ? "#FFF7ED" : colors.card }}>
            <Text style={{ color: cadence === value ? "#C2410C" : colors.text, fontWeight: "700" }}>{value === "monthly" ? "Mensuelle" : "Trimestrielle"}</Text>
          </Pressable>
        ))}
      </View>

      {matrixQuery.isLoading ? <ActivityIndicator color="#2563EB" /> : !matrix || labels.length === 0 ? (
        <View style={{ padding: 24, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted }}>Aucune prestation non exportee pour cette periode.</Text>
        </View>
      ) : (
        <ScrollView horizontal style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card }}>
          <View>
            <View style={{ flexDirection: "row", backgroundColor: isDark ? "#1E293B" : "#EFF6FF" }}>
              <Text style={{ width: 230, padding: 12, fontWeight: "800", color: colors.text }}>Commerce</Text>
              {matrix.buckets.map((bucket, index) => <Text key={bucket} style={{ width: 145, padding: 12, fontWeight: "800", color: colors.text }}>{matrix.headers[index]}</Text>)}
              <Text style={{ width: 120, padding: 12, fontWeight: "800", color: colors.text }}>Total</Text>
            </View>
            {labels.map((label) => {
              const rowCells = matrix.buckets.map((bucket) => cellMap.get(`${label}|${bucket}`));
              const total = rowCells.reduce((sum, cell) => sum + (cell?.selected ? cell.amount : 0), 0);
              return (
                <View key={label} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: colors.border }}>
                  <Text style={{ width: 230, padding: 12, fontWeight: "700", color: colors.text }}>{label}</Text>
                  {rowCells.map((cell, index) => cell ? (
                    <View key={cell.bucket_start} style={{ width: 145, padding: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Pressable onPress={() => updateCell(cell, { selected: !cell.selected })} hitSlop={8}>
                        {cell.selected ? <Check size={18} color="#16A34A" /> : <Square size={18} color={colors.muted} />}
                      </Pressable>
                      <TextInput
                        value={draftAmounts[`${zone}|${cadence}|${label}|${cell.bucket_start}`] ?? String(cell.amount)}
                        keyboardType="decimal-pad"
                        onChangeText={(value) => setDraftAmounts((old) => ({ ...old, [`${zone}|${cadence}|${label}|${cell.bucket_start}`]: value }))}
                        onBlur={() => {
                          const key = `${zone}|${cadence}|${label}|${cell.bucket_start}`;
                          const parsed = Number((draftAmounts[key] ?? String(cell.amount)).replace(",", "."));
                          if (Number.isFinite(parsed)) updateCell(cell, { amount: parsed, overridden: parsed !== cell.source_amount });
                        }}
                        style={{ flex: 1, borderWidth: 1, borderColor: cell.overridden ? "#F97316" : colors.border, borderRadius: 8, padding: 7, color: colors.text, backgroundColor: colors.input }}
                      />
                    </View>
                  ) : <View key={`${label}-${index}`} style={{ width: 145 }} />)}
                  <Text style={{ width: 120, padding: 12, fontWeight: "800", color: colors.text }}>{formatEuro(total)}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Pressable disabled={exportMutation.isPending || cells.every((cell) => !cell.selected)} onPress={() => exportMutation.mutate()} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#16A34A", opacity: exportMutation.isPending ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}>
        <FileSpreadsheet size={20} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{exportMutation.isPending ? "Creation…" : "Créer le lot Excel"}</Text>
      </Pressable>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Historique immuable</Text>
        {(batchesQuery.data ?? []).map((batch) => (
          <Pressable key={batch.id} onPress={() => downloadBatch(batch).catch((error) => toast.error("Téléchargement impossible", error.message))} style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Download size={18} color="#2563EB" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{batch.filename}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(batch.created_at).toLocaleString("fr-BE")}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
