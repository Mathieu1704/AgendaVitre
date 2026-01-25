import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import {
  FileText,
  Plus,
  Euro,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FilePlus,
  ArrowUpRight,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";

// Composants UI
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../src/ui/components/Card";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

// Hooks
import { useInterventions } from "../../../src/hooks/useInterventions";

export default function FacturationScreen() {
  const router = useRouter();
  const { interventions, isLoading } = useInterventions();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  const scrollRef = useRef<ScrollView>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "pending">(
    "all",
  );

  useFocusEffect(
    useCallback(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: false });
      }
    }, []),
  );

  // --- LOGIQUE MÉTIER ---
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const stats = useMemo(() => {
    const safeInterventions = interventions || [];

    const thisMonth = safeInterventions.filter(
      (i: any) =>
        i.start_time &&
        isWithinInterval(parseISO(i.start_time), {
          start: currentMonthStart,
          end: currentMonthEnd,
        }),
    );

    const completed = thisMonth.filter((i: any) => i.status === "done");
    const pending = thisMonth.filter((i: any) => i.status !== "done");

    const totalHT = completed.reduce(
      (acc: number, i: any) => acc + (Number(i.price_estimated) || 0),
      0,
    );
    const pendingHT = pending.reduce(
      (acc: number, i: any) => acc + (Number(i.price_estimated) || 0),
      0,
    );

    return {
      totalHT,
      pendingHT,
      completedCount: completed.length,
      pendingCount: pending.length,
    };
  }, [interventions]);

  const filteredInterventions = useMemo(() => {
    const safeInterventions = interventions || [];
    let filtered = safeInterventions;

    if (statusFilter === "done") {
      filtered = safeInterventions.filter((i: any) => i.status === "done");
    } else if (statusFilter === "pending") {
      filtered = safeInterventions.filter((i: any) => i.status !== "done");
    }

    return filtered.filter((i: any) => i.price_estimated);
  }, [interventions, statusFilter]);

  // ✅ CONFIGURATION DES KPIS (Style Dashboard)
  const kpiStats = [
    {
      label: "Encaissé (HT)",
      value: `${stats.totalHT.toFixed(0)} €`,
      icon: Euro,
      color: "#22C55E",
      bg: "bg-green-500/10",
      trend: `+${(stats.totalHT * 0.21).toFixed(0)}€ TVA`, // On utilise le slot trend pour la TVA
      trendColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "En attente",
      value: `${stats.pendingHT.toFixed(0)} €`,
      icon: Clock,
      color: "#F97316",
      bg: "bg-orange-500/10",
      trend: "À facturer",
      trendColor: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Terminées",
      value: stats.completedCount.toString(),
      icon: CheckCircle2,
      color: "#3B82F6",
      bg: "bg-blue-500/10",
      trend: "Ce mois",
      trendColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Planifiées",
      value: stats.pendingCount.toString(),
      icon: Calendar,
      color: "#A855F7",
      bg: "bg-purple-500/10",
      trend: "À venir",
      trendColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  // --- RENDER ---
  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 lg:p-8"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Page */}
        <View className="flex-row items-center justify-between mb-6 pt-4">
          <View>
            <Text className="text-3xl font-bold text-foreground dark:text-white">
              Facturation
            </Text>
            <Text className="text-muted-foreground mt-1">
              Revenus & Factures (TVA 21%)
            </Text>
          </View>
        </View>

        {/* 1. KPIS GRID (Style Exact du Dashboard) */}
        {/* On utilise gap-3 comme dans le dashboard */}
        <View className="flex-row flex-wrap gap-3 mb-8">
          {kpiStats.map((stat, index) => {
            // Calcul exact de la largeur comme dans le dashboard
            // width - 32 (padding container px-4*2) - 12 (gap-3) / 2
            const cardWidth = (width - 32 - 12) / 2;

            return (
              <Animated.View
                key={index}
                entering={FadeInDown.delay(index * 80).springify()}
                style={{ width: cardWidth }}
              >
                <Card className="rounded-[24px]">
                  <CardContent
                    className="p-3 items-center justify-center"
                    style={{ minHeight: 100 }}
                  >
                    {/* 1. Icône + Label (Ligne du haut) */}
                    <View className="flex-row items-center mb-3 w-full">
                      <View
                        className={`p-2 ${stat.bg} mr-2`}
                        style={{ borderRadius: 12 }}
                      >
                        <stat.icon size={16} color={stat.color} />
                      </View>
                      <Text
                        className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex-1"
                        numberOfLines={1}
                      >
                        {stat.label}
                      </Text>
                    </View>

                    {/* 2. Valeur + Trend (Ligne du bas) */}
                    <View className="w-full">
                      {isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={stat.color}
                          className="self-start py-1"
                        />
                      ) : (
                        <View className="flex-row items-baseline justify-center flex-wrap">
                          <Text className="text-2xl font-extrabold text-foreground dark:text-white leading-none mr-2">
                            {stat.value}
                          </Text>
                          {stat.trend ? (
                            <View className="flex-row items-center mt-1">
                              {/* Petite flèche esthétique */}
                              <ArrowUpRight
                                size={10}
                                color={stat.color} // On utilise la couleur de l'icone pour la fleche
                                strokeWidth={3}
                                className="opacity-80"
                              />
                              <Text
                                className={`text-[10px] font-bold ml-0.5 ${stat.trendColor}`}
                              >
                                {stat.trend}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </CardContent>
                </Card>
              </Animated.View>
            );
          })}
        </View>

        {/* 2. LISTE DES FACTURES */}
        <Card className="min-h-[400px] mb-20 rounded-[32px] overflow-hidden">
          <CardHeader className="p-6 border-b border-border dark:border-slate-800 pb-4">
            <View className="gap-4">
              <View className="flex-row items-center">
                <FileText size={20} color="#3B82F6" />

                {/* On utilise ml-3 pour l'écart et on retire le padding bizarre */}
                <Text className="text-lg font-bold text-foreground dark:text-white ml-2">
                  Historique
                </Text>
              </View>

              {/* Filtres Tabs Arrondis */}
              <View className="flex-row bg-muted dark:bg-slate-800 p-1 rounded-full self-start">
                {(["all", "done", "pending"] as const).map((filter) => (
                  <Pressable
                    key={filter}
                    onPress={() => setStatusFilter(filter)}
                    className={`px-4 py-1.5 rounded-full ${
                      statusFilter === filter
                        ? "bg-background dark:bg-slate-600 shadow-sm"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold capitalize ${
                        statusFilter === filter
                          ? "text-foreground dark:text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      {filter === "all"
                        ? "Tout"
                        : filter === "done"
                          ? "Payées"
                          : "À faire"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </CardHeader>

          <CardContent className="p-4">
            {isLoading ? (
              <ActivityIndicator color="#3B82F6" className="mt-8" />
            ) : filteredInterventions.length === 0 ? (
              <View className="items-center justify-center py-16 opacity-50">
                <FilePlus size={48} color={isDark ? "#475569" : "#CBD5E1"} />
                <Text className="text-foreground dark:text-white font-bold mt-4 text-lg">
                  Aucune facture
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {filteredInterventions.map((item: any, index: number) => {
                  const invoiceNumber = `2024-${String(index + 1).padStart(
                    3,
                    "0",
                  )}`;

                  return (
                    <View
                      key={item.id}
                      className="flex-row items-center justify-between p-4 rounded-[24px] border border-border dark:border-slate-800 bg-card dark:bg-slate-900"
                    >
                      <View className="flex-row items-center flex-1 gap-3">
                        <View className="bg-muted/50 dark:bg-slate-800 h-10 w-10 items-center justify-center rounded-full">
                          <FileText size={18} color="#64748B" />
                        </View>
                        <View>
                          <Text
                            className="font-bold text-sm text-foreground dark:text-white"
                            numberOfLines={1}
                          >
                            {item.client?.name || "Client Inconnu"}
                          </Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            #{invoiceNumber}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <StatusBadge status={item.status} />
                        <Pressable
                          onPress={() =>
                            toast.success(
                              "Téléchargement",
                              `Facture #${invoiceNumber} générée`,
                            )
                          }
                          className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 border border-border dark:border-slate-700"
                        >
                          <Download
                            size={14}
                            color={isDark ? "#FFF" : "#0F172A"}
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* FAB (Bouton Ajouter) */}
      <Pressable
        onPress={() => router.push("/(app)/facturation/add")}
        className="absolute bottom-6 right-6 h-14 w-14 bg-primary rounded-full items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform"
      >
        <Plus size={28} color="white" />
      </Pressable>
    </View>
  );
}
