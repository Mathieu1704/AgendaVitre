import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Bell, Search, Menu, X } from "lucide-react-native";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle"; // ✅ Import du nouveau composant
import { useRouter } from "expo-router";
import { Card } from "../components/Card"; // On réutilise nos Cards

export const Header = ({ onMenuPress }: { onMenuPress?: () => void }) => {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const user = { email: "mathieu@lvm-agenda.com" };

  // Fausses notifications
  const notifications = [
    {
      id: 1,
      title: "Nouveau client",
      desc: "Jean Dupont a été ajouté.",
      time: "2 min",
    },
    {
      id: 2,
      title: "Intervention terminée",
      desc: "Lavage Vitres - Bureau A",
      time: "1h",
    },
    {
      id: 3,
      title: "Rappel",
      desc: "Penser à envoyer la facture n°402",
      time: "3h",
    },
  ];

  return (
    <View className="z-50 h-16 flex-row items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      {/* Menu & Search */}
      <View className="flex-row items-center gap-4 flex-1">
        <Pressable onPress={onMenuPress} className="lg:hidden p-2 -ml-2">
          <Menu size={24} color="#71717A" />
        </Pressable>

        <View className="relative flex-1 max-w-md hidden md:flex">
          <View className="absolute left-3 top-3 z-10">
            <Search size={16} color="#71717A" />
          </View>
          <TextInput
            placeholder="Rechercher..."
            placeholderTextColor="#71717A"
            className="h-10 w-full rounded-md bg-muted pl-9 pr-4 text-sm text-foreground focus:border-primary focus:border"
          />
        </View>
      </View>

      {/* Right Actions */}
      <View className="flex-row items-center gap-2 relative">
        {/* --- TOGGLE THEME --- */}
        <ThemeToggle />

        {/* --- NOTIFICATIONS --- */}
        <View>
          <Pressable
            onPress={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full hover:bg-muted active:opacity-70"
          >
            <Bell size={20} color="#71717A" />
            <View className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Pressable>

          {/* Popup Notifications (Position Absolue) */}
          {showNotifications && (
            <View className="absolute top-12 right-0 w-72 bg-card border border-border rounded-xl shadow-xl z-50 p-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="font-bold text-foreground">Notifications</Text>
                <Pressable onPress={() => setShowNotifications(false)}>
                  <X size={16} color="#71717A" />
                </Pressable>
              </View>
              <View className="gap-3">
                {notifications.map((n) => (
                  <View
                    key={n.id}
                    className="border-b border-border pb-2 last:border-0"
                  >
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-semibold text-foreground">
                        {n.title}
                      </Text>
                      <Text className="text-[10px] text-muted-foreground">
                        {n.time}
                      </Text>
                    </View>
                    <Text
                      className="text-xs text-muted-foreground mt-0.5"
                      numberOfLines={2}
                    >
                      {n.desc}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Profil */}
        <Pressable
          onPress={() => router.push("/(app)/parametres")}
          className="flex-row items-center gap-3 border-l border-border pl-4 active:opacity-70"
        >
          <Avatar name={user.email} size="sm" />
        </Pressable>
      </View>
    </View>
  );
};
