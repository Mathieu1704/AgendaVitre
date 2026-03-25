import React, { useState } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  Linking,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { format, parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Navigation,
  FileText,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { Avatar } from "../../../src/ui/components/Avatar";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Input } from "../../../src/ui/components/Input";
import { Dialog } from "../../../src/ui/components/Dialog";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { toast } from "../../../src/ui/toast";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useAuth } from "../../../src/hooks/useAuth";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const { isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();

  const { width: screenWidth } = useWindowDimensions();
  const dialogPosition = isWeb && screenWidth >= 768 ? "center" : "bottom";

  const [menuOpen, setMenuOpen]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [deleteDialog, setDeleteDialog]   = useState(false);
  const [showHistory, setShowHistory]     = useState(false);

  // Form state
  const [name, setName]       = useState("");
  const [street, setStreet]   = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity]       = useState("");
  const [phone, setPhone]     = useState("");
  const [email, setEmail]     = useState("");
  const [notes, setNotes]     = useState("");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const res = await api.get(`/api/clients/${id}`);
      return res.data;
    },
  });

  const startEdit = () => {
    setName(client?.name || "");
    setStreet(client?.street || "");
    setZipCode(client?.zip_code || "");
    setCity(client?.city || "");
    setPhone(client?.phone || "");
    setEmail(client?.email || "");
    setNotes(client?.notes || "");
    setMenuOpen(false);
    setEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.patch(`/api/clients/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Succès", "Client mis à jour.");
      setEditing(false);
    },
    onError: () => toast.error("Erreur", "Impossible de mettre à jour le client."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.setQueryData(["clients"], (old: any[]) =>
        old ? old.filter((c) => c.id !== id) : []
      );
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Supprimé", "Client supprimé.");
      router.push("/(app)/clients");
    },
    onError: () => toast.error("Erreur", "Impossible de supprimer le client."),
  });

  const handleSave = () => {
    const addressStr = [street, zipCode, city].filter(Boolean).join(", ");
    updateMutation.mutate({
      name:     name || null,
      street:   street || null,
      zip_code: zipCode || null,
      city:     city || null,
      address:  addressStr || null,
      phone:    phone || null,
      email:    email || null,
      notes:    notes || null,
    });
  };

  const handleCall  = () => client?.phone && Linking.openURL(`tel:${client.phone.replace(/\s/g, "")}`);
  const handleEmail = () => client?.email && Linking.openURL(`mailto:${client.email.trim()}`);
  const handleMaps  = () => {
    if (!client?.address) return;
    const q = encodeURIComponent(client.address);
    Linking.openURL(Platform.select({
      ios:     `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
      web:     `https://www.google.com/maps/search/?api=1&query=${q}`,
    })!);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950" style={{ backgroundColor: isDark ? "#020817" : "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!client) return null;

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isWeb ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-2 border-b border-border dark:border-slate-800">
        <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/clients")}>
          <ChevronLeft size={24} color={isDark ? "white" : "black"} />
        </Button>
        <Text className="ml-2 text-lg font-bold text-foreground dark:text-white flex-1">
          {editing ? "Modifier le client" : "Fiche Client"}
        </Text>
        {isAdmin && !editing && (
          <Pressable
            onPress={() => setMenuOpen(true)}
            className="p-2 rounded-full"
          >
            <MoreVertical size={22} color={isDark ? "#94A3B8" : "#64748B"} />
          </Pressable>
        )}
        {editing && (
          <Pressable onPress={() => setEditing(false)} className="p-2">
            <X size={22} color={isDark ? "#94A3B8" : "#64748B"} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20 }}>
        {editing ? (
          /* ── Mode édition ── */
          <>
            <Card className="mb-4 rounded-[32px] overflow-hidden">
              <CardContent className="px-6 py-6 gap-4">
                <Input label="Nom / Entreprise" value={name} onChangeText={setName} placeholder="Jean Dupont" />
                <Input label="Rue et numéro"    value={street} onChangeText={setStreet} placeholder="10 Rue de la Paix" />
                <View className="flex-row gap-3">
                  <View style={{ flex: 1 }}>
                    <Input label="Code postal" value={zipCode} onChangeText={setZipCode} keyboardType="numeric" placeholder="7000" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Input label="Ville" value={city} onChangeText={setCity} placeholder="Mons" />
                  </View>
                </View>
                <Input label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0487 12 34 56" />
                <Input label="Email"     value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="client@email.com" />
                <Input label="Notes"     value={notes} onChangeText={setNotes} multiline numberOfLines={3} className="h-24 py-2" placeholder="Code porte, préférences..." />
              </CardContent>
            </Card>

            <Button
              onPress={handleSave}
              loading={updateMutation.isPending}
              className="h-14 rounded-[28px]"
            >
              <Check size={20} color="white" />
              <Text className="ml-2 text-white font-bold text-base">Enregistrer</Text>
            </Button>
          </>
        ) : (
          /* ── Mode lecture ── */
          <>
            {/* Profil */}
            <View className="items-center mb-8 pt-4">
              <Avatar name={client.name || client.address || "?"} size="lg" className="h-24 w-24 mb-4" />
              <Text className="text-2xl font-bold text-foreground dark:text-white text-center">
                {client.name || "Client anonyme"}
              </Text>
              {client.address && (
                <Text className="text-muted-foreground text-center mt-1 px-8">
                  {client.address}
                </Text>
              )}
            </View>

            {/* Actions rapides */}
            <View className="flex-row justify-center gap-3 mb-8">
              {/* Y aller */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={handleMaps}
              >
                <View className="bg-emerald-500/10 p-3 rounded-full mb-2">
                  <Navigation size={24} color="#10B981" fill="#10B981" fillOpacity={0.2} />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">Y aller</Text>
              </Pressable>

              {/* Appeler */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={handleCall}
              >
                <View className="bg-blue-500/10 p-3 rounded-full mb-2">
                  <Phone size={24} color="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">Appeler</Text>
              </Pressable>

              {/* Email */}
              <Pressable
                className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
                onPress={handleEmail}
              >
                <View className="bg-orange-500/10 p-3 rounded-full mb-2">
                  <Mail size={24} color="#F97316" fill="#F97316" fillOpacity={0.2} />
                </View>
                <Text className="text-xs font-bold text-foreground dark:text-white">Email</Text>
              </Pressable>
            </View>

            {/* Infos */}
            <Card className="mb-6 rounded-[32px] overflow-hidden">
              <CardContent className="p-5 gap-6">
                <View className="flex-row items-start">
                  <Phone size={18} color="#94A3B8" className="mt-1 mr-3" />
                  <View>
                    <Text className="text-xs text-muted-foreground uppercase font-bold">Téléphone</Text>
                    <Text className="text-base text-foreground dark:text-white mt-1">{client.phone || "Non renseigné"}</Text>
                  </View>
                </View>
                <View className="flex-row items-start">
                  <Mail size={18} color="#94A3B8" className="mt-1 mr-3" />
                  <View>
                    <Text className="text-xs text-muted-foreground uppercase font-bold">Email</Text>
                    <Text className="text-base text-foreground dark:text-white mt-1">{client.email || "Non renseigné"}</Text>
                  </View>
                </View>
                <View className="flex-row items-start">
                  <FileText size={18} color="#94A3B8" className="mt-1 mr-3" />
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground uppercase font-bold">Notes</Text>
                    <Text className="text-base text-foreground dark:text-white mt-1 leading-relaxed" numberOfLines={5}>{client.notes || "Aucune note particulière."}</Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            <Button
              variant="outline"
              onPress={() => setShowHistory(true)}
              className="w-full h-12 rounded-[24px]"
            >
              <ExternalLink size={18} color={isDark ? "white" : "black"} />
              <Text className="ml-2 font-bold text-foreground dark:text-white">
                Voir l'historique des interventions
              </Text>
            </Button>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Menu contextuel (admin) */}
      {menuOpen && (
        <Dialog open onClose={() => setMenuOpen(false)}>
          <View className="p-2">
            <Text className="text-xs font-bold uppercase text-muted-foreground tracking-wider px-4 pt-3 pb-1">Options</Text>
            <Pressable
              onPress={startEdit}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              className="flex-row items-center gap-3 px-4 py-3 rounded-xl"
            >
              <Pencil size={20} color="#3B82F6" />
              <Text className="text-base text-foreground dark:text-white font-medium">Modifier les informations</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                if (Platform.OS !== "web") {
                  Alert.alert(
                    "Supprimer ce client ?",
                    "Le client sera supprimé, mais ses interventions resteront dans l'agenda.",
                    [
                      { text: "Annuler", style: "cancel" },
                      { text: "Supprimer", style: "destructive", onPress: () => deleteMutation.mutate() },
                    ]
                  );
                } else {
                  setDeleteDialog(true);
                }
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              className="flex-row items-center gap-3 px-4 py-3 rounded-xl"
            >
              <Trash2 size={20} color="#EF4444" />
              <Text className="text-base text-red-500 font-medium">Supprimer ce client</Text>
            </Pressable>
          </View>
        </Dialog>
      )}

      {/* Historique des interventions */}
      {showHistory && (() => {
        const sorted = [...(client?.interventions ?? [])].sort(
          (a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        return (
          <Dialog open onClose={() => setShowHistory(false)} position={dialogPosition}>
            <View
              className="p-4"
              style={isWeb && screenWidth >= 768 ? ({ width: 500, maxWidth: "100%", maxHeight: "80vh" } as any) : {}}
            >
              <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
                Historique ({sorted.length})
              </Text>
              <ScrollView showsVerticalScrollIndicator style={{ maxHeight: "60%" }}>
                {sorted.length === 0 && (
                  <Text className="text-center text-muted-foreground py-8">Aucune intervention</Text>
                )}
                {sorted.map((item: any) => (
                  <Pressable
                    key={item.id}
                    onPress={() => { setShowHistory(false); router.push(`/(app)/calendar/${item.id}`); }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    className="flex-row items-center justify-between py-3 border-b border-border dark:border-slate-700"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-xs text-muted-foreground mb-0.5">
                        {format(parseISO(item.start_time), "dd/MM/yyyy")}
                      </Text>
                      <Text className="font-medium text-foreground dark:text-white" numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </Pressable>
                ))}
              </ScrollView>
              <Button variant="ghost" onPress={() => setShowHistory(false)} className="mt-3">
                Fermer
              </Button>
            </View>
          </Dialog>
        );
      })()}

      {/* Confirmation suppression */}
      {deleteDialog && (
        <Dialog open onClose={() => setDeleteDialog(false)}>
          <View className="p-5">
            <Text className="text-lg font-bold text-foreground dark:text-white mb-2">Supprimer ce client ?</Text>
            <Text className="text-muted-foreground dark:text-slate-400 mb-6">
              Le client sera supprimé, mais ses interventions resteront dans l'agenda.
            </Text>
            <View className="flex-row gap-3">
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => setDeleteDialog(false)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  className="h-12 rounded-[24px] border border-border dark:border-slate-700 items-center justify-center"
                >
                  <Text className="font-bold text-foreground dark:text-white">Annuler</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Pressable
                  onPress={() => { setDeleteDialog(false); deleteMutation.mutate(); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  className="h-12 rounded-[24px] bg-red-500 items-center justify-center"
                >
                  <Text className="font-bold text-white">Supprimer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Dialog>
      )}
    </View>
  );
}
