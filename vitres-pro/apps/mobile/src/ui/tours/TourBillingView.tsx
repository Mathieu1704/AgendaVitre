import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react-native";

import { API_URL, api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { toast } from "../toast";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
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
  const [monthText, setMonthText] = useState(currentMonth().slice(0, 7));
  const colors = {
    card: isDark ? "#0F172A" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
    input: isDark ? "#1E293B" : "#F8FAFC",
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthText)) throw new Error("Mois invalide (format AAAA-MM).");
      await downloadExport(zone, `${monthText}-01`);
    },
    onSuccess: () => toast.success("Export téléchargé", "Recopiez les montants dans votre classeur habituel."),
    onError: (error: any) => toast.error("Export impossible", error?.response?.data?.detail ?? error?.message),
  });

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {(["hainaut", "ardennes"] as const).map((value) => (
          <Pressable key={value} onPress={() => setZone(value)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: zone === value ? "#3B82F6" : colors.input }}>
            <Text style={{ color: zone === value ? "#FFFFFF" : colors.text, fontWeight: "700", textTransform: "capitalize" }}>{value}</Text>
          </Pressable>
        ))}
        <TextInput
          value={monthText}
          onChangeText={(value) => /^\d{0,4}-?\d{0,2}$/.test(value) && setMonthText(value)}
          placeholder="AAAA-MM"
          placeholderTextColor={colors.muted}
          style={{ minWidth: 130, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, backgroundColor: colors.input }}
        />
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
