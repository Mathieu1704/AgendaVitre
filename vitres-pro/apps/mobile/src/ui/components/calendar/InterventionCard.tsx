import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

export type AssignModalState =
  | { mode: "single"; interventionId: string; currentIds: string[] }
  | { mode: "zone"; date: string; subZone: string; label: string; color: string }
  | null;

export const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  intervention: { bg: "#EFF6FF", text: "#3B82F6", label: "Intervention" },
  devis:        { bg: "#F5F3FF", text: "#8B5CF6", label: "Devis" },
  tournee:      { bg: "#FFF7ED", text: "#F97316", label: "Tournée" },
  note:         { bg: "#F8FAFC", text: "#64748B", label: "Note" },
};

interface InterventionCardProps {
  item: any;
  compact?: boolean;
  viewMode: string;
  selectedDate: string;
  leftBarColor?: string;
  setAssignModal: React.Dispatch<React.SetStateAction<AssignModalState>>;
  setSelectedAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInitialAssignIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const InterventionCard = React.memo(function InterventionCard({
  item,
  compact = false,
  viewMode,
  selectedDate,
  leftBarColor,
  setAssignModal,
  setSelectedAssignIds,
  setInitialAssignIds,
}: InterventionCardProps) {
  const router = useRouter();

  const cardPadding = compact ? "p-2" : "p-3";
  const cardRadius = compact ? 12 : 20;

  const startTime = new Date(item.start_time);
  const endTime = item.end_time
    ? new Date(item.end_time)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const durationMs = endTime.getTime() - startTime.getTime();
  const durationH = Math.floor(durationMs / 3600000);
  const durationMin = Math.round((durationMs % 3600000) / 60000);
  const durationLabel = durationMin > 0
    ? `${durationH}h${String(durationMin).padStart(2, "0")}`
    : `${durationH}h`;

  const typeConfig = TYPE_CONFIG[item.type ?? "intervention"] ?? TYPE_CONFIG["intervention"];

  // Durée calculée quand time_tbd=true et taux non-time_only
  const computedDurationH: number | null = (() => {
    if (!item.time_tbd) return null;
    const rate = item.hourly_rate;
    if (!rate || rate.time_only) return null;
    if (!item.price_estimated || rate.rate <= 0) return null;
    return Math.round((item.price_estimated / rate.rate) * 4) / 4;
  })();
  const computedDurationLabel = computedDurationH != null
    ? computedDurationH === Math.floor(computedDurationH)
      ? `${computedDurationH}h`
      : `${Math.floor(computedDurationH)}h${String(Math.round((computedDurationH % 1) * 60)).padStart(2, "0")}`
    : null;
  const hasClient = ["intervention", "devis"].includes(item.type ?? "intervention");

  const employees: any[] = [...(item.employees ?? [])].sort(
    (a: any, b: any) => (a.id as string).localeCompare(b.id as string)
  );

  const card = (
    <Pressable
      onPress={() => router.push(`/(app)/calendar/${item.id}?from_view=${viewMode}&from_date=${selectedDate}` as any)}
      onLongPress={() => {
        const currentIds = employees.map((e: any) => e.id);
        setAssignModal({ mode: "single", interventionId: item.id, currentIds });
        setSelectedAssignIds(currentIds);
        setInitialAssignIds(currentIds);
      }}
      delayLongPress={400}
      className={`border border-border dark:border-slate-800 shadow-sm active:scale-[0.98] overflow-hidden${leftBarColor ? "" : " mb-3"}`}
      style={{ borderRadius: cardRadius, flex: leftBarColor ? 1 : undefined }}
    >
      {employees.length > 0 && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" }}>
          {employees.map((e: any) => (
            <View key={e.id} style={{ flex: 1, backgroundColor: (e.color ?? "#3B82F6") + "2C" }} />
          ))}
        </View>
      )}
      {employees.length > 0 && (
        <View style={{ flexDirection: "row", height: 18, width: "100%" }}>
          {employees.map((emp: any) => (
            <View
              key={emp.id}
              style={{ flex: 1, backgroundColor: emp.color ?? "#94A3B8", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
            >
              <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: "700", color: "#fff", paddingHorizontal: 4, letterSpacing: 0.2 }}>
                {(emp.full_name ?? emp.email ?? "?").split(" ")[0]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className={`flex-row items-stretch gap-2.5 ${cardPadding}`}>
        {(!item.time_tbd || computedDurationLabel) && (
          <View
            className={`items-center justify-center ${compact ? "w-10" : "w-12"}`}
            style={{ borderRadius: 12, backgroundColor: typeConfig.bg }}
          >
            {item.time_tbd ? (
              <Text style={{ color: typeConfig.text }} className={`font-bold ${compact ? "text-xs" : "text-sm"}`}>
                ~{computedDurationLabel}
              </Text>
            ) : (
              <>
                <Text style={{ color: typeConfig.text }} className={`font-bold ${compact ? "text-xs" : "text-sm"}`}>
                  {startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}
                </Text>
                {!compact && (
                  <Text className="text-[9px] text-muted-foreground mt-0.5 font-medium">
                    {endTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}
                  </Text>
                )}
                {!compact && item.type && item.type !== "intervention" && (
                  <Text style={{ color: typeConfig.text }} className="text-[8px] font-bold uppercase mt-0.5 tracking-wide">
                    {typeConfig.label}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        <View className="flex-1 justify-center">
          <Text
            className={`font-extrabold text-foreground dark:text-white ${compact ? "text-sm" : "text-base"}`}
            numberOfLines={compact ? 1 : 2}
          >
            {hasClient && item.client?.address ? item.client.address : item.title}
          </Text>
          {hasClient && item.client?.address && (
            <>
              <Text className={`text-muted-foreground dark:text-slate-400 font-medium ${compact ? "text-[10px]" : "text-xs"} mt-0.5`} numberOfLines={1}>
                {item.title}
              </Text>
              {item.client?.name && (
                <Text className="text-muted-foreground dark:text-slate-400 text-[10px]" numberOfLines={1}>
                  {item.client.name}
                </Text>
              )}
            </>
          )}
          {hasClient && !item.client?.address && item.client?.name && (
            <Text className={`text-muted-foreground dark:text-slate-400 font-medium ${compact ? "text-[10px]" : "text-xs"} mt-0.5`} numberOfLines={1}>
              {item.client.name}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );

  if (leftBarColor) {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ width: 6, borderRadius: 3, backgroundColor: leftBarColor }} />
        {card}
      </View>
    );
  }
  return card;
});
