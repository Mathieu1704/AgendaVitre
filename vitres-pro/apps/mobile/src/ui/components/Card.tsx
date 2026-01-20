import React from "react";
import { View, Text, ViewProps, TextProps } from "react-native";
import { cn } from "../cn";

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        "dark:bg-slate-900 dark:border-slate-800",
        className,
      )}
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
