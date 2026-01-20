import React, { useEffect, useState } from "react";
import { View, useWindowDimensions, ActivityIndicator } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";

import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Settings,
} from "lucide-react-native";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
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
              <Tabs.Screen name="facturation/index" />
              <Tabs.Screen name="parametres/index" />
              <Tabs.Screen name="calendar/add" options={{ href: null }} />
              <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
              <Tabs.Screen name="clients/add" options={{ href: null }} />
              <Tabs.Screen name="clients/[id]" options={{ href: null }} />
              <Tabs.Screen name="facturation/add" options={{ href: null }} />
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // --- RENDU MOBILE ---
  return (
    <View className="flex-1 bg-background">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E4E4E7",
            height: 80,
            paddingBottom: 20,
            paddingTop: 10,
          },
          tabBarActiveTintColor: "#3B82F6",
          tabBarInactiveTintColor: "#71717A",
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
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
          options={{
            title: "Factures",
            tabBarIcon: ({ color, size }) => (
              <FileText size={size} color={color} />
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
        <Tabs.Screen name="clients/add" options={{ href: null }} />
        <Tabs.Screen name="clients/[id]" options={{ href: null }} />
        <Tabs.Screen name="facturation/add" options={{ href: null }} />
        <Tabs.Screen
          name="parametres/create-employee"
          options={{ href: null }}
        />
        <Tabs.Screen name="parametres/team" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
