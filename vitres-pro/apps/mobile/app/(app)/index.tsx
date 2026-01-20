import React, { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import {
  TrendingUp,
  Calendar as CalendarIcon,
  Users,
  Euro,
  ArrowUpRight,
  Clock,
} from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import Animated, { FadeInDown } from "react-native-reanimated";
import { format, isToday, parseISO } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../src/ui/components/Card";
import { StatusBadge } from "../../src/ui/components/StatusBadge";
import { Avatar } from "../../src/ui/components/Avatar";
import { useInterventions } from "../../src/hooks/useInterventions";
import { useClients } from "../../src/hooks/useClients";
import { supabase } from "../../src/lib/supabase";
import { api } from "../../src/lib/api";

interface ChartItem {
  value: number;
  label: string;
}

interface StatItem {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  trend: string;
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { interventions, isLoading: interventionsLoading } = useInterventions();
  const { clients } = useClients();
  const { width } = useWindowDimensions();

  // ✅ Détection Mobile/Desktop
  const isMobile = width < 768;
  const isDesktop = width >= 1024;

  // ✅ État pour le rôle utilisateur
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // Charger le rôle de l'utilisateur
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const res = await api.get("/api/employees");
          const myProfile = res.data.find((e: any) => e.email === user.email);
          setUserRole(myProfile?.role || "employee");
        }
      } catch (e) {
        setUserRole("employee");
      } finally {
        setLoadingRole(false);
      }
    };
    loadUserRole();
  }, []);

  const isAdmin = userRole === "admin";

  const [chartWidth, setChartWidth] = useState(300);

  const todayInterventions =
    interventions?.filter(
      (i: any) => i.start_time && isToday(parseISO(i.start_time)),
    ) || [];

  const upcomingInterventions =
    interventions?.filter((i: any) => {
      if (!i.start_time) return false;
      const startDate = parseISO(i.start_time);

      // Exclure aujourd'hui (déjà dans "Aujourd'hui")
      return startDate >= new Date() && !isToday(startDate);
    }) || [];

  const totalRevenue =
    interventions
      ?.filter((i: any) => i.status === "done")
      .reduce(
        (acc: number, i: any) => acc + (Number(i.price_estimated) || 0),
        0,
      ) || 0;

  const chartData: ChartItem[] = [
    { value: 1200, label: "Jan" },
    { value: 2100, label: "Fév" },
    { value: 1800, label: "Mar" },
    { value: 2400, label: "Avr" },
    { value: 3200, label: "Mai" },
    { value: 2800, label: "Juin" },
  ];

  const stats: StatItem[] = [
    {
      label: "Chiffre d'affaires",
      value: `${totalRevenue.toFixed(0)} €`,
      icon: Euro,
      color: "#22C55E",
      bg: "bg-green-500/10",
      trend: "+12%",
    },
    {
      label: "Interventions à venir",
      value: upcomingInterventions.length.toString(),
      icon: CalendarIcon,
      color: "#3B82F6",
      bg: "bg-blue-500/10",
      trend: "+4",
    },
    {
      label: "Clients",
      value: (clients?.length || 0).toString(),
      icon: Users,
      color: "#F97316",
      bg: "bg-orange-500/10",
      trend: "+2",
    },
  ];

  const mobileStats: StatItem[] = [
    ...stats,
    {
      label: "Aujourd'hui",
      value: todayInterventions.length.toString(),
      icon: Clock,
      color: "#8B5CF6",
      bg: "bg-purple-500/10",
      trend: "",
    },
  ];

  // Loading state
  if (loadingRole) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // ========================================
  // 📱 RENDU MOBILE (UNIQUEMENT)
  // ========================================
  if (isMobile) {
    return (
      <ScrollView
        className="flex-1 bg-background dark:bg-slate-950"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 120,
          paddingHorizontal: 16,
        }}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground dark:text-white">
            Tableau de bord
          </Text>
          <Text className="text-muted-foreground dark:text-slate-400 mt-1 text-sm">
            {isAdmin
              ? "Bienvenue sur votre espace LVM Agenda"
              : "Vos interventions du jour"}
          </Text>
        </View>

        {/* ========== ADMIN : KPIs 2x2 ========== */}
        {isAdmin && (
          <View className="flex-row flex-wrap gap-3 mb-6">
            {mobileStats.map((stat, index) => {
              const cardWidth = (width - 32 - 12) / 2;

              return (
                <Animated.View
                  key={index}
                  entering={FadeInDown.delay(index * 80).springify()}
                  style={{ width: cardWidth }}
                >
                  <Card className="rounded-3xl">
                    <CardContent
                      className="p-3 items-center justify-center"
                      style={{ minHeight: 100 }}
                    >
                      {/* 1. Icône + Label (même ligne) */}
                      <View className="flex-row items-center mb-2">
                        <View
                          className={`p-2 ${stat.bg} mr-2`}
                          style={{ borderRadius: 12 }}
                        >
                          <stat.icon size={16} color={stat.color} />
                        </View>
                        <Text
                          // className="text-base text-foreground dark:text-white font-semibold tracking-wide flex-1 leading-tight"
                          className="text-base font-semibold text-foreground dark:text-white flex-1"
                          numberOfLines={2}
                        >
                          {stat.label}
                        </Text>
                      </View>

                      {/* 2. Valeur + Trend (même ligne) */}
                      <View className="flex-row items-end">
                        <Text className="text-2xl font-extrabold text-foreground dark:text-white leading-none">
                          {stat.value}
                        </Text>
                        {stat.trend ? (
                          <View className="flex-row items-center ml-2 mb-0.5">
                            <ArrowUpRight
                              size={11}
                              color="#22C55E"
                              strokeWidth={2.5}
                            />
                            <Text className="text-[10px] text-green-600 dark:text-green-400 font-bold ml-0.5">
                              {stat.trend}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </CardContent>
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        )}
        {/* ========== ADMIN : Graphique ========== */}
        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(300)} className="mb-6">
            <Card className="rounded-3xl">
              <CardHeader className="p-4 pb-2">
                <View className="flex-row items-center gap-2">
                  <TrendingUp size={18} color="#3B82F6" />
                  <Text className="text-base font-semibold text-foreground dark:text-white">
                    Évolution des revenus
                  </Text>
                </View>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <View
                  className="w-full"
                  style={{ paddingTop: 8 }}
                  onLayout={(e) => {
                    const containerWidth = e.nativeEvent.layout.width;
                    setChartWidth(Math.max(containerWidth - 20, 250));
                  }}
                >
                  <LineChart
                    data={chartData}
                    color="#3B82F6"
                    thickness={2}
                    startFillColor="rgba(59, 130, 246, 0.2)"
                    endFillColor="rgba(59, 130, 246, 0.02)"
                    startOpacity={0.8}
                    endOpacity={0.1}
                    areaChart
                    curved
                    hideDataPoints={false}
                    dataPointsColor="#3B82F6"
                    dataPointsRadius={4}
                    width={chartWidth}
                    height={180}
                    adjustToWidth={true}
                    spacing={(chartWidth - 10) / chartData.length}
                    initialSpacing={15}
                    endSpacing={15}
                    showVerticalLines={false}
                    rulesType="solid"
                    rulesColor="#E4E4E7"
                    rulesThickness={1}
                    yAxisTextStyle={{
                      color: "#71717A",
                      fontSize: 10,
                    }}
                    xAxisLabelTextStyle={{
                      color: "#71717A",
                      fontSize: 10,
                      fontWeight: "500",
                    }}
                    hideYAxisText={false}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    noOfSections={4}
                    maxValue={4000}
                  />
                </View>
              </CardContent>
            </Card>
          </Animated.View>
        )}

        {/* ========== Aujourd'hui (Tous) ========== */}
        <Animated.View
          entering={FadeInDown.delay(isAdmin ? 400 : 100)}
          className="mb-6"
        >
          <Card className="rounded-3xl">
            <CardHeader className="p-4 pb-3">
              <View className="flex-row items-center gap-2">
                <Clock size={18} color="#8B5CF6" />
                <Text className="text-base font-semibold text-foreground dark:text-white">
                  Aujourd'hui
                </Text>
                {todayInterventions.length > 0 && (
                  <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                    <Text className="text-xs font-bold text-primary">
                      {todayInterventions.length}
                    </Text>
                  </View>
                )}
              </View>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {interventionsLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#3B82F6" />
                </View>
              ) : todayInterventions.length === 0 ? (
                <View className="items-center justify-center py-8 bg-muted/30 dark:bg-slate-800/30 rounded-2xl">
                  <CalendarIcon size={32} color="#94A3B8" />
                  <Text className="text-muted-foreground dark:text-slate-400 text-sm mt-3">
                    Aucune intervention prévue
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {todayInterventions.map((item: any, i: number) => (
                    <View
                      key={i}
                      className="flex-row items-center gap-3 p-3 rounded-2xl bg-muted/40 dark:bg-slate-800/50"
                    >
                      <Avatar
                        name={item.client?.name || item.title}
                        size="sm"
                      />
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold text-foreground dark:text-white"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground dark:text-slate-400">
                          {item.start_time
                            ? format(parseISO(item.start_time), "HH:mm")
                            : "--:--"}{" "}
                          • {item.client?.name || "Client"}
                        </Text>
                      </View>
                      <StatusBadge status={item.status} />
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        </Animated.View>

        {/* ========== À venir (Employés) ========== */}
        {!isAdmin && upcomingInterventions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200)} className="mb-6">
            <Card className="rounded-3xl">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="flex-row items-center gap-2">
                  <CalendarIcon size={18} color="#3B82F6" />
                  <Text className="text-base font-semibold text-foreground dark:text-white">
                    À venir
                  </Text>
                  <View className="bg-blue-500/10 px-2 py-0.5 rounded-full ml-2">
                    <Text className="text-xs font-bold text-blue-600">
                      {upcomingInterventions.length}
                    </Text>
                  </View>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <View className="gap-3">
                  {upcomingInterventions
                    .slice(0, 5)
                    .map((item: any, i: number) => (
                      <View
                        key={i}
                        className="flex-row items-center gap-3 p-3 rounded-2xl bg-muted/40 dark:bg-slate-800/50"
                      >
                        <View className="bg-blue-500/10 p-2 rounded-xl">
                          <CalendarIcon size={16} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-sm font-semibold text-foreground dark:text-white"
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text className="text-xs text-muted-foreground dark:text-slate-400">
                            {item.start_time
                              ? format(
                                  parseISO(item.start_time),
                                  "dd/MM • HH:mm",
                                )
                              : "--/-- • --:--"}{" "}
                            • {item.client?.name || "Client"}
                          </Text>
                        </View>
                        <StatusBadge status={item.status} />
                      </View>
                    ))}
                </View>
              </CardContent>
            </Card>
          </Animated.View>
        )}

        {/* Message vide (Employés) */}
        {!isAdmin &&
          upcomingInterventions.length === 0 &&
          todayInterventions.length === 0 && (
            <Animated.View entering={FadeInDown.delay(200)}>
              <Card className="rounded-3xl">
                <CardContent className="p-8 items-center">
                  <View className="bg-green-500/10 p-4 rounded-full mb-4">
                    <CalendarIcon size={32} color="#22C55E" />
                  </View>
                  <Text className="text-lg font-bold text-foreground dark:text-white text-center">
                    Tout est à jour !
                  </Text>
                  <Text className="text-sm text-muted-foreground dark:text-slate-400 text-center mt-2">
                    Vous n'avez pas d'interventions planifiées pour le moment.
                  </Text>
                </CardContent>
              </Card>
            </Animated.View>
          )}
      </ScrollView>
    );
  }

  // ========================================
  // 💻 RENDU WEB (TON CODE ORIGINAL)
  // ========================================
  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-slate-950 p-4 lg:p-8"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 16 }}
    >
      <View className="mb-8">
        <Text className="text-3xl font-bold text-foreground dark:text-white">
          Tableau de bord
        </Text>
        <Text className="text-muted-foreground dark:text-slate-400 mt-1">
          Bienvenue sur votre espace LVM Agenda
        </Text>
      </View>

      {/* KPI CARDS */}
      <View className="flex-row flex-wrap gap-4 mb-8">
        {stats.map((stat, index) => (
          <Animated.View
            key={index}
            entering={FadeInDown.delay(index * 100).springify()}
            className="w-full md:w-[32%] flex-grow"
          >
            <Card className="min-h-[130px] justify-center">
              <CardContent className="p-6">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-1 justify-center">
                    <Text className="text-sm font-medium text-muted-foreground dark:text-slate-400 mb-1">
                      {stat.label}
                    </Text>
                    <Text className="text-3xl font-bold text-foreground dark:text-white tracking-tight">
                      {stat.value}
                    </Text>
                  </View>
                  <View className={`p-3 rounded-xl ${stat.bg} self-start`}>
                    <stat.icon size={22} color={stat.color} />
                  </View>
                </View>

                <View className="flex-row items-center mt-2">
                  <ArrowUpRight size={14} color="#22C55E" />
                  <Text className="text-xs text-green-600 font-medium ml-1">
                    {stat.trend}{" "}
                    <Text className="text-muted-foreground dark:text-slate-500 font-normal">
                      vs mois dernier
                    </Text>
                  </Text>
                </View>
              </CardContent>
            </Card>
          </Animated.View>
        ))}
      </View>

      <View className="flex-col lg:flex-row gap-6">
        <Animated.View
          entering={FadeInDown.delay(300)}
          className="flex-1 min-h-[420px]"
        >
          <Card className="h-full">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="flex-row items-center gap-2">
                <TrendingUp size={20} color="#3B82F6" />
                Évolution des revenus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <View
                className="w-full"
                style={{ paddingTop: 16, paddingBottom: 8 }}
                onLayout={(e) => {
                  const containerWidth = e.nativeEvent.layout.width;
                  setChartWidth(Math.max(containerWidth - 20, 250));
                }}
              >
                <View
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <LineChart
                    data={chartData}
                    color="#3B82F6"
                    thickness={3}
                    startFillColor="rgba(59, 130, 246, 0.3)"
                    endFillColor="rgba(59, 130, 246, 0.05)"
                    startOpacity={1}
                    endOpacity={0.3}
                    areaChart
                    curved
                    hideDataPoints={false}
                    dataPointsColor="#3B82F6"
                    dataPointsRadius={6}
                    width={chartWidth}
                    height={280}
                    adjustToWidth={true}
                    spacing={(chartWidth - 10) / chartData.length}
                    initialSpacing={20}
                    endSpacing={20}
                    showVerticalLines={false}
                    rulesType="solid"
                    rulesColor="#E4E4E7"
                    rulesThickness={1}
                    yAxisTextStyle={{
                      color: "#71717A",
                      fontSize: 11,
                      fontWeight: "400",
                    }}
                    xAxisLabelTextStyle={{
                      color: "#71717A",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                    xAxisLabelsHeight={20}
                    xAxisLabelsVerticalShift={8}
                    hideYAxisText={false}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor="#E4E4E7"
                    noOfSections={5}
                    maxValue={3500}
                    pointerConfig={{
                      pointerStripHeight: 200,
                      pointerStripColor: "#CBD5E1",
                      pointerStripWidth: 2,
                      pointerColor: "#3B82F6",
                      radius: 6,
                      pointerLabelWidth: 100,
                      pointerLabelHeight: 90,
                      activatePointersOnLongPress: false,
                      autoAdjustPointerLabelPosition: true,
                      pointerLabelComponent: (items: any) => (
                        <View className="bg-slate-900 dark:bg-slate-800 px-3 py-2 rounded-lg">
                          <Text className="text-white text-xs font-bold">
                            {items[0].value} €
                          </Text>
                        </View>
                      ),
                    }}
                  />
                </View>
              </View>
            </CardContent>
          </Card>
        </Animated.View>

        {/* LISTE AUJOURD'HUI */}
        <Animated.View
          entering={FadeInDown.delay(400)}
          className="w-full lg:w-[350px]"
        >
          <Card className="h-full">
            <CardHeader className="p-6 pb-4">
              <CardTitle>Aujourd'hui</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {todayInterventions.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <Text className="text-muted-foreground dark:text-slate-400 text-sm">
                    Rien de prévu aujourd'hui 🎉
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {todayInterventions.map((item: any, i: number) => (
                    <View
                      key={i}
                      className="flex-row items-center gap-3 p-3 rounded-xl bg-muted/50 dark:bg-slate-800 border border-transparent hover:border-border dark:hover:border-slate-700 transition-all"
                    >
                      <Avatar
                        name={item.client?.name || item.title}
                        size="sm"
                      />
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold text-foreground dark:text-white"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground dark:text-slate-400">
                          {item.start_time
                            ? format(parseISO(item.start_time), "HH:mm")
                            : "--:--"}{" "}
                          • {item.client?.name || "Client"}
                        </Text>
                      </View>
                      <StatusBadge status={item.status} />
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        </Animated.View>
      </View>
    </ScrollView>
  );
}
