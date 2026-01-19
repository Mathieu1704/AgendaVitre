import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { usePlanningStats } from "../../hooks/usePlanning";
import { cn } from "../cn";

export function PlanningHeader({ dateStr }: { dateStr: string }) {
  const { stats, isLoading } = usePlanningStats(dateStr);

  if (isLoading) {
    return (
      <View className="h-12 justify-center items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (!stats) return null;

  // Calcul du pourcentage de remplissage
  const percentage = Math.min(
    100,
    (stats.planned_hours / (stats.capacity_hours || 1)) * 100,
  );

  // Choix de la couleur
  let colorClass = "bg-green-500"; // OK
  if (stats.status === "warning") colorClass = "bg-orange-500";
  if (stats.status === "overload") colorClass = "bg-red-500";

  return (
    <View className="mb-4">
      {/* 1. Les Textes (Ex: 67h00 = totale...) */}
      <View className="flex-row justify-between items-end mb-2 px-1">
        <View>
          <Text className="text-2xl font-extrabold text-foreground dark:text-white">
            {stats.planned_hours.toFixed(1)}h
            <Text className="text-sm font-normal text-muted-foreground">
              {" / "}
              {stats.capacity_hours.toFixed(1)}h dispo
            </Text>
          </Text>
          <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {stats.present_employees} Employés présents
          </Text>
        </View>

        {/* Badge d'état */}
        <View className={cn("px-2 py-1 rounded-md", colorClass, "opacity-90")}>
          <Text className="text-white text-xs font-bold uppercase">
            {stats.status === "overload"
              ? "Surcharge"
              : stats.status === "warning"
                ? "Juste"
                : "OK"}
          </Text>
        </View>
      </View>

      {/* 2. La Barre de progression (Visuelle) */}
      <View className="h-3 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
        <View
          className={cn(
            "h-full rounded-full transition-all duration-500",
            colorClass,
          )}
          style={{ width: `${percentage}%` }}
        />
        {/* Barre de tolérance (petite ligne pour montrer la limite) */}
        {stats.tolerance > 0 && (
          <View
            className="absolute top-0 bottom-0 w-0.5 bg-black/20"
            style={{
              left: `${Math.min(100, ((stats.capacity_hours + stats.tolerance) / stats.capacity_hours) * 100)}%`,
            }}
          />
        )}
      </View>
    </View>
  );
}
