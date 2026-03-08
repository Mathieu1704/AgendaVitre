import React from "react";
import { View, ScrollView, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Bell, BellOff, CheckCheck, AlertTriangle, Info } from "lucide-react-native";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
  type InAppNotification,
} from "../../../src/hooks/useNotifications";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD}j`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "no_reprise") return <AlertTriangle size={20} color="#EF4444" />;
  return <Info size={20} color="#3B82F6" />;
}

function NotifItem({
  notif,
  onPress,
}: {
  notif: InAppNotification;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "flex-start", gap: 12,
        padding: 16,
        backgroundColor: notif.is_read ? "transparent" : "#EFF6FF",
        borderRadius: 16, marginBottom: 8,
        borderWidth: notif.is_read ? 0 : 1,
        borderColor: notif.is_read ? "transparent" : "#BFDBFE",
      }}
    >
      {/* Dot non lu */}
      {!notif.is_read && (
        <View style={{
          position: "absolute", top: 12, right: 12,
          width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6",
        }} />
      )}

      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: notif.type === "no_reprise" ? "#FEF2F2" : "#EFF6FF",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <NotifIcon type={notif.type} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 14, color: "#0f172a", marginBottom: 2 }}>
          {notif.title}
        </Text>
        <Text style={{ fontSize: 13, color: "#64748B", lineHeight: 18 }}>
          {notif.message}
        </Text>
        <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
          {timeAgo(notif.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { notifications, isLoading, unreadCount } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const handlePress = (notif: InAppNotification) => {
    if (!notif.is_read) markRead.mutate(notif.id);
    if (notif.metadata?.intervention_id) {
      router.push(`/(app)/calendar/${notif.metadata.intervention_id}` as any);
    }
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-3 flex-row items-center border-b border-border dark:border-slate-800">
        <Pressable
          onPress={() => router.back()}
          className="p-2 rounded-full active:bg-muted mr-1"
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Pressable>
        <Bell size={20} color="#3B82F6" />
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2 flex-1">
          Notifications
          {unreadCount > 0 && (
            <Text style={{ color: "#3B82F6" }}> ({unreadCount})</Text>
          )}
        </Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAllRead.mutate()}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 active:bg-blue-100"
          >
            <CheckCheck size={14} color="#3B82F6" />
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#3B82F6" }}>
              Tout lu
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <View className="bg-slate-100 dark:bg-slate-800 p-5 rounded-full">
            <BellOff size={40} color="#94A3B8" />
          </View>
          <Text className="text-lg font-bold text-foreground dark:text-white text-center">
            Aucune notification
          </Text>
          <Text className="text-muted-foreground text-center text-sm">
            Les alertes (RDV non repris, etc.) apparaîtront ici.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {notifications.map((notif) => (
            <NotifItem key={notif.id} notif={notif} onPress={() => handlePress(notif)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
