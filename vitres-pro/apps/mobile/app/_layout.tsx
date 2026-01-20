import { Stack } from "expo-router";
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { ToastHost } from "../src/ui/toast";
import "../app.css";

const queryClient = new QueryClient();

// 🎨 Thème Paper Moderne (Surchargé)
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#3B82F6",
    primaryContainer: "#DBEAFE",
    secondary: "#1E293B",
    secondaryContainer: "#F1F5F9",
    background: "#FFFFFF",
    surface: "#F8FAFC",
    error: "#EF4444",
    onPrimary: "#FFFFFF",
    onSecondary: "#FFFFFF",
  },
  roundness: 16, // Coins arrondis
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#60A5FA",
    primaryContainer: "#1E40AF",
    secondary: "#E2E8F0",
    secondaryContainer: "#334155",
    background: "#0F172A",
    surface: "#1E293B",
    error: "#F87171",
    onPrimary: "#0F172A",
    onSecondary: "#0F172A",
  },
  roundness: 16,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <ToastHost />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
