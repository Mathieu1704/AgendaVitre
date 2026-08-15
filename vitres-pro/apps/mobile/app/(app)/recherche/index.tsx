import React, { useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, History } from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

const formatSearchResultDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

type InterventionSearchResult = {
  id: string;
  title: string;
  start_time: string;
  price_estimated: number | null;
  client: { id: string; name: string | null } | null;
};

export default function RechercheScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Historique des interventions assignées à l'utilisateur courant
  // correspondant à la recherche (nom, adresse, téléphone) — le filtrage par
  // employé assigné + zone est déjà appliqué côté backend pour ce rôle.
  const { data: matchingInterventions, isFetching: isSearchingHistory } =
    useQuery({
      queryKey: ["interventions-search", debouncedQuery],
      queryFn: async () => {
        const res = await api.get("/api/interventions/search", {
          params: { q: debouncedQuery },
        });
        return res.data as InterventionSearchResult[];
      },
      enabled: debouncedQuery.trim().length >= 2,
    });

  const hasQuery = debouncedQuery.trim().length >= 2;
  const results = matchingInterventions ?? [];

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: isWeb ? 0 : insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <View
        className="px-6 pb-4 bg-background dark:bg-slate-950 z-10"
        style={{ paddingTop: isWeb ? 24 : 10 }}
      >
        <Text className="text-3xl font-bold text-foreground dark:text-slate-50 mb-4">
          Recherche
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            paddingHorizontal: 16,
            borderRadius: 9999,
            borderWidth: 1.5,
            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
            borderColor: isSearchFocused
              ? "#3B82F6"
              : isDark
                ? "transparent"
                : "#E2E8F0",
          }}
        >
          <Search size={18} color={isSearchFocused ? "#3B82F6" : "#94A3B8"} />
          <TextInput
            placeholder="Rechercher une intervention..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            style={[
              {
                flex: 1,
                marginLeft: 12,
                fontSize: 16,
                height: "100%",
                color: isDark ? "#fff" : "#09090B",
              },
              Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
            ]}
          />
        </View>
      </View>

      {!hasQuery ? (
        <View className="flex-1 justify-center items-center px-10">
          <View className="bg-muted/30 dark:bg-slate-900 p-6 rounded-full mb-4">
            <Search size={48} color={isDark ? "#475569" : "#CBD5E1"} />
          </View>
          <Text className="text-xl font-bold text-foreground dark:text-white text-center">
            Recherche tes interventions
          </Text>
          <Text className="mt-2 text-center text-muted-foreground dark:text-slate-500">
            Tape un nom, une adresse ou un numéro de téléphone.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={Platform.OS !== "web"}
          ListHeaderComponent={
            <View className="flex-row items-center mb-3 mt-2">
              <History size={16} color={isDark ? "#94A3B8" : "#64748B"} />
              <Text className="ml-2 text-sm font-semibold text-foreground dark:text-white">
                Historique des passages
              </Text>
              {isSearchingHistory && (
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />
              )}
            </View>
          }
          ListEmptyComponent={
            !isSearchingHistory ? (
              <Text className="text-xs text-muted-foreground dark:text-slate-500 mb-2">
                Aucune intervention correspondante.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/calendar/${item.id}` as any)}
              className="mb-2 active:opacity-70"
            >
              <View
                className="p-4 bg-muted/40 dark:bg-slate-900"
                style={{ borderRadius: 16 }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-semibold text-primary">
                    {formatSearchResultDate(item.start_time)}
                  </Text>
                  {item.price_estimated != null && (
                    <Text className="text-xs font-semibold text-foreground dark:text-white">
                      {item.price_estimated.toFixed(2)} €
                    </Text>
                  )}
                </View>
                <Text
                  className="text-sm text-foreground dark:text-slate-200"
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.client?.name && (
                  <Text className="mt-1 text-xs text-muted-foreground dark:text-slate-500">
                    {item.client.name}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
