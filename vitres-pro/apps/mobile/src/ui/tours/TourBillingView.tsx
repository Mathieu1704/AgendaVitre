import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react-native";

import { API_URL, api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { addMonths } from "../../lib/date";
import { SlidingPillSelector } from "../components/SlidingPillSelector";
import { toast } from "../toast";

function monthStartString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

async function downloadExport(zone: "hainaut" | "ardennes", periodStart: string) {
  const path = "/api/tours/billing/export";
  const params = { zone, period_start: periodStart };
  const filename = `facturation_tournees_${zone}_${periodStart.slice(0, 7).replace("-", "_")}.xlsx`;
  if (Platform.OS === "web") {
    const response = await api.get(path, { params, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
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
  const target = `${FileSystem.cacheDirectory}${filename}`;
  const query = new URLSearchParams(params).toString();
  await FileSystem.downloadAsync(`${API_URL}${path}?${query}`, target, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target);
}

export function TourBillingView({ isDark }: { isDark: boolean }) {
  const [zone, setZone] = useState<"hainaut" | "ardennes">("hainaut");
  const [cursorDate, setCursorDate] = useState<Date>(new Date());
  const colors = {
    card: isDark ? "#0F172A" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
    soft: isDark ? "#1E293B" : "#F1F5F9",
  };
  const monthTitle = useMemo(() => cursorDate.toLocaleDateString("fr-BE", { month: "long", year: "numeric" }), [cursorDate]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      await downloadExport(zone, monthStartString(cursorDate));
    },
    onSuccess: () => toast.success("Export téléchargé", "Recopiez les montants dans votre classeur habituel."),
    onError: (error: any) => toast.error("Export impossible", error?.response?.data?.detail ?? error?.message),
  });

  return (
    <View style={{ gap: 16 }}>
      <SlidingPillSelector
        options={[{ id: "hainaut", label: "Hainaut" }, { id: "ardennes", label: "Ardennes" }]}
        selected={zone}
        onSelect={(id) => setZone(id as "hainaut" | "ardennes")}
        pillColor="#3B82F6"
        bgColor={colors.soft}
        activeTextColor="#FFFFFF"
        inactiveTextColor={colors.muted}
        itemPy={11}
        fontSize={14}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 6 }}>
        <Pressable onPress={() => setCursorDate((d) => addMonths(d, -1))} style={{ padding: 10, borderRadius: 999 }}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", textTransform: "capitalize" }}>{monthTitle}</Text>
        <Pressable onPress={() => setCursorDate((d) => addMonths(d, 1))} style={{ padding: 10, borderRadius: 999 }}>
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Export mensuel</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Additionne les prestations marquées "réalisé" par commerce et par semaine pour le mois choisi.
          La colonne Paiement reprend le texte du modèle (F, N, NF, F.T...) pour que vous routiez chaque ligne comme d'habitude.
        </Text>
      </View>

      <Pressable disabled={exportMutation.isPending} onPress={() => exportMutation.mutate()} style={{ alignSelf: "flex-start", flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#16A34A", opacity: exportMutation.isPending ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}>
        <FileSpreadsheet size={20} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>{exportMutation.isPending ? "Génération…" : "Télécharger l'export Excel"}</Text>
      </Pressable>
    </View>
  );
}
