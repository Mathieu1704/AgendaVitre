import React, { useState, useCallback, useEffect, useRef } from "react";
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
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Users,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Card } from "../../../src/ui/components/Card";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

type Client = {
  id: string;
  name: string | null;
  address: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function ClientsListScreen() {
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

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients");
      return res.data as Client[];
    },
  });

  // Filtrage local pour la recherche
  const filteredClients =
    clients?.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        (c.address ?? "").toLowerCase().includes(debouncedQuery.toLowerCase()),
    ) || [];

  const renderItem = useCallback(
    ({ item }: { item: Client }) => (
      <Pressable
        onPress={() => router.push(`/(app)/clients/${item.id}` as any)}
        className="mx-4 mb-3"
      >
        <Card className="active:scale-[0.99] transition-transform rounded-[32px] overflow-hidden">
          <View className="p-5">
            <View className="flex-row items-center">
              <Avatar name={item.name || item.address || "?"} size="md" />

              <View className="ml-4 flex-1">
                <Text className="text-base font-bold text-foreground dark:text-white mb-1">
                  {item.name || item.city || "Client anonyme"}
                </Text>

                {item.address && (
                  <View className="flex-row items-center">
                    <MapPin size={12} color={isDark ? "#94A3B8" : "#64748B"} />
                    <Text
                      className="ml-1.5 text-xs text-muted-foreground dark:text-slate-400"
                      numberOfLines={1}
                    >
                      {item.address}
                    </Text>
                  </View>
                )}
              </View>

              <ChevronRight size={18} color={isDark ? "#475569" : "#CBD5E1"} />
            </View>

            {/* Contact Info Footer (si dispo) */}
            {(item.phone || item.email) && (
              <View className="mt-3 pt-3 dark:border-slate-800 flex-row gap-4 ml-6">
                {item.phone && (
                  <View className="flex-row items-center">
                    <Phone size={12} color="#3B82F6" />
                    <Text className="ml-2 text-xs text-foreground dark:text-slate-300">
                      {item.phone}
                    </Text>
                  </View>
                )}
                {item.email && (
                  <View className="flex-row items-center">
                    <Mail size={12} color="#3B82F6" />
                    <Text
                      className="ml-2 text-xs text-foreground dark:text-slate-300"
                      numberOfLines={1}
                    >
                      {item.email}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </Card>
      </Pressable>
    ),
    [isDark, router],
  );

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
          Clients
        </Text>

        {/* 2. CORRECTION ICI : Remplacement du bloc de recherche */}
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              height: 48,
              paddingHorizontal: 16,
              borderRadius: 9999, // Force l'arrondi (pilule)
              borderWidth: 1.5, // Épaisseur de la bordure
              backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
              // La couleur de bordure change selon le focus
              borderColor: isSearchFocused
                ? "#3B82F6"
                : isDark
                  ? "transparent"
                  : "#E2E8F0",
            },
          ]}
        >
          <Search size={18} color={isSearchFocused ? "#3B82F6" : "#94A3B8"} />
          <TextInput
            placeholder="Rechercher un client..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            // Met à jour l'état quand l'utilisateur clique dedans ou clique ailleurs
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
              // 🚨 Tue le rectangle bleu natif des navigateurs
              Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
            ]}
          />
        </View>
      </View>

      {/* Liste */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : filteredClients.length > 0 ? (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={Platform.OS !== "web"}
          indicatorStyle="black"
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
        />
      ) : (
        <View className="flex-1 justify-center items-center px-10">
          <View className="bg-muted/30 dark:bg-slate-900 p-6 rounded-full mb-4">
            <Users size={48} color={isDark ? "#475569" : "#CBD5E1"} />
          </View>
          <Text className="text-xl font-bold text-foreground dark:text-white text-center">
            Aucun client trouvé
          </Text>
          <Text className="mt-2 text-center text-muted-foreground dark:text-slate-500">
            {searchQuery
              ? "Essaie une autre recherche."
              : "Commence par ajouter ton premier client."}
          </Text>
        </View>
      )}

      {/* FAB (Bouton Ajouter) */}
      <Pressable
        onPress={() => router.push("/(app)/clients/add")}
        className="absolute right-6 h-14 w-14 bg-primary rounded-full items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-transform"
        style={{ bottom: Math.max(insets.bottom, 24) }}
      >
        <Plus size={28} color="white" />
      </Pressable>
    </View>
  );
}
