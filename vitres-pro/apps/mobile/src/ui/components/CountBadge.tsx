import React from "react";
import { Text, View, ViewStyle } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

/** Pastille rouge avec un nombre, comme sur l'onglet Alertes. Rien si 0. */
export function CountBadge({ count, style }: { count: number; style?: ViewStyle }) {
  if (count <= 0) return null;
  return (
    <Animated.View
      entering={ZoomIn.duration(200)}
      exiting={ZoomOut.duration(150)}
      style={[
        {
          minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
          backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>{count > 99 ? "99+" : count}</Text>
    </Animated.View>
  );
}
