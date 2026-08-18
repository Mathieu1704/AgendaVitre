import type { PaymentMode } from "../types";

export interface PaymentModePillOption {
  id: PaymentMode;
  label: string;
  pillColor: string;
  activeTextColor: string;
}

/** Options du sélecteur de moyen de paiement. Espèces et FAC+Esp. impliquent
 * toutes les deux du cash : les deux disparaissent quand hideCash est actif. */
export function paymentModeOptionIds(hideCash: boolean): PaymentMode[] {
  return (["cash", "invoice", "invoice_cash"] as PaymentMode[]).filter(
    (id) => !(hideCash && (id === "cash" || id === "invoice_cash")),
  );
}

export function isCashRelated(mode?: string | null): boolean {
  return mode === "cash" || mode === "invoice_cash" || !mode;
}

const ROUNDING_TOLERANCE = 0.005;

/** Retourne un message d'erreur si la somme cash+facture ne correspond pas
 * exactement au total (avec une tolérance d'arrondi flottant), sinon null. */
export function validatePaymentSplit(
  mode: PaymentMode,
  total: number,
  amountCash: string,
  amountInvoice: string,
): string | null {
  if (mode !== "invoice_cash") return null;
  const cash = parseFloat(amountCash.replace(",", "."));
  const invoice = parseFloat(amountInvoice.replace(",", "."));
  if (Number.isNaN(cash) || Number.isNaN(invoice)) {
    return "Renseignez les 2 montants";
  }
  const diff = cash + invoice - total;
  if (Math.abs(diff) > ROUNDING_TOLERANCE) {
    const rounded = Math.round(total * 100) / 100;
    return `La somme doit être égale à ${rounded.toFixed(2)} €`;
  }
  return null;
}
