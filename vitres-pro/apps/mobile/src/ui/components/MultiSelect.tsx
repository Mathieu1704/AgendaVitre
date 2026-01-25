import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";
import { Check, ChevronDown } from "lucide-react-native";

type Item = { id: string; label: string; color?: string };

export function MultiSelect({
  items,
  selectedIds,
  onChange,
  label = "",
  className,
  style,
}: {
  items: Item[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
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
            "text-base flex-1 mr-2",
            selectedIds.length > 0
              ? "text-foreground dark:text-white font-medium"
              : "text-muted-foreground",
          )}
          numberOfLines={1}
        >
          {selectedIds.length > 0 ? selectedLabels : "Choisir les employés..."}
        </Text>

        <View className="flex-row items-center gap-2">
          {selectedIds.length > 0 && (
            <View className="bg-primary/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary font-bold text-xs">
                {selectedIds.length}
              </Text>
            </View>
          )}
          <ChevronDown size={18} color="#94A3B8" />
        </View>
      </Pressable>

      <Dialog open={open} onClose={() => setOpen(false)} position="bottom">
        <View className="p-5">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Assigner à...
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {items.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={{ borderRadius: 16 }}
                  className={cn(
                    "flex-row items-center justify-between p-4 mb-2 border",
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-card border-border dark:border-slate-800",
                  )}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-1 h-8 rounded-full"
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
        </View>
      </Dialog>
    </View>
  );
}
