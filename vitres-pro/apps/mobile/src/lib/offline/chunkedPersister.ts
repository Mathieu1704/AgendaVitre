/**
 * Persister découpé en morceaux pour AsyncStorage.
 *
 * AsyncStorage stocke chaque clé dans une ligne SQLite, et Android plafonne une
 * ligne à 2 Mo (CursorWindow). Le persister fourni par TanStack écrit tout le
 * cache dans une seule clé : au-delà de ce seuil, l'écriture passe mais la
 * relecture échoue avec « Row too big to fit into CursorWindow », et le cache
 * hors-ligne devient inexploitable.
 *
 * On découpe donc la sérialisation en morceaux nettement sous la limite, avec
 * un enregistrement de tête qui indique combien en relire.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const PREFIX = "lvm_query_cache_v2";
const META_KEY = `${PREFIX}:meta`;
const chunkKey = (i: number, generation?: string) =>
  generation ? `${PREFIX}:${generation}:${i}` : `${PREFIX}:${i}`;

// 512 Ko : large sous la limite de 2 Mo, en gardant à l'esprit que les
// caractères non-ASCII (accents) pèsent plusieurs octets en UTF-8.
const CHUNK_SIZE = 512 * 1024;
const PERSIST_DELAY_MS = 1500;

type Meta = { count: number; generation?: string };

let pendingClient: PersistedClient | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let drainPromise: Promise<void> | null = null;
let generationCounter = 0;

function keysForMeta(meta: Meta): string[] {
  return Array.from(
    { length: meta.count },
    (_, i) => chunkKey(i, meta.generation),
  );
}

async function clearChunks(meta: Meta | null): Promise<void> {
  const keys = [META_KEY, ...(meta ? keysForMeta(meta) : [])];
  await AsyncStorage.multiRemove(keys);
}

async function readMeta(): Promise<Meta | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Meta) : null;
  } catch {
    return null;
  }
}

async function writeClient(client: PersistedClient): Promise<void> {
  try {
    const serialized = JSON.stringify(client);
    const generation = `${Date.now()}-${++generationCounter}`;
    const chunks: [string, string][] = [];
    for (let i = 0; i * CHUNK_SIZE < serialized.length; i++) {
      chunks.push([chunkKey(i, generation), serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)]);
    }

    // Les morceaux d'abord, l'enregistrement de tête ensuite : si l'écriture
    // est interrompue, la tête pointe encore sur l'ancienne version complète
    // plutôt que sur un cache tronqué.
    const previous = await readMeta();
    await AsyncStorage.multiSet(chunks);
    await AsyncStorage.setItem(
      META_KEY,
      JSON.stringify({ count: chunks.length, generation }),
    );

    // La tête pointe maintenant intégralement sur la nouvelle génération :
    // l'ancienne peut être supprimée sans fenêtre de cache partiellement écrit.
    if (previous) {
      await AsyncStorage.multiRemove(keysForMeta(previous));
    }
  } catch {
    // Un cache non écrit dégrade le hors-ligne mais ne doit jamais faire
    // échouer l'application.
  }
}

/**
 * Écrit au plus une version du cache à la fois. Si React Query change pendant
 * l'écriture, seule la version la plus récente est conservée pour le passage
 * suivant. Cela évite les écritures concurrentes et les sérialisations en
 * rafale sur le thread JavaScript.
 */
async function drainPendingClient(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (!drainPromise) {
    drainPromise = (async () => {
      while (pendingClient) {
        const client = pendingClient;
        pendingClient = null;
        await writeClient(client);
      }
    })().finally(() => {
      drainPromise = null;
    });
  }

  await drainPromise;

  // Une demande peut arriver entre le dernier test de la boucle et le finally.
  if (pendingClient) await drainPendingClient();
}

function schedulePersist(client: PersistedClient): void {
  pendingClient = client;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void drainPendingClient();
  }, PERSIST_DELAY_MS);
}

/** Force la dernière sauvegarde de lecture avant la mise en arrière-plan. */
export async function flushPersistedQueryCache(): Promise<void> {
  await drainPendingClient();
}

export const chunkedAsyncStoragePersister: Persister = {
  persistClient(client: PersistedClient) {
    schedulePersist(client);
  },

  async restoreClient() {
    // L'ancien cache monobloc reste en base et n'est plus relisible (c'est
    // précisément ce qui dépassait la limite de ligne) : on s'en débarrasse.
    AsyncStorage.removeItem("lvm_query_cache_v1").catch(() => {});

    try {
      const meta = await readMeta();
      if (!meta || meta.count <= 0) return undefined;

      const keys = keysForMeta(meta);
      const entries = await AsyncStorage.multiGet(keys);

      // Un morceau manquant rend l'ensemble inexploitable : on repart de zéro
      // plutôt que de restaurer un cache incohérent.
      const parts: string[] = [];
      for (const [, value] of entries) {
        if (value == null) {
          await clearChunks(meta);
          return undefined;
        }
        parts.push(value);
      }

      return JSON.parse(parts.join("")) as PersistedClient;
    } catch {
      return undefined;
    }
  },

  async removeClient() {
    pendingClient = null;
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (drainPromise) await drainPromise;
    const meta = await readMeta();
    await clearChunks(meta);
  },
};
