import React from "react";
import { View, Text } from "react-native";
import { usePlanningStats } from "../../hooks/usePlanning";

function fmtH(h: number): string {
  // Arrondi au quart d'heure — aligné sur l'écran "Session taux" (mobile)
  // et intervention_hours (backend), qui font tous deux le même calcul.
  const rounded = Math.round(h * 4) / 4;
  const hours = Math.floor(rounded);
  const mins = Math.round((rounded % 1) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

export const DailyStatsBadge = React.memo(function DailyStatsBadge({
  dateStr,
  zone,
}: {
  dateStr: string;
  zone?: string;
}) {
  const { stats, isLoading } = usePlanningStats(dateStr, zone);

  if (isLoading || !stats) return null;

  let bgClass = "bg-green-100 dark:bg-green-900/50";
  let textClass = "text-green-700 dark:text-green-400";

  if (stats.status === "warning") {
    bgClass = "bg-orange-100 dark:bg-orange-900/50";
    textClass = "text-orange-700 dark:text-orange-400";
  } else if (stats.status === "overload") {
    bgClass = "bg-red-100 dark:bg-red-900/50";
    textClass = "text-red-700 dark:text-red-400";
  }

  return (
    <View className={`px-3 py-1.5 rounded-full ${bgClass}`}>
      <Text className={`text-sm font-bold ${textClass}`}>
        {fmtH(stats.planned_hours)} / {fmtH(stats.capacity_hours)}
      </Text>
    </View>
  );
});
