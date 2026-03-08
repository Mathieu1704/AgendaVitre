import React, { useMemo, useState } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { useRouter, usePathname } from "expo-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
} from "lucide-react-native";
import { cn } from "../cn";
import { supabase } from "../../lib/supabase";
import { useNotifications } from "../../hooks/useNotifications";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { unreadCount } = useNotifications();

  const items = useMemo(
    () => [
      { path: "/(app)", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { path: "/(app)/calendar", label: "Planning", icon: Calendar },
      { path: "/(app)/clients", label: "Clients", icon: Users },
      { path: "/(app)/facturation", label: "Facturation", icon: FileText },
      { path: "/(app)/notifications", label: "Alertes", icon: Bell, badge: true },
      { path: "/(app)/parametres", label: "Paramètres", icon: Settings },
    ],
    []
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View
      className={cn(
        "h-full border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <View className="h-16 flex-row items-center px-6 border-b border-border">
        <View className="h-11 w-11 bg-primary rounded-lg items-center justify-center">
          <Text className="text-white font-bold text-lg">LVM</Text>
        </View>
        {!collapsed && (
          <Text className="ml-3 text-lg font-bold text-foreground">LVM Agenda</Text>
        )}
      </View>

      <ScrollView className="flex-1 py-6 px-3 gap-1">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === "/" || pathname === "/index"
            : pathname.startsWith(item.path);

          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as any)}
              className={cn(
                "flex-row items-center rounded-xl p-3 mb-1 transition-all",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <View style={{ position: "relative" }}>
                <item.icon size={20} color={isActive ? "#FFFFFF" : "#64748B"} />
                {item.badge && unreadCount > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -6,
                    minWidth: 15, height: 15, borderRadius: 8,
                    backgroundColor: "#EF4444",
                    alignItems: "center", justifyContent: "center",
                    paddingHorizontal: 2,
                  }}>
                    <Text style={{ color: "white", fontSize: 8, fontWeight: "700" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              {!collapsed && (
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text className={cn("ml-3 font-medium text-sm", isActive ? "text-white" : "text-muted-foreground")}>
                    {item.label}
                  </Text>
                  {item.badge && unreadCount > 0 && !isActive && (
                    <View style={{ backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="p-3 border-t border-border gap-2">
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          className="flex-row items-center justify-center p-2 rounded-lg hover:bg-muted"
        >
          {collapsed ? <ChevronRight size={20} color="#64748B" /> : <ChevronLeft size={20} color="#64748B" />}
        </Pressable>
        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center p-3 rounded-xl hover:bg-destructive/10 group"
        >
          <LogOut size={20} color="#EF4444" />
          {!collapsed && <Text className="ml-3 text-sm font-medium text-destructive">Déconnexion</Text>}
        </Pressable>
      </View>
    </View>
  );
}
