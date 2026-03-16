import React from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { usePlanningStats } from "../../hooks/usePlanning";
import { cn } from "../cn";
import { Zap } from "lucide-react-native";

function fmtH(h: number): string {
  const rounded = Math.round(h * 2) / 2;
  const hours = Math.floor(rounded);
  const mins = Math.round((rounded % 1) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, "0")}`;
}

export function PlanningHeader({ dateStr, zone, onRateSession }: { dateStr: string; zone?: string; onRateSession?: () => void }) {
  const { stats, isLoading } = usePlanningStats(dateStr, zone);

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
      {/* 1. Les Textes */}
      <View className="flex-row items-center mb-2 px-1 gap-3">
        {onRateSession && (
          <Pressable
            onPress={onRateSession}
            className="w-11 h-11 rounded-full items-center justify-center active:opacity-60"
            style={{ backgroundColor: "#3B82F6" + "18" }}
          >
            <Zap size={20} color="#3B82F6" />
          </Pressable>
        )}
        <View className="flex-1">
          <Text className="text-2xl font-extrabold text-foreground dark:text-white">
            {fmtH(Math.round(stats.planned_hours * 2) / 2)}
            <Text className="text-sm font-normal text-muted-foreground">
              {" / "}
              {fmtH(stats.capacity_hours)} dispo
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
