import React from "react";
import {
  View,
  ScrollView,
  Alert,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Appbar, Text, Button, ActivityIndicator } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { useColorScheme } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

export default function InterventionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { data: intervention, isLoading } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      const res = await api.get(`/api/interventions/${id}`);
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const now = new Date().toISOString();
      const payload: any = { status: newStatus };

      if (newStatus === "in_progress") payload.real_start_time = now;
      if (newStatus === "done") payload.real_end_time = now;

      return await api.patch(`/api/interventions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      Alert.alert("Succès", "Statut mis à jour !");
    },
    onError: () => {
      Alert.alert("Erreur", "Impossible de mettre à jour le statut.");
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-dark-900">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-500 dark:text-dark-400">
          Chargement...
        </Text>
      </View>
    );
  }

  if (!intervention) {
    return (
      <View className="flex-1 justify-center items-center bg-white dark:bg-dark-900">
        <FontAwesome name="exclamation-circle" size={64} color="#EF4444" />
        <Text className="text-xl font-bold text-gray-900 dark:text-white mt-4">
          Intervention introuvable
        </Text>
        <Button mode="contained" onPress={() => router.back()} className="mt-6">
          Retour
        </Button>
      </View>
    );
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      planned: {
        bg: "bg-blue-500",
        icon: "clock-o",
        label: "Planifié",
        lightBg: isDark ? "bg-blue-900/30" : "bg-blue-50",
      },
      in_progress: {
        bg: "bg-orange-500",
        icon: "play-circle",
        label: "En cours",
        lightBg: isDark ? "bg-orange-900/30" : "bg-orange-50",
      },
      done: {
        bg: "bg-green-500",
        icon: "check-circle",
        label: "Terminé",
        lightBg: isDark ? "bg-green-900/30" : "bg-green-50",
      },
    };
    return configs[status as keyof typeof configs] || configs.planned;
  };

  const statusConfig = getStatusConfig(intervention.status);
  const startTime = new Date(intervention.start_time);

  return (
    <View className={`flex-1 ${isDark ? "bg-dark-900" : "bg-gray-50"}`}>
      {/* Header */}
      <Appbar.Header
        style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="" />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section avec Statut */}
        <View className={`${statusConfig.bg} pt-8 pb-16 px-6`}>
          <View className="flex-row items-center mb-3">
            <View className="bg-white/20 p-2 rounded-full">
              <FontAwesome
                name={statusConfig.icon as any}
                size={24}
                color="#FFFFFF"
              />
            </View>
            <Text className="ml-3 text-white text-sm font-semibold uppercase tracking-wider">
              {statusConfig.label}
            </Text>
          </View>

          <Text className="text-white text-3xl font-bold mb-2">
            {intervention.title}
          </Text>

          <View className="flex-row items-center mt-2">
            <FontAwesome name="calendar" size={16} color="#FFFFFF" />
            <Text className="ml-2 text-white/90 text-base">
              {startTime.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>

        {/* Carte principale */}
        <View
          className={`mx-4 -mt-10 rounded-2xl ${
            isDark ? "bg-dark-800" : "bg-white"
          } shadow-xl overflow-hidden`}
        >
          {/* Horaire */}
          <View
            className={`p-6 border-b ${
              isDark ? "border-dark-700" : "border-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isDark ? "text-dark-400" : "text-gray-500"
              } mb-2 uppercase tracking-wide`}
            >
              Horaire prévu
            </Text>
            <View className="flex-row items-center">
              <View className={`${statusConfig.lightBg} p-3 rounded-xl`}>
                <FontAwesome name="clock-o" size={24} color="#3B82F6" />
              </View>
              <Text
                className={`ml-4 text-2xl font-bold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                {startTime.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          {/* Informations Client */}
          <View
            className={`p-6 border-b ${
              isDark ? "border-dark-700" : "border-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isDark ? "text-dark-400" : "text-gray-500"
              } mb-4 uppercase tracking-wide`}
            >
              Informations client
            </Text>

            <View className="space-y-4">
              {/* Nom */}
              <View className="flex-row items-start">
                <View
                  className={`${
                    isDark ? "bg-dark-700" : "bg-gray-100"
                  } p-3 rounded-xl`}
                >
                  <FontAwesome
                    name="user"
                    size={20}
                    color={isDark ? "#94A3B8" : "#64748B"}
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text
                    className={`text-xs ${
                      isDark ? "text-dark-400" : "text-gray-500"
                    } mb-1`}
                  >
                    Nom du client
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {intervention.client?.name || "Client inconnu"}
                  </Text>
                </View>
              </View>

              {/* Adresse */}
              {intervention.client?.address && (
                <View className="flex-row items-start mt-4">
                  <View
                    className={`${
                      isDark ? "bg-dark-700" : "bg-gray-100"
                    } p-3 rounded-xl`}
                  >
                    <FontAwesome
                      name="map-marker"
                      size={20}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-dark-400" : "text-gray-500"
                      } mb-1`}
                    >
                      Adresse
                    </Text>
                    <Text
                      className={`text-base ${
                        isDark ? "text-dark-300" : "text-gray-700"
                      }`}
                    >
                      {intervention.client.address}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Temps réel (si commencé/terminé) */}
          {(intervention.real_start_time || intervention.real_end_time) && (
            <View className="p-6">
              <Text
                className={`text-sm font-semibold ${
                  isDark ? "text-dark-400" : "text-gray-500"
                } mb-4 uppercase tracking-wide`}
              >
                Suivi en temps réel
              </Text>

              {intervention.real_start_time && (
                <View className="flex-row items-center mb-3">
                  <FontAwesome name="play-circle" size={18} color="#22C55E" />
                  <Text
                    className={`ml-3 ${
                      isDark ? "text-dark-300" : "text-gray-700"
                    }`}
                  >
                    Démarré à{" "}
                    {new Date(intervention.real_start_time).toLocaleTimeString(
                      "fr-FR"
                    )}
                  </Text>
                </View>
              )}

              {intervention.real_end_time && (
                <View className="flex-row items-center">
                  <FontAwesome name="check-circle" size={18} color="#16A34A" />
                  <Text
                    className={`ml-3 ${
                      isDark ? "text-dark-300" : "text-gray-700"
                    }`}
                  >
                    Terminé à{" "}
                    {new Date(intervention.real_end_time).toLocaleTimeString(
                      "fr-FR"
                    )}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Actions Buttons */}
        <View className="px-4 py-8">
          {intervention.status === "planned" && (
            <Pressable
              onPress={() => statusMutation.mutate("in_progress")}
              disabled={statusMutation.isPending}
              className="bg-orange-500 rounded-2xl p-5 shadow-lg active:scale-98 flex-row items-center justify-center"
            >
              {statusMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome name="play" size={20} color="#FFFFFF" />
                  <Text className="ml-3 text-white text-lg font-bold">
                    Démarrer l'intervention
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {intervention.status === "in_progress" && (
            <Pressable
              onPress={() => statusMutation.mutate("done")}
              disabled={statusMutation.isPending}
              className="bg-green-500 rounded-2xl p-5 shadow-lg active:scale-98 flex-row items-center justify-center"
            >
              {statusMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome name="check" size={20} color="#FFFFFF" />
                  <Text className="ml-3 text-white text-lg font-bold">
                    Terminer l'intervention
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {intervention.status === "done" && (
            <View
              className={`${
                isDark ? "bg-green-900/30" : "bg-green-50"
              } rounded-2xl p-6 items-center`}
            >
              <View className="bg-green-500 p-4 rounded-full mb-4">
                <FontAwesome name="check" size={32} color="#FFFFFF" />
              </View>
              <Text className="text-green-600 dark:text-green-400 text-xl font-bold">
                Intervention Terminée
              </Text>
              {intervention.real_end_time && (
                <Text
                  className={`mt-2 ${
                    isDark ? "text-dark-400" : "text-gray-600"
                  }`}
                >
                  Clôturée à{" "}
                  {new Date(intervention.real_end_time).toLocaleTimeString(
                    "fr-FR"
                  )}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
