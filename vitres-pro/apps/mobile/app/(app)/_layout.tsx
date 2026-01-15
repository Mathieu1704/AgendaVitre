import React from "react";
import { View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024; // Détection Desktop

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
