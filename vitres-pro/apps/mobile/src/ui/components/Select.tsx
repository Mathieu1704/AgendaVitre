import React, { useState, useMemo, useCallback } from "react";
import { Pressable, Text, View, ViewStyle, StyleProp, FlatList, TextInput, Platform, useWindowDimensions } from "react-native";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../cn";
import { ChevronDown, Search } from "lucide-react-native";
import { useTheme } from "./ThemeToggle";

export function Select<T extends { id: string; label: string }>({
  value,
  onChange,
  items,
  placeholder = "Sélectionner...",
  title = "Choisir",
  className,
  style,
  containerStyle,
  label,
  searchable = true,
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: T[];
  placeholder?: string;
  title?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  label?: string;
  searchable?: boolean;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const { isDark } = useTheme();
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

  const ITEM_HEIGHT = 50;

  const renderItem = useCallback(({ item: it }: { item: T }) => {
    const active = value?.id === it.id;
    return (
      <Pressable
        key={it.id}
        onPress={() => { onChange(it); handleClose(); }}
        style={{
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 13,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: active ? "#3B82F6" : isDark ? "#334155" : "#E2E8F0",
          backgroundColor: active ? (isDark ? "#1E3A5F" : "#EFF6FF") : (isDark ? "#1E293B" : "#FFFFFF"),
          height: ITEM_HEIGHT,
          justifyContent: "center",
        }}
      >
        <Text style={{ fontWeight: "500", fontSize: 16, color: active ? "#3B82F6" : isDark ? "#F8FAFC" : "#09090B" }} numberOfLines={1}>
          {it.label}
        </Text>
      </Pressable>
    );
  }, [value?.id, isDark, onChange]);

  return (
    // ✅ 3. On l'applique sur la View parente
    <View style={[{ gap: 6, width: "100%" }, containerStyle]}>
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
          {searchable && <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: searchFocused ? "#3B82F6" : isDark ? "#334155" : "#E2E8F0",
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
              backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
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
                { flex: 1, height: 40, paddingHorizontal: 8, color: isDark ? "#F1F5F9" : "#0f172a", fontSize: 15 },
                Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
              ]}
            />
          </View>}

          <FlatList
            data={filteredItems}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            getItemLayout={(_, index) => ({ length: ITEM_HEIGHT + 8, offset: (ITEM_HEIGHT + 8) * index, index })}
            style={{ maxHeight: Math.min(320, screenHeight * 0.4) }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={16}
            windowSize={5}
            ListEmptyComponent={
              <Text style={{ textAlign: "center", color: "#94A3B8", paddingVertical: 16 }}>
                Aucun résultat
              </Text>
            }
          />

          <Button variant="ghost" onPress={handleClose} style={{ marginTop: 8 }}>
            Fermer
          </Button>
        </View>
      </Dialog>
    </View>
  );
}
