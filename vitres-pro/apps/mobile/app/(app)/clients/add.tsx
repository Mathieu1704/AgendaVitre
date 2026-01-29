import React, { useState, useCallback } from "react";
import { View, ScrollView, Text, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/lib/api";
import { UserPlus, Check, ChevronLeft } from "lucide-react-native";

import { Card, CardContent, CardHeader } from "../../../src/ui/components/Card";
import { Input } from "../../../src/ui/components/Input";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function AddClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets(); // ✅ Gestion Notch
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  //  NETTOYAGE AUTOMATIQUE : Se lance à chaque fois que la page s'affiche
  useFocusEffect(
    useCallback(() => {
      // On remet tout à zéro
      return () => {
        setName("");
        setStreet("");
        setZipCode("");
        setCity("");
        setPhone("");
        setEmail("");
        setNotes("");
      };
    }, []),
  );

  const mutation = useMutation({
    mutationFn: async (newClient: any) => {
      return await api.post("/api/clients", newClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Succès", "Client créé avec succès !");
      router.push("/(app)/clients");
    },
    onError: (error: any) => {
      toast.error("Erreur", error.response?.data?.detail || "Erreur inconnue");
    },
  });

  const formatPhoneNumber = (text: string) => {
    // 1. On ne garde que les chiffres
    const cleaned = text.replace(/\D/g, "");

    // 2. Détection GSM (046x, 047x, 048x, 049x) -> Format 0487 12 34 56
    if (/^(04[6789])/.test(cleaned)) {
      if (cleaned.length <= 4) return cleaned;
      if (cleaned.length <= 6)
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      if (cleaned.length <= 8)
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }

    // 3. Détection Zones Courtes (02 Bruxelles, 03 Anvers, 04 Liège, 09 Gand) -> Format 02 123 45 67
    if (/^(02|03|04|09)/.test(cleaned)) {
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5)
        return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
      if (cleaned.length <= 7)
        return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
    }

    // 4. Par défaut (Autres zones comme 067, 065...) -> Format 067 12 34 56
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 5)
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 7)
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
  };

  const handleSubmit = () => {
    if (!name || !street || !city) {
      toast.error("Erreur", "Nom, rue et ville sont obligatoires.");
      return;
    }

    mutation.mutate({
      name,
      street,
      zip_code: zipCode,
      city,
      address: `${street}, ${zipCode} ${city}`, // Fallback
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    });
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top }}
    >
      {/* Header Simple */}
      <View className="px-4 pt-4 pb-2 flex-row items-center">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.push("/(app)/clients")}
        >
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Client
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero */}
        <View className="items-center mb-8">
          <View className="bg-primary/10 w-20 h-20 rounded-full items-center justify-center mb-4">
            <UserPlus size={32} color="#3B82F6" />
          </View>
          <Text className="text-center text-muted-foreground dark:text-slate-400 max-w-xs">
            Remplissez les informations ci-dessous pour créer une fiche client.
          </Text>
        </View>

        <Card className="rounded-[32px] overflow-hidden">
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Informations Principales
            </Text>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-4 gap-4">
            <Input
              label="Nom / Entreprise *"
              placeholder="Ex: Jean Dupont"
              value={name}
              onChangeText={setName}
              containerStyle={{ marginBottom: 8 }}
            />

            <Input
              label="Rue et numéro *"
              placeholder="10 Rue de la Paix"
              value={street}
              onChangeText={setStreet}
            />

            <View className="flex-row w-full" style={isWeb ? { gap: 16 } : {}}>
              {/* Colonne Code Postal avec marge à droite manuelle */}
              <View
                style={{
                  flex: 1,
                  marginRight: isWeb ? 0 : 16,
                  marginLeft: isWeb ? 0 : -15,
                }}
              >
                <Input
                  label="Code Postal"
                  placeholder="7000"
                  keyboardType="numeric"
                  value={zipCode}
                  onChangeText={setZipCode}
                  containerStyle={{ width: "100%" }}
                />
              </View>

              {/* Colonne Ville */}
              <View
                style={{
                  flex: 2,
                  marginRight: isWeb ? 0 : 15,
                }}
              >
                <Input
                  label="Ville *"
                  placeholder="Mons"
                  value={city}
                  onChangeText={setCity}
                  containerStyle={{ width: "100%" }}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Card arrondie */}
        <Card className="mt-4 rounded-[32px] overflow-hidden">
          {/* Header ajusté : pt-4 */}
          <CardHeader className="px-6 pt-4 pb-2">
            <Text className="text-sm font-bold uppercase text-center text-muted-foreground dark:text-slate-500 tracking-wider">
              Coordonnées & Notes
            </Text>
          </CardHeader>

          {/* Content ajusté : pt-4 */}
          <CardContent className="px-6 pb-6 pt-4 gap-4">
            <Input
              label="Téléphone"
              placeholder="0487 12 34 56"
              value={phone}
              onChangeText={(text) => setPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
              containerStyle={{ marginBottom: 8 }}
              maxLength={13}
            />
            <Input
              label="Email"
              placeholder="client@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={{ marginBottom: 8 }}
            />
            <Input
              label="Notes internes"
              placeholder="Code porte, préférences..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              className="h-24 py-2"
            />
          </CardContent>
        </Card>

        <Button
          onPress={handleSubmit}
          loading={mutation.isPending}
          className="mt-8 h-14 rounded-[28px]"
        >
          <Check size={20} color="white" />
          <Text className="ml-2 text-white font-bold text-lg">
            Enregistrer le client
          </Text>
        </Button>
      </ScrollView>
    </View>
  );
}
