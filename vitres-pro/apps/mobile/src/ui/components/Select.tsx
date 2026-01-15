import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";

export function Select<T extends { id: string; label: string }>({
  value,
  onChange,
  items,
  placeholder = "Sélectionner…",
  title = "Choisir",
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: T[];
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onPress={() => setOpen(true)}
        className="justify-between"
      >
        <View className="flex-1 flex-row items-center justify-between">
          <Text className={cn("font-semibold", value ? "" : "opacity-60")}>
            {value ? value.label : placeholder}
          </Text>
          <Text className="opacity-50">▾</Text>
        </View>
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} position="bottom">
        <Text className="text-lg font-extrabold mb-3">{title}</Text>

        <ScrollView style={{ maxHeight: 420 }}>
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
                  "px-4 py-3 rounded-xl border mb-2",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border dark:border-border-dark"
                )}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.99 : 1 }] },
                ]}
              >
                <Text className="font-bold">{it.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button variant="ghost" onPress={() => setOpen(false)} className="mt-2">
          Fermer
        </Button>
      </Dialog>
    </>
  );
}
