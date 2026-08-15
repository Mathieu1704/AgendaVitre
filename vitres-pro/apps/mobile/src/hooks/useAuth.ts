import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { useQueryClient, onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  loadProfile,
  saveProfile,
  clearProfile,
  readProfileSync,
} from "../lib/offline/profileCache";
import { clearOutbox } from "../lib/offline/outbox";
import { clearIdMap } from "../lib/offline/idMap";
import { queryPersister } from "../lib/offline/persist";

export const useAuth = () => {
  const initial = readProfileSync(); // synchrone sur web uniquement
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(initial?.role === "admin");
  const [isSubcontractor, setIsSubcontractor] = useState(
    initial?.role === "subcontractor",
  );
  const [userZone, setUserZone] = useState<"hainaut" | "ardennes">(
    initial?.zone ?? "hainaut",
  );
  const [userName, setUserName] = useState<string>(initial?.fullName ?? "");
  const [userColor, setUserColor] = useState<string | null>(initial?.color ?? null);
  const [employeeId, setEmployeeId] = useState<string | undefined>(initial?.employeeId);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Le serveur a-t-il confirmé le profil ? Tant que non, on retente au retour
  // du réseau : un profil issu du seul cache peut être périmé.
  const confirmedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const applyProfile = (p: {
      role: string;
      zone: "hainaut" | "ardennes";
      fullName: string;
      color?: string | null;
      employeeId?: string;
    }) => {
      if (cancelled) return;
      setIsAdmin(p.role === "admin");
      setIsSubcontractor(p.role === "subcontractor");
      setUserZone(p.zone);
      setUserName(p.fullName);
      setUserColor(p.color ?? null);
      setEmployeeId(p.employeeId);
    };

    // Réhydratation depuis le cache : sur natif la lecture est asynchrone, donc
    // on l'applique dès que possible pour ne pas afficher un état dégradé le
    // temps de la requête réseau (ou indéfiniment, si elle échoue).
    const hydrate = async () => {
      const cached = await loadProfile();
      if (cached) applyProfile(cached);
      return cached;
    };

    const checkRole = async () => {
      const cached = await hydrate();
      try {
        const me = (await api.get("/api/employees/me")).data;
        const profile = {
          role: me?.role ?? "employee",
          zone: (me?.zone === "ardennes" ? "ardennes" : "hainaut") as
            | "hainaut"
            | "ardennes",
          fullName: me?.full_name ?? "",
          email: me?.email ?? session?.user?.email,
          color: me?.color ?? null,
          employeeId: me?.id ? String(me.id) : undefined,
        };
        applyProfile(profile);
        await saveProfile(profile);
        confirmedRef.current = true;
      } catch {
        // Hors réseau, on conserve le profil en cache : le remettre à zéro
        // ferait perdre à l'ouvrier son rôle et sa zone alors qu'ils sont
        // connus. On ne retombe sur "employee" que sans cache du tout.
        if (!cached && !cancelled) {
          setIsAdmin(false);
          setIsSubcontractor(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const signOutLocal = async () => {
      setSession(null);
      setIsAdmin(false);
      setIsSubcontractor(false);
      setLoading(false);
      await clearProfile();
      await clearOutbox();
      await clearIdMap();
      queryClient.clear();
      // `queryClient.clear()` ne touche pas au cache persisté : sans cette
      // ligne, les données du compte précédent seraient restaurées au
      // prochain démarrage.
      await queryPersister.removeClient();
      router.replace("/(auth)/login");
    };

    // 1. Session initiale — si le refresh token est invalide, on déconnecte proprement
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        if (error) supabase.auth.signOut(); // nettoie le token corrompu du SecureStore
        setLoading(false);
        return;
      }
      setSession(session);
      if (session?.user) checkRole();
      else setLoading(false);
    });

    // 2. Écoute des changements
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const lostSession =
        event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session);

      if (lostSession) {
        // Hors réseau, le rafraîchissement de token échoue forcément : le
        // traiter comme une déconnexion viderait le cache et renverrait
        // l'ouvrier sur l'écran de connexion en plein chantier. Le JWT en
        // cache reste valable, on ignore l'événement.
        if (event === "TOKEN_REFRESHED" && !onlineManager.isOnline()) return;

        void signOutLocal();
        return;
      }

      setSession(session);
      if (session?.user) checkRole();
      else {
        setIsAdmin(false);
        setIsSubcontractor(false);
        setLoading(false);
      }
    });

    // Le rôle n'était demandé qu'au montage. Démarrée sans réseau, l'app
    // restait donc indéfiniment sur un rôle par défaut, même une fois la
    // connexion revenue. On retente dès le retour en ligne, tant que le
    // serveur n'a pas confirmé le profil.
    const unsubOnline = onlineManager.subscribe(() => {
      if (!onlineManager.isOnline() || confirmedRef.current || cancelled) return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user && !cancelled) void checkRole();
      });
    });

    return () => {
      cancelled = true;
      unsubOnline();
      subscription.unsubscribe();
    };
  }, []);

  return { session, isAdmin, isSubcontractor, userZone, userName, userColor, employeeId, loading };
};
