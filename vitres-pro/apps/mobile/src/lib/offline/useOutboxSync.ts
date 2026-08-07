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
  getQueue,
  getFailed,
  subscribeOutbox,
  subscribeFlushed,
  type OutboxEntry,
} from "./outbox";
import { isOfflineSupported } from "./storage";

export function useOutboxSync() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<OutboxEntry[]>([]);
  // Nombre de tentatives infructueuses sur l'entrée en tête de file. Permet de
  // distinguer une synchronisation en cours d'un réseau qui répond mal :
  // l'appareil peut se croire connecté alors qu'aucune requête n'aboutit.
  const [stalledAttempts, setStalledAttempts] = useState(0);

  const refresh = useCallback(async () => {
    const queue = await getQueue();
    setPending(queue.length);
    setStalledAttempts(queue[0]?.attempts ?? 0);
    setFailed(await getFailed());
  }, []);

  // Remplace les données optimistes par l'état réel du serveur : lui seul
  // calcule la sous-zone, les identifiants définitifs et les totaux.
  const resync = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["interventions"] });
    queryClient.invalidateQueries({ queryKey: ["intervention"] });
    queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const run = useCallback(async () => {
    const result = await flush();
    if (result.sent > 0) resync();
    await refresh();
  }, [resync, refresh]);

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

    // `enqueue` vide la file de lui-même quand le réseau est disponible :
    // sans cet abonnement, cet envoi-là ne déclencherait aucun rafraîchissement.
    const unsubFlushed = subscribeFlushed(() => {
      resync();
      void refresh();
    });

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && onlineManager.isOnline()) void run();
    });

    return () => {
      unsubOnline();
      unsubQueue();
      unsubFlushed();
      sub.remove();
    };
  }, [run, refresh, resync]);

  return { pending, failed, stalledAttempts, sync: run, refresh };
}
