/**
 * Profil utilisateur mis en cache localement.
 *
 * Le rôle et la zone conditionnent toute la navigation : les onglets visibles,
 * et surtout le filtre géographique du planning. Ils venaient uniquement d'un
 * appel réseau (`GET /api/employees/me`), avec un cache limité au web.
 *
 * Conséquence sur natif : au démarrage sans réseau, l'ouvrier perdait son rôle
 * ET sa zone (qui retombait sur "hainaut" par défaut), donc voyait le planning
 * d'une zone qui n'est pas la sienne. C'est ce que corrige ce module.
 */
import { Platform } from "react-native";
import { readJson, writeJson, removeKey } from "./storage";

const PROFILE_KEY = "lvm_cached_profile_v1";

export type CachedProfile = {
  role: string;
  zone: "hainaut" | "ardennes";
  fullName: string;
  email?: string;
  color?: string | null;
  employeeId?: string;
};

const isWeb = Platform.OS === "web";

/**
 * Lecture synchrone, disponible seulement sur web (localStorage).
 * Sur natif, utiliser `loadProfile`.
 */
export function readProfileSync(): CachedProfile | null {
  if (!isWeb || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as CachedProfile) : null;
  } catch {
    return null;
  }
}

export async function loadProfile(): Promise<CachedProfile | null> {
  if (isWeb) return readProfileSync();
  return readJson<CachedProfile | null>(PROFILE_KEY, null);
}

export async function saveProfile(profile: CachedProfile): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch {
        /* quota ou mode privé */
      }
    }
    return;
  }
  await writeJson(PROFILE_KEY, profile);
}

export async function clearProfile(): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(PROFILE_KEY);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  await removeKey(PROFILE_KEY);
}
