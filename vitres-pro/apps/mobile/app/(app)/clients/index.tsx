import React from "react";
import { View, FlatList, Pressable, useWindowDimensions } from "react-native";
import {
  Text,
  Appbar,
  FAB,
  ActivityIndicator,
  Avatar,
} from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../../src/lib/api";
import { useColorScheme } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type Client = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
};

export default function ClientsListScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const {
    data: clients,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients/");
      return res.data as Client[];
    },
  });

  const renderItem = ({ item }: { item: Client }) => (
    <Pressable
      onPress={() => console.log("Détail client", item.id)}
      className={`mx-4 mb-4 rounded-2xl overflow-hidden ${
        isDark ? "bg-dark-800" : "bg-white"
      } shadow-lg active:scale-98`}
    >
      <View className="p-5">
        {/* Header avec Avatar */}
        <View className="flex-row items-center mb-4">
          <View className="bg-primary-500 w-14 h-14 rounded-full items-center justify-center">
            <Text className="text-white text-xl font-bold">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View className="ml-4 flex-1">
            <Text
              className={`text-lg font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {item.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <FontAwesome
                name="map-marker"
                size={12}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
              <Text
                className={`ml-1.5 text-xs ${
                  isDark ? "text-dark-400" : "text-gray-500"
                }`}
                numberOfLines={1}
              >
                {item.address}
              </Text>
            </View>
          </View>

          <FontAwesome
            name="chevron-right"
            size={16}
            color={isDark ? "#475569" : "#CBD5E1"}
          />
        </View>

        {/* Contacts */}
        {(item.phone || item.email) && (
          <View
            className={`pt-4 border-t ${
              isDark ? "border-dark-700" : "border-gray-100"
            }`}
          >
            {item.phone && (
              <View className="flex-row items-center mb-2">
                <View
                  className={`${
                    isDark ? "bg-dark-700" : "bg-gray-100"
                  } p-2 rounded-lg`}
                >
                  <FontAwesome name="phone" size={14} color="#3B82F6" />
                </View>
                <Text
                  className={`ml-3 ${
                    isDark ? "text-dark-300" : "text-gray-700"
                  }`}
                >
                  {item.phone}
                </Text>
              </View>
            )}

            {item.email && (
              <View className="flex-row items-center">
                <View
                  className={`${
                    isDark ? "bg-dark-700" : "bg-gray-100"
                  } p-2 rounded-lg`}
                >
                  <FontAwesome name="envelope" size={14} color="#3B82F6" />
                </View>
                <Text
                  className={`ml-3 ${
                    isDark ? "text-dark-300" : "text-gray-700"
                  }`}
                  numberOfLines={1}
                >
                  {item.email}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <View className={`flex-1 ${isDark ? "bg-dark-900" : "bg-gray-50"}`}>
      {/* Header */}
      {!isDesktop && (
        <Appbar.Header
          style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
        >
          <Appbar.Content
            title="Mes Clients"
            titleStyle={{ fontWeight: "bold", fontSize: 24 }}
          />
          <Appbar.Action icon="refresh" onPress={() => refetch()} />
        </Appbar.Header>
      )}

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="mt-4 text-gray-500 dark:text-dark-400">
            Chargement des clients...
          </Text>
        </View>
      ) : clients && clients.length > 0 ? (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View className="flex-1 justify-center items-center px-6">
          <FontAwesome
            name="users"
            size={64}
            color={isDark ? "#475569" : "#CBD5E1"}
          />
          <Text
            className={`mt-4 text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Aucun client
          </Text>
          <Text
            className={`mt-2 text-center ${
              isDark ? "text-dark-400" : "text-gray-500"
            }`}
          >
            Commencez par ajouter votre premier client
          </Text>
        </View>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        onPress={() => router.push("/(app)/clients/add")}
        className="absolute right-6 bottom-6"
        style={{
          backgroundColor: "#3B82F6",
          borderRadius: 16,
        }}
        customSize={64}
      />
    </View>
  );
}
