/**
 * Bornes de la plage d'interventions chargée par le planning.
 *
 * Ces valeurs entrent dans la clé de cache `["interventions", start, end]`.
 * Le prefetch de démarrage et l'écran du planning doivent donc produire
 * exactement les mêmes chaînes : sinon le cache persisté ne serait jamais
 * réutilisé et le planning s'afficherait vide hors réseau.
 *
 * Les bornes sont alignées sur des débuts/fins de mois, pas sur l'instant
 * courant : la clé reste stable d'un lancement à l'autre dans le même mois.
 */

export function monthRangeStart(cursorDate: Date): string {
  const d = new Date(cursorDate);
  d.setMonth(d.getMonth() - 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function monthRangeEnd(cursorDate: Date): string {
  const d = new Date(cursorDate);
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function yearRangeStart(cursorDate: Date): string {
  return new Date(cursorDate.getFullYear(), 0, 1).toISOString();
}

export function yearRangeEnd(cursorDate: Date): string {
  return new Date(cursorDate.getFullYear(), 11, 31, 23, 59, 59).toISOString();
}
