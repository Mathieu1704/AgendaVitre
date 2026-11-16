/**
 * Rechargement automatique de l'agenda.
 *
 * L'écran agenda reste monté (onglet) : sans ce hook, les interventions
 * n'étaient relues qu'au démarrage à froid, au tirer-pour-rafraîchir, au
 * changement de mois ou après une écriture locale. Un employé qui gardait
 * l'app ouverte, ou la ressortait de sa poche, voyait donc l'ancien planning.
 * Il n'y a pas de push temps réel sur les interventions.
 *
 * On recharge :
 *  - quand l'écran reprend le focus (retour sur l'onglet) ;
 *  - quand l'app revient au premier plan ;
 *  - toutes les 2 minutes tant que l'écran est affiché et l'app active.
 *
 * On ne recharge PAS hors ligne, ni tant que des écritures locales attendent
 * leur envoi : la réponse du serveur écraserait l'état optimiste, et la file
 * d'attente resynchronise de toute façon une fois vidée (useOutboxSync).
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { isOnlineNow } from "../lib/offline/network";
import { hasPendingWrites } from "../lib/offline/outbox";

const INTERVAL_MS = 2 * 60 * 1000;
// Évite deux rechargements coup sur coup (focus + premier plan au même moment).
const MIN_GAP_MS = 15 * 1000;

export function useAgendaAutoRefresh(refresh: () => unknown, enabled = true): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  // Initialisé au montage : le premier chargement est déjà fait par la requête.
  const lastRunRef = useRef(Date.now());

  const run = useCallback(() => {
    if (AppState.currentState !== "active") return;
    if (!isOnlineNow() || hasPendingWrites()) return;
    const now = Date.now();
    if (now - lastRunRef.current < MIN_GAP_MS) return;
    lastRunRef.current = now;
    void refreshRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      run();
      const timer = setInterval(run, INTERVAL_MS);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") run();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [enabled, run]),
  );
}
