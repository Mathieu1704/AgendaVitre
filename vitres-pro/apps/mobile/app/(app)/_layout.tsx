// apps/mobile/app/(app)/_layout.tsx
import React from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Text } from "react-native-paper";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useColorScheme } from "react-native";

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={24} name={name} color={color} />;
}

function DesktopSidebar({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const navItems = [
    { path: "/(app)/calendar", icon: "calendar", label: "Planning" },
    { path: "/(app)/clients", icon: "users", label: "Clients" },
  ];

  return (
    <View
      className={`w-64 h-full ${isDark ? "bg-dark-800" : "bg-white"} border-r ${
        isDark ? "border-dark-700" : "border-gray-200"
      }`}
    >
      <View className="p-6 border-b border-gray-200 dark:border-dark-700">
        <Text className="text-2xl font-bold text-primary-500">
          Lavage de Vitres
        </Text>
        <Text className="text-sm text-gray-500 dark:text-dark-400">
          Planning Pro
        </Text>
      </View>

      <View className="py-4">
        {navItems.map((item) => {
          const isActive = currentPath.startsWith(item.path);
          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path as any)}
              className={`mx-3 mb-2 px-4 py-3 rounded-xl flex-row items-center ${
                isActive
                  ? "bg-primary-500 shadow-lg"
                  : isDark
                  ? "hover:bg-dark-700"
                  : "hover:bg-gray-100"
              }`}
            >
              <TabBarIcon
                name={item.icon as any}
                color={isActive ? "#fff" : isDark ? "#94A3B8" : "#64748B"}
              />
              <Text
                className={`ml-3 text-base font-semibold ${
                  isActive
                    ? "text-white"
                    : isDark
                    ? "text-dark-300"
                    : "text-gray-700"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row">
        <DesktopSidebar currentPath={pathname} />
        <View className="flex-1">
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: "none" },
            }}
          >
            {/* ✅ routes correctes */}
            <Tabs.Screen name="calendar/index" options={{ href: null }} />
            <Tabs.Screen name="clients/index" options={{ href: null }} />

            {/* écrans push */}
            <Tabs.Screen name="calendar/add" options={{ href: null }} />
            <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
            <Tabs.Screen name="clients/add" options={{ href: null }} />

            <Tabs.Screen name="index" options={{ href: null }} />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: colorScheme === "dark" ? "#64748B" : "#94A3B8",
        tabBarStyle: {
          backgroundColor: colorScheme === "dark" ? "#1E293B" : "#FFFFFF",
          borderTopWidth: 0,
          elevation: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      {/* ✅ routes correctes */}
      <Tabs.Screen
        name="calendar/index"
        options={{
          title: "Planning",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients/index"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />

      {/* écrans push */}
      <Tabs.Screen name="calendar/add" options={{ href: null }} />
      <Tabs.Screen name="calendar/[id]" options={{ href: null }} />
      <Tabs.Screen name="clients/add" options={{ href: null }} />

      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
