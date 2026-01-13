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

// 2. Adapter pour Web SÉCURISÉ (Vérifie si localStorage existe)
// Cela empêche le crash lors du rendu serveur
const ExpoWebStorage = {
  getItem: (key: string) => {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") {
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
    // Ici, on utilise notre wrapper ExpoWebStorage au lieu de localStorage direct
    storage: Platform.OS === "web" ? ExpoWebStorage : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
