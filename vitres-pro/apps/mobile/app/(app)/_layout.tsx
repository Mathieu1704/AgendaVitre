import React, { useEffect, useRef, useState } from "react";
import { View, Text, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, Redirect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/lib/supabase";
import { api } from "../../src/lib/api";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";
import { CustomTabBar } from "../../src/ui/layout/CustomTabBar";
import { useNotifications } from "../../src/hooks/useNotifications";
import { useAuth } from "../../src/hooks/useAuth";
import { useTheme } from "../../src/ui/components/ThemeToggle";

import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  Bell,
} from "lucide-react-native";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const { unreadCount } = useNotifications();
  const { isAdmin } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);

  const prefetchMainData = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const today = new Date().toISOString().split("T")[0];
    queryClient.prefetchQuery({ queryKey: ["clients"],        queryFn: () => api.get("/api/clients").then((r) => r.data) });
    queryClient.prefetchQuery({ queryKey: ["employees"],      queryFn: () => api.get("/api/employees").then((r) => r.data) });
    queryClient.prefetchQuery({ queryKey: ["notifications"],  queryFn: () => api.get("/api/notifications").then((r) => r.data) });
    queryClient.prefetchQuery({ queryKey: ["planning-stats", today, "all"], queryFn: () => api.get(`/api/planning/daily-stats?date_str=${today}`).then((r) => r.data) });
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
      if (session) prefetchMainData();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
      if (session) prefetchMainData();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "#020817" : "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // ✅ redirection declarative (safe)
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  // --- RENDU DESKTOP ---
  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-background">
        <Sidebar />
        <View className="flex-1 flex-col h-full overflow-hidden">
          <Header />
          <View className="flex-1 bg-muted/30">
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" },
              }}
            >
              <Tabs.Screen name="index" />
              <Tabs.Screen name="calendar/index" />
              <Tabs.Screen name="clients/index" />
              <Tabs.Screen name="facturation/index" options={{ href: null }} />
              <Tabs.Screen name="parametres/index" />
              <Tabs.Screen name="notifications/index" options={{ href: null }} />
              <Tabs.Screen name="calendar/add" options={{ href: null }} />
              <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
              <Tabs.Screen name="calendar/rate-session" options={{ href: null }} />
              <Tabs.Screen name="clients/add" options={{ href: null }} />
              <Tabs.Screen name="clients/[id]" options={{ href: null }} />
              <Tabs.Screen name="facturation/add" options={{ href: null }} />
              <Tabs.Screen name="parametres/logs" options={{ href: null }} />
              <Tabs.Screen name="parametres/zones" options={{ href: null }} />
              <Tabs.Screen name="parametres/team" options={{ href: null }} />
              <Tabs.Screen name="parametres/tarifs" options={{ href: null }} />
              <Tabs.Screen name="parametres/create-employee" options={{ href: null }} />
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // --- RENDU MOBILE ---
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size }) => (
              <LayoutDashboard size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar/index"
          options={{
            title: "Planning",
            tabBarIcon: ({ color, size }) => (
              <Calendar size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="clients/index"
          options={{
            title: "Clients",
            tabBarIcon: ({ color, size }) => (
              <Users size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="facturation/index"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="notifications/index"
          options={{
            title: "Alertes",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Bell size={size} color={color} />
                {unreadCount > 0 && (
                  <View style={{
                    position: "absolute", top: -4, right: -6,
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
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="parametres/index"
          options={{
            title: "Réglages",
            tabBarIcon: ({ color, size }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
        {/* Écrans cachés de la tab bar */}
        <Tabs.Screen name="calendar/add" options={{ href: null }} />
        <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
        <Tabs.Screen name="calendar/rate-session" options={{ href: null }} />
        <Tabs.Screen name="calendar/raw-event/[id]" options={{ href: null }} />
        <Tabs.Screen name="clients/add" options={{ href: null }} />
        <Tabs.Screen name="clients/[id]" options={{ href: null }} />
        <Tabs.Screen name="facturation/add" options={{ href: null }} />
        <Tabs.Screen
          name="parametres/create-employee"
          options={{ href: null }}
        />
        <Tabs.Screen name="parametres/team" options={{ href: null }} />
        <Tabs.Screen name="parametres/logs" options={{ href: null }} />
        <Tabs.Screen name="parametres/zones" options={{ href: null }} />
        <Tabs.Screen name="parametres/tarifs" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
