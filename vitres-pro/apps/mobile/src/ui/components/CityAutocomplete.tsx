import React, { useRef, useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Portal } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useTheme } from "./ThemeToggle";

function useCities(): string[] {
  const { data } = useQuery<string[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/api/settings/zones/cities")).data,
    staleTime: 10 * 60 * 1000,
  });
  return data ?? [];
}

interface DropdownPos { top: number; left: number; width: number }

interface CityAutocompleteProps {
  value: string;
  onChangeText: (v: string) => void;
  children: (props: {
    onChangeText: (v: string) => void;
    onFocus: () => void;
    onBlur: () => void;
    inputRef: React.RefObject<any>;
  }) => React.ReactNode;
}

export function CityAutocomplete({ value, onChangeText, children }: CityAutocompleteProps) {
  const { isDark } = useTheme();
  const cities = useCities();
  const inputRef = useRef<any>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = value.toLowerCase();
    return cities.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 6);
  }, [value, cities]);

  const measure = useCallback(() => {
    inputRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w > 0) setPos({ top: y + h + 4, left: x, width: w });
    });
  }, []);

  const handleFocus = useCallback(() => {
    setTimeout(measure, 50);
    setShow(true);
  }, [measure]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setShow(false), 150);
  }, []);

  const handleChangeText = useCallback((v: string) => {
    onChangeText(v);
    measure();
    setShow(true);
  }, [onChangeText, measure]);

  const handleSelect = useCallback((city: string) => {
    onChangeText(city);
    setShow(false);
  }, [onChangeText]);

  const visible = show && suggestions.length > 0 && pos !== null;

  return (
    <>
      {children({ onChangeText: handleChangeText, onFocus: handleFocus, onBlur: handleBlur, inputRef })}
      {visible && pos && (
        <Portal>
          <Pressable style={{ position: "absolute", inset: 0 } as any} onPress={() => setShow(false)}>
            <View
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isDark ? "#334155" : "#E2E8F0",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="always"
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: isDark ? "#334155" : "#F1F5F9",
                    }}
                  >
                    <Text style={{ fontSize: 15, color: isDark ? "#F8FAFC" : "#09090B" }}>{item}</Text>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Portal>
      )}
    </>
  );
}
