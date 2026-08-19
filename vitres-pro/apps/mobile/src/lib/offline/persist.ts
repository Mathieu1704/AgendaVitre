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

  if (root === "interventions") {
    // Le planning courant charge environ trois mois. Les grandes plages du
    // dashboard (plusieurs milliers de lignes) et la liste historique de
    // facturation ne sont pas nécessaires au travail hors ligne et rendaient
    // chaque sauvegarde beaucoup trop lourde sur Android.
    if (key.length !== 3 || typeof key[1] !== "string" || typeof key[2] !== "string") {
      return false;
    }
    const start = Date.parse(key[1]);
    const end = Date.parse(key[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    const spanDays = (end - start) / (24 * 60 * 60 * 1000);
    return spanDays >= 20 && spanDays <= 100;
  }

  if (root === "tour-runs-assigned") {
    if (key.length !== 3 || typeof key[1] !== "string" || typeof key[2] !== "string") return false;
    const start = Date.parse(key[1]);
    const end = Date.parse(key[2]);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start && (end - start) / 86_400_000 <= 100;
  }

  // Volontairement exclus :
  //  - ["clients"] : ~3000 clients, inutiles hors ligne puisque chaque
  //    intervention embarque déjà le sien ;
  //  - ["intervention", id] : duplique la liste, dont la fiche se sert
  //    désormais comme donnée initiale.
  return (
    root === "client-services" ||
    root === "chain-services" ||
    root === "employees" ||
    root === "company-settings" ||
    root === "hourly-rates" ||
    // Agrégats très légers utilisés par la barre d'heures du jour et la vue
    // semaine. Sans eux, les interventions restaient visibles hors ligne mais
    // la capacité disparaissait pour tous les jours non ouverts auparavant.
    root === "planning-stats" ||
    root === "planning-range" ||
    // Statistiques de charge par jour (coloration vert/orange/rouge du
    // calendrier de reprise). Légères — de simples agrégats par date, pas des
    // interventions complètes — donc peu coûteuses à conserver.
    root === "horizon-stats" ||
    root === "initial-stats-reprise" ||
    // Six lignes {mois, CA} agrégées par le serveur pour le graphique du
    // dashboard. Sans persistance, la courbe repartait vide à chaque
    // démarrage alors que les revenus passés ne changent plus.
    root === "monthly-revenue" ||
    // Un simple entier, contrairement à ["clients"] (~3000 lignes) qui reste
    // exclu : le compteur du dashboard s'affiche donc dès le démarrage.
    root === "clients-count" ||
    root === "tour-run"
  );
}

export function shouldDehydrateQuery(query: Query): boolean {
  // Ne jamais persister une requête en erreur : on figerait un état cassé
  // pour 7 jours, y compris après le retour du réseau.
  if (query.state.status !== "success") return false;
  return isPersistableKey(query.queryKey);
}
