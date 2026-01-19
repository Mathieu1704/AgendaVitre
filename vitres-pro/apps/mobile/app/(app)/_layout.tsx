import React, { useEffect, useState } from "react";
import { View, useWindowDimensions, ActivityIndicator } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024; // Détection Desktop

  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const ok = !!data.session?.access_token;
      setIsAuthed(ok);
      setCheckingAuth(false);

      if (!ok) router.replace("/(auth)/login");
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const ok = !!session?.access_token;
      setIsAuthed(ok);

      // si logout / session expirée → retour login
      if (!ok) router.replace("/(auth)/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checkingAuth) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  // sécurité supplémentaire (en pratique le router.replace suffit)
  if (!isAuthed) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-background">
        {/* 1. Sidebar Fixe à Gauche */}
        <Sidebar />

        {/* 2. Zone Principale à Droite */}
        <View className="flex-1 flex-col h-full overflow-hidden">
          {/* A. Header Fixe en Haut */}
          <Header />

          {/* B. Contenu des pages (Dashboard, Planning, etc.) */}
          <View className="flex-1 bg-muted/30">
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" }, // On cache la barre native sur Desktop
                // ❌ J'ai supprimé la ligne "sceneContainerStyle" qui causait l'erreur
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
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // --- VERSION MOBILE ---
  return (
    <View className="flex-1 bg-background">
      {/* Sur mobile, le header est souvent géré par page ou simplifié */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="calendar/index" />
        <Tabs.Screen name="clients/index" />
        <Tabs.Screen name="facturation/index" /> {/* Si tu l'as créée */}
        <Tabs.Screen name="parametres/index" options={{ href: null }} />
        {/* Pages cachées */}
        <Tabs.Screen name="calendar/add" options={{ href: null }} />
        <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
        <Tabs.Screen name="clients/add" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
