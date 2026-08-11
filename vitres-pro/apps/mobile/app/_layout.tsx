import { Stack } from "expo-router";
import { useEffect } from "react";
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState } from "react-native";
import { ToastHost } from "../src/ui/toast";
import { ThemeProvider, useTheme } from "../src/ui/components/ThemeToggle";
import { isOfflineSupported } from "../src/lib/offline/storage";
import { startNetworkWatch } from "../src/lib/offline/network";
import {
  queryPersister,
  shouldDehydrateQuery,
  PERSIST_MAX_AGE,
} from "../src/lib/offline/persist";
import { flush as flushOutbox } from "../src/lib/offline/outbox";
import { flushPersistedQueryCache } from "../src/lib/offline/chunkedPersister";
import "../app.css";

// Sentry désactivé temporairement : le build natif 1.0.2 a été publié sans le
// plugin Expo "@sentry/react-native/expo" dans app.json, ce qui casse le
// module natif sur iOS (crash immédiat au lancement). Réactiver une fois
// qu'un nouveau build natif avec le plugin correctement configuré est en
// prod (voir app.json).

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Sans un gcTime long, React Query purge les données 5 minutes après le
      // démontage : le cache persisté serait vidé avant d'avoir servi.
      gcTime: PERSIST_MAX_AGE,
      // En mode `online`, une requête hors connexion conserve et affiche son
      // cache sans exécuter queryFn. `offlineFirst` lançait au contraire une
      // tentative (puis un retry) pour chaque écran au démarrage Android.
      networkMode: "online",
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      // Indispensable : par défaut React Query met les mutations en pause hors
      // réseau, donc mutationFn n'est jamais appelée et l'interface reste
      // bloquée sur un indicateur de chargement. Nos mutations n'écrivent
      // qu'en local (elles empilent dans la file d'attente, qui se charge
      // ensuite de l'envoi) : elles doivent toujours s'exécuter.
      networkMode: "always",
    },
  },
});

// Branché une seule fois, au chargement du module : `onlineManager` est global
// et doit connaître l'état réseau avant le premier rendu.
startNetworkWatch();

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
  roundness: 16,
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

function AppShell({ theme }: { theme: typeof lightTheme }) {
  return (
    <PaperProvider theme={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <ToastHost />
    </PaperProvider>
  );
}

// Séparé pour pouvoir lire useTheme() après ThemeProvider
function ThemedApp() {
  const { isDark } = useTheme();
  const theme = isDark ? darkTheme : lightTheme;

  // Sur web, la persistance n'est pas dans le périmètre : on garde le provider
  // simple pour ne pas embarquer AsyncStorage dans le bundle statique.
  if (!isOfflineSupported) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppShell theme={theme} />
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE,
        dehydrateOptions: { shouldDehydrateQuery },
        // Invalide le cache persisté quand la forme des données change.
        buster: "v1",
      }}
      // Le cache restauré peut contenir des écritures déjà en file : on tente
      // de vider dès que l'app est prête, sans attendre un changement de réseau.
      onSuccess={() => {
        void flushOutbox();
      }}
    >
      <AppShell theme={theme} />
    </PersistQueryClientProvider>
  );
}

function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "inactive" || state === "background") {
        void flushPersistedQueryCache();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default RootLayout;
