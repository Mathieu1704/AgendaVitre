import React, { useState } from "react";
import { View, ScrollView, Text, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, FileText } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function AddFactureScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  // États du formulaire
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("Lavage de vitres");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  // Calculs auto
  const price = parseFloat(amount) || 0;
  const tva = price * 0.21;
  const total = price + tva;

  const handleSubmit = () => {
    if (!clientName || !amount) {
      toast.error("Erreur", "Nom du client et montant requis.");
      return;
    }

    // Simulation d'envoi API
    toast.success(
      "Facture créée",
      `Facture de ${total.toFixed(2)}€ enregistrée.`,
    );
    router.back();
  };

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouvelle Facture
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Info Box */}
        <View className="bg-blue-500/10 p-4 rounded-xl mb-6 flex-row items-start border border-blue-500/20">
          <FileText size={20} color="#3B82F6" className="mt-0.5" />
          <Text className="ml-3 text-sm text-foreground dark:text-slate-300 flex-1 leading-relaxed">
            Saisie manuelle pour un paiement rapide ou hors planning. Si vous
            utilisez un logiciel comptable, saisissez uniquement les totaux ici.
          </Text>
        </View>

        <Card>
          <CardHeader className="p-6 pb-4">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Détails de la prestation
            </Text>
          </CardHeader>
          <CardContent className="p-6 pt-0 gap-5">
            <Input
              label="Nom du Client"
              placeholder="Ex: Restaurant Le Gourmet"
              value={clientName}
              onChangeText={setClientName}
            />

            <Input
              label="Description"
              placeholder="Ex: Nettoyage vitrine + enseigne"
              value={description}
              onChangeText={setDescription}
            />

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Input
                  label="Montant HT (€)"
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <View className="flex-1 justify-end pb-3">
                <Text className="text-right text-xs text-muted-foreground mb-1">
                  TVA (21%)
                </Text>
                <Text className="text-right font-bold text-foreground dark:text-white text-lg">
                  {tva.toFixed(2)} €
                </Text>
              </View>
            </View>

            <View className="border-t border-border dark:border-slate-800 pt-4 flex-row justify-between items-center">
              <Text className="font-bold text-lg text-foreground dark:text-white">
                Total TTC
              </Text>
              <Text className="font-extrabold text-2xl text-primary">
                {total.toFixed(2)} €
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* Options */}
        <Card className="mt-4">
          <CardContent className="p-4 flex-row items-center justify-between">
            <Text className="font-medium text-foreground dark:text-white">
              Facture déjà payée ?
            </Text>
            <Switch
              value={isPaid}
              onValueChange={setIsPaid}
              trackColor={{ false: "#767577", true: "#22C55E" }}
            />
          </CardContent>
        </Card>

        <Button
          onPress={handleSubmit}
          className="mt-8 h-14 bg-primary hover:bg-primary/90"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 text-white font-bold text-lg">
            Valider la facture
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
