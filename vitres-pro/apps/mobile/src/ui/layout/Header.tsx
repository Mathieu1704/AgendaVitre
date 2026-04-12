import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Search } from "lucide-react-native";
import { Avatar } from "../components/Avatar";
import { ThemeToggle } from "../components/ThemeToggle";
import { useRouter } from "expo-router";
import { useNotifications } from "../../hooks/useNotifications";

export const Header = ({ onMenuPress }: { onMenuPress?: () => void }) => {
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS !== "web" ? insets.top : 0;

  return (
    <View
      className="z-50 flex-row items-center justify-between border-b border-border bg-background px-4 lg:px-6"
      style={{ height: 64 + topPadding, paddingTop: topPadding }}
    >
      <View className="flex-row items-center gap-4 flex-1">
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

      <View className="flex-row items-center gap-2">
        <ThemeToggle />

        <Pressable
          onPress={() => router.push("/(app)/notifications" as any)}
          className="relative p-2 rounded-full hover:bg-muted active:opacity-70"
        >
          <Bell size={20} color="#71717A" />
          {unreadCount > 0 && (
            <View style={{
              position: "absolute", top: 6, right: 6,
              minWidth: 16, height: 16, borderRadius: 8,
              backgroundColor: "#EF4444",
              alignItems: "center", justifyContent: "center",
              paddingHorizontal: 3,
            }}>
              <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push("/(app)/parametres")}
          className="flex-row items-center gap-3 border-l border-border pl-4 active:opacity-70"
        >
          <Avatar name="M" size="sm" />
        </Pressable>
      </View>
    </View>
  );
};
