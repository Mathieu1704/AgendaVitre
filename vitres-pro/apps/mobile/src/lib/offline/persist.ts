/**
 * Persistance du cache React Query.
 *
 * Sans cela le cache vit uniquement en mémoire : un redémarrage de l'app sans
 * réseau affiche un planning vide. On le sérialise donc dans AsyncStorage.
 *
 * Le filtre `shouldDehydrateQuery` est une LISTE BLANCHE, pas une exclusion :
 * la requête `["interventions"]` sans bornes de dates charge tout l'historique
 * de l'employé et ferait exploser le quota AsyncStorage (~6 Mo sur Android).
 * On ne garde que la fenêtre glissante et les référentiels utiles hors ligne.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Query } from "@tanstack/react-query";

export const PERSIST_KEY = "lvm_query_cache_v1";

/** Durée de conservation du cache hors ligne. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 2000, // évite d'écrire à chaque frappe / refetch
});

/**
 * Clés conservées hors ligne.
 *
 * `["interventions", start, end]` (avec bornes) est gardée, `["interventions"]`
 * seule est écartée : c'est la requête non bornée.
 */
function isPersistableKey(key: readonly unknown[]): boolean {
  const [root] = key;

  if (root === "interventions") return key.length > 1;

  return (
    root === "intervention" ||
    root === "clients" ||
    root === "client-services" ||
    root === "client-detail" ||
    root === "employees" ||
    root === "company-settings" ||
    root === "hourly-rates"
  );
}

export function shouldDehydrateQuery(query: Query): boolean {
  // Ne jamais persister une requête en erreur : on figerait un état cassé
  // pour 7 jours, y compris après le retour du réseau.
  if (query.state.status !== "success") return false;
  return isPersistableKey(query.queryKey);
}
