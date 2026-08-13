/**
 * Affichage des montants.
 *
 * `price_estimated` est nullable côté modèle. Interpolé tel quel, il produisait
 * « null € » dans les textes, et un « € » orphelin en JSX (React n'affiche rien
 * pour null). On centralise le formatage pour que les deux cas se comportent
 * pareil.
 */

/** Formate un montant, ou renvoie `fallback` si la valeur est absente. */
export function formatPrice(
  value: number | string | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return fallback;
  // Les montants ronds restent lisibles sans décimales.
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2)} €`;
}

/** Supplément "à la demande" appliqué à une prestation. */
export const ON_DEMAND_MULTIPLIER = 1.33;

/**
 * Prix majoré "à la demande", arrondi au multiple de 5€ supérieur pour
 * limiter la monnaie sur le terrain (ex: 25€ -> 33.25€ -> 35€).
 */
export function onDemandPrice(basePrice: number): number {
  return Math.ceil((basePrice * ON_DEMAND_MULTIPLIER) / 5) * 5;
}
