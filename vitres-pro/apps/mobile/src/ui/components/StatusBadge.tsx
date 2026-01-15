import React from "react";
import { Text, View } from "react-native";
import { cn } from "../../lib/utils";
// On type pour matcher ton backend
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
      style: "bg-blue-50 border-blue-200",
      textStyle: "text-blue-700",
    },
    in_progress: {
      label: "En cours",
      style: "bg-orange-50 border-orange-200",
      textStyle: "text-orange-700",
    },
    done: {
      label: "Terminée",
      style: "bg-green-50 border-green-200",
      textStyle: "text-green-700",
    },
  };

  const config = configs[status] || configs.planned;

  return (
    <View
      className={cn(
        "border px-2.5 py-1 rounded-full self-start",
        config.style,
        className
      )}
    >
      <Text
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide",
          config.textStyle
        )}
      >
        {config.label}
      </Text>
    </View>
  );
};
