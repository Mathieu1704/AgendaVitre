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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  | "payment-mode"        // mode de paiement / encaissement
  | "items-done"          // prestations réalisées à la clôture
  | "create-reprise"      // création du RDV de reprise
  | "mark-done"           // marquage terminé + reprise prise
  | "no-reprise"          // clôture sans reprise
  | "edit-intervention"   // modification (admin)
  | "delete-intervention" // suppression (admin)
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
type QueueListener = (pending: number) => void;
const listeners = new Set<QueueListener>();

/**
 * Abonnés notifiés après un envoi effectif.
 *
 * `enqueue` déclenche le vidage de la file directement quand le réseau est là.
 * Sans ce signal, rien ne rafraîchissait les données après coup : l'entrée
 * provisoire insérée en optimiste restait affichée telle quelle, sans les
 * champs que seul le serveur calcule.
 */
const flushedListeners = new Set<Listener>();

export function subscribeFlushed(fn: Listener): () => void {
  flushedListeners.add(fn);
  return () => flushedListeners.delete(fn);
}

function notifyFlushed() {
  flushedListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* un abonné défaillant ne doit pas interrompre les autres */
    }
  });
}

/**
 * Nombre d'entrées en attente, maintenu en mémoire.
 *
 * Nécessaire en lecture synchrone : les écrans doivent pouvoir suspendre leurs
 * sondages périodiques tant qu'une écriture n'est pas partie, sinon un refetch
 * écraserait la mise à jour optimiste avec l'état serveur encore inchangé.
 */
let pendingCount = 0;
// Incrémente dès qu'une mutation de file commence. Sur Android, la lecture
// AsyncStorage initiale peut être beaucoup plus lente qu'un premier flush :
// elle ne doit pas réinjecter ensuite le compteur de l'ancien état.
let queueRevision = 0;

export function hasPendingWrites(): boolean {
  return pendingCount > 0;
}

/** Snapshot synchrone utilisé par React pour afficher le bandeau. */
export function getPendingCountSnapshot(): number {
  return pendingCount;
}

async function syncPendingCount(): Promise<void> {
  const revisionAtStart = queueRevision;
  const count = (await readJson<OutboxEntry[]>(QUEUE_KEY, [])).length;
  if (revisionAtStart === queueRevision) pendingCount = count;
}

export function subscribeOutbox(fn: QueueListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      // `mutateQueue` a déjà écrit le stockage et mis ce compteur à jour.
      // Le transmettre directement évite qu'une ancienne lecture AsyncStorage
      // terminée en retard ressuscite visuellement une entrée déjà supprimée.
      fn(pendingCount);
    } catch {
      /* un abonné défaillant ne doit pas interrompre les autres */
    }
  });
}

// Au démarrage, la file peut déjà contenir des entrées d'une session précédente.
// Prévenir React après cette unique lecture initiale.
void syncPendingCount().then(() => notify());

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

// AsyncStorage ne fournit pas de transaction. Une synchronisation peut retirer
// la tête pendant qu'une seconde action ajoute une entrée ; avec le classique
// read/modify/write, cette action pouvait alors réécrire l'ancienne tête et la
// faire tourner indéfiniment dans le bandeau de synchronisation. Toutes les
// mutations de la file passent donc par cette courte section critique.
let queueMutation: Promise<void> = Promise.resolve();

async function mutateQueue(
  mutation: (queue: OutboxEntry[]) => OutboxEntry[],
): Promise<OutboxEntry[]> {
  let result: OutboxEntry[] = [];
  const operation = queueMutation.then(async () => {
    queueRevision++;
    result = mutation(await getQueue());

    // La file est critique : contrairement aux caches facultatifs, une erreur
    // d'écriture ne doit pas être avalée. Sur Android, supprimer physiquement
    // la clé vide évite qu'une ancienne valeur SQLite soit relue après succès.
    if (isOfflineSupported) {
      if (result.length === 0) {
        await AsyncStorage.removeItem(QUEUE_KEY);
      } else {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(result));
      }

      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      const storedQueue = stored ? (JSON.parse(stored) as OutboxEntry[]) : [];
      const sameQueue =
        storedQueue.length === result.length &&
        storedQueue.every((entry, index) => entry.id === result[index]?.id);
      if (!sameQueue) {
        throw new Error("La file hors ligne n'a pas été enregistrée sur l'appareil");
      }
    }
    pendingCount = result.length;
  });
  queueMutation = operation.catch(() => {});
  await operation;
  return result;
}

async function removeQueuedEntry(id: string): Promise<void> {
  await mutateQueue((queue) => queue.filter((entry) => entry.id !== id));
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

  const queue = await mutateQueue((current) => [...current, full]);
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

/**
 * Une suppression rejouée sur une ressource déjà supprimée renvoie 404.
 * L'état visé est pourtant atteint : la traiter comme un échec ferait
 * apparaître une alerte rouge alors que tout s'est bien passé.
 */
function isAlreadyApplied(entry: OutboxEntry, error: any): boolean {
  return entry.method === "DELETE" && error?.response?.status === 404;
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
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Relance automatique après un envoi resté incomplet.
 *
 * Le système annonce le réseau disponible avant que la route de données ne le
 * soit réellement (sortie de tunnel, bascule wifi/mobile) : la première
 * tentative échoue alors presque toujours. Sans cette relance, la file restait
 * bloquée jusqu'au prochain événement réseau ou retour au premier plan — donc
 * potentiellement très longtemps.
 *
 * Le délai croît avec le nombre de tentatives pour ne pas marteler le réseau.
 */
function scheduleRetry(attempts: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  // La première annonce « en ligne » arrive parfois avant que la route IP soit
  // réellement prête. On retente vite au début, puis on espace progressivement.
  const delay = Math.min(15_000, 500 * 2 ** Math.min(attempts, 5));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

function cancelRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

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

      if (__DEV__) {
        console.info(`[outbox] envoi ${entry.kind} ${entry.id} (tentative ${entry.attempts + 1})`);
      }

      // Un id temporaire encore non résolu à ce stade signale une file
      // incohérente (la création aurait dû précéder) : on écarte l'entrée
      // plutôt que de bloquer la file indéfiniment.
      if (await hasUnresolvedTempId({ url: entry.url, body: entry.body })) {
        await moveToFailed(entry, "Référence non résolue");
        await removeQueuedEntry(entry.id);
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
        await removeQueuedEntry(entry.id);
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

        await removeQueuedEntry(entry.id);
        sent++;
        if (__DEV__) {
          console.info(`[outbox] envoyé et retiré ${entry.kind} ${entry.id} (${pendingCount} restante)`);
        }
        notify();
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? error?.message ?? "Erreur inconnue";

        if (__DEV__) {
          console.warn(
            `[outbox] échec ${entry.kind} ${entry.id}: ${String(message)}`,
          );
        }

        if (isAlreadyApplied(entry, error)) {
          await removeQueuedEntry(entry.id);
          sent++;
          notify();
          continue;
        }

        if (isPermanentFailure(error)) {
          await moveToFailed(entry, String(message));
          await removeQueuedEntry(entry.id);
          failed++;
          notify();
          continue;
        }

        // Erreur transitoire : on incrémente et on s'arrête là pour préserver
        // l'ordre. La file repartira au prochain retour de réseau.
        const updatedEntry = {
          ...entry,
          attempts: entry.attempts + 1,
          lastError: String(message),
        };

        if (updatedEntry.attempts >= MAX_ATTEMPTS) {
          await moveToFailed(updatedEntry, `Abandon après ${MAX_ATTEMPTS} tentatives`);
          await removeQueuedEntry(entry.id);
          failed++;
        } else {
          await mutateQueue((queue) =>
            queue.map((queued) =>
              queued.id === entry.id ? updatedEntry : queued,
            ),
          );
        }
        notify();
        break;
      }
    }
  } finally {
    flushing = false;
  }

  if (sent > 0) notifyFlushed();

  const queue = await getQueue();
  const remaining = queue.length;

  // Il reste des écritures et le réseau est censé être là : on retentera.
  // Hors ligne, inutile de programmer quoi que ce soit — le retour de la
  // connexion déclenchera un nouvel envoi.
  if (remaining > 0 && isOnlineNow()) {
    scheduleRetry(queue[0]?.attempts ?? 0);
  } else {
    cancelRetry();
  }

  return { sent, failed, remaining };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remet les entrées en échec en fin de file (action « réessayer »). */
export async function retryFailed(): Promise<void> {
  const failed = await getFailed();
  if (failed.length === 0) return;

  await mutateQueue((queue) => [...queue,
    ...failed.map((e) => ({
      ...e,
      // Un identifiant mal formé est rejeté en validation par le serveur : le
      // réessai échouerait à l'identique indéfiniment. L'opération n'ayant
      // jamais abouti, en regénérer un est sans risque de doublon.
      id: UUID_RE.test(e.id) ? e.id : newOperationId(),
      attempts: 0,
      lastError: undefined,
    })),
  ]);
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
  await mutateQueue(() => []);
  await writeJson(FAILED_KEY, []);
  notify();
}
