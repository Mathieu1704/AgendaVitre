import React from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  Linking,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  FileText,
  ExternalLink,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const res = await api.get(`/api/clients/${id}`);
      return res.data;
    },
  });

  const handleCall = () => {
    if (client?.phone) {
      const cleanedPhone = client.phone.replace(/\s/g, "");
      Linking.openURL(`tel:${cleanedPhone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email.trim()}`);
    }
  };

  const handleMaps = () => {
    if (client?.address) {
      const query = encodeURIComponent(client.address);
      const url = Platform.select({
        ios: `maps:0,0?q=${query}`,
        android: `geo:0,0?q=${query}`,
        web: `https://www.google.com/maps/search/?api=1&query=${query}`,
      });
      Linking.openURL(url!);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!client) return null;

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-2 border-b border-border dark:border-slate-800">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/(app)/clients")}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="ml-2 text-lg font-bold text-foreground dark:text-white">
          Fiche Client
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Profil Header */}
        <View className="items-center mb-8 pt-4">
          <Avatar name={client.name || client.address || "?"} size="lg" className="h-24 w-24 mb-4" />
          <Text className="text-2xl font-bold text-foreground dark:text-white text-center">
            {client.name || "Client anonyme"}
          </Text>
          {client.address && (
            <Text className="text-muted-foreground text-center mt-1 px-8">
              {client.address}
            </Text>
          )}
        </View>

        {/* Actions Rapides */}
        <View className="flex-row justify-center gap-4 mb-8">
          <Pressable
            onPress={handleCall}
            disabled={!client.phone}
            className={`items-center justify-center h-14 w-14 rounded-full ${
              client.phone ? "bg-green-500/10" : "bg-muted opacity-50"
            }`}
          >
            <Phone size={24} color={client.phone ? "#22C55E" : "#94A3B8"} />
          </Pressable>
          <Pressable
            onPress={handleEmail}
            disabled={!client.email}
            className={`items-center justify-center h-14 w-14 rounded-full ${
              client.email ? "bg-blue-500/10" : "bg-muted opacity-50"
            }`}
          >
            <Mail size={24} color={client.email ? "#3B82F6" : "#94A3B8"} />
          </Pressable>
          <Pressable
            onPress={handleMaps}
            className="items-center justify-center h-14 w-14 rounded-full bg-orange-500/10"
          >
            <MapPin size={24} color="#F97316" />
          </Pressable>
        </View>

        {/* Informations */}
        {/* ✅ Card arrondie */}
        <Card className="mb-6 rounded-[32px] overflow-hidden">
          <CardContent className="p-5 gap-6">
            <View className="flex-row items-start">
              <Phone size={18} color="#94A3B8" className="mt-1 mr-3" />
              <View>
                <Text className="text-xs text-muted-foreground uppercase font-bold">
                  Téléphone
                </Text>
                <Text className="text-base text-foreground dark:text-white mt-1">
                  {client.phone || "Non renseigné"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <Mail size={18} color="#94A3B8" className="mt-1 mr-3" />
              <View>
                <Text className="text-xs text-muted-foreground uppercase font-bold">
                  Email
                </Text>
                <Text className="text-base text-foreground dark:text-white mt-1">
                  {client.email || "Non renseigné"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <FileText size={18} color="#94A3B8" className="mt-1 mr-3" />
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground uppercase font-bold">
                  Notes
                </Text>
                <Text className="text-base text-foreground dark:text-white mt-1 leading-relaxed">
                  {client.notes || "Aucune note particulière."}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Bouton Historique */}
        <Button
          variant="outline"
          onPress={() => alert("Historique bientôt disponible")}
          className="w-full h-12 rounded-[24px]"
        >
          <ExternalLink size={18} color={isDark ? "white" : "black"} />
          <Text className="ml-2 font-bold text-foreground dark:text-white">
            Voir l'historique des interventions
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
