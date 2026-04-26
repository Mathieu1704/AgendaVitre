import React, { useState, useCallback } from "react";
import { View, ScrollView, Text, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../src/lib/api";
import { UserPlus, Check, ChevronLeft } from "lucide-react-native";

import { Input } from "../../../src/ui/components/Input";
import { CityAutocomplete } from "../../../src/ui/components/CityAutocomplete";
import { Button } from "../../../src/ui/components/Button";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function AddClientScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useFocusEffect(
    useCallback(() => {
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
      queryClient.invalidateQueries({ queryKey: ["unassigned-cities"] });
      toast.success("Succès", "Client créé avec succès !");
      router.push("/(app)/clients");
    },
    onError: (error: any) => {
      toast.error("Erreur", error.response?.data?.detail || "Erreur inconnue");
    },
  });

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (/^(04[6789])/.test(cleaned)) {
      if (cleaned.length <= 4) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
      if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
    }
    if (/^(02|03|04|09)/.test(cleaned)) {
      if (cleaned.length <= 2) return cleaned;
      if (cleaned.length <= 5) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
      if (cleaned.length <= 7) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
      return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
    }
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 5) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
  };

  const handleSubmit = () => {
    if (!name || !street || !city) {
      toast.error("Erreur", "Nom, rue et ville sont obligatoires.");
      return;
    }
    if (!phone) {
      toast.error("Erreur", "Le numéro de téléphone est obligatoire.");
      return;
    }
    mutation.mutate({
      name,
      street,
      zip_code: zipCode,
      city,
      address: `${street}, ${zipCode} ${city}`,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    });
  };

  const cardStyle = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? "#1E293B" : "#E4E4E7",
    backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
    overflow: "hidden" as const,
    padding: 20,
  };

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/clients")}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
          Nouveau Client
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View style={{ backgroundColor: "#3B82F610", width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <UserPlus size={32} color="#3B82F6" style={{ marginLeft: 6 }} />
          </View>
          <Text className="text-center text-muted-foreground dark:text-slate-400 max-w-xs">
            Remplissez les informations ci-dessous pour créer une fiche client.
          </Text>
        </View>

        {/* Card 1 — Informations principales */}
        <View style={cardStyle}>
          <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", textAlign: "center", color: isDark ? "#64748B" : "#94A3B8", letterSpacing: 1, marginBottom: 16 }}>
            Informations Principales
          </Text>
          <View style={{ gap: 16 }}>
            <Input
              label="Nom / Entreprise *"
              placeholder="Ex: Jean Dupont"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Rue et numéro *"
              placeholder="10 Rue de la Paix"
              value={street}
              onChangeText={setStreet}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Code Postal"
                  placeholder="7000"
                  keyboardType="numeric"
                  value={zipCode}
                  onChangeText={setZipCode}
                />
              </View>
              <View style={{ flex: 2 }}>
                <CityAutocomplete value={city} onChangeText={setCity}>
                  {({ onChangeText, onFocus, onBlur, inputRef }) => (
                    <Input
                      ref={inputRef}
                      label="Ville *"
                      placeholder="Mons"
                      value={city}
                      onChangeText={onChangeText}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                  )}
                </CityAutocomplete>
              </View>
            </View>
          </View>
        </View>

        {/* Card 2 — Coordonnées & Notes */}
        <View style={{ ...cardStyle, marginTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", textAlign: "center", color: isDark ? "#64748B" : "#94A3B8", letterSpacing: 1, marginBottom: 16 }}>
            Coordonnées & Notes
          </Text>
          <View style={{ gap: 16 }}>
            <Input
              label="Téléphone *"
              placeholder="0487 12 34 56"
              value={phone}
              onChangeText={(text) => setPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
              maxLength={13}
            />
            <Input
              label="Email"
              placeholder="client@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Notes internes"
              placeholder="Code porte, préférences..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ height: 96 }}
              inputStyle={{ textAlignVertical: "top", paddingTop: 8 }}
            />
          </View>
        </View>

        {/* Bouton submit */}
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
