/**
 * Correspondance entre identifiants temporaires et identifiants serveur.
 *
 * Quand un ouvrier crée une prestation sans réseau, on ne peut pas connaître
 * l'id que le serveur lui donnera. On fabrique donc un id temporaire
 * (`tmp_<uuid>`) utilisable immédiatement par l'interface, puis référencé par
 * les opérations suivantes — typiquement `items[].client_service_id` dans la
 * création du RDV de reprise.
 *
 * Au moment de vider la file, la création part en premier (ordre FIFO) : dès
 * qu'elle aboutit, on enregistre `tmp_xxx -> uuid serveur` ici, et toutes les
 * opérations encore en attente sont réécrites avant d'être envoyées.
 */
import { readJson, writeJson } from "./storage";

const ID_MAP_KEY = "lvm_offline_id_map_v1";
const TEMP_PREFIX = "tmp_";

type IdMap = Record<string, string>;

let cache: IdMap | null = null;

export function isTempId(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(TEMP_PREFIX);
}

export function newTempId(): string {
  // `crypto.randomUUID` n'est pas garanti sur toutes les versions de Hermes.
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${TEMP_PREFIX}${rand}`;
}

async function load(): Promise<IdMap> {
  if (cache) return cache;
  cache = await readJson<IdMap>(ID_MAP_KEY, {});
  return cache;
}

/** Enregistre la résolution d'un id temporaire après création côté serveur. */
export async function resolveTempId(tempId: string, serverId: string): Promise<void> {
  const map = await load();
  map[tempId] = serverId;
  await writeJson(ID_MAP_KEY, map);
}

/** Marque un id temporaire comme définitivement irrésolvable (création en échec). */
export async function markTempIdFailed(tempId: string): Promise<void> {
  const map = await load();
  map[tempId] = "";
  await writeJson(ID_MAP_KEY, map);
}

/**
 * Remplace récursivement les ids temporaires par leur id serveur.
 *
 * Un id temporaire connu comme échoué est remplacé par `null` : côté modèle,
 * `client_service_id` est nullable, donc la prestation reste rattachée à
 * l'intervention avec son libellé et son prix — seul le lien au catalogue est
 * perdu. C'est préférable à un rejet de toute l'opération.
 *
 * Un id temporaire encore inconnu est laissé tel quel : cela ne doit pas
 * arriver (la création le précède dans la file) et signalerait une file
 * incohérente, que l'appelant doit traiter comme une erreur.
 */
export async function substituteTempIds<T>(value: T): Promise<T> {
  const map = await load();

  const walk = (node: any): any => {
    if (typeof node === "string") {
      // Chaîne qui EST un id temporaire (ex: `client_service_id`) : on peut
      // renvoyer null si la création a échoué, le champ est nullable.
      if (isTempId(node)) {
        const resolved = map[node];
        if (resolved === undefined) return node; // encore inconnu
        return resolved === "" ? null : resolved; // "" = création échouée
      }
      // Chaîne qui CONTIENT un id temporaire (ex: une URL) : on remplace le
      // segment concerné. Sans ce cas, les URL n'étaient jamais réécrites.
      if (!node.includes(TEMP_PREFIX)) return node;
      return node
        .split("/")
        .map((part) => {
          if (!isTempId(part)) return part;
          const resolved = map[part];
          return resolved === undefined || resolved === "" ? part : resolved;
        })
        .join("/");
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };

  return walk(value) as T;
}

export type TempIdStatus = "resolved" | "failed" | "unknown";

export async function getTempIdStatus(tempId: string): Promise<TempIdStatus> {
  const map = await load();
  const value = map[tempId];
  if (value === undefined) return "unknown";
  return value === "" ? "failed" : "resolved";
}

/** Liste les ids temporaires présents dans une valeur (URL ou corps). */
export function collectTempIds(value: unknown): string[] {
  const found = new Set<string>();

  const walk = (node: any): void => {
    if (typeof node === "string") {
      // Une URL contient l'id comme segment de chemin, pas comme valeur seule.
      if (isTempId(node)) {
        found.add(node);
        return;
      }
      for (const part of node.split("/")) if (isTempId(part)) found.add(part);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") Object.values(node).forEach(walk);
  };

  walk(value);
  return [...found];
}

/** Y a-t-il un id temporaire dont la création n'a pas encore abouti ? */
export async function hasUnresolvedTempId(value: unknown): Promise<boolean> {
  for (const id of collectTempIds(value)) {
    if ((await getTempIdStatus(id)) === "unknown") return true;
  }
  return false;
}

/** Y a-t-il un id temporaire dont la création a définitivement échoué ? */
export async function hasFailedTempId(value: unknown): Promise<boolean> {
  for (const id of collectTempIds(value)) {
    if ((await getTempIdStatus(id)) === "failed") return true;
  }
  return false;
}

/** Purge la table (déconnexion). */
export async function clearIdMap(): Promise<void> {
  cache = {};
  await writeJson(ID_MAP_KEY, {});
}
