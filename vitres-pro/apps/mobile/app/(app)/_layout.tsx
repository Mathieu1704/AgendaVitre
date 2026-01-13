import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function AppLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      {/* 1. Onglet Planning (Pointe vers le dossier 'calendar') */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Planning",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
          headerShown: false,
        }}
      />

      {/* 2. Onglet Clients (Pointe vers le dossier 'clients') */}
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          headerShown: false,
        }}
      />

      {/* --- ROUTES CACHÉES (href: null) --- */}
      {/* On cache tout le reste pour ne pas polluer la barre du bas */}

      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
