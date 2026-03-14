import React from "react";
import { View, Text } from "react-native";

interface Props {
  hourPx: number;
  startHour?: number;
  endHour?: number;
  isDark: boolean;
  labelWidth?: number;
}

export function TimeGridBackground({
  hourPx,
  startHour = 0,
  endHour = 24,
  isDark,
  labelWidth = 44,
}: Props) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const lineColor = isDark ? "#1E293B" : "#F1F5F9";
  const labelColor = isDark ? "#64748B" : "#94A3B8";

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="none">
      {hours.map((hour) => {
        const top = (hour - startHour) * hourPx;
        const label = hour === 0 ? "" : hour < 12 ? `${hour}h` : hour === 12 ? "12h" : `${hour}h`;
        return (
          <React.Fragment key={hour}>
            {/* Ligne heure */}
            <View
              style={{
                position: "absolute",
                top,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: lineColor,
              }}
            />
            {/* Label heure */}
            {hour > 0 && (
              <Text
                style={{
                  position: "absolute",
                  top: top - 8,
                  left: 4,
                  width: labelWidth - 8,
                  fontSize: 10,
                  color: labelColor,
                  textAlign: "right",
                }}
              >
                {label}
              </Text>
            )}
            {/* Ligne demi-heure (pointillée) */}
            <View
              style={{
                position: "absolute",
                top: top + hourPx / 2,
                left: labelWidth,
                right: 0,
                height: 1,
                backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
              }}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}
