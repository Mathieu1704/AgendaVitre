import React, { useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
  name: string;
  address: string;
  phone?: string;
  email?: string;
};

export default function ClientsListScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

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
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const renderItem = ({ item }: { item: Client }) => (
    <Pressable
      onPress={() => router.push(`/(app)/clients/${item.id}` as any)}
      className="mx-4 mb-3"
    >
      <Card className="active:scale-[0.99] transition-transform">
        <View className="p-4">
          <View className="flex-row items-center">
            <Avatar name={item.name} size="md" />

            <View className="ml-4 flex-1">
              <Text className="text-base font-bold text-foreground dark:text-white mb-1">
                {item.name}
              </Text>

              <View className="flex-row items-center">
                <MapPin size={12} color={isDark ? "#94A3B8" : "#64748B"} />
                <Text
                  className="ml-1.5 text-xs text-muted-foreground dark:text-slate-400"
                  numberOfLines={1}
                >
                  {item.address}
                </Text>
              </View>
            </View>

            <ChevronRight size={18} color={isDark ? "#475569" : "#CBD5E1"} />
          </View>

          {/* Contact Info Footer (si dispo) */}
          {(item.phone || item.email) && (
            <View className="mt-3 pt-3 border-t border-border dark:border-slate-800 flex-row gap-4">
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
  );

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header avec Recherche */}
      <View className="px-6 pt-6 pb-4 bg-background dark:bg-slate-950 z-10">
        <Text className="text-3xl font-bold text-foreground dark:text-white mb-4">
          Clients
        </Text>

        <View className="flex-row items-center bg-muted/50 dark:bg-slate-900 border border-transparent focus:border-primary rounded-xl px-3 h-12">
          <Search size={18} color="#94A3B8" />
          <TextInput
            placeholder="Rechercher un client..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-foreground dark:text-white text-base h-full"
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
          showsVerticalScrollIndicator={false}
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
        className="absolute bottom-6 right-6 h-14 w-14 bg-primary rounded-2xl items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform"
      >
        <Plus size={28} color="white" />
      </Pressable>
    </View>
  );
}
