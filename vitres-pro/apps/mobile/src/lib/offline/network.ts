/**
 * Détection réseau.
 *
 * Avant ce module, l'app n'avait aucune détection : React Query se croyait
 * toujours en ligne (son `onlineManager` par défaut ne sait rien faire sur
 * React Native sans NetInfo), donc rien n'était mis en pause hors réseau et
 * rien n'était repris au retour de la connexion.
 *
 * On distingue « connecté » de « internet réellement joignable » : NetInfo
 * expose `isInternetReachable`, qui reste plus fiable qu'un simple état wifi
 * sur un portail captif ou une connexion sans route.
 */
import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { isOfflineSupported } from "./storage";

function isReachable(state: NetInfoState): boolean {
  // `isInternetReachable` vaut null tant que la sonde n'a pas abouti : dans ce
  // cas on se fie à `isConnected` pour ne pas afficher un faux hors-ligne au
  // démarrage.
  if (state.isInternetReachable === null) return !!state.isConnected;
  return !!state.isConnected && state.isInternetReachable;
}

/**
 * Branche NetInfo sur React Query. À appeler une seule fois au démarrage.
 * Retourne la fonction de désabonnement.
 */
export function startNetworkWatch(): () => void {
  if (!isOfflineSupported) return () => {};

  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(isReachable(state));
    });
    return unsubscribe;
  });

  // État initial : sans cet appel, `onlineManager` garde sa valeur par défaut
  // jusqu'au premier changement d'état réseau.
  NetInfo.fetch().then((state) => onlineManager.setOnline(isReachable(state)));

  return () => onlineManager.setEventListener(() => () => {});
}

/** État de connexion, pour l'affichage (bannière hors-ligne). */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => {
    return onlineManager.subscribe(() => setOnline(onlineManager.isOnline()));
  }, []);

  return online;
}

/** Lecture ponctuelle, hors composant React (utilisée par la file d'attente). */
export function isOnlineNow(): boolean {
  return onlineManager.isOnline();
}
