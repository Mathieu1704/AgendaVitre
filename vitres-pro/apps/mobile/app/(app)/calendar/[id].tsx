import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Text,
  useWindowDimensions,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  Navigation,
  ChevronLeft,
  MapPin,
  Clock,
  Calendar,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Wallet,
} from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Imports internes
import { api } from "../../../src/lib/api";
import { toast } from "../../../src/ui/toast";
import { Button } from "../../../src/ui/components/Button";
import { Card, CardContent } from "../../../src/ui/components/Card";
import { StatusBadge } from "../../../src/ui/components/StatusBadge";
import { Avatar } from "../../../src/ui/components/Avatar";
import { useTheme } from "../../../src/ui/components/ThemeToggle";

export default function InterventionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();

  // --- DATA ---
  const { data: intervention, isLoading } = useQuery({
    queryKey: ["intervention", id],
    queryFn: async () => {
      const res = await api.get(`/api/interventions/${id}`);
      return res.data;
    },
  });

  // --- NAVIGATION RETOUR INTELLIGENTE ---
  const handleBack = () => {
    if (intervention?.start_time) {
      router.push({
        pathname: "/(app)/calendar",
        params: { date: intervention.start_time },
      });
    } else {
      router.back();
    }
  };

  // --- MUTATION STATUS ---
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const now = new Date().toISOString();
      const payload: any = { status: newStatus };

      if (newStatus === "in_progress") payload.real_start_time = now;
      if (newStatus === "done") payload.real_end_time = now;

      return await api.patch(`/api/interventions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention", id] });
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.success("Statut mis à jour", "L'intervention a été modifiée.");
    },
    onError: () => {
      toast.error("Erreur", "Impossible de mettre à jour le statut.");
    },
  });

  // --- LOADING ---
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // --- NOT FOUND ---
  if (!intervention) {
    return (
      <View className="flex-1 justify-center items-center bg-background dark:bg-slate-950 px-6">
        <View className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle size={48} color="#EF4444" />
        </View>
        <Text className="text-xl font-bold text-foreground dark:text-white mt-4 text-center">
          Intervention introuvable
        </Text>
        <Button
          variant="outline"
          onPress={() => router.back()}
          className="mt-6"
        >
          Retour
        </Button>
      </View>
    );
  }

  const startTime = new Date(intervention.start_time);

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{ paddingTop: isDesktop ? 0 : insets.top }}
    >
      {/* --- HEADER --- */}
      <View className="flex-row items-center p-4 pt-12 pb-4 border-b border-border dark:border-slate-800 bg-background dark:bg-slate-950 z-10">
        <Pressable
          onPress={handleBack}
          className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:bg-muted"
        >
          <ChevronLeft
            size={24}
            className="text-foreground dark:text-white"
            color={isDark ? "#FFF" : "#09090B"}
          />
        </Pressable>
        <Text className="ml-2 text-lg font-bold text-foreground dark:text-white">
          Détails
        </Text>
        <View className="flex-1" />
        <StatusBadge status={intervention.status} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* --- TITRE --- */}
        <View className="px-6 pt-6 pb-2">
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-3xl font-extrabold text-foreground dark:text-white mb-4 leading-tight">
              {intervention.title}
            </Text>

            {/* ✅ LOGIQUE FACTURATION vs ENCAISSEMENT */}
            {intervention.is_invoice ? (
              // CAS 1 : FACTURE (Admin gère, Employé tranquille)
              <View className="self-start bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-full mb-6 border border-blue-200 dark:border-blue-800">
                <Text className="text-blue-700 dark:text-blue-400 font-bold text-xs uppercase">
                  📄 Facture à émettre
                </Text>
              </View>
            ) : (
              // CAS 2 : PAS DE FACTURE = ALERTE ROUGE
              <View className="bg-red-100 dark:bg-red-900/20 p-4 rounded-2xl mb-6 border border-red-200 dark:border-red-900/50 flex-row gap-4 items-center">
                <View className="bg-red-500 h-10 w-10 rounded-full items-center justify-center">
                  <Wallet size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-red-700 dark:text-red-400 font-extrabold text-sm uppercase mb-0.5">
                    À ENCAISSER SUR PLACE
                  </Text>
                  <Text className="text-red-600/80 dark:text-red-300 text-xs font-medium leading-tight">
                    Le client doit payer {intervention.price_estimated} €
                    maintenant.
                  </Text>
                </View>
              </View>
            )}

            <View className="flex-row items-center gap-2 mb-6">
              <Calendar size={16} color={isDark ? "#94A3B8" : "#64748B"} />
              <Text className="text-base font-medium text-muted-foreground">
                {startTime.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* --- BLOCS D'INFORMATIONS --- */}
        <View className="px-6 pb-20">
          {/* LIGNE 1 : HORAIRE + CLIENT */}
          <View
            className={isDesktop ? "flex-row w-full gap-4" : "gap-4"}
            style={{
              marginRight: isDesktop ? 0 : 20,
              marginBottom: 20,
            }}
          >
            {/* 1. HORAIRE */}
            <Animated.View
              entering={FadeInDown.delay(200)}
              className={isDesktop ? "flex-1" : "w-full"}
            >
              <Card className="min-h-[110px] justify-center rounded-3xl">
                <CardContent className="p-5 flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Horaire prévu
                    </Text>
                    <Text className="text-3xl font-bold text-foreground dark:text-white">
                      {startTime.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View className="bg-blue-500/10 p-3 rounded-full">
                    <Clock size={28} color="#3B82F6" />
                  </View>
                </CardContent>
              </Card>
            </Animated.View>

            {/* 2. CLIENT */}
            <Animated.View
              entering={FadeInDown.delay(300)}
              className={isDesktop ? "flex-1" : "w-full"}
            >
              <Card className="min-h-[110px] justify-center rounded-3xl">
                <CardContent className="p-5">
                  <View className="flex-row items-center">
                    <Avatar name={intervention.client?.name || "?"} size="md" />
                    <View className="ml-4 flex-1">
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Client
                      </Text>
                      <Text className="text-lg font-bold text-foreground dark:text-white mb-0.5">
                        {intervention.client?.name || "Client Inconnu"}
                      </Text>

                      {intervention.client?.address && (
                        <View className="flex-row items-center mt-1">
                          <MapPin size={12} color="#64748B" />
                          <Text
                            className="ml-1 text-xs text-muted-foreground dark:text-slate-400"
                            numberOfLines={1}
                          >
                            {intervention.client.address}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </CardContent>
              </Card>
            </Animated.View>
          </View>

          {/* LIGNE 2 : ACTIONS RAPIDES */}
          <Animated.View
            entering={FadeInDown.delay(350)}
            className={`flex-row w-full ${isDesktop ? "gap-4" : "gap-2"}`}
            style={{
              marginBottom: isDesktop ? 0 : 20,
            }}
          >
            {/* BOUTON GPS */}
            <Pressable
              className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
              onPress={() => {
                if (intervention.client?.address) {
                  const query = encodeURIComponent(intervention.client.address);
                  const url = Platform.select({
                    ios: `maps:0,0?q=${query}`,
                    android: `geo:0,0?q=${query}`,
                    web: `https://www.google.com/maps/search/?api=1&query=${query}`,
                  });
                  Linking.openURL(url!);
                } else {
                  toast.error(
                    "Pas d'adresse",
                    "Aucune adresse pour ce client.",
                  );
                }
              }}
            >
              <View className="bg-emerald-500/10 p-3 rounded-full mb-2">
                <Navigation
                  size={24}
                  color="#10B981"
                  fill="#10B981"
                  fillOpacity={0.2}
                />
              </View>
              <Text className="text-xs font-bold text-foreground dark:text-white">
                Y aller
              </Text>
            </Pressable>

            {/* BOUTON APPELER */}
            <Pressable
              className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
              onPress={() => {
                if (intervention.client?.phone) {
                  const cleanedPhone = intervention.client.phone.replace(
                    /\s/g,
                    "",
                  );
                  Linking.openURL(`tel:${cleanedPhone}`);
                } else {
                  toast.error("Pas de téléphone", "Aucun numéro renseigné.");
                }
              }}
            >
              <View className="bg-blue-500/10 p-3 rounded-full mb-2">
                <Phone
                  size={24}
                  color="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.2}
                />
              </View>
              <Text className="text-xs font-bold text-foreground dark:text-white">
                Appeler
              </Text>
            </Pressable>

            {/* BOUTON MAIL */}
            <Pressable
              className="flex-1 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 p-4 rounded-3xl items-center justify-center active:scale-95 transition-transform"
              onPress={() => {
                if (intervention.client?.email) {
                  Linking.openURL(`mailto:${intervention.client.email.trim()}`);
                } else {
                  toast.error("Pas d'email", "Aucun email renseigné.");
                }
              }}
            >
              <View className="bg-orange-500/10 p-3 rounded-full mb-2">
                <Mail
                  size={24}
                  color="#F97316"
                  fill="#F97316"
                  fillOpacity={0.2}
                />
              </View>
              <Text className="text-xs font-bold text-foreground dark:text-white">
                Email
              </Text>
            </Pressable>
          </Animated.View>

          {/* 3. SUIVI TEMPS RÉEL (Si dispo) */}
          {(intervention.real_start_time || intervention.real_end_time) && (
            <Animated.View
              entering={FadeInDown.delay(400)}
              className="w-full"
              // ✅ MODIF : Marge en bas UNIQUEMENT sur mobile
              style={{ marginBottom: isDesktop ? 0 : 20 }}
            >
              <Card className="border-l-4 border-l-primary bg-primary/5 border-y-0 border-r-0 rounded-3xl">
                <CardContent className="p-5">
                  <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                    Suivi en direct
                  </Text>

                  <View className="flex-row gap-6">
                    {intervention.real_start_time && (
                      <View>
                        <Text className="text-xs text-muted-foreground mb-1">
                          Démarré à
                        </Text>
                        <View className="flex-row items-center">
                          <PlayCircle
                            size={14}
                            color="#22C55E"
                            className="mr-1.5"
                          />
                          <Text className="font-bold text-foreground dark:text-white">
                            {new Date(
                              intervention.real_start_time,
                            ).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                    {intervention.real_end_time && (
                      <View>
                        <Text className="text-xs text-muted-foreground mb-1">
                          Terminé à
                        </Text>
                        <View className="flex-row items-center">
                          <CheckCircle2
                            size={14}
                            color="#22C55E"
                            className="mr-1.5"
                          />
                          <Text className="font-bold text-foreground dark:text-white">
                            {new Date(
                              intervention.real_end_time,
                            ).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </CardContent>
              </Card>
            </Animated.View>
          )}

          <Animated.View
            entering={FadeInDown.delay(450)}
            className="w-full mt-4"
          >
            <Card className="rounded-3xl">
              <CardContent className="p-5">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  Détail de la prestation
                </Text>

                {/* LISTE DES ITEMS */}
                {intervention.items && intervention.items.length > 0 ? (
                  <View className="gap-3 mb-4">
                    {intervention.items.map((item: any, idx: number) => (
                      <View
                        key={idx}
                        className="flex-row justify-between items-center pb-2 border-b border-border dark:border-slate-800 last:border-0"
                      >
                        <Text className="text-foreground dark:text-white font-medium flex-1 mr-4">
                          {item.label}
                        </Text>
                        <Text className="text-foreground dark:text-white font-bold">
                          {item.price} €
                        </Text>
                      </View>
                    ))}
                    {/* TOTAL */}
                    <View className="flex-row justify-between items-center pt-2 mt-1">
                      <Text className="text-lg font-bold text-foreground dark:text-white">
                        Total
                      </Text>
                      <Text className="text-xl font-extrabold text-primary">
                        {intervention.price_estimated} €
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Fallback si pas d'items (anciennes données)
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-muted-foreground">
                      Prix global estimé
                    </Text>
                    <Text className="text-xl font-extrabold text-primary">
                      {intervention.price_estimated} €
                    </Text>
                  </View>
                )}

                {/* DESCRIPTION / NOTES */}
                {intervention.description && (
                  <View className="bg-muted/50 dark:bg-slate-900/50 p-4 rounded-xl mt-2">
                    <Text className="text-xs font-bold text-muted-foreground mb-1">
                      NOTES
                    </Text>
                    <Text className="text-foreground dark:text-slate-300 leading-relaxed">
                      {intervention.description}
                    </Text>
                  </View>
                )}
              </CardContent>
            </Card>
          </Animated.View>
        </View>
      </ScrollView>

      {/* --- FOOTER ACTIONS (Fixe en bas) --- */}
      <View className="absolute bottom-0 left-0 right-0 p-4 bg-background dark:bg-slate-950 border-t border-border dark:border-slate-800">
        {intervention.status === "planned" && (
          <Button
            onPress={() => statusMutation.mutate("in_progress")}
            disabled={statusMutation.isPending}
            className="w-full h-14 bg-orange-500 hover:bg-orange-600 rounded-full"
          >
            {statusMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center">
                <PlayCircle size={20} color="white" strokeWidth={2.5} />
                <Text className="text-white font-bold text-lg ml-2">
                  Démarrer l'intervention
                </Text>
              </View>
            )}
          </Button>
        )}

        {intervention.status === "in_progress" && (
          <Button
            onPress={() => statusMutation.mutate("done")}
            disabled={statusMutation.isPending}
            className="w-full h-14 bg-green-500 hover:bg-green-600 rounded-full"
          >
            {statusMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center">
                <CheckCircle2 size={20} color="white" strokeWidth={2.5} />
                <Text className="text-white font-bold text-lg ml-2">
                  Terminer l'intervention
                </Text>
              </View>
            )}
          </Button>
        )}

        {intervention.status === "done" && (
          <View className="w-full h-14 bg-green-500 rounded-full items-center justify-center flex-row shadow-lg shadow-green-500/20">
            <CheckCircle2 size={24} color="white" strokeWidth={3} />
            <Text className="ml-2 text-white text-lg font-extrabold tracking-wide">
              INTERVENTION CLÔTURÉE
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
