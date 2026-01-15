import React, { useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import {
  TrendingUp,
  Calendar as CalendarIcon,
  Users,
  Euro,
  ArrowUpRight,
} from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import Animated, { FadeInDown } from "react-native-reanimated";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

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
  const { interventions } = useInterventions();
  const { clients } = useClients();
  const { width } = useWindowDimensions();

  // ✅ Largeur du graphique
  const [chartWidth, setChartWidth] = useState(300);

  const todayInterventions =
    interventions?.filter(
      (i: any) => i.start_time && isToday(parseISO(i.start_time))
    ) || [];

  const upcomingInterventions =
    interventions?.filter(
      (i: any) => i.start_time && parseISO(i.start_time) >= new Date()
    ) || [];

  const totalRevenue =
    interventions
      ?.filter((i: any) => i.status === "done")
      .reduce(
        (acc: number, i: any) => acc + (Number(i.price_estimated) || 0),
        0
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

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-slate-950 p-4 lg:p-8"
      showsVerticalScrollIndicator={false}
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
              <CardContent className="py-6">
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
        {/* ✅ GRAPHIQUE CORRIGÉ */}
        <Animated.View
          entering={FadeInDown.delay(300)}
          className="flex-1 min-h-[420px]"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex-row items-center gap-2">
                <TrendingUp size={20} color="#3B82F6" />
                Évolution des revenus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* ✅ Conteneur qui capture la largeur */}
              <View
                className="w-full"
                style={{ paddingTop: 16, paddingBottom: 8 }}
                onLayout={(e) => {
                  const containerWidth = e.nativeEvent.layout.width;
                  // On enlève juste un peu de marge pour éviter le débordement
                  setChartWidth(Math.max(containerWidth - 20, 250));
                }}
              >
                <View
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  <LineChart
                    data={chartData}
                    // Style
                    color="#3B82F6"
                    thickness={3}
                    startFillColor="rgba(59, 130, 246, 0.3)"
                    endFillColor="rgba(59, 130, 246, 0.05)"
                    startOpacity={1}
                    endOpacity={0.3}
                    areaChart
                    curved
                    // Points
                    hideDataPoints={false}
                    dataPointsColor="#3B82F6"
                    dataPointsRadius={6}
                    // ✅ DIMENSIONS CLÉS
                    width={chartWidth}
                    height={280}
                    adjustToWidth={true}
                    // ✅ ESPACEMENT ENTRE LES POINTS
                    spacing={(chartWidth - 10) / chartData.length}
                    initialSpacing={20}
                    endSpacing={20}
                    // Axes
                    showVerticalLines={false}
                    rulesType="solid"
                    rulesColor="#E4E4E7"
                    rulesThickness={1}
                    // ✅ Style des labels Y
                    yAxisTextStyle={{
                      color: "#71717A",
                      fontSize: 11,
                      fontWeight: "400",
                    }}
                    // ✅ Style des labels X (mois) - CORRIGÉ
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
                    // Tooltip
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
            <CardHeader>
              <CardTitle>Aujourd'hui</CardTitle>
            </CardHeader>
            <CardContent>
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
