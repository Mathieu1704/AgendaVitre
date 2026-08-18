import React from "react";
import { View, Text } from "react-native";
import { Banknote, FileText, CheckCircle2, AlertCircle } from "lucide-react-native";
import { Input } from "./Input";
import { validatePaymentSplit } from "../../lib/payment";
import { useTheme } from "./ThemeToggle";

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
  const { isDark } = useTheme();
  const error = validatePaymentSplit(
    "invoice_cash",
    total,
    amountCash,
    amountInvoice,
  );

  const cashColor = isDark ? "#F87171" : "#DC2626";
  const invoiceColor = isDark ? "#4ADE80" : "#16A34A";

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Banknote size={13} color={cashColor} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: cashColor }}>
              Cash
            </Text>
          </View>
          <Input
            containerStyle={{ flex: 1 }}
            style={{ borderColor: cashColor, borderWidth: 1.5 }}
            value={amountCash}
            onChangeText={onChangeCash}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <FileText size={13} color={invoiceColor} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: invoiceColor }}>
              Facture
            </Text>
          </View>
          <Input
            containerStyle={{ flex: 1 }}
            style={{ borderColor: invoiceColor, borderWidth: 1.5 }}
            value={amountInvoice}
            onChangeText={onChangeInvoice}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {error
          ? <AlertCircle size={13} color="#EF4444" />
          : <CheckCircle2 size={13} color="#22C55E" />}
        <Text style={{ fontSize: 11, fontWeight: "600", color: error ? "#EF4444" : "#22C55E" }}>
          {error ?? `Somme correcte (${total.toFixed(2)} €)`}
        </Text>
      </View>
    </View>
  );
}
