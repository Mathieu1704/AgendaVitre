import React, { useEffect, useState } from "react";
import { View, useWindowDimensions, ActivityIndicator } from "react-native";
import { Tabs, useRouter, Stack } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const router = useRouter();

  // On commence par "loading" le temps de vérifier Supabase
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // 1. Vérification initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // 2. Écoute des changements (Login, Logout, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);

      // Si on perd la session, on renvoie au login
      if (!session) {
        router.replace("/(auth)/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tant qu'on charge, on affiche une roue
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Si le chargement est fini et qu'on a pas de session => Redirection Login
  if (!session) {
    // Petit hack pour éviter le flash : on retourne null le temps que router.replace se fasse
    router.replace("/(auth)/login");
    return null;
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

              {/* Pages cachées */}
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
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="calendar/index" />
        <Tabs.Screen name="clients/index" />
        <Tabs.Screen name="facturation/index" />
        <Tabs.Screen name="parametres/index" />

        {/* Pages cachées */}
        <Tabs.Screen name="calendar/add" options={{ href: null }} />
        <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
        <Tabs.Screen name="clients/add" options={{ href: null }} />
        <Tabs.Screen name="clients/[id]" options={{ href: null }} />
        <Tabs.Screen name="facturation/add" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
