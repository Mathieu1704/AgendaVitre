/**
 * Déclencheurs de synchronisation de la file d'attente.
 *
 * Trois moments : le retour du réseau, le retour de l'app au premier plan
 * (le réseau a pu revenir pendant qu'elle était en arrière-plan, sans que
 * l'écouteur NetInfo ne soit réveillé), et le montage initial.
 *
 * Retourne de quoi alimenter l'indicateur « N modifications en attente ».
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import {
  flush,
  getQueue,
  getFailed,
  getPendingCountSnapshot,
  subscribeOutbox,
  subscribeFlushed,
  type OutboxEntry,
} from "./outbox";
import { isOfflineSupported } from "./storage";

export function useOutboxSync() {
  const queryClient = useQueryClient();
  const pending = useSyncExternalStore(
    (onStoreChange) => subscribeOutbox(() => onStoreChange()),
    getPendingCountSnapshot,
    getPendingCountSnapshot,
  );
  const [failed, setFailed] = useState<OutboxEntry[]>([]);
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  // Nombre de tentatives infructueuses sur l'entrée en tête de file. Permet de
  // distinguer une synchronisation en cours d'un réseau qui répond mal :
  // l'appareil peut se croire connecté alors qu'aucune requête n'aboutit.
  const [stalledAttempts, setStalledAttempts] = useState(0);
  const [pendingError, setPendingError] = useState<string | undefined>();
  const refreshVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const [queue, failedEntries] = await Promise.all([getQueue(), getFailed()]);

    // Les notifications d'ajout et de retrait peuvent lancer deux lectures
    // presque simultanées. Une lecture ancienne ne doit jamais réafficher un
    // compteur déjà revenu à zéro après la fin de la synchronisation.
    if (version !== refreshVersion.current) return;
    setStalledAttempts(queue[0]?.attempts ?? 0);
    setPendingError(queue[0]?.lastError);
    setFailed(failedEntries);
  }, []);

  // Remplace les données optimistes par l'état réel du serveur : lui seul
  // calcule la sous-zone, les identifiants définitifs et les totaux.
  const resync = useCallback(() => {
    // Marque toutes les variantes comme périmées, mais ne recharge ici que les
    // petites plages de planning visibles. Le dashboard historique sera
    // réconcilié lorsqu'il reprendra le focus, sans bloquer l'interaction en
    // cours dans le calendrier.
    queryClient.invalidateQueries({
      queryKey: ["interventions"],
      refetchType: "none",
    });
    queryClient.refetchQueries({
      type: "active",
      predicate: (query) => {
        const key = query.queryKey;
        if (
          key[0] !== "interventions" ||
          key.length !== 3 ||
          typeof key[1] !== "string" ||
          typeof key[2] !== "string"
        ) return false;
        const spanDays = (Date.parse(key[2]) - Date.parse(key[1])) / 86_400_000;
        return spanDays >= 20 && spanDays <= 100;
      },
    });
    queryClient.invalidateQueries({ queryKey: ["intervention"] });
    queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["tour-run"] });
    queryClient.invalidateQueries({ queryKey: ["tour-runs-assigned"] });
  }, [queryClient]);

  const run = useCallback(async () => {
    await flush();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOfflineSupported) return;

    void refresh();
    void run();

    const unsubOnline = onlineManager.subscribe(() => {
      const isOnline = onlineManager.isOnline();
      setOnline(isOnline);
      if (isOnline) void run();
    });

    const unsubQueue = subscribeOutbox((count) => {
      if (count === 0) {
        setStalledAttempts(0);
        setPendingError(undefined);
      }
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

  // File non vide en ligne : on relit brièvement le stockage jusqu'à ce que le
  // retrait final soit observé. Cette vérification ne fait aucun appel réseau
  // et s'arrête immédiatement lorsque le compteur atteint zéro.
  useEffect(() => {
    if (pending === 0 || !online) return;
    const timer = setInterval(() => void refresh(), 2_000);
    return () => clearInterval(timer);
  }, [online, pending, refresh]);

  return { pending, failed, stalledAttempts, pendingError, sync: run, refresh };
}
