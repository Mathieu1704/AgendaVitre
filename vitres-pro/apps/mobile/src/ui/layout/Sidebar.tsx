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
} from "lucide-react-native";
import { cn } from "../cn";
import { supabase } from "../../lib/supabase";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = useMemo(
    () => [
      {
        path: "/(app)",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      { path: "/(app)/calendar", label: "Planning", icon: Calendar },
      { path: "/(app)/clients", label: "Clients", icon: Users },
      { path: "/(app)/facturation", label: "Facturation", icon: FileText },
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
      {/* Logo Area */}
      <View className="h-16 flex-row items-center px-6 border-b border-border">
        <View className="h-11 w-11 bg-primary rounded-lg items-center justify-center">
          <Text className="text-white font-bold text-lg">LVM</Text>
        </View>
        {!collapsed && (
          <Text className="ml-3 text-lg font-bold text-foreground">
            LVM Agenda
          </Text>
        )}
      </View>

      {/* Navigation Items */}
      <ScrollView className="flex-1 py-6 px-3 gap-1">
        {items.map((item) => {
          // Détection active plus précise
          const isActive = item.exact
            ? pathname === "/" || pathname === "/index"
            : pathname.startsWith(item.path);

          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as any)}
              className={cn(
                "flex-row items-center rounded-xl p-3 mb-1 transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <item.icon size={20} color={isActive ? "#FFFFFF" : "#64748B"} />
              {!collapsed && (
                <Text
                  className={cn(
                    "ml-3 font-medium text-sm",
                    isActive ? "text-white" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Footer Actions */}
      <View className="p-3 border-t border-border gap-2">
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          className="flex-row items-center justify-center p-2 rounded-lg hover:bg-muted"
        >
          {collapsed ? (
            <ChevronRight size={20} color="#64748B" />
          ) : (
            <ChevronLeft size={20} color="#64748B" />
          )}
        </Pressable>

        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center p-3 rounded-xl hover:bg-destructive/10 group"
        >
          <LogOut size={20} color="#EF4444" />
          {!collapsed && (
            <Text className="ml-3 text-sm font-medium text-destructive">
              Déconnexion
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
