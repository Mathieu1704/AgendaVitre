import axios from "axios";
import { router } from "expo-router";
import { supabase } from "./supabase";
import { toast } from "../ui/toast";

// Pour le WEB, localhost marche.
// Pour ANDROID Emulator, il faudra peut-être utiliser 'http://10.0.2.2:8000' plus tard.
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

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
  (error) => {
    if (error.code === "ECONNABORTED") {
      toast.error("Délai dépassé", "Le serveur ne répond pas. Réessaie.");
    } else if (error.response?.status === 401) {
      _cachedToken = null;
      router.replace("/(auth)/login");
    } else if (!error.response) {
      toast.error("Hors ligne", "Vérifie ta connexion internet.");
    }
    return Promise.reject(error);
  },
);
