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

/**
 * Applique `patch` à une intervention, partout où elle apparaît dans le cache.
 * `patch` reçoit l'objet courant pour permettre des mises à jour dérivées.
 */
function patchIntervention(
  qc: QueryClient,
  interventionId: string,
  patch: (current: AnyIntervention) => AnyIntervention,
): void {
  qc.setQueryData<AnyIntervention>(["intervention", interventionId], (prev) =>
    prev ? patch(prev) : prev,
  );

  // Les listes : `["interventions"]` et `["interventions", start, end]`.
  qc.setQueriesData<AnyIntervention[]>({ queryKey: ["interventions"] }, (prev) => {
    if (!Array.isArray(prev)) return prev;
    let touched = false;
    const next = prev.map((item) => {
      if (item?.id !== interventionId) return item;
      touched = true;
      return patch(item);
    });
    return touched ? next : prev;
  });
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

  qc.setQueriesData<AnyIntervention[]>({ queryKey: ["interventions"] }, (prev) => {
    if (!Array.isArray(prev)) return prev;
    if (prev.some((i) => i?.id === tempId)) return prev;
    return [...prev, provisional];
  });
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
