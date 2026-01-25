import React, { useState, useCallback, useRef } from "react";
import { View, ScrollView, Text, Switch, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Check, FileText } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function AddFactureScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const scrollRef = useRef<ScrollView>(null);

  // États du formulaire
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  // Calculs auto
  const price = parseFloat(amount) || 0;
  const tva = price * 0.21;
  const total = price + tva;

  useFocusEffect(
    useCallback(() => {
      // 1. Force le scroll en haut à l'arrivée
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: false });
      }

      // 2. Nettoyage du formulaire quand on quitte la page
      return () => {
        setClientName("");
        setDescription("Lavage de vitres"); // Retour à la valeur par défaut
        setAmount("");
        setIsPaid(false);
      };
    }, []),
  );

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
    router.push("/(app)/facturation");
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      // ✅ Padding Top dynamique
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/(app)/facturation")}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouvelle Facture
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Info Box Arrondie */}
        <View className="bg-blue-500/10 p-4 mb-6 flex-row items-start border border-blue-500/20 rounded-[24px]">
          <FileText size={20} color="#3B82F6" className="mt-0.5" />
          <Text className="ml-3 text-sm text-foreground dark:text-slate-300 flex-1 leading-relaxed">
            Saisie manuelle pour un paiement rapide ou hors planning. Si vous
            utilisez un logiciel comptable, saisissez uniquement les totaux ici.
          </Text>
        </View>

        <Card className="rounded-[32px] overflow-hidden">
          {/* Header ajusté : px-6 pt-4 pb-2 */}
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Détails de la prestation
            </Text>
          </CardHeader>

          {/* Content ajusté : px-6 pb-6 pt-4 gap-4 */}
          <CardContent className="px-6 pb-6 pt-4 gap-4">
            <Input
              label="Nom du Client"
              placeholder="Ex: Restaurant Le Gourmet"
              value={clientName}
              onChangeText={setClientName}
              containerStyle={{ marginBottom: 8 }} // Petit espacement supplémentaire comme sur Client
            />

            <Input
              label="Description"
              placeholder="Ex: Nettoyage vitrine + enseigne"
              value={description}
              onChangeText={setDescription}
            />

            {/* Ligne Montant + TVA */}
            <View className="flex-row gap-4 w-full">
              <View className="flex-1">
                <Input
                  label="Montant HT (€)"
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              {/* Résumé TVA aligné */}
              <View className="flex-1 justify-end pb-3 pr-6">
                <Text className="text-right text-xs text-muted-foreground mb-1">
                  TVA (21%)
                </Text>
                <Text className="text-right font-bold text-foreground dark:text-white text-lg">
                  {tva.toFixed(2)} €
                </Text>
              </View>
            </View>

            {/* Total TTC */}
            <View className="border-t border-border dark:border-slate-800 pt-4 mt-2 flex-row justify-between items-center">
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
        <Card className="mt-4 rounded-[24px] overflow-hidden">
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
          className="mt-8 h-14 bg-primary hover:bg-primary/90 rounded-[28px]"
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
