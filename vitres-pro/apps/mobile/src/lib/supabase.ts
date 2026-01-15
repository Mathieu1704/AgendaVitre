import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// 1. Adapter pour Mobile (SecureStore) - inchangé
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("ERREUR: URL ou Clé Supabase manquante dans le .env");
}

export const supabase = createClient(url, key, {
  auth: {
    storage: Platform.OS === "web" ? ExpoWebStorage : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
