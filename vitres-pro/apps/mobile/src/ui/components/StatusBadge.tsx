import React from "react";
import { Text, View } from "react-native";
import { cn } from "../../lib/utils";

type Status = "planned" | "in_progress" | "done" | string;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const configs: Record<
    string,
    { label: string; style: string; textStyle: string }
  > = {
    planned: {
      label: "Planifiée",
      style: "bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-700",
      textStyle: "text-blue-700 dark:text-blue-300",
    },
    in_progress: {
      label: "En cours",
      style: "bg-orange-50 border-orange-200 dark:bg-orange-900/40 dark:border-orange-700",
      textStyle: "text-orange-700 dark:text-orange-300",
    },
    done: {
      label: "Terminée",
      style: "bg-green-50 border-green-200 dark:bg-green-900/40 dark:border-green-700",
      textStyle: "text-green-700 dark:text-green-300",
    },
  };

  const config = configs[status] || configs.planned;

  return (
    <View
      className={cn(
        "border px-2 py-0.5 rounded-full",
        config.style,
        className
      )}
    >
      <Text
        className={cn("font-bold uppercase tracking-wide", config.textStyle)}
        style={{ fontSize: 10 }}
      >
        {config.label}
      </Text>
    </View>
  );
};
