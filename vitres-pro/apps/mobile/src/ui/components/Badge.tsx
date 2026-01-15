import React from "react";
import { Text, View } from "react-native";
import { cn } from "../cn";

export function Badge({
  label,
  tone = "default",
  className,
}: {
  label: string;
  tone?: "default" | "success" | "warning";
  className?: string;
}) {
  const toneCls =
    tone === "success"
      ? "bg-green-500/15 border-green-500/30"
      : tone === "warning"
      ? "bg-orange-500/15 border-orange-500/30"
      : "bg-primary/15 border-primary/30";

  const textCls =
    tone === "success"
      ? "text-green-600"
      : tone === "warning"
      ? "text-orange-600"
      : "text-primary";

  return (
    <View className={cn("px-3 py-1 rounded-full border", toneCls, className)}>
      <Text className={cn("text-xs font-semibold", textCls)}>{label}</Text>
    </View>
  );
}
