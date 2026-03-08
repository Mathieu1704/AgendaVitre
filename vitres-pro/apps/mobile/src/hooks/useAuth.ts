import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userZone, setUserZone] = useState<"hainaut" | "ardennes">("hainaut");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async (email: string | undefined) => {
      if (!email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const res = await api.get("/api/employees");
        const me = res.data.find((e: any) => e.email === email);
        setIsAdmin(me?.role === "admin");
        setUserZone(me?.zone === "ardennes" ? "ardennes" : "hainaut");
      } catch (e) {
        console.log("Erreur rôle:", e);
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
