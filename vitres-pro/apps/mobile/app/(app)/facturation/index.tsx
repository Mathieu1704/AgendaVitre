import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
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
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "expo-router";

// Composants UI
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

// Hooks
import { useInterventions } from "../../../src/hooks/useInterventions";

export default function FacturationScreen() {
  const router = useRouter();
  const { interventions, isLoading } = useInterventions();
  const { isDark } = useTheme();
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "pending">(
    "all",
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

  // --- RENDER ---
  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-slate-950 p-4 lg:p-8"
      showsVerticalScrollIndicator={false}
    >
      {/* Header Page */}
      <View className="flex-row items-center justify-between mb-8">
        <View>
          <Text className="text-3xl font-bold text-foreground dark:text-white">
            Facturation
          </Text>
          <Text className="text-muted-foreground mt-1">
            Revenus & Factures (TVA 21%)
          </Text>
        </View>

        {/* ✅ Navigation vers la page de création */}
        <Button
          size="sm"
          onPress={() => router.push("/(app)/facturation/add")}
          className="bg-primary hover:bg-primary/90"
        >
          <View className="flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="ml-2 text-white font-bold hidden md:flex">
              Nouvelle facture
            </Text>
          </View>
        </Button>
      </View>

      {/* 1. STATS CARDS */}
      <View className="flex-row flex-wrap gap-4 mb-8">
        {/* Carte 1 : Encaissé */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          className="w-full md:w-[23%] flex-grow"
        >
          <Card className="min-h-[120px] justify-center">
            <CardContent className="p-5 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Encaissé (HT)
                </Text>
                {isLoading ? (
                  <ActivityIndicator size="small" className="self-start" />
                ) : (
                  <Text className="text-2xl font-bold text-foreground dark:text-white">
                    {stats.totalHT.toFixed(0)} €
                  </Text>
                )}
                <Text className="text-[10px] text-green-600 mt-1">
                  + TVA {(stats.totalHT * 0.21).toFixed(0)} €
                </Text>
              </View>
              <View className="bg-green-500/10 p-3 rounded-xl">
                <Euro size={24} color="#22C55E" />
              </View>
            </CardContent>
          </Card>
        </Animated.View>

        {/* Carte 2 : En attente */}
        <Animated.View
          entering={FadeInDown.delay(200)}
          className="w-full md:w-[23%] flex-grow"
        >
          <Card className="min-h-[120px] justify-center">
            <CardContent className="p-5 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  En attente
                </Text>
                {isLoading ? (
                  <ActivityIndicator size="small" className="self-start" />
                ) : (
                  <Text className="text-2xl font-bold text-foreground dark:text-white">
                    {stats.pendingHT.toFixed(0)} €
                  </Text>
                )}
                <Text className="text-[10px] text-muted-foreground mt-1">
                  Prestations à facturer
                </Text>
              </View>
              <View className="bg-orange-500/10 p-3 rounded-xl">
                <Clock size={24} color="#F97316" />
              </View>
            </CardContent>
          </Card>
        </Animated.View>

        {/* Carte 3 : Volume */}
        <Animated.View
          entering={FadeInDown.delay(300)}
          className="w-[48%] md:w-[23%] flex-grow"
        >
          <Card className="min-h-[120px] justify-center">
            <CardContent className="p-5 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Terminées
                </Text>
                <Text className="text-2xl font-bold text-foreground dark:text-white">
                  {stats.completedCount}
                </Text>
              </View>
              <View className="bg-blue-500/10 p-3 rounded-xl">
                <CheckCircle2 size={24} color="#3B82F6" />
              </View>
            </CardContent>
          </Card>
        </Animated.View>

        {/* Carte 4 : À venir */}
        <Animated.View
          entering={FadeInDown.delay(400)}
          className="w-[48%] md:w-[23%] flex-grow"
        >
          <Card className="min-h-[120px] justify-center">
            <CardContent className="p-5 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Planifiées
                </Text>
                <Text className="text-2xl font-bold text-foreground dark:text-white">
                  {stats.pendingCount}
                </Text>
              </View>
              <View className="bg-purple-500/10 p-3 rounded-xl">
                <Calendar size={24} color="#A855F7" />
              </View>
            </CardContent>
          </Card>
        </Animated.View>
      </View>

      {/* 2. LISTE DES FACTURES */}
      <Card className="min-h-[400px] mb-20">
        <CardHeader className="p-6 border-b border-border dark:border-slate-800 pb-4">
          <View className="flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex-row items-center gap-2">
              <FileText size={20} color="#3B82F6" />
              <Text className="text-lg">Historique des factures</Text>
            </CardTitle>

            {/* Filtres Tabs */}
            <View className="flex-row bg-muted dark:bg-slate-800 p-1 rounded-xl self-start md:self-auto">
              {(["all", "done", "pending"] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setStatusFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg ${
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

        <CardContent className="p-6">
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
                const invoiceNumber = `2024-${String(index + 1).padStart(3, "0")}`;

                return (
                  <View
                    key={item.id}
                    className="flex-row items-center justify-between p-4 rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900 hover:bg-muted/30 transition-colors"
                  >
                    <View className="flex-row items-center flex-1 gap-4">
                      <View className="bg-muted/50 dark:bg-slate-800 h-10 w-10 items-center justify-center rounded-lg">
                        <FileText size={20} color="#64748B" />
                      </View>
                      <View>
                        <Text
                          className="font-bold text-sm text-foreground dark:text-white"
                          numberOfLines={1}
                        >
                          {item.client?.name || "Client Inconnu"}
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          #{invoiceNumber} •{" "}
                          {item.start_time
                            ? format(parseISO(item.start_time), "dd/MM/yyyy")
                            : "-"}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                      <View className="items-end hidden md:flex">
                        <Text className="font-bold text-sm text-foreground dark:text-white">
                          {Number(item.price_estimated).toFixed(2)} €{" "}
                          <Text className="text-[10px] text-muted-foreground font-normal">
                            HT
                          </Text>
                        </Text>
                        <Text className="text-[10px] text-muted-foreground">
                          {(Number(item.price_estimated) * 1.21).toFixed(2)} €
                          TTC
                        </Text>
                      </View>

                      <StatusBadge status={item.status} />

                      <Pressable
                        onPress={() =>
                          toast.success(
                            "Téléchargement",
                            `Facture #${invoiceNumber} générée`,
                          )
                        }
                        className="p-2 rounded-lg hover:bg-muted dark:hover:bg-slate-800 active:opacity-50 border border-border dark:border-slate-700 ml-2"
                      >
                        <Download
                          size={16}
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
  );
}
