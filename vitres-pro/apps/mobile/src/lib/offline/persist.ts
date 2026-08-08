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
import type { Query } from "@tanstack/react-query";
import { chunkedAsyncStoragePersister } from "./chunkedPersister";

/** Durée de conservation du cache hors ligne. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Persister découpé : une seule clé AsyncStorage ne peut pas dépasser 2 Mo sur
// Android, ce que le cache des interventions franchit largement.
export const queryPersister = chunkedAsyncStoragePersister;

/**
 * Clés conservées hors ligne.
 *
 * `["interventions", start, end]` (avec bornes) est gardée, `["interventions"]`
 * seule est écartée : c'est la requête non bornée.
 */
function isPersistableKey(key: readonly unknown[]): boolean {
  const [root] = key;

  if (root === "interventions") return key.length > 1;

  // Volontairement exclus :
  //  - ["clients"] : ~3000 clients, inutiles hors ligne puisque chaque
  //    intervention embarque déjà le sien ;
  //  - ["intervention", id] : duplique la liste, dont la fiche se sert
  //    désormais comme donnée initiale.
  return (
    root === "client-services" ||
    root === "employees" ||
    root === "company-settings" ||
    root === "hourly-rates" ||
    // Statistiques de charge par jour (coloration vert/orange/rouge du
    // calendrier de reprise). Légères — de simples agrégats par date, pas des
    // interventions complètes — donc peu coûteuses à conserver.
    root === "horizon-stats" ||
    root === "initial-stats-reprise"
  );
}

export function shouldDehydrateQuery(query: Query): boolean {
  // Ne jamais persister une requête en erreur : on figerait un état cassé
  // pour 7 jours, y compris après le retour du réseau.
  if (query.state.status !== "success") return false;
  return isPersistableKey(query.queryKey);
}
