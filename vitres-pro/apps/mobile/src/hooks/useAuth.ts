import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userZone, setUserZone] = useState<"hainaut" | "ardennes">("hainaut");
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkRole = async (email: string | undefined) => {
      if (!email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        // Utilise le cache React Query si disponible (évite une requête réseau supplémentaire)
        const cached = queryClient.getQueryData<any[]>(["employees"]);
        const employees = cached ?? (await api.get("/api/employees")).data;
        const me = employees.find((e: any) => e.email === email);
        setIsAdmin(me?.role === "admin");
        setUserZone(me?.zone === "ardennes" ? "ardennes" : "hainaut");
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    // 1. Session initiale — si le refresh token est invalide, on déconnecte proprement
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        if (error) supabase.auth.signOut(); // nettoie le token corrompu du SecureStore
        setLoading(false);
        return;
      }
      setSession(session);
      if (session?.user) checkRole(session.user.email);
      else setLoading(false);
    });

    // 2. Écoute des changements
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !session) {
        // Token expiré ou révoqué : nettoyer et rediriger silencieusement
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
        queryClient.clear();
        router.replace("/(auth)/login");
        return;
      }
      setSession(session);
      if (session?.user) checkRole(session.user.email);
      else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, isAdmin, userZone, loading };
};
