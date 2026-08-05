/**
 * Stockage local du mode hors-connexion.
 *
 * Même principe que `src/lib/supabase.ts` : un adaptateur par plateforme.
 * On n'utilise PAS SecureStore ici — il plafonne à ~2 Ko par valeur, très
 * en dessous de ce que pèsent le cache des interventions et la file d'attente.
 *
 * Sur web, le hors-connexion n'est pas dans le périmètre (les admins
 * travaillent au bureau) : les fonctions deviennent des no-op pour que le
 * même code puisse tourner sans casser le bundle web statique.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const isOfflineSupported = Platform.OS !== "web";

export async function readKey(key: string): Promise<string | null> {
  if (!isOfflineSupported) return null;
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // Un stockage illisible ne doit jamais empêcher l'app de démarrer.
    return null;
  }
}

export async function writeKey(key: string, value: string): Promise<void> {
  if (!isOfflineSupported) return;
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* quota atteint ou stockage indisponible : on abandonne silencieusement */
  }
}

export async function removeKey(key: string): Promise<void> {
  if (!isOfflineSupported) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* idem */
  }
}

/** Lit une valeur JSON, en retombant sur `fallback` si absente ou corrompue. */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await readKey(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await writeKey(key, JSON.stringify(value));
  } catch {
    /* valeur non sérialisable : on ignore */
  }
}
