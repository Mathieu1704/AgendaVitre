import React from "react";
import { View, Text, ViewProps, TextProps, Platform } from "react-native";
import { cn } from "../cn";
import { useTheme } from "./ThemeToggle";

export function Card({ className, style, ...props }: ViewProps) {
  const { isDark } = useTheme();
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
        "dark:bg-slate-900 dark:border-slate-800",
        className,
      )}
      style={[
        Platform.OS !== "web"
          ? {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              borderColor: isDark ? "#1E293B" : "#E4E4E7",
            }
          : {},
        style,
      ]}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn("flex flex-col space-y-1.5", className)} {...props} />
  );
}
export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        "text-foreground dark:text-white",
        className,
      )}
      {...props}
    />
  );
}
export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("", className)} {...props} />;
}
