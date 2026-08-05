/**
 * File d'attente des écritures (outbox).
 *
 * Toutes les écritures du parcours ouvrier passent par ici, y compris en
 * ligne. C'est délibéré : si certaines partaient en direct et d'autres par la
 * file, une opération en direct pourrait doubler une opération encore en
 * attente et casser l'ordre de la chaîne de clôture
 * (prestations réalisées -> création de la reprise -> marquage terminé).
 * L'interface, elle, reste instantanée grâce aux mises à jour optimistes.
 *
 * Garanties :
 *  - ordre FIFO strict ; un échec réseau bloque la file plutôt que de laisser
 *    passer les suivantes ;
 *  - pas de doublon au rejeu : chaque entrée porte un `client_operation_id`
 *    que le serveur journalise (voir app/core/idempotency.py) ;
 *  - les identifiants temporaires sont résolus avant envoi (voir idMap.ts).
 */
import { api } from "../api";
import { readJson, writeJson, isOfflineSupported } from "./storage";
import { isOnlineNow } from "./network";
import {
  substituteTempIds,
  hasUnresolvedTempId,
  hasFailedTempId,
  resolveTempId,
  markTempIdFailed,
} from "./idMap";

const QUEUE_KEY = "lvm_outbox_v1";
const FAILED_KEY = "lvm_outbox_failed_v1";
const MAX_ATTEMPTS = 8;

export type OutboxKind =
  | "payment-mode"     // mode de paiement / encaissement
  | "items-done"       // prestations réalisées à la clôture
  | "create-reprise"   // création du RDV de reprise
  | "mark-done"        // marquage terminé + reprise prise
  | "no-reprise"       // clôture sans reprise
  | "service-create"
  | "service-rename"
  | "service-delete";

export type OutboxEntry = {
  id: string;                  // sert aussi de client_operation_id
  kind: OutboxKind;
  method: "POST" | "PATCH" | "DELETE";
  url: string;                 // peut contenir un id temporaire
  body?: any;                  // idem
  tempId?: string;             // pour service-create : l'id qu'elle résout
  label?: string;              // libellé lisible, pour l'écran des échecs
  createdAt: number;
  attempts: number;
  lastError?: string;
};

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Nombre d'entrées en attente, maintenu en mémoire.
 *
 * Nécessaire en lecture synchrone : les écrans doivent pouvoir suspendre leurs
 * sondages périodiques tant qu'une écriture n'est pas partie, sinon un refetch
 * écraserait la mise à jour optimiste avec l'état serveur encore inchangé.
 */
let pendingCount = 0;

export function hasPendingWrites(): boolean {
  return pendingCount > 0;
}

async function syncPendingCount(): Promise<void> {
  pendingCount = (await readJson<OutboxEntry[]>(QUEUE_KEY, [])).length;
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  void syncPendingCount();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* un abonné défaillant ne doit pas interrompre les autres */
    }
  });
}

// Au démarrage, la file peut déjà contenir des entrées d'une session précédente.
void syncPendingCount();

/**
 * UUID v4.
 *
 * Le serveur valide ce champ comme un UUID (`Optional[UUID]` côté Pydantic) :
 * un format approximatif est rejeté en 422, donc traité comme une erreur
 * définitive par la file. Le format 8-4-4-4-12 doit être exact.
 */
function newOperationId(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4"; // version
    } else if (i === 19) {
      out += hex[(Math.floor(Math.random() * 16) & 0x3) | 0x8]; // variante
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}

export async function getQueue(): Promise<OutboxEntry[]> {
  return readJson<OutboxEntry[]>(QUEUE_KEY, []);
}

export async function getFailed(): Promise<OutboxEntry[]> {
  return readJson<OutboxEntry[]>(FAILED_KEY, []);
}

export async function getPendingCount(): Promise<number> {
  return (await getQueue()).length;
}

/** Ajoute une écriture en fin de file, puis tente de vider si le réseau est là. */
export async function enqueue(
  entry: Omit<OutboxEntry, "id" | "createdAt" | "attempts">,
): Promise<string> {
  const full: OutboxEntry = {
    ...entry,
    id: newOperationId(),
    createdAt: Date.now(),
    attempts: 0,
  };

  const queue = await getQueue();
  queue.push(full);
  await writeJson(QUEUE_KEY, queue);
  // Mise à jour synchrone : un écran peut interroger `hasPendingWrites()` juste
  // après l'appel, avant que la resynchronisation asynchrone n'ait eu lieu.
  pendingCount = queue.length;
  notify();

  // Sur web (hors périmètre) le stockage est un no-op : on envoie directement.
  if (!isOfflineSupported) {
    await sendEntry(full);
    return full.id;
  }

  if (isOnlineNow()) void flush();
  return full.id;
}

/** Envoie une entrée, en injectant le client_operation_id sur les POST. */
async function sendEntry(entry: OutboxEntry): Promise<any> {
  const url = await substituteTempIds(entry.url);
  const body = entry.body ? await substituteTempIds(entry.body) : undefined;

  const payload =
    entry.method === "POST"
      ? { ...(body ?? {}), client_operation_id: entry.id }
      : body;

  if (entry.method === "DELETE") return (await api.delete(url)).data;
  if (entry.method === "POST") return (await api.post(url, payload)).data;
  return (await api.patch(url, payload)).data;
}

/**
 * Une erreur est-elle définitive ?
 *
 * Un 4xx signifie que la requête est invalide en soi : la rejouer ne changera
 * rien. On excepte 408 (timeout) et 429 (trop de requêtes), qui sont
 * transitoires. Tout le reste (réseau injoignable, 5xx) reste rejouable.
 */
function isPermanentFailure(error: any): boolean {
  const status = error?.response?.status;
  if (!status) return false; // pas de réponse = problème réseau
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

async function moveToFailed(entry: OutboxEntry, message: string): Promise<void> {
  const failed = await getFailed();
  failed.push({ ...entry, lastError: message });
  await writeJson(FAILED_KEY, failed);

  // Une création de prestation en échec rend son id temporaire irrésolvable :
  // on le marque pour que les opérations qui le référencent le remplacent par
  // null plutôt que de rester bloquées.
  if (entry.tempId) await markTempIdFailed(entry.tempId);
}

let flushing = false;

/**
 * Vide la file, dans l'ordre, en s'arrêtant au premier échec rejouable.
 *
 * S'arrêter est volontaire : la chaîne de clôture n'a de sens que dans
 * l'ordre, et une création de prestation doit aboutir avant l'intervention
 * qui la référence.
 */
export async function flush(): Promise<{ sent: number; failed: number; remaining: number }> {
  if (flushing || !isOfflineSupported) {
    return { sent: 0, failed: 0, remaining: (await getQueue()).length };
  }
  flushing = true;

  let sent = 0;
  let failed = 0;

  try {
    // Boucle bornée par la taille initiale : chaque tour retire ou conserve
    // l'entrée de tête, donc pas de risque de boucle infinie.
    for (let guard = (await getQueue()).length; guard > 0; guard--) {
      const queue = await getQueue();
      if (queue.length === 0) break;
      if (!isOnlineNow()) break;

      const entry = queue[0];

      // Un id temporaire encore non résolu à ce stade signale une file
      // incohérente (la création aurait dû précéder) : on écarte l'entrée
      // plutôt que de bloquer la file indéfiniment.
      if (await hasUnresolvedTempId({ url: entry.url, body: entry.body })) {
        await moveToFailed(entry, "Référence non résolue");
        await writeJson(QUEUE_KEY, queue.slice(1));
        failed++;
        notify();
        continue;
      }

      // La prestation visée n'a jamais pu être créée : renommer ou supprimer
      // une ressource inexistante n'a pas de sens et construirait une URL
      // invalide (.../services/null). On écarte l'entrée.
      // Dans le corps en revanche, la substitution en null est acceptable :
      // `client_service_id` est nullable, l'item garde libellé et prix.
      if (await hasFailedTempId(entry.url)) {
        await moveToFailed(entry, "Prestation liée jamais créée");
        await writeJson(QUEUE_KEY, queue.slice(1));
        failed++;
        notify();
        continue;
      }

      try {
        const result = await sendEntry(entry);

        // Création de prestation : on mémorise l'id serveur pour que les
        // entrées suivantes puissent y faire référence.
        if (entry.tempId && result?.id) {
          await resolveTempId(entry.tempId, String(result.id));
        }

        await writeJson(QUEUE_KEY, (await getQueue()).slice(1));
        sent++;
        notify();
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? error?.message ?? "Erreur inconnue";

        if (isPermanentFailure(error)) {
          await moveToFailed(entry, String(message));
          await writeJson(QUEUE_KEY, (await getQueue()).slice(1));
          failed++;
          notify();
          continue;
        }

        // Erreur transitoire : on incrémente et on s'arrête là pour préserver
        // l'ordre. La file repartira au prochain retour de réseau.
        const current = await getQueue();
        current[0] = {
          ...entry,
          attempts: entry.attempts + 1,
          lastError: String(message),
        };

        if (current[0].attempts >= MAX_ATTEMPTS) {
          await moveToFailed(current[0], `Abandon après ${MAX_ATTEMPTS} tentatives`);
          await writeJson(QUEUE_KEY, current.slice(1));
          failed++;
        } else {
          await writeJson(QUEUE_KEY, current);
        }
        notify();
        break;
      }
    }
  } finally {
    flushing = false;
  }

  return { sent, failed, remaining: (await getQueue()).length };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remet les entrées en échec en fin de file (action « réessayer »). */
export async function retryFailed(): Promise<void> {
  const failed = await getFailed();
  if (failed.length === 0) return;

  const queue = await getQueue();
  queue.push(
    ...failed.map((e) => ({
      ...e,
      // Un identifiant mal formé est rejeté en validation par le serveur : le
      // réessai échouerait à l'identique indéfiniment. L'opération n'ayant
      // jamais abouti, en regénérer un est sans risque de doublon.
      id: UUID_RE.test(e.id) ? e.id : newOperationId(),
      attempts: 0,
      lastError: undefined,
    })),
  );
  await writeJson(QUEUE_KEY, queue);
  await writeJson(FAILED_KEY, []);
  notify();

  if (isOnlineNow()) void flush();
}

export async function clearFailed(): Promise<void> {
  await writeJson(FAILED_KEY, []);
  notify();
}

/** Purge complète (déconnexion). */
export async function clearOutbox(): Promise<void> {
  await writeJson(QUEUE_KEY, []);
  await writeJson(FAILED_KEY, []);
  notify();
}
