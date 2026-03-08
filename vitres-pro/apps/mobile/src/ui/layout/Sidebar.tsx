import React, { useMemo, useState, useRef, useEffect } from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { useRouter, usePathname } from "expo-router";
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Settings,
  LogOut,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useNotifications } from "../../hooks/useNotifications";
import { useTheme } from "../components/ThemeToggle";

const ITEM_HEIGHT = 44; // height of each nav item (p-3 + mb-1 ≈ 44px)
const ITEM_MARGIN = 4;  // mb-1 = 4px
const ITEMS_OFFSET = 24; // py-6 top padding

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { unreadCount } = useNotifications();
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? "#0F172A" : "#FFFFFF",
    border: isDark ? "#1E293B" : "#E2E8F0",
    logoText: isDark ? "#FFFFFF" : "#09090B",
    inactiveIcon: isDark ? "#94A3B8" : "#64748B",
    inactiveText: isDark ? "#94A3B8" : "#64748B",
    pill: "#3B82F6",
    collapseText: isDark ? "#94A3B8" : "#64748B",
    hoverBg: isDark ? "#1E293B" : "#F1F5F9",
    logoutHover: isDark ? "#2D1515" : "#FEF2F2",
  };

  // Width animation
  const widthAnim = useRef(new Animated.Value(288)).current; // 72 * 4 = 288px
  const collapsedWidth = 80;
  const expandedWidth = 288;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: collapsed ? collapsedWidth : expandedWidth,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
  }, [collapsed]);

  const items = useMemo(
    () => [
      { path: "/(app)", label: "Dashboard", icon: LayoutDashboard, exact: true, match: "/" },
      { path: "/(app)/calendar", label: "Planning", icon: Calendar, match: "/calendar" },
      { path: "/(app)/clients", label: "Clients", icon: Users, match: "/clients" },
      { path: "/(app)/facturation", label: "Facturation", icon: FileText, match: "/facturation" },
      { path: "/(app)/notifications", label: "Alertes", icon: Bell, badge: true, match: "/notifications" },
      { path: "/(app)/parametres", label: "Paramètres", icon: Settings, match: "/parametres" },
    ],
    []
  );

  // Find active index
  const activeIndex = useMemo(() => {
    return items.findIndex((item) => {
      if (item.exact) return pathname === "/" || pathname === "/index";
      return (
        pathname === item.match ||
        pathname.startsWith(item.match + "/") ||
        pathname.startsWith(item.path) ||
        pathname.startsWith(item.path + "/")
      );
    });
  }, [pathname, items]);

  // Sliding indicator animation
  const slideY = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex * (ITEM_HEIGHT + ITEM_MARGIN) : 0)).current;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(slideY, {
        toValue: activeIndex * (ITEM_HEIGHT + ITEM_MARGIN),
        useNativeDriver: true,
        tension: 180,
        friction: 22,
      }).start();
    }
  }, [activeIndex]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <Animated.View
      style={[
        {
          height: "100%",
          borderRightWidth: 1,
          borderRightColor: colors.border,
          backgroundColor: colors.bg,
          overflow: "hidden",
          width: widthAnim,
        },
      ]}
    >
      {/* Logo Header */}
      <View style={{
        height: 64,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        paddingHorizontal: collapsed ? 0 : 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <View style={{ height: 36, width: 36, backgroundColor: "#3B82F6", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>LVM</Text>
        </View>
        {!collapsed && (
          <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: "700", color: colors.logoText }} numberOfLines={1}>
            LVM Agenda
          </Text>
        )}
      </View>

      {/* Navigation Items */}
      <View style={{ flex: 1, paddingVertical: ITEMS_OFFSET }}>
        {/* Sliding pill indicator — left/right: 12 pour matcher exactement la largeur des items */}
        {activeIndex >= 0 && (
          <Animated.View
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              height: ITEM_HEIGHT,
              top: ITEMS_OFFSET,
              backgroundColor: colors.pill,
              borderRadius: 12,
              transform: [{ translateY: slideY }],
            }}
            pointerEvents="none"
          />
        )}

        {items.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 12,
                marginHorizontal: 12,
                paddingHorizontal: collapsed ? 0 : 12,
                paddingVertical: 12,
                marginBottom: ITEM_MARGIN,
                height: ITEM_HEIGHT,
                position: "relative",
                zIndex: 1,
              }}
            >
              <View style={{ position: "relative" }}>
                <item.icon size={20} color={isActive ? "#FFFFFF" : colors.inactiveIcon} />
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
                  <Text style={{ marginLeft: 12, fontWeight: "500", fontSize: 14, color: isActive ? "#FFFFFF" : colors.inactiveText }} numberOfLines={1}>
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
      </View>

      {/* Bottom: Collapse + Logout */}
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 }}>
        {/* Collapse button */}
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: 10,
            borderRadius: 10,
            backgroundColor: pressed ? colors.hoverBg : "transparent",
            gap: 8,
          })}
        >
          {collapsed
            ? <PanelLeftOpen size={18} color={colors.collapseText} />
            : <PanelLeftClose size={18} color={colors.collapseText} />
          }
          {!collapsed && (
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.collapseText }}>Réduire</Text>
          )}
        </Pressable>

        {/* Logout */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: 12,
            borderRadius: 10,
            backgroundColor: pressed ? colors.logoutHover : "transparent",
            gap: 10,
          })}
        >
          <LogOut size={18} color="#EF4444" />
          {!collapsed && (
            <Text style={{ fontSize: 13, fontWeight: "500", color: "#EF4444" }}>Déconnexion</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}
