import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Check, Palette } from "lucide-react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

// Palette étendue avec 40 couleurs
const COLOR_PALETTE = [
  // Bleus
  "#3B82F6",
  "#60A5FA",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF",
  // Verts
  "#10B981",
  "#34D399",
  "#059669",
  "#047857",
  "#065F46",
  // Oranges/Jaunes
  "#F59E0B",
  "#FBBF24",
  "#F97316",
  "#FB923C",
  "#EA580C",
  // Rouges/Roses
  "#EF4444",
  "#F87171",
  "#DC2626",
  "#EC4899",
  "#F472B6",
  // Violets/Indigos
  "#8B5CF6",
  "#A78BFA",
  "#7C3AED",
  "#6366F1",
  "#818CF8",
  // Teals/Cyans
  "#14B8A6",
  "#2DD4BF",
  "#06B6D4",
  "#22D3EE",
  "#0891B2",
  // Gris/Neutres
  "#6B7280",
  "#9CA3AF",
  "#4B5563",
  "#374151",
  "#1F2937",
  // Terre/Marron
  "#92400E",
  "#B45309",
  "#D97706",
  "#78350F",
  "#451A03",
  // Lime/Emerald
  "#84CC16",
  "#A3E635",
  "#10B981",
  "#6EE7B7",
  "#34D399",
  // Fuchsia/Purple
  "#D946EF",
  "#E879F9",
  "#C026D3",
  "#A21CAF",
  "#86198F",
];

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({
  selectedColor,
  onColorChange,
  label = "Couleur",
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View>
        <Text className="text-sm font-medium text-foreground dark:text-white mb-3">
          {label}
        </Text>

        {/* Bouton d'ouverture */}
        <Pressable
          onPress={() => setOpen(true)}
          className="h-12 flex-row items-center justify-between px-4 rounded-xl border border-border dark:border-slate-700 bg-background dark:bg-slate-900"
        >
          <View className="flex-row items-center gap-3">
            <View
              style={{ backgroundColor: selectedColor }}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
            />
            <Text className="text-foreground dark:text-white font-medium">
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
              {COLOR_PALETTE.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    onColorChange(color);
                    setOpen(false);
                  }}
                  style={{ backgroundColor: color }}
                  className={`w-12 h-12 rounded-lg items-center justify-center ${
                    selectedColor === color
                      ? "ring-2 ring-primary ring-offset-2"
                      : ""
                  }`}
                >
                  {selectedColor === color && (
                    <Check size={20} color="white" strokeWidth={3} />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Button
            variant="ghost"
            onPress={() => setOpen(false)}
            className="mt-4"
          >
            Fermer
          </Button>
        </View>
      </Dialog>
    </>
  );
}
