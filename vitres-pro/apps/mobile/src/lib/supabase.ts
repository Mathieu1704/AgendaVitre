import "react-native-url-polyfill/auto";
import { createClient, Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { onlineManager } from "@tanstack/react-query";

// 1. Adapter pour Mobile (SecureStore) - inchangé
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

// 2. Adapter pour Web SÉCURISÉ (Vérifie si window existe)
// La modification est ici : on vérifie "typeof window" pour éviter le crash côté serveur
const ExpoWebStorage = {
  getItem: (key: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(key);
    }
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const authStorage = Platform.OS === "web" ? ExpoWebStorage : ExpoSecureStoreAdapter;

export const supabase = createClient(url, key, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Clé de stockage utilisée par supabase-js pour persister la session. Comme
// on ne l'a jamais surchargée via `auth.storageKey`, le client applique sa
// valeur par défaut : `sb-<project-ref>-auth-token` (voir
// @supabase/supabase-js/src/SupabaseClient.ts, `defaultStorageKey`) — PAS la
// constante générique `supabase.auth.token` de @supabase/auth-js, qui ne
// s'applique que si aucune storageKey n'est calculée par SupabaseClient.
const SESSION_STORAGE_KEY = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;

// Lecture locale de la session persistée, sans réseau. Contrairement à
// `supabase.auth.getSession()`, ne déclenche jamais de refresh token — donc
// peut renvoyer une session expirée, mais résout toujours immédiatement.
async function readPersistedSessionFast(): Promise<Session | null> {
  try {
    const raw = await authStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

/**
 * `supabase.auth.getSession()` sans filet peut rester bloqué indéfiniment :
 * si le token est expiré (ou proche de l'être), le SDK tente un refresh
 * réseau sans timeout ni AbortController. Sur un appareil "connecté mais
 * sans route internet" (portail captif, wifi chantier sans accès, etc.),
 * ce fetch ne se résout jamais — l'app reste bloquée sur son écran de
 * chargement même si une session/des données en cache existent déjà.
 *
 * `getSessionFast()` court-circuite dès qu'on sait qu'on est hors ligne
 * (NetInfo, via onlineManager) et sinon borne l'attente à `timeoutMs`,
 * avec repli sur la session persistée en stockage local dans les deux cas.
 */
type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

function toGetSessionResult(session: Session | null): GetSessionResult {
  return session
    ? { data: { session }, error: null }
    : { data: { session: null }, error: null };
}

export async function getSessionFast(timeoutMs = 5000): Promise<GetSessionResult> {
  if (!onlineManager.isOnline()) {
    return toGetSessionResult(await readPersistedSessionFast());
  }

  return Promise.race([
    supabase.auth.getSession(),
    new Promise<GetSessionResult>((resolve) => {
      setTimeout(async () => {
        resolve(toGetSessionResult(await readPersistedSessionFast()));
      }, timeoutMs);
    }),
  ]);
}
