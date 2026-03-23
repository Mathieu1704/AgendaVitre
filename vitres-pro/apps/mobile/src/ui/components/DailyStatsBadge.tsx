import React from "react";
import { View, Text } from "react-native";
import { usePlanningStats } from "../../hooks/usePlanning";

function fmtH(h: number): string {
  const rounded = Math.round(h * 2) / 2;
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
        {fmtH(Math.round(stats.planned_hours * 2) / 2)} / {fmtH(stats.capacity_hours)}
      </Text>
    </View>
  );
});
