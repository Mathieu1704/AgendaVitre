/**
 * Déclencheurs de synchronisation de la file d'attente.
 *
 * Trois moments : le retour du réseau, le retour de l'app au premier plan
 * (le réseau a pu revenir pendant qu'elle était en arrière-plan, sans que
 * l'écouteur NetInfo ne soit réveillé), et le montage initial.
 *
 * Retourne de quoi alimenter l'indicateur « N modifications en attente ».
 */
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import {
  flush,
  getPendingCount,
  getFailed,
  subscribeOutbox,
  type OutboxEntry,
} from "./outbox";
import { isOfflineSupported } from "./storage";

export function useOutboxSync() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<OutboxEntry[]>([]);

  const refresh = useCallback(async () => {
    setPending(await getPendingCount());
    setFailed(await getFailed());
  }, []);

  const run = useCallback(async () => {
    const result = await flush();
    // Après une synchronisation effective, on resynchronise depuis le serveur :
    // les mises à jour optimistes locales sont remplacées par l'état réel.
    if (result.sent > 0) {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    await refresh();
  }, [queryClient, refresh]);

  useEffect(() => {
    if (!isOfflineSupported) return;

    void refresh();
    void run();

    const unsubOnline = onlineManager.subscribe(() => {
      if (onlineManager.isOnline()) void run();
    });

    const unsubQueue = subscribeOutbox(() => {
      void refresh();
    });

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && onlineManager.isOnline()) void run();
    });

    return () => {
      unsubOnline();
      unsubQueue();
      sub.remove();
    };
  }, [run, refresh]);

  return { pending, failed, sync: run, refresh };
}
