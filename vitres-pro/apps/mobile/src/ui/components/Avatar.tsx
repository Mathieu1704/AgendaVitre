import React from "react";
import { View, Text } from "react-native";
import { cn } from "../cn";

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <View
      className={cn(
        "rounded-full bg-primary items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      <Text className={cn("font-bold text-white", textSizes[size])}>
        {initials}
      </Text>
    </View>
  );
}
