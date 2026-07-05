import React, { useState } from "react";
import { View, Pressable, TextInput, Text, useWindowDimensions } from "react-native";

export type WeekdayHoursPickerProps = {
  value: Record<string, number>; // clés "1".."5", 1=lundi..5=vendredi
  onChange: (value: Record<string, number>) => void;
  isDark?: boolean;
  disabled?: boolean;
};

const DAYS = [
  { key: "1", label: "L", full: "Lundi" },
  { key: "2", label: "M", full: "Mardi" },
  { key: "3", label: "M", full: "Mercredi" },
  { key: "4", label: "J", full: "Jeudi" },
  { key: "5", label: "V", full: "Vendredi" },
];

const ACTIVE_COLOR = "#3B82F6";

export function WeekdayHoursPicker({ value, onChange, isDark = false, disabled }: WeekdayHoursPickerProps) {
  const [activeDay, setActiveDay] = useState<string>("1");
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const inactiveBg = isDark ? "#1E293B" : "#E2E8F0";
  const inactiveText = isDark ? "#94A3B8" : "#334155";
  const inactiveSubText = isDark ? "#64748B" : "#64748B";
  const inputBorder = isDark ? "#334155" : "#CBD5E1";
  const inputText = isDark ? "#FFFFFF" : "#0F172A";
  const totalText = isDark ? "#64748B" : "#94A3B8";

  const currentHours = value[activeDay] ?? 0;

  const handleHoursChange = (text: string) => {
    const cleaned = text.replace(",", ".");
    if (cleaned === "") {
      onChange({ ...value, [activeDay]: 0 });
      return;
    }
    const num = parseFloat(cleaned);
    if (Number.isNaN(num)) return;
    onChange({ ...value, [activeDay]: Math.min(24, Math.max(0, num)) });
  };

  const total = DAYS.reduce((sum, d) => sum + (value[d.key] || 0), 0);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: isWide ? "flex-start" : "space-between",
          gap: isWide ? 14 : 0,
        }}
      >
        {DAYS.map((day) => {
          const hours = value[day.key] ?? 0;
          const isActive = day.key === activeDay;
          const hasHours = hours > 0;
          return (
            <Pressable
              key={day.key}
              onPress={() => setActiveDay(day.key)}
              disabled={disabled}
              accessibilityLabel={`${day.full}: ${hours}h`}
              style={{
                width: 48,
                height: 58,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? ACTIVE_COLOR : inactiveBg,
                opacity: hasHours || isActive ? 1 : 0.55,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: isActive ? "#fff" : inactiveText }}>
                {day.label}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: isActive ? "#DBEAFE" : inactiveSubText,
                  marginTop: 2,
                }}
              >
                {hasHours ? `${hours}h` : "-"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: inactiveText }}>
          Heures le {DAYS.find((d) => d.key === activeDay)?.full}
        </Text>
        <TextInput
          value={currentHours === 0 ? "" : String(currentHours)}
          onChangeText={handleHoursChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
          editable={!disabled}
          style={{
            borderWidth: 1,
            borderColor: inputBorder,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            width: 80,
            textAlign: "center",
            fontSize: 15,
            fontWeight: "600",
            color: inputText,
          }}
        />
      </View>

      <Text style={{ fontSize: 12, color: totalText }}>Total semaine : {total}h</Text>
    </View>
  );
}
