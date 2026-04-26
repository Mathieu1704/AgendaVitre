import React, { useRef, useState, useMemo, useCallback } from "react";
import { Modal, View, Text, Pressable, FlatList, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useTheme } from "./ThemeToggle";

function useCities() {
  const { data } = useQuery<string[]>({
    queryKey: ["cities"],
    queryFn: async () => (await api.get("/api/settings/zones/cities")).data,
    staleTime: 10 * 60 * 1000,
  });
  return data ?? [];
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = value.toLowerCase();
    return cities.filter((c) => c.toLowerCase().startsWith(q)).slice(0, 6);
  }, [value, cities]);

  const measureInput = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
      setPos({ top: y + height + 4, left: x, width });
    });
  }, []);

  const handleFocus = useCallback(() => {
    measureInput();
    setShowDropdown(true);
  }, [measureInput]);

  const handleBlur = useCallback(() => {
    setTimeout(() => setShowDropdown(false), 150);
  }, []);

  const handleChangeText = useCallback((v: string) => {
    onChangeText(v);
    measureInput();
    setShowDropdown(true);
  }, [onChangeText, measureInput]);

  const handleSelect = useCallback((city: string) => {
    onChangeText(city);
    setShowDropdown(false);
  }, [onChangeText]);

  const visible = showDropdown && suggestions.length > 0 && pos !== null;

  return (
    <>
      {children({ onChangeText: handleChangeText, onFocus: handleFocus, onBlur: handleBlur, inputRef })}
      {Platform.OS === "web" ? (
        visible && pos && (
          <View
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
              backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? "#334155" : "#E4E4E7",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            }}
          >
            {suggestions.map((city, i) => (
              <Pressable
                key={city}
                onPress={() => handleSelect(city)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: isDark ? "#334155" : "#F1F5F9",
                }}
              >
                <Text style={{ fontSize: 15, color: isDark ? "#F8FAFC" : "#09090B" }}>{city}</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : (
        <Modal
          visible={visible}
          transparent
          animationType="none"
          onRequestClose={() => setShowDropdown(false)}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setShowDropdown(false)}>
            {pos && (
              <View
                style={{
                  position: "absolute",
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#334155" : "#E4E4E7",
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
            )}
          </Pressable>
        </Modal>
      )}
    </>
  );
}
