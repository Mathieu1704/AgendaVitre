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
const chunkKey = (i: number) => `${PREFIX}:${i}`;

// 512 Ko : large sous la limite de 2 Mo, en gardant à l'esprit que les
// caractères non-ASCII (accents) pèsent plusieurs octets en UTF-8.
const CHUNK_SIZE = 512 * 1024;

type Meta = { count: number };

async function clearChunks(count: number): Promise<void> {
  const keys = [META_KEY];
  for (let i = 0; i < count; i++) keys.push(chunkKey(i));
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

export const chunkedAsyncStoragePersister: Persister = {
  async persistClient(client: PersistedClient) {
    try {
      const serialized = JSON.stringify(client);
      const chunks: [string, string][] = [];
      for (let i = 0; i * CHUNK_SIZE < serialized.length; i++) {
        chunks.push([chunkKey(i), serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)]);
      }

      // Les morceaux d'abord, l'enregistrement de tête ensuite : si l'écriture
      // est interrompue, la tête pointe encore sur l'ancienne version complète
      // plutôt que sur un cache tronqué.
      const previous = await readMeta();
      await AsyncStorage.multiSet(chunks);
      await AsyncStorage.setItem(META_KEY, JSON.stringify({ count: chunks.length }));

      // Purge les morceaux devenus inutiles si le cache a rétréci.
      if (previous && previous.count > chunks.length) {
        const stale: string[] = [];
        for (let i = chunks.length; i < previous.count; i++) stale.push(chunkKey(i));
        await AsyncStorage.multiRemove(stale);
      }
    } catch {
      // Un cache non écrit dégrade le hors-ligne mais ne doit jamais faire
      // échouer l'application.
    }
  },

  async restoreClient() {
    // L'ancien cache monobloc reste en base et n'est plus relisible (c'est
    // précisément ce qui dépassait la limite de ligne) : on s'en débarrasse.
    AsyncStorage.removeItem("lvm_query_cache_v1").catch(() => {});

    try {
      const meta = await readMeta();
      if (!meta || meta.count <= 0) return undefined;

      const keys = Array.from({ length: meta.count }, (_, i) => chunkKey(i));
      const entries = await AsyncStorage.multiGet(keys);

      // Un morceau manquant rend l'ensemble inexploitable : on repart de zéro
      // plutôt que de restaurer un cache incohérent.
      const parts: string[] = [];
      for (const [, value] of entries) {
        if (value == null) {
          await clearChunks(meta.count);
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
    const meta = await readMeta();
    await clearChunks(meta?.count ?? 0);
  },
};
