/** Règle de récurrence telle que stockée dans `Intervention.recurrence_rule` (JSONB). */
export type RecurrenceRule = {
  freq?: string;
  interval?: number;
  count?: number;
  until?: string;
  byday?: string[] | number[];
} | null | undefined;

function getOrdinalLabel(n: number) {
  if (n === 1) return "premier";
  if (n === 2) return "deuxieme";
  if (n === 3) return "troisieme";
  if (n === 4) return "quatrieme";
  if (n === 5) return "cinquieme";
  return `${n}e`;
}

/** Libellé français lisible d'une règle de récurrence, ex. "Chaque semaine le lundi". */
export function formatRecurrenceLabel(
  recurrenceRule: RecurrenceRule,
  startTimeIso: string,
): string | null {
  if (!recurrenceRule?.freq) return null;

  const start = new Date(startTimeIso);
  const interval = Math.max(1, Number(recurrenceRule.interval) || 1);
  const weekday = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    timeZone: "Europe/Brussels",
  });
  const monthDay = start.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels",
  });
  const weekOfMonth = Math.ceil(start.getUTCDate() / 7);

  switch ((recurrenceRule.freq || "").toLowerCase()) {
    case "daily":
    case "day":
      return interval === 1 ? "Tous les jours" : `Tous les ${interval} jours`;
    case "weekly":
    case "week":
      return interval === 1
        ? `Chaque semaine le ${weekday}`
        : `Toutes les ${interval} semaines le ${weekday}`;
    case "monthly":
    case "month":
      return interval === 1
        ? `Tous les mois le ${getOrdinalLabel(weekOfMonth)} ${weekday}`
        : `Tous les ${interval} mois le ${getOrdinalLabel(weekOfMonth)} ${weekday}`;
    case "yearly":
    case "year":
      return interval === 1
        ? `Chaque annee le ${monthDay}`
        : `Tous les ${interval} ans le ${monthDay}`;
    case "weekdays":
      return "Tous les jours de semaine";
    default:
      return "Evenement recurrent";
  }
}
