import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { RawCalendarEvent } from "../../../types";

interface RawEventCardProps {
  item: RawCalendarEvent;
  compact?: boolean;
  date: string;
}

export const RawEventCard = React.memo(function RawEventCard({
  item,
  compact = false,
  date,
}: RawEventCardProps) {
  const router = useRouter();

  const startTime = new Date(item.start_time);
  const endTime = new Date(item.end_time);
  const firstEmp = item.assigned_employees?.[0] ?? item.employee;
  const employeeColor = firstEmp?.color ?? "#94A3B8";

  return (
    <Pressable
      onPress={() => router.push(`/(app)/calendar/raw-event/${item.id}?date=${date}` as any)}
      className="mb-2 active:scale-[0.98]"
      style={{
        borderRadius: compact ? 10 : 18,
        borderWidth: 1.5,
        borderColor: employeeColor + "55",
        backgroundColor: employeeColor + "11",
        padding: compact ? 7 : 12,
      }}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={`items-center justify-center ${compact ? "w-9" : "w-16"} py-2 rounded-xl`}
          style={{ backgroundColor: employeeColor + "22" }}
        >
          <Text
            className={`font-bold ${compact ? "text-[9px]" : "text-sm"}`}
            style={{ color: employeeColor }}
          >
            {startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}
          </Text>
          {!compact && (
            <Text className="text-[9px] text-muted-foreground mt-0.5 font-medium">
              {endTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className={`font-bold text-foreground dark:text-white flex-1 ${compact ? "text-[10px]" : "text-sm"}`}
              numberOfLines={1}
            >
              {item.summary}
            </Text>
            <View className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
              <Text className="text-[7px] font-bold text-slate-500 dark:text-slate-300 uppercase">RAW</Text>
            </View>
          </View>
          {!compact && (item.location || item.description) ? (
            <View className="flex-row items-center gap-1 mt-0.5 opacity-70">
              {item.location && <MapPin size={10} color="#64748B" />}
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {item.location || item.description}
              </Text>
            </View>
          ) : null}
          {item.assigned_employees && item.assigned_employees.length > 1 && (
            <View className="flex-row mt-1">
              {item.assigned_employees.slice(0, 4).map((emp) => (
                <View
                  key={emp.id}
                  className="w-4 h-4 rounded-full items-center justify-center border border-white"
                  style={{ backgroundColor: emp.color, marginRight: -4 }}
                >
                  <Text className="text-[6px] text-white font-bold">{emp.full_name?.[0] ?? "?"}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});
