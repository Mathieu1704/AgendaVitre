import React, { useState } from "react";
import { Pressable, Text, View, ViewStyle, StyleProp } from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";
import { ChevronDown } from "lucide-react-native";

export function Select<T extends { id: string; label: string }>({
  value,
  onChange,
  items,
  placeholder = "Sélectionner...",
  title = "Choisir",
  className,
  style,
  label,
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: T[];
  placeholder?: string;
  title?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-1.5 w-full">
      {label && (
        // ✅ SUPPRESSION de ml-1
        <Text className="text-sm font-semibold text-foreground dark:text-white">
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setOpen(true)}
        style={[{ borderRadius: 16, overflow: "hidden" }, style]}
        className={cn(
          // ✅ PASSAGE à h-12
          "h-12 flex-row items-center justify-between px-4 border",
          "bg-background border-border",
          "dark:bg-slate-900 dark:border-slate-700",
          "active:opacity-80",
          className,
        )}
      >
        <Text
          className={cn(
            "text-base flex-1",
            value
              ? "text-foreground dark:text-white font-medium"
              : "text-muted-foreground",
          )}
          numberOfLines={1}
        >
          {value ? value.label : placeholder}
        </Text>
        <ChevronDown size={18} color="#94A3B8" />
      </Pressable>

      <Dialog open={open} onClose={() => setOpen(false)} position="center">
        <View className="p-5">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            {title}
          </Text>

          <View className="gap-2 mb-4">
            {items.map((it) => {
              const active = value?.id === it.id;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => {
                    onChange(it);
                    setOpen(false);
                  }}
                  style={{ borderRadius: 12 }}
                  className={cn(
                    "px-4 py-3 border",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border dark:border-slate-700 bg-background dark:bg-slate-800",
                  )}
                >
                  <Text
                    className={cn(
                      "font-medium text-base",
                      active
                        ? "text-primary"
                        : "text-foreground dark:text-white",
                    )}
                  >
                    {it.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button variant="ghost" onPress={() => setOpen(false)}>
            Fermer
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
