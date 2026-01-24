import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";

export function Select<T extends { id: string; label: string }>({
  value,
  onChange,
  items,
  placeholder = "Sélectionner…",
  title = "Choisir",
  // ✅ AJOUTS
  className,
  style,
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: T[];
  placeholder?: string;
  title?: string;
  // ✅ TYPES
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onPress={() => setOpen(true)}
        // ✅ ON PASSE LE CLASSNAME ET LE STYLE ICI
        className={cn("justify-between h-11", className)}
        style={style}
      >
        <View className="flex-1 flex-row items-center justify-between">
          <Text
            className={cn(
              "text-base",
              value
                ? "text-foreground dark:text-white font-medium"
                : "text-muted-foreground",
            )}
          >
            {value ? value.label : placeholder}
          </Text>
          <Text className="text-muted-foreground ml-2">▾</Text>
        </View>
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} position="center">
        {/* Le reste ne change pas */}
        <View className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5">
          <Text className="text-lg font-bold mb-3 text-foreground dark:text-white">
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
                  className={cn(
                    "px-4 py-3 rounded-lg border",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border dark:border-slate-700 bg-background dark:bg-slate-800",
                  )}
                >
                  <Text
                    className={cn(
                      "font-medium",
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
    </>
  );
}
