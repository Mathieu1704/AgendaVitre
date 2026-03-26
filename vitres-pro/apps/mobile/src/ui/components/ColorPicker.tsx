import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Check, Palette } from "lucide-react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

// Palette étendue avec 40 couleurs
const COLOR_PALETTE = [
  "#3B82F6",
  "#60A5FA",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF", // Bleus
  "#10B981",
  "#059669",
  "#047857",
  "#065F46", // Verts
  "#F59E0B",
  "#FBBF24",
  "#F97316",
  "#FB923C",
  "#EA580C", // Oranges
  "#EF4444",
  "#F87171",
  "#DC2626",
  "#EC4899",
  "#F472B6", // Rouges
  "#8B5CF6",
  "#A78BFA",
  "#7C3AED",
  "#6366F1",
  "#818CF8", // Violets
  "#14B8A6",
  "#2DD4BF",
  "#06B6D4",
  "#22D3EE",
  "#0891B2", // Cyans
  "#6B7280",
  "#9CA3AF",
  "#4B5563",
  "#374151",
  "#1F2937", // Gris
  "#92400E",
  "#B45309",
  "#D97706",
  "#78350F",
  "#451A03", // Marrons
  "#84CC16",
  "#A3E635",
  "#6EE7B7",
  "#34D399", // Lime
  "#D946EF",
  "#E879F9",
  "#C026D3",
  "#A21CAF",
  "#86198F", // Fuchsia
];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  usedColors?: string[];
}

export function ColorPicker({
  selectedColor,
  onColorChange,
  label = "Couleur",
  containerStyle,
  usedColors = [],
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={[{ gap: 6, width: "100%" }, containerStyle]}>
        <Text className="text-sm font-semibold text-foreground dark:text-white">
          {label}
        </Text>

        {/* ✅ INPUT STYLE : h-12 (48px) et rounded-[16px] pour matcher l'Input */}
        <Pressable
          onPress={() => setOpen(true)}
          className="h-12 flex-row items-center justify-between px-4 rounded-[16px] border border-border dark:border-slate-700 bg-background dark:bg-slate-900"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{ backgroundColor: selectedColor }}
              className="w-5 h-5 rounded-full border border-white/50 shadow-sm"
            />
            <Text className="text-foreground dark:text-white text-base">
              Choisir une couleur
            </Text>
          </View>
          <Palette size={18} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Dialog avec palette complète */}
      <Dialog open={open} onClose={() => setOpen(false)} position="center">
        <View className="p-2">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Sélectionner une couleur
          </Text>

          <ScrollView style={{ maxHeight: 400 }}>
            <View className="flex-row flex-wrap gap-2 justify-center">
              {COLOR_PALETTE.map((color, index) => {
                const isSelected = selectedColor === color;
                const isUsed = usedColors.includes(color) && !isSelected;
                return (
                  <Pressable
                    key={`${color}-${index}`}
                    onPress={() => {
                      if (isUsed) return;
                      onColorChange(color);
                      setOpen(false);
                    }}
                    style={{
                      backgroundColor: color,
                      width: 48, height: 48, borderRadius: 24,
                      alignItems: "center", justifyContent: "center",
                      opacity: isUsed ? 0.25 : 1,
                    }}
                  >
                    {isSelected && <Check size={20} color="white" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Button
            variant="ghost"
            onPress={() => setOpen(false)}
            className="mt-4 rounded-[16px]"
          >
            Fermer
          </Button>
        </View>
      </Dialog>
    </>
  );
}
