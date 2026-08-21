import axios from "axios";
import { Platform } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { supabase, getSessionFast } from "./supabase";

const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

// Dans l'émulateur Android, `localhost` pointe vers Android lui-même. L'hôte
// macOS est exposé par l'adresse spéciale 10.0.2.2. iOS et le web conservent
// localhost, tandis que les URL de production (Railway) restent inchangées.
export const API_URL =
  Platform.OS === "android"
    ? configuredApiUrl
        .replace("://localhost", "://10.0.2.2")
        .replace("://127.0.0.1", "://10.0.2.2")
    : configuredApiUrl;

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Cache du token en mémoire — mis à jour via onAuthStateChange (une seule lecture I/O au lieu d'une par requête)
let _cachedToken: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token ?? null;
});
// Initialisation synchrone depuis le cache Supabase au démarrage
supabase.auth.getSession().then(({ data }) => {
  _cachedToken = data.session?.access_token ?? null;
});

// Intercepteur : Ajoute le token Supabase avant chaque envoi
// Si le token n'est pas encore en cache (premier chargement), on attend getSession()
api.interceptors.request.use(async (config) => {
  if (!_cachedToken) {
    const { data } = await getSessionFast();
    _cachedToken = data.session?.access_token ?? null;
  }
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`;
  }
  return config;
});

// Un seul refreshSession() en vol même si plusieurs requêtes tombent en 401
// en même temps (ex: plusieurs appels lancés au même instant) : elles
// partagent la même promesse au lieu de déclencher chacune leur refresh.
let _refreshPromise: Promise<string | null> | null = null;
function refreshSessionOnce(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = supabase.auth
      .refreshSession()
      .then(({ data, error }) => (error ? null : (data.session?.access_token ?? null)))
      .catch(() => null)
      .finally(() => {
        _refreshPromise = null;
      });
  }
  return _refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const isNetworkIssue = error.code === "ECONNABORTED" || !error.response;

    // Retry silencieux, une seule fois, uniquement pour les lectures (GET) : un blip
    // réseau passager ne doit pas déclencher de popup. On ne retry jamais les
    // écritures (POST/PATCH/DELETE) pour ne pas risquer un doublon si la requête
    // avait en fait été traitée côté serveur avant le timeout.
    // Inutile de réessayer si l'appareil se sait hors ligne : la file d'attente
    // et React Query reprendront d'eux-mêmes au retour du réseau.
    if (
      isNetworkIssue &&
      config?.method?.toLowerCase() === "get" &&
      !config._retried &&
      onlineManager.isOnline()
    ) {
      config._retried = true;
      try {
        return await api(config);
      } catch (retryError) {
        error = retryError;
      }
    }

    // Un 401 isolé ne veut pas forcément dire "session morte" : il peut
    // s'agir d'un token expiré juste avant que le rafraîchissement
    // automatique n'ait eu le temps de tourner (course entre timer et
    // requête). On tente un refreshSession() explicite et on rejoue la
    // requête une seule fois avant de conclure à une vraie déconnexion —
    // sinon un simple aller-retour d'1h renvoyait l'employé au login alors
    // que sa session (refresh token, valable ~60 jours) était toujours bonne.
    if (error.response?.status === 401 && !config?._authRetried) {
      config._authRetried = true;
      const newToken = await refreshSessionOnce();
      if (newToken) {
        _cachedToken = newToken;
        try {
          return await api(config);
        } catch (retryError) {
          error = retryError;
        }
      }
    }

    if (error.response?.status === 401) {
      _cachedToken = null;
      // `signOut()` déclenche l'événement d'authentification que `(app)/_layout`
      // écoute pour rediriger vers le login. Naviguer aussi depuis ici faisait
      // rejouer l'écran de connexion autant de fois qu'il y avait de requêtes
      // en 401 — typiquement toute la rafale de préchargement au démarrage.
      void supabase.auth.signOut();
    } else if (isNetworkIssue) {
      // Pas de toast par requête : hors réseau, le planning et les sondages
      // périodiques en déclenchaient une rafale. L'état est signalé une seule
      // fois par la bannière hors-ligne globale (OfflineBanner).
      console.warn(
        `[hors ligne] ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      );
    }
    return Promise.reject(error);
  },
);
