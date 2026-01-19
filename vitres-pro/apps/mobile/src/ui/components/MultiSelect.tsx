import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";
import { Check } from "lucide-react-native";

type Item = { id: string; label: string; color?: string };

export function MultiSelect({
  items,
  selectedIds,
  onChange,
  label = "Sélectionner",
}: {
  items: Item[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedLabels = items
    .filter((i) => selectedIds.includes(i.id))
    .map((i) => i.label)
    .join(", ");

  return (
    <>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground dark:text-white ml-1">
          {label}
        </Text>
        <Button
          variant="outline"
          onPress={() => setOpen(true)}
          className="justify-between h-auto min-h-[44px] py-2"
        >
          <Text
            className={cn(
              "text-sm flex-1 mr-2",
              selectedIds.length > 0
                ? "text-foreground dark:text-white font-medium"
                : "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {selectedIds.length > 0
              ? selectedLabels
              : "Choisir les employés..."}
          </Text>
          <View className="bg-primary/10 px-2 py-0.5 rounded text-xs">
            <Text className="text-primary font-bold text-xs">
              {selectedIds.length}
            </Text>
          </View>
        </Button>
      </View>

      <Dialog open={open} onClose={() => setOpen(false)} position="bottom">
        <Text className="text-lg font-bold mb-4 text-foreground dark:text-white">
          Assigner à...
        </Text>
        <ScrollView style={{ maxHeight: 400 }}>
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                className={cn(
                  "flex-row items-center justify-between p-3 rounded-xl mb-2 border transition-all",
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-card border-border dark:border-slate-800",
                )}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-3 h-10 rounded-full"
                    style={{ backgroundColor: item.color || "#ccc" }}
                  />
                  <Text
                    className={cn(
                      "font-bold text-base",
                      isSelected
                        ? "text-primary"
                        : "text-foreground dark:text-white",
                    )}
                  >
                    {item.label}
                  </Text>
                </View>
                {isSelected && <Check size={20} color="#3B82F6" />}
              </Pressable>
            );
          })}
        </ScrollView>
        <Button onPress={() => setOpen(false)} className="mt-4">
          Valider
        </Button>
      </Dialog>
    </>
  );
}
