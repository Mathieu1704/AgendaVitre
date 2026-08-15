import axios from "axios";
import { router } from "expo-router";
import { Platform } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { supabase } from "./supabase";

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
    const { data } = await supabase.auth.getSession();
    _cachedToken = data.session?.access_token ?? null;
  }
  if (_cachedToken) {
    config.headers.Authorization = `Bearer ${_cachedToken}`;
  }
  return config;
});

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

    if (error.response?.status === 401) {
      _cachedToken = null;
      router.replace("/(auth)/login");
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
