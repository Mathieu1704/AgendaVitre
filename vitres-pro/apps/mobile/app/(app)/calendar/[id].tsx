import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Text,
  useWindowDimensions,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  Navigation,
  ChevronLeft,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Wallet,
  MoreVertical,
  Pencil,
  Banknote,
  FileText,
  X,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports internes
import { api } from "../../../src/lib/api";
import { toast } from "../../../src/ui/toast";
import { Button } from "../../../src/ui/components/Button";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { Avatar } from "../../../src/ui/components/Avatar";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";
import { OptionsModal } from "../../../src/ui/components/OptionsModal";
import { ConfirmModal } from "../../../src/ui/components/ConfirmModal";
import { SlidingPillSelector } from "../../../src/ui/components/SlidingPillSelector";
import { DateTimePicker } from "../../../src/ui/components/DateTimePicker";
import { Dialog } from "../../../src/ui/components/Dialog";
import { toBrusselsDateTimeString, parseBrusselsDateTimeString } from "../../../src/lib/date";

export default function InterventionDetailScreen() {
  const { id, from_view, from_date } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();

  // 1. TOUS LES STATES
  const [menuVisible, setMenuVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [pendingPaymentMode, setPendingPaymentMode] = useState<"cash" | "invoice" | "invoice_cash">("cash");

  // 2. QUERY (Chargement données)
  const { data: intervention, isLoading } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      const res = await api.get(`/api/interventions/${id}`);
      return res.data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => { const res = await api.get("/api/settings/company"); return res.data; },
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 500,
  });
  const hideCash = companySettings?.hide_cash ?? false;

  const isFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    isFocused.current = true;
    return () => { isFocused.current = false; };
  }, []));

  useEffect(() => {
    if (!intervention || !isFocused.current) return;
    const isCash = intervention.payment_mode === "cash" || !intervention.payment_mode;
    if (hideCash && isCash) {
      router.replace({
        pathname: "/(app)/calendar",
        params: from_view ? { view: from_view, date: from_date } : {},
      });
    }
  }, [hideCash, intervention]);

  // 3. MUTATIONS (Doivent être déclarées AVANT les returns conditionnels)
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await api.delete(`/api/interventions/${id}`);
    },
    onMutate: () => {
      // Suppression optimiste : retire l'item du cache immédiatement
      queryClient.setQueryData(["interventions"], (old: any[]) =>
        Array.isArray(old) ? old.filter((i) => i.id !== id) : old,
      );
    },
    onSuccess: () => {
      toast.success("Supprimé", "Intervention supprimée.");
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      router.push({
        pathname: "/(app)/calendar",
        params: from_view ? { view: from_view, date: from_date } : {},
      });
    },
    onError: () => {
      // En cas d'erreur, on recharge pour restaurer l'état correct
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.error("Erreur", "Impossible de supprimer.");
    },
  });

  // 4. HELPER FUNCTIONS
  const handleBack = () => {
    router.replace({
      pathname: "/(app)/calendar",
      params: {
        ...(from_view ? { view: from_view } : {}),
        ...(from_date
          ? { date: from_date }
          : intervention?.start_time
            ? { date: intervention.start_time }
            : {}),
      },
    });
  };

  const handleDeleteRequest = () => {
    setMenuVisible(false);
    if (Platform.OS !== "web") {
      Alert.alert(
        "Supprimer l'intervention ?",
        "Cette action est irréversible. L'intervention sera définitivement effacée du planning.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => deleteMutation.mutate() },
        ]
      );
    } else {
      setTimeout(() => setShowDeleteConfirm(true), 200);
    }
  };

  const paymentMutation = useMutation({
    mutationFn: async (mode: "cash" | "invoice" | "invoice_cash") =>
      api.patch(`/api/interventions/${id}`, {
        payment_mode: mode,
        is_invoice: mode !== "cash",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      setEditingPayment(false);
      toast.success("Paiement mis à jour", "");
    },
    onError: () => toast.error("Erreur", "Impossible de modifier le paiement."),
  });

  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [editStartStr, setEditStartStr] = useState("");
  const [editEndStr, setEditEndStr] = useState("");

  const timeMutation = useMutation({
    mutationFn: async ({ startIso, endIso }: { startIso: string; endIso: string }) =>
      api.patch(`/api/interventions/${id}`, { start_time: startIso, end_time: endIso }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      setShowTimeEdit(false);
      toast.success("Horaires mis à jour", "");
    },
    onError: () => toast.error("Erreur", "Impossible de modifier les horaires."),
  });

  const openTimeEdit = () => {
    if (!intervention) return;
    setEditStartStr(toBrusselsDateTimeString(new Date(intervention.start_time)));
    setEditEndStr(intervention.end_time ? toBrusselsDateTimeString(new Date(intervention.end_time)) : "");
    setShowTimeEdit(true);
  };

  const handleSaveTime = () => {
    const startParsed = parseBrusselsDateTimeString(editStartStr);
    const endParsed = editEndStr ? parseBrusselsDateTimeString(editEndStr) : null;
    if (endParsed && endParsed.getTime() <= startParsed.getTime()) {
      toast.error("Horaires", "L'heure de fin doit être après l'heure de début.");
      return;
    }
    timeMutation.mutate({ startIso: startParsed.toISOString(), endIso: endParsed?.toISOString() ?? "" });
  };

  // 5. RENDU CONDITIONNEL (Loading / Error)
  // C'est SEULEMENT ICI qu'on a le droit de faire des returns anticipés
  if (isLoading) {
    return (
      <View
        className="flex-1 justify-center items-center bg-background dark:bg-slate-950"
        style={{ backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!intervention) {
    return (
      <View
        className="flex-1 justify-center items-center bg-background dark:bg-slate-950 px-6"
        style={{ backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
      >
        <View className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle size={48} color="#EF4444" />
        </View>
        <Text className="text-xl font-bold text-foreground dark:text-white mt-4 text-center">
          Intervention introuvable
        </Text>
        <Button
          variant="outline"
          onPress={() => router.back()}
          className="mt-6"
        >
          Retour
        </Button>
      </View>
    );
  }

  const startTime = new Date(intervention.start_time);

  const intervType: string =
    typeof intervention.type === "string" && intervention.type.trim() !== ""
      ? intervention.type
      : "intervention";
  const hasClient = ["intervention", "devis"].includes(intervType);
  const TYPE_BADGE: Record<
    string,
    { label: string; color: string; bg: string; bgDark: string }
  > = {
    intervention: {
      label: "Intervention",
      color: "#3B82F6",
      bg: "#EFF6FF",
      bgDark: "#1E3A5F",
    },
    devis: {
      label: "Devis",
      color: "#8B5CF6",
      bg: "#F5F3FF",
      bgDark: "#2E1B5E",
    },
    tournee: {
      label: "Tournée",
      color: "#F97316",
      bg: "#FFF7ED",
      bgDark: "#431407",
    },
    note: { label: "Note", color: "#64748B", bg: "#F8FAFC", bgDark: "#1E293B" },
  };
  const typeBadge = TYPE_BADGE[intervType] ?? TYPE_BADGE["intervention"];

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: isDesktop ? 0 : insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      {/* --- HEADER --- */}
      <View className="flex-row items-center p-4 pt-4 pb-4 border-b border-border dark:border-slate-800 bg-background dark:bg-slate-950 z-10">
        <Pressable
          onPress={handleBack}
          className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:bg-muted"
        >
          <ChevronLeft
            size={24}
            className="text-foreground dark:text-white"
            color={isDark ? "#FFF" : "#09090B"}
          />
        </Pressable>
        <Text className="ml-2 text-lg font-bold text-foreground dark:text-white">
          Détails
        </Text>
        <View className="flex-1" />
        {/* Badges type + statut + bouton 3 points alignés à droite */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
              backgroundColor: isDark ? typeBadge.bgDark : typeBadge.bg,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: typeBadge.color,
              }}
            >
              {typeBadge.label.toUpperCase()}
            </Text>
          </View>
          <StatusBadge status={intervention.status} />
          {isAdmin && (
            <Pressable
              onPress={() => setMenuVisible(true)}
              className="p-1.5 rounded-full hover:bg-muted"
            >
              <MoreVertical size={20} color={isDark ? "#94A3B8" : "#64748B"} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* --- TITRE --- */}
        <View className="px-6 pt-4 pb-2">
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-2xl font-extrabold text-foreground dark:text-white mb-3 leading-tight">
              {intervention.title.replace(/[\r\n\u2028\u2029]+/g, " ").trim()}
            </Text>

            {/* Bloc paiement — tappable pour modifier */}
            {intervType === "intervention" && (() => {
              const mode = intervention.payment_mode || (intervention.is_invoice ? "invoice" : "cash");
              const cfg = {
                cash:         { bg: isDark ? "rgba(153,27,27,0.2)" : "#FEE2E2", border: isDark ? "rgba(153,27,27,0.5)" : "#FECACA", iconBg: "#EF4444", title: "À ENCAISSER SUR PLACE", titleColor: isDark ? "#F87171" : "#B91C1C", sub: `Le client doit payer ${intervention.price_estimated} € maintenant.`, subColor: isDark ? "#FCA5A5" : "#DC2626" },
                invoice_cash: { bg: isDark ? "rgba(154,52,18,0.2)" : "#FFEDD5", border: isDark ? "rgba(154,52,18,0.5)" : "#FED7AA", iconBg: "#F97316", title: "À ENCAISSER SUR PLACE", titleColor: isDark ? "#FB923C" : "#C2410C", sub: `Le client doit payer ${intervention.price_estimated} € maintenant.`, subColor: isDark ? "#FDBA74" : "#EA580C" },
                invoice:      { bg: isDark ? "rgba(21,128,61,0.15)" : "#F0FDF4", border: isDark ? "rgba(21,128,61,0.4)" : "#BBF7D0", iconBg: "#22C55E", title: "PAIEMENT PAR FACTURE", titleColor: isDark ? "#4ADE80" : "#15803D", sub: "Le client sera facturé.", subColor: isDark ? "#86EFAC" : "#16A34A" },
              }[mode as string] ?? { bg: isDark ? "rgba(153,27,27,0.2)" : "#FEE2E2", border: isDark ? "rgba(153,27,27,0.5)" : "#FECACA", iconBg: "#EF4444", title: "À ENCAISSER SUR PLACE", titleColor: isDark ? "#F87171" : "#B91C1C", sub: `Le client doit payer ${intervention.price_estimated} € maintenant.`, subColor: isDark ? "#FCA5A5" : "#DC2626" };

              return (
                <View style={{ marginBottom: 12 }}>
                  {/* Ligne principale */}
                  <View
                    style={{
                      backgroundColor: cfg.bg,
                      borderWidth: 1,
                      borderColor: cfg.border,
                      borderRadius: 16,
                      borderBottomLeftRadius: editingPayment ? 0 : 16,
                      borderBottomRightRadius: editingPayment ? 0 : 16,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ backgroundColor: cfg.iconBg, height: 40, width: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
                      <Wallet size={20} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: cfg.titleColor, fontWeight: "800", fontSize: 14, textTransform: "uppercase", marginBottom: 2 }}>{cfg.title}</Text>
                      <Text style={{ color: cfg.subColor, fontSize: 13, fontWeight: "500" }}>{cfg.sub}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setPendingPaymentMode(mode as any);
                        setEditingPayment((v) => !v);
                      }}
                      style={{ padding: 8, borderRadius: 20, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
                    >
                      {editingPayment
                        ? <X size={15} color={cfg.titleColor} />
                        : <Pencil size={15} color={cfg.titleColor} />}
                    </Pressable>
                  </View>

                  {/* Éditeur inline */}
                  {editingPayment && (
                    <View style={{
                      backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                      borderWidth: 1,
                      borderTopWidth: 0,
                      borderColor: cfg.border,
                      borderBottomLeftRadius: 16,
                      borderBottomRightRadius: 16,
                      padding: 14,
                      gap: 10,
                    }}>
                      <SlidingPillSelector
                        options={[
                          !hideCash && { id: "cash",         label: "Espèces",  pillColor: "#EF4444", activeTextColor: "#fff", icon: (c) => <Banknote size={13} color={c} /> },
                          { id: "invoice",      label: "Facture",  pillColor: "#22C55E", activeTextColor: "#fff", icon: (c) => <FileText size={13} color={c} /> },
                          { id: "invoice_cash", label: "FAC+Esp.", pillColor: "#F97316", activeTextColor: "#fff", icon: (c) => <Wallet  size={13} color={c} /> },
                        ].filter(Boolean) as any}
                        selected={pendingPaymentMode}
                        onSelect={(id) => setPendingPaymentMode(id as any)}
                        pillColor="#3B82F6"
                        bgColor={isDark ? "#0F172A" : "#E2E8F0"}
                        activeTextColor="#fff"
                        inactiveTextColor={isDark ? "#94A3B8" : "#64748B"}
                        fontSize={12}
                        itemPy={8}
                      />
                      <Pressable
                        onPress={() => paymentMutation.mutate(pendingPaymentMode)}
                        disabled={paymentMutation.isPending}
                        style={{
                          backgroundColor: "#3B82F6",
                          borderRadius: 12,
                          paddingVertical: 10,
                          alignItems: "center",
                          opacity: paymentMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {paymentMutation.isPending
                          ? <ActivityIndicator color="white" size="small" />
                          : <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Confirmer</Text>}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Date + heure sur une seule ligne compacte */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 4,
                }}
              >
                <Calendar size={16} color={isDark ? "#94A3B8" : "#64748B"} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "500",
                    color: isDark ? "#94A3B8" : "#64748B",
                    textTransform: "capitalize",
                  }}
                >
                  {startTime.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Europe/Brussels",
                  })}
                </Text>
              </View>
              <Pressable
                onPress={isAdmin ? openTimeEdit : undefined}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  opacity: 1,
                }}
              >
                <Clock size={16} color="#3B82F6" />
                <Text
                  style={{ fontSize: 17, fontWeight: "700", color: "#3B82F6" }}
                >
                  {startTime.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Brussels",
                  })}
                  {intervention.end_time && (
                    " → " + new Date(intervention.end_time).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Brussels",
                    })
                  )}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>

        {/* --- BLOCS D'INFORMATIONS --- */}
        <View className="px-6 pb-32" style={{ marginTop: -10 }}>
          {/* LIGNE 1 : CLIENT */}
          <View
            className={isDesktop ? "flex-row w-full gap-4" : "gap-4"}
            style={{
              marginRight: isDesktop ? 0 : 20,
              marginBottom: 12,
            }}
          >
            {/* 2. CLIENT (seulement pour intervention/devis avec un client lié) */}
            {hasClient && intervention.client && (
              <Animated.View
                entering={FadeInDown.delay(300)}
                className={isDesktop ? "flex-1" : "w-full"}
              >
                <Card className="min-h-[110px] justify-center rounded-3xl">
                  <CardContent className="p-5">
                    <View className="flex-row items-center">
                      <Avatar
                        name={intervention.client?.name || "?"}
                        size="md"
                      />
                      <View className="ml-4 flex-1">
                        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                          Client
                        </Text>
                        {intervention.client?.name && (
                          <Text className="text-lg font-bold text-foreground dark:text-white mb-0.5">
                            {intervention.client.name}
                          </Text>
                        )}
                        {intervention.client?.address && (
                          <View className="flex-row items-center mt-1">
                            <MapPin size={12} color="#64748B" />
                            <Text
                              className="ml-1 text-xs text-muted-foreground dark:text-slate-400"
                              numberOfLines={1}
                            >
                              {intervention.client.address}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </CardContent>
                </Card>
              </Animated.View>
            )}
          </View>

          {/* LIGNE 2 : ACTIONS RAPIDES (seulement si client lié) */}
          {hasClient && intervention.client && (
            <Animated.View
              entering={FadeInDown.delay(350)}
              className={`flex-row w-full ${isDesktop ? "gap-4" : "gap-2"}`}
              style={{
                marginBottom: isDesktop ? 0 : 0,
              }}
            >
              {/* BOUTON GPS */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={() => {
                  if (intervention.client?.address) {
                    const query = encodeURIComponent(
                      intervention.client.address,
                    );
                    const url = Platform.select({
                      ios: `maps:0,0?q=${query}`,
                      android: `geo:0,0?q=${query}`,
                      web: `https://www.google.com/maps/search/?api=1&query=${query}`,
                    });
                    Linking.openURL(url!);
                  } else {
                    toast.error(
                      "Pas d'adresse",
                      "Aucune adresse pour ce client.",
                    );
                  }
                }}
              >
                <View className="bg-emerald-500/10 p-3 rounded-full mb-2">
                  <Navigation
                    size={24}
                    color="#10B981"
                    fill="#10B981"
                    fillOpacity={0.2}
                  />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">
                  Y aller
                </Text>
              </Pressable>

              {/* BOUTON APPELER */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={() => {
                  if (intervention.client?.phone) {
                    const cleanedPhone = intervention.client.phone.replace(
                      /\s/g,
                      "",
                    );
                    Linking.openURL(`tel:${cleanedPhone}`);
                  } else {
                    toast.error("Pas de téléphone", "Aucun numéro renseigné.");
                  }
                }}
              >
                <View className="bg-blue-500/10 p-3 rounded-full mb-2">
                  <Phone
                    size={24}
                    color="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.2}
                  />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">
                  Appeler
                </Text>
              </Pressable>

              {/* BOUTON MAIL */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={() => {
                  if (intervention.client?.email) {
                    Linking.openURL(
                      `mailto:${intervention.client.email.trim()}`,
                    );
                  } else {
                    toast.error("Pas d'email", "Aucun email renseigné.");
                  }
                }}
              >
                <View className="bg-orange-500/10 p-3 rounded-full mb-2">
                  <Mail
                    size={24}
                    color="#F97316"
                    fill="#F97316"
                    fillOpacity={0.2}
                  />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">
                  Email
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* 3. SUIVI TEMPS RÉEL (Si dispo) */}
          {(intervention.real_start_time || intervention.real_end_time) && (
            <Animated.View
              entering={FadeInDown.delay(400)}
              className="w-full"
              // ✅ MODIF : Marge en bas UNIQUEMENT sur mobile
              style={{ marginBottom: isDesktop ? 0 : 20 }}
            >
              <Card className="border-l-4 border-l-primary bg-primary/5 border-y-0 border-r-0 rounded-3xl">
                <CardContent className="p-5">
                  <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                    Suivi en direct
                  </Text>

                  <View className="flex-row gap-6">
                    {intervention.real_start_time && (
                      <View>
                        <Text className="text-xs text-muted-foreground mb-1">
                          Démarré à
                        </Text>
                        <View className="flex-row items-center">
                          <PlayCircle
                            size={14}
                            color="#22C55E"
                            className="mr-1.5"
                          />
                          <Text className="font-bold text-foreground dark:text-white">
                            {new Date(
                              intervention.real_start_time,
                            ).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Brussels",
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                    {intervention.real_end_time && (
                      <View>
                        <Text className="text-xs text-muted-foreground mb-1">
                          Terminé à
                        </Text>
                        <View className="flex-row items-center">
                          <CheckCircle2
                            size={14}
                            color="#22C55E"
                            className="mr-1.5"
                          />
                          <Text className="font-bold text-foreground dark:text-white">
                            {new Date(
                              intervention.real_end_time,
                            ).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Brussels",
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </CardContent>
              </Card>
            </Animated.View>
          )}

          {(intervType === "intervention" || !!intervention.description) && (
            <Animated.View
              entering={FadeInDown.delay(450)}
              className="w-full mt-4"
            >
              <Card className="rounded-3xl">
                <CardContent className="p-5">
                  {/* Prix — uniquement pour les interventions */}
                  {intervType === "intervention" && (
                    <>
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                        Détail de la prestation
                      </Text>
                      {intervention.items && intervention.items.length > 0 ? (
                        <View className="gap-3 mb-4">
                          {intervention.items.map((item: any, idx: number) => (
                            <View
                              key={idx}
                              className="flex-row justify-between items-center pb-2 border-b border-border dark:border-slate-800 last:border-0"
                            >
                              <Text className="text-foreground dark:text-white font-medium flex-1 mr-4">
                                {item.label}
                              </Text>
                              <Text className="text-foreground dark:text-white font-bold">
                                {item.price} €
                              </Text>
                            </View>
                          ))}
                          <View className="flex-row justify-between items-center pt-2 mt-1">
                            <Text className="text-lg font-bold text-foreground dark:text-white">
                              Total
                            </Text>
                            <Text className="text-xl font-extrabold text-primary">
                              {intervention.price_estimated} €
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View className="flex-row justify-between items-center mb-4">
                          <Text className="text-muted-foreground">
                            Prix global estimé
                          </Text>
                          <Text className="text-xl font-extrabold text-primary">
                            {intervention.price_estimated} €
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Notes — toujours affichées */}
                  {intervention.description && (
                    <View style={{ backgroundColor: isDark ? "rgba(15,23,42,0.5)" : "rgba(0,0,0,0.04)", padding: 16, borderRadius: 16, marginTop: 8 }}>
                      <Text className="text-xs font-bold text-muted-foreground mb-1">
                        NOTES
                      </Text>
                      <Text className="text-foreground dark:text-slate-300 leading-relaxed">
                        {intervention.description}
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* --- FOOTER ACTIONS (Fixe en bas, flottant) --- */}
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {(intervention.status === "planned" || intervention.status === "in_progress") && (
          <Button
            onPress={() =>
              router.push(`/(app)/calendar/add?reprise_of=${id}` as any)
            }
            className="w-full h-14 bg-blue-500 hover:bg-blue-600 rounded-full"
          >
            <View className="flex-row items-center">
              <CheckCircle2 size={20} color="white" strokeWidth={2.5} />
              <Text className="text-white font-bold text-lg ml-2">
                Intervention terminée
              </Text>
            </View>
          </Button>
        )}

        {intervention.status === "done" && (
          <View className="w-full h-14 bg-green-500 rounded-full items-center justify-center flex-row shadow-lg shadow-green-500/20">
            <CheckCircle2 size={24} color="white" strokeWidth={3} />
            <Text className="ml-2 text-white text-lg font-extrabold tracking-wide">
              INTERVENTION CLÔTURÉE
            </Text>
          </View>
        )}
      </View>

      {/* 1. LE MENU 3 POINTS */}
      <OptionsModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onEdit={() => {
          setMenuVisible(false);
          router.push(`/(app)/calendar/add?id=${id}`);
        }}
        onDelete={handleDeleteRequest}
      />

      {/* 2. LA CONFIRMATION CUSTOM */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Supprimer l'intervention ?"
        message="Cette action est irréversible. L'intervention sera définitivement effacée du planning."
        confirmText="Supprimer"
        cancelText="Annuler"
        isDestructive={true}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMutation.mutate();
        }}
      />

      <Dialog open={showTimeEdit} onClose={() => setShowTimeEdit(false)} position="bottom" containerStyle={{ paddingBottom: 120 }}>
        <View style={{ padding: 16, gap: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: isDark ? "#F8FAFC" : "#09090B", textAlign: "center" }}>
            Modifier les horaires
          </Text>
          <DateTimePicker
            value={editStartStr}
            onChange={(v) => {
              setEditStartStr(v);
              // Ensure end stays after start
              if (editEndStr) {
                const [, st = "00:00"] = v.split("T");
                const [, et = "00:00"] = editEndStr.split("T");
                const [sh, sm] = st.split(":").map(Number);
                const [eh, em] = et.split(":").map(Number);
                if (eh * 60 + em <= sh * 60 + sm) {
                  const adjH = Math.min(sh + 1, 23);
                  setEditEndStr(`${v.split("T")[0]}T${String(adjH).padStart(2, "0")}:${String(sm).padStart(2, "0")}`);
                }
              }
            }}
            label="Début"
            timeOnly
          />
          {editEndStr ? (
            <DateTimePicker
              value={editEndStr}
              onChange={setEditEndStr}
              label="Fin"
              timeOnly
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="outline" onPress={() => setShowTimeEdit(false)} style={{ flex: 1 }}>
              Annuler
            </Button>
            <Button onPress={handleSaveTime} style={{ flex: 1 }} disabled={timeMutation.isPending}>
              Enregistrer
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  );
}
