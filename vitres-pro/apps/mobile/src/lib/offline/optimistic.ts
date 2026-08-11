/**
 * Application locale des écritures au cache React Query.
 *
 * Les écritures partant toutes par la file d'attente, l'interface ne peut plus
 * compter sur la réponse du serveur pour se rafraîchir : c'est ce module qui
 * donne le retour visuel immédiat, en ligne comme hors ligne.
 *
 * Toutes les fonctions ciblent à la fois `["intervention", id]` (l'écran de
 * détail) et les listes `["interventions", ...]` (le planning), qui sont deux
 * caches distincts alimentés par des requêtes différentes.
 */
import type { QueryClient } from "@tanstack/react-query";

type AnyIntervention = Record<string, any>;
export type InterventionCacheSnapshot = [readonly unknown[], unknown];

/**
 * Applique `patch` à une intervention, partout où elle apparaît dans le cache.
 * `patch` reçoit l'objet courant pour permettre des mises à jour dérivées.
 */
export function patchIntervention(
  qc: QueryClient,
  interventionId: string,
  patch: (current: AnyIntervention) => AnyIntervention,
): InterventionCacheSnapshot[] {
  const snapshots: InterventionCacheSnapshot[] = [];
  const detailKey = ["intervention", interventionId] as const;
  const detail = qc.getQueryData<AnyIntervention>(detailKey);
  let source = detail;
  if (detail) {
    snapshots.push([detailKey, detail]);
    qc.setQueryData(detailKey, patch(detail));
  }

  if (!source) {
    const activeLists = qc.getQueriesData<AnyIntervention[]>({
      queryKey: ["interventions"],
      type: "active",
    });
    for (const [, data] of activeLists) {
      source = data?.find((item) => item?.id === interventionId);
      if (source) break;
    }
  }

  // Les listes datées qui couvrent l'intervention sont peu nombreuses, même
  // après plusieurs mois visités. On les garde cohérentes pour le hors-ligne,
  // sans jamais parcourir la liste historique non bornée de facturation ou du
  // dashboard.
  const lists = qc.getQueriesData<AnyIntervention[]>({ queryKey: ["interventions"] });
  const sourceTime = source?.start_time ? new Date(source.start_time).getTime() : NaN;
  for (const [key, data] of lists) {
    if (
      key.length !== 3 ||
      typeof key[1] !== "string" ||
      typeof key[2] !== "string"
    ) continue;
    const rangeStart = Date.parse(key[1]);
    const rangeEnd = Date.parse(key[2]);
    if (
      Number.isFinite(sourceTime) &&
      Number.isFinite(rangeStart) &&
      Number.isFinite(rangeEnd) &&
      (sourceTime < rangeStart || sourceTime > rangeEnd)
    ) continue;
    if (!Array.isArray(data)) continue;
    const index = data.findIndex((item) => item?.id === interventionId);
    if (index < 0) continue;
    snapshots.push([key, data]);
    const next = data.slice();
    next[index] = patch(data[index]);
    qc.setQueryData(key, next);
  }

  return snapshots;
}

export function restoreInterventionSnapshots(
  qc: QueryClient,
  snapshots: InterventionCacheSnapshot[],
): void {
  for (const [key, data] of snapshots) qc.setQueryData(key, data);
}

/** Mode de paiement / encaissement sur place. */
export function applyPaymentMode(
  qc: QueryClient,
  interventionId: string,
  mode: "cash" | "invoice" | "invoice_cash",
): void {
  patchIntervention(qc, interventionId, (current) => ({
    ...current,
    payment_mode: mode,
    is_invoice: mode !== "cash",
  }));
}

/**
 * Prestations réalisées à la clôture.
 *
 * Le serveur recalcule `price_estimated` comme la somme des prestations
 * faites : on reproduit ce calcul localement pour que le total affiché soit
 * cohérent avant même la synchronisation.
 */
export function applyItemsDone(
  qc: QueryClient,
  interventionId: string,
  notDoneItemIds: string[],
): void {
  const notDone = new Set(notDoneItemIds);

  patchIntervention(qc, interventionId, (current) => {
    const items = Array.isArray(current.items) ? current.items : [];
    const nextItems = items.map((item: any) => ({
      ...item,
      done: !notDone.has(item.id),
    }));
    const total = nextItems.reduce(
      (sum: number, item: any) => (item.done ? sum + (Number(item.price) || 0) : sum),
      0,
    );
    return { ...current, items: nextItems, price_estimated: total };
  });
}

/** Marquage terminé, avec ou sans reprise. */
export function applyMarkDone(
  qc: QueryClient,
  interventionId: string,
  options: { repriseTaken: boolean; note?: string },
): void {
  patchIntervention(qc, interventionId, (current) => ({
    ...current,
    status: "done",
    reprise_taken: options.repriseTaken,
    ...(options.note !== undefined ? { reprise_note: options.note || null } : {}),
  }));
}

/**
 * Insère le RDV de reprise créé hors ligne dans les listes du planning.
 *
 * L'entrée porte un id temporaire et `pending_sync`, ce qui permet à
 * l'interface de la distinguer visuellement d'une intervention confirmée.
 */
export function applyCreateReprise(
  qc: QueryClient,
  tempId: string,
  payload: Record<string, any>,
): void {
  // Le payload est au format d'envoi (`employee_ids`, `client_id`), pas au
  // format de lecture attendu par les cartes du planning (`employees`,
  // `client`). Sans cette reconstitution, la carte s'affiche nue — sans nom
  // d'ouvrier, sans couleur ni adresse — jusqu'au prochain rechargement.
  const allEmployees = qc.getQueryData<any[]>(["employees"]) ?? [];
  const employees = Array.isArray(payload.employee_ids)
    ? payload.employee_ids
        .map((eid: string) => allEmployees.find((e) => e?.id === eid))
        .filter(Boolean)
    : (payload.employees ?? []);

  let client = payload.client;
  if (!client && payload.client_id) {
    const allClients = qc.getQueryData<any[]>(["clients"]) ?? [];
    client =
      allClients.find((c) => c?.id === payload.client_id) ??
      qc.getQueryData<any>(["client-detail", payload.client_id]) ??
      undefined;
  }

  const provisional: AnyIntervention = {
    ...payload,
    id: tempId,
    status: payload.status ?? "planned",
    employees,
    client,
    items: payload.items ?? [],
    pending_sync: true,
  };

  const startTime = new Date(provisional.start_time).getTime();
  const lists = qc.getQueriesData<AnyIntervention[]>({ queryKey: ["interventions"] });
  for (const [key, data] of lists) {
    if (
      key.length !== 3 ||
      typeof key[1] !== "string" ||
      typeof key[2] !== "string" ||
      startTime < Date.parse(key[1]) ||
      startTime > Date.parse(key[2]) ||
      !Array.isArray(data) ||
      data.some((item) => item?.id === tempId)
    ) continue;
    qc.setQueryData(key, [...data, provisional]);
  }
}

/**
 * Modification d'une intervention.
 *
 * Le payload est au format d'envoi : on ne recopie que les champs directement
 * affichables, en reconstituant employés et prestations comme à la création.
 */
export function applyEditIntervention(
  qc: QueryClient,
  interventionId: string,
  payload: Record<string, any>,
): InterventionCacheSnapshot[] {
  const allEmployees = qc.getQueryData<any[]>(["employees"]) ?? [];
  const employees = Array.isArray(payload.employee_ids)
    ? payload.employee_ids
        .map((eid: string) => allEmployees.find((e) => e?.id === eid))
        .filter(Boolean)
    : undefined;

  return patchIntervention(qc, interventionId, (current) => ({
    ...current,
    ...payload,
    // `employee_ids` n'existe pas côté lecture : on le retire pour ne pas
    // laisser traîner un champ hybride dans le cache.
    employee_ids: undefined,
    employees: employees ?? current.employees,
  }));
}

/** Retrait immédiat d'une intervention supprimée. */
export function applyDeleteIntervention(
  qc: QueryClient,
  interventionId: string,
): void {
  const detail = qc.getQueryData<AnyIntervention>(["intervention", interventionId]);
  const startTime = detail?.start_time ? new Date(detail.start_time).getTime() : NaN;
  const lists = qc.getQueriesData<AnyIntervention[]>({ queryKey: ["interventions"] });
  for (const [key, data] of lists) {
    if (key.length !== 3 || !Array.isArray(data)) continue;
    if (
      Number.isFinite(startTime) &&
      typeof key[1] === "string" &&
      typeof key[2] === "string" &&
      (startTime < Date.parse(key[1]) || startTime > Date.parse(key[2]))
    ) continue;
    const index = data.findIndex((item) => item?.id === interventionId);
    if (index < 0) continue;
    qc.setQueryData(key, data.filter((_, i) => i !== index));
  }
  qc.removeQueries({ queryKey: ["intervention", interventionId] });
}

// --- Catalogue de prestations du client -------------------------------------

export function applyServiceCreate(
  qc: QueryClient,
  clientId: string,
  service: { id: string; label: string; price: number; position: number },
): void {
  qc.setQueryData<any[]>(["client-services", clientId], (prev) => {
    const list = Array.isArray(prev) ? prev : [];
    if (list.some((s) => s?.id === service.id)) return list;
    return [...list, { ...service, pending_sync: true }];
  });
}

export function applyServiceRename(
  qc: QueryClient,
  clientId: string,
  serviceId: string,
  label: string,
): void {
  qc.setQueryData<any[]>(["client-services", clientId], (prev) =>
    Array.isArray(prev)
      ? prev.map((s) => (s?.id === serviceId ? { ...s, label } : s))
      : prev,
  );
}

export function applyServiceDelete(
  qc: QueryClient,
  clientId: string,
  serviceId: string,
): void {
  qc.setQueryData<any[]>(["client-services", clientId], (prev) =>
    Array.isArray(prev) ? prev.filter((s) => s?.id !== serviceId) : prev,
  );
}

// --- Catalogue de prestations d'une intervention sans client (chaîne de
// reprises) — mêmes opérations que ci-dessus, sur ["chain-services", chainId].

export function applyChainServiceCreate(
  qc: QueryClient,
  chainId: string,
  service: { id: string; label: string; price: number; position: number },
): void {
  qc.setQueryData<any[]>(["chain-services", chainId], (prev) => {
    const list = Array.isArray(prev) ? prev : [];
    if (list.some((s) => s?.id === service.id)) return list;
    return [...list, { ...service, pending_sync: true }];
  });
}

export function applyChainServiceRename(
  qc: QueryClient,
  chainId: string,
  serviceId: string,
  label: string,
): void {
  qc.setQueryData<any[]>(["chain-services", chainId], (prev) =>
    Array.isArray(prev)
      ? prev.map((s) => (s?.id === serviceId ? { ...s, label } : s))
      : prev,
  );
}

export function applyChainServiceDelete(
  qc: QueryClient,
  chainId: string,
  serviceId: string,
): void {
  qc.setQueryData<any[]>(["chain-services", chainId], (prev) =>
    Array.isArray(prev) ? prev.filter((s) => s?.id !== serviceId) : prev,
  );
}
