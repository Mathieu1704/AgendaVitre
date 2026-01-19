// apps/mobile/app/(auth)/callback.tsx
import { useEffect } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

export default function CallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // Sur web, Supabase peut détecter la session dans l'URL si detectSessionInUrl=true
      const { data } = await supabase.auth.getSession();

      if (data.session?.access_token) {
        // Nettoie l'URL (enlève #access_token...)
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.history.replaceState({}, document.title, "/");
        }
        router.replace("/(app)/calendar");
      } else {
        router.replace("/(auth)/login");
      }
    };

    run();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 12 }}>Validation en cours...</Text>
    </View>
  );
}
