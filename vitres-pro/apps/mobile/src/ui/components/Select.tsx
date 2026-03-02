import React, { useState, useMemo } from "react";
import { Pressable, Text, View, ViewStyle, StyleProp, ScrollView, TextInput, Platform } from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";
import { ChevronDown, Search } from "lucide-react-native";

export function Select<T extends { id: string; label: string }>({
  value,
  onChange,
  items,
  placeholder = "Sélectionner...",
  title = "Choisir",
  className,
  style,
  containerStyle, // ✅ 1. On récupère la prop
  label,
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: T[];
  placeholder?: string;
  title?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>; // ✅ 2. On la type
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, search]);

  const handleClose = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    // ✅ 3. On l'applique sur la View parente
    <View className="gap-1.5 w-full" style={containerStyle}>
      {label && (
        <Text className="text-sm font-semibold text-foreground dark:text-white">
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setOpen(true)}
        style={[{ borderRadius: 16, overflow: "hidden" }, style]}
        className={cn(
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

      <Dialog open={open} onClose={handleClose} position="center">
        <View className="p-5">
          <Text className="text-lg font-bold mb-3 text-foreground dark:text-white text-center">
            {title}
          </Text>

          {/* Champ de recherche */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: searchFocused ? "#3B82F6" : "#E2E8F0",
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
              backgroundColor: "#F8FAFC",
            }}
          >
            <Search size={16} color={searchFocused ? "#3B82F6" : "#94A3B8"} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Rechercher..."
              placeholderTextColor="#94A3B8"
              style={[
                { flex: 1, height: 40, paddingHorizontal: 8, color: "#0f172a", fontSize: 15 },
                Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
              ]}
            />
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            <View className="gap-2 pb-1">
              {filteredItems.map((it) => {
                const active = value?.id === it.id;
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => {
                      onChange(it);
                      handleClose();
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
              {filteredItems.length === 0 && (
                <Text className="text-center text-muted-foreground py-4">
                  Aucun résultat
                </Text>
              )}
            </View>
          </ScrollView>

          <Button variant="ghost" onPress={handleClose} style={{ marginTop: 8 }}>
            Fermer
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
