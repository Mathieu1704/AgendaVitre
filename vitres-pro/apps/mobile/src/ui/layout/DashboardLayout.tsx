import React from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Calendar, Users, LogOut, Menu } from "lucide-react-native";
import { cn } from "../../lib/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 1. Sidebar Item Component
const SidebarItem = ({
  icon: Icon,
  label,
  path,
  isActive,
  isCollapsed,
}: any) => {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(path)}
      className={cn(
        "flex-row items-center p-3 rounded-lg mb-1 transition-all",
        isActive ? "bg-primary/10" : "hover:bg-sidebar-accent/50"
      )}
    >
      <Icon size={20} color={isActive ? "#18181B" : "#71717A"} />
      {!isCollapsed && (
        <Text
          className={cn(
            "ml-3 text-sm font-medium",
            isActive ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

// 2. Main Layout
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isDesktop = width >= 1024;
  const [collapsed, setCollapsed] = React.useState(false);

  const menuItems = [
    { icon: Calendar, label: "Planning", path: "/(app)/calendar" },
    { icon: Users, label: "Clients", path: "/(app)/clients" },
  ];

  if (!isDesktop) {
    // Version Mobile (Header simple + Contenu)
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Tu peux ajouter un Header Mobile ici si tu veux */}
        <View className="flex-1">{children}</View>
        {/* Bottom Tab Bar gérée par Expo Router ou custom ici */}
      </View>
    );
  }

  // Version Desktop (Sidebar + Contenu)
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Sidebar */}
      <View
        className={cn(
          "h-full border-r border-sidebar-border bg-sidebar py-6 px-4 flex-col transition-all duration-300",
          collapsed ? "w-20 items-center" : "w-64"
        )}
      >
        <View className="flex-row items-center mb-8 px-2">
          <View className="h-8 w-8 bg-primary rounded-lg items-center justify-center">
            <Text className="text-white font-bold">V</Text>
          </View>
          {!collapsed && (
            <Text className="ml-3 text-lg font-bold text-foreground">
              LVM Agenda
            </Text>
          )}
        </View>

        <View className="flex-1 gap-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.path}
              {...item}
              isActive={pathname.includes(item.path)}
              isCollapsed={collapsed}
            />
          ))}
        </View>

        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          className="p-2 opacity-50"
        >
          <Menu size={20} color="#000" />
        </Pressable>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 bg-background">
        {/* Top Header */}
        <View className="h-16 border-b border-border flex-row items-center justify-between px-8 bg-background">
          <Text className="text-lg font-semibold text-foreground">
            {menuItems.find((m) => pathname.includes(m.path))?.label ||
              "Tableau de bord"}
          </Text>
          {/* Avatar / User ici */}
          <View className="h-8 w-8 bg-primary/10 rounded-full items-center justify-center">
            <Text className="text-xs font-bold text-primary">MZ</Text>
          </View>
        </View>

        {/* Page Content */}
        <View className="flex-1 p-8">{children}</View>
      </View>
    </View>
  );
}
