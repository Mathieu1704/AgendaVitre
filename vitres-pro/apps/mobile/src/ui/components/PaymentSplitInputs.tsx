import React from "react";
import { View, Text } from "react-native";
import { Input } from "./Input";
import { validatePaymentSplit } from "../../lib/payment";

interface PaymentSplitInputsProps {
  total: number;
  amountCash: string;
  amountInvoice: string;
  onChangeCash: (v: string) => void;
  onChangeInvoice: (v: string) => void;
}

/** 2 champs côte à côte pour répartir un paiement FAC+ESP entre cash et
 * facture, avec un indicateur du reste à répartir par rapport au total. */
export function PaymentSplitInputs({
  total,
  amountCash,
  amountInvoice,
  onChangeCash,
  onChangeInvoice,
}: PaymentSplitInputsProps) {
  const error = validatePaymentSplit(
    "invoice_cash",
    total,
    amountCash,
    amountInvoice,
  );

  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Input
          label="Montant Cash"
          containerStyle={{ flex: 1 }}
          value={amountCash}
          onChangeText={onChangeCash}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Input
          label="Montant Facture"
          containerStyle={{ flex: 1 }}
          value={amountInvoice}
          onChangeText={onChangeInvoice}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
      </View>
      <Text style={{ fontSize: 11, color: error ? "#EF4444" : "#22C55E" }}>
        {error ?? `✓ Somme correcte (${total.toFixed(2)} €)`}
      </Text>
    </View>
  );
}
