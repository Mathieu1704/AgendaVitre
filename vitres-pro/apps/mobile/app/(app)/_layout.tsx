import React, { useEffect, useRef, useState } from "react";
import { View, Text, useWindowDimensions, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, Redirect, usePathname, useGlobalSearchParams } from "expo-router";
import { useQueryClient, useIsRestoring } from "@tanstack/react-query";
import { supabase, getSessionFast } from "../../src/lib/supabase";
import { api } from "../../src/lib/api";
import { rememberAppPath } from "../../src/lib/returnTo";
import { Sidebar } from "../../src/ui/layout/Sidebar";
import { Header } from "../../src/ui/layout/Header";
import { CustomTabBar } from "../../src/ui/layout/CustomTabBar";
import { useNotifications } from "../../src/hooks/useNotifications";
import { useAuth, AuthProvider } from "../../src/hooks/useAuth";
import { useCompanySettingsSync } from "../../src/hooks/useCompanySettingsSync";
import { useTheme } from "../../src/ui/components/ThemeToggle";
import { monthRangeStart, monthRangeEnd } from "../../src/lib/calendarRange";
// OfflineBanner monte useOutboxSync : c'est lui qui déclenche la reprise de la
// file au retour du réseau et au retour au premier plan.
import { OfflineBanner } from "../../src/ui/components/OfflineBanner";

import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  Bell,
  Search,
} from "lucide-react-native";

// AuthProvider enveloppe tout l'arbre authentifié : c'est lui qui fait tourner
// le flux d'authentification, une seule fois, pour tous les `useAuth()` des
// écrans en dessous (voir src/hooks/useAuth.tsx).
export default function AppLayout() {
  return (
    <AuthProvider>
      <AppLayoutContent />
    </AuthProvider>
  );
}

function AppLayoutContent() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const { unreadCount } = useNotifications();
  const { isAdmin, isSubcontractor, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  // Le cache React Query persisté (planning, heures, etc.) se restaure de
  // façon asynchrone au démarrage. Sans l'attendre ici, les écrans montent
  // avant la fin de la restauration : hors réseau, ils ne voient ni cache
  // ni réponse serveur et restent vides jusqu'au prochain remount.
  const isRestoring = useIsRestoring();
  // Abonnement unique au canal Realtime : c'est lui qui propage hide_cash à
  // tous les écrans (et à tous les appareils) sans sondage.
  useCompanySettingsSync();
  const prefetchedRef = useRef(false);
  const prefetchedAdminRef = useRef(false);
  const prefetchedToursRef = useRef(false);

  // Mémorise l'écran courant à chaque navigation, pour pouvoir y revenir si
  // l'API force une déconnexion (401) en pleine utilisation — voir returnTo.ts.
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams();
  useEffect(() => {
    const search = Object.entries(globalParams)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
    rememberAppPath(pathname, search);
  }, [pathname, globalParams]);

  const prefetchMainData = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const today = new Date().toISOString().split("T")[0];
    const STALE = 2 * 60 * 1000; // 2 min

    // T+0 : interventions du planning. On charge la plage bornée plutôt que
    // /api/interventions sans filtre : c'est la clé que l'écran Planning lit
    // réellement, et c'est elle qui est conservée hors ligne (la requête non
    // bornée ramène tout l'historique et n'est pas persistable).
    const now = new Date();
    const rangeStart = monthRangeStart(now);
    const rangeEnd = monthRangeEnd(now);
    queryClient.prefetchQuery({
      queryKey: ["interventions", rangeStart, rangeEnd],
      queryFn: () =>
        api
          .get("/api/interventions", { params: { start: rangeStart, end: rangeEnd } })
          .then((r) => (Array.isArray(r.data) ? r.data : [])),
      staleTime: STALE,
    });

    // T+800ms : clients + employees
    setTimeout(() => {
      queryClient.prefetchQuery({ queryKey: ["clients"],   queryFn: () => api.get("/api/clients").then((r) => r.data),   staleTime: STALE });
      queryClient.prefetchQuery({ queryKey: ["employees"], queryFn: () => api.get("/api/employees").then((r) => r.data), staleTime: STALE });
    }, 800);

    // T+2000ms : notifications + planning-stats
    setTimeout(() => {
      queryClient.prefetchQuery({ queryKey: ["notifications"], queryFn: () => api.get("/api/notifications").then((r) => r.data), staleTime: STALE });
      queryClient.prefetchQuery({ queryKey: ["planning-stats", today, "all"], queryFn: () => api.get(`/api/planning/daily-stats?date_str=${today}`).then((r) => r.data), staleTime: STALE });
    }, 2000);
  };

  // T+3000ms : données admin (team, zones, tarifs) — seulement si admin
  useEffect(() => {
    if (!isAdmin || prefetchedAdminRef.current) return;
    prefetchedAdminRef.current = true;
    const STALE = 2 * 60 * 1000;
    setTimeout(() => {
      queryClient.prefetchQuery({ queryKey: ["hourly-rates"], queryFn: () => api.get("/api/settings/hourly-rates").then((r) => r.data), staleTime: STALE });
      queryClient.prefetchQuery({ queryKey: ["sub-zones"],    queryFn: () => api.get("/api/settings/zones").then((r) => r.data),    staleTime: STALE });
    }, 3000);
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading || isAdmin || isSubcontractor || prefetchedToursRef.current) return;
    prefetchedToursRef.current = true;
    const rangeStart = monthRangeStart(new Date());
    const rangeEnd = monthRangeEnd(new Date());
    const tourStart = rangeStart.slice(0, 10);
    const tourEnd = rangeEnd.slice(0, 10);
    queryClient.prefetchQuery({
      queryKey: ["tour-runs-assigned", tourStart, tourEnd],
      queryFn: async () => {
        const runs = (await api.get("/api/tours/assigned", { params: { start: tourStart, end: tourEnd } })).data;
        if (Array.isArray(runs)) {
          runs.forEach((run: any) => queryClient.setQueryData(["tour-run", run.id], run));
          return runs;
        }
        return [];
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [authLoading, isAdmin, isSubcontractor, queryClient]);

  useEffect(() => {
    let mounted = true;

    getSessionFast().then(({ data: { session } }) => {
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

  if (isLoading || authLoading || isRestoring) {
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
              <Tabs.Screen name="calendar" />
              <Tabs.Screen name="clients" />
              <Tabs.Screen name="recherche/index" />
              <Tabs.Screen name="facturation" options={{ href: null }} />
              <Tabs.Screen name="parametres" />
              <Tabs.Screen name="notifications/index" options={{ href: null }} />
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
      {/* Sous l'encoche : la bannière remplace les toasts par requête. */}
      <OfflineBanner topInset={insets.top} />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            href: isAdmin ? undefined : null,
            tabBarIcon: isAdmin
              ? ({ color, size }) => <LayoutDashboard size={size} color={color} />
              : undefined,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Planning",
            tabBarIcon: ({ color, size }) => (
              <Calendar size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: "Clients",
            href: isAdmin ? undefined : null,
            tabBarIcon: isAdmin
              ? ({ color, size }) => <Users size={size} color={color} />
              : undefined,
          }}
        />
        <Tabs.Screen
          name="recherche/index"
          options={{
            title: "Recherche",
            href: isAdmin ? null : undefined,
            tabBarIcon: !isAdmin
              ? ({ color, size }) => <Search size={size} color={color} />
              : undefined,
          }}
        />
        <Tabs.Screen
          name="facturation"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="notifications/index"
          options={{
            title: "Alertes",
            href: isAdmin ? undefined : null,
            tabBarIcon: isAdmin
              ? ({ color, size }) => (
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
                )
              : undefined,
          }}
        />
        <Tabs.Screen
          name="parametres"
          options={{
            title: "Réglages",
            tabBarIcon: ({ color, size }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
