import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

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

    // 1. Session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) checkRole(session.user.email);
      else setLoading(false);
    });

    // 2. Écoute des changements
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
