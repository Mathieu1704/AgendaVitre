import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  XCircle,
} from "lucide-react-native";

import { api } from "../../../src/lib/api";
import { useAuth } from "../../../src/hooks/useAuth";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { Dialog } from "../../../src/ui/components/Dialog";
import { enqueue } from "../../../src/lib/offline/outbox";
import { isOnlineNow } from "../../../src/lib/offline/network";
import {
  applyItemsDone,
  applyMarkDone,
} from "../../../src/lib/offline/optimistic";
import { toast } from "../../../src/ui/toast";


/**
 * Étape intermédiaire de clôture : "reprise ou pas de reprise ?".
 *
 * Le bouton "Pas de reprise" vivait auparavant en bannière au-dessus du
 * formulaire de reprise, et beaucoup d'employés ne le voyaient pas — ils
 * replanifiaient donc un RDV qui n'aurait pas dû l'être. Le choix est
 * maintenant explicite, plein écran, avant d'arriver sur le formulaire.
 *
 * Les paramètres de clôture en attente (prestations non faites, ajustements,
 * motif) ne font que transiter : rien n'est enregistré ici, tout est appliqué
 * plus loin, dans `add.tsx`, une fois la reprise — ou la non-reprise —
 * réellement confirmée.
 */
export default function RepriseChoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { isSubcontractor } = useAuth();

  const params = useLocalSearchParams<{
    reprise_of?: string;
    from_view?: string;
    from_date?: string;
    from_zone?: string;
    pending_not_done?: string;
    pending_adjustments?: string;
    pending_not_done_notes?: string;
  }>();
  const {
    reprise_of,
    from_view,
    from_date,
    from_zone,
    pending_not_done,
    pending_adjustments,
    pending_not_done_notes,
  } = params;
  const queryClient = useQueryClient();
  const [confirmNoReprise, setConfirmNoReprise] = React.useState(false);
  const [noRepriseNote, setNoRepriseNote] = React.useState("");
  const [isSubmittingNoReprise, setIsSubmittingNoReprise] = React.useState(false);

  // Checklist de clôture préparée sur la fiche d'origine : elle ne fait que
  // transiter en paramètres et n'est appliquée qu'ici, une fois "pas de
  // reprise" réellement confirmé.
  const parseJson = <T,>(raw: string | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };
  const pendingNotDoneIds = parseJson<string[]>(pending_not_done, []);
  const pendingAdjustmentItems = parseJson<{ label: string; price: number }[]>(
    pending_adjustments,
    [],
  );
  const pendingNotDoneNotes = parseJson<Record<string, string>>(
    pending_not_done_notes,
    {},
  );
  const hasPendingChecklist =
    pendingNotDoneIds.length > 0 || pendingAdjustmentItems.length > 0;

  const { data: intervention, isLoading } = useQuery({
    queryKey: ["intervention", reprise_of],
    queryFn: async () => (await api.get(`/api/interventions/${reprise_of}`)).data,
    enabled: !!reprise_of,
  });

  const clientId = intervention?.client?.id;
  const { data: clientDetail } = useQuery({
    queryKey: ["client-detail", clientId],
    queryFn: async () => (await api.get(`/api/clients/${clientId}`)).data,
    enabled: !!clientId,
  });

  // RDV déjà planifiés pour ce client : de quoi juger si une reprise est
  // vraiment nécessaire (souvent, le prochain passage existe déjà).
  const upcoming: any[] = React.useMemo(() => {
    if (!clientDetail?.interventions) return [];
    const now = new Date();
    return clientDetail.interventions
      .filter(
        (it: any) =>
          ["planned", "in_progress"].includes(it.status) &&
          new Date(it.start_time) > now &&
          it.id !== reprise_of,
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
  }, [clientDetail, reprise_of]);

  const goToRepriseForm = () => {
    router.push({ pathname: "/(app)/calendar/add", params } as any);
  };

  const handleNoReprise = async () => {
    if (!reprise_of || isSubmittingNoReprise) return;
    setIsSubmittingNoReprise(true);
    try {
      const note = noRepriseNote.trim();
      applyMarkDone(queryClient, String(reprise_of), {
        repriseTaken: false,
        note,
      });
      await enqueue({
        kind: "no-reprise",
        method: "POST",
        url: `/api/interventions/${reprise_of}/no-reprise`,
        body: { note },
        label: "Clôture sans reprise",
      });
      if (hasPendingChecklist) {
        applyItemsDone(
          queryClient,
          String(reprise_of),
          pendingNotDoneIds,
          pendingAdjustmentItems,
        );
        await enqueue({
          kind: "items-done",
          method: "PATCH",
          url: `/api/interventions/${reprise_of}/items-done`,
          body: {
            not_done_item_ids: pendingNotDoneIds,
            new_items: pendingAdjustmentItems,
            not_done_notes: pendingNotDoneNotes,
          },
          label: "Prestations réalisées",
        });
      }
      setConfirmNoReprise(false);
      toast.success(
        "Enregistré",
        isOnlineNow()
          ? "Intervention clôturée sans reprise."
          : "Clôturée sans reprise. Sera synchronisé au retour du réseau.",
      );
      router.dismissTo({
        pathname: "/(app)/calendar",
        params: {
          ...(from_view ? { view: from_view } : {}),
          ...(from_date ? { date: from_date } : {}),
          ...(from_zone ? { zone: from_zone } : {}),
        },
      } as any);
    } catch (err: any) {
      toast.error("Erreur", err.response?.data?.detail || "Erreur inconnue");
    } finally {
      setIsSubmittingNoReprise(false);
    }
  };

  if (isSubcontractor) {
    return <Redirect href="/(app)/calendar" />;
  }

  return (
    <View
      className="flex-1 bg-background dark:bg-slate-950"
      style={{
        paddingTop: insets.top,
        backgroundColor: isDark ? "#020817" : "#FFFFFF",
      }}
    >
      <View className="px-4 py-2 flex-row items-center">
        <Pressable
          onPress={() => router.replace(`/(app)/calendar/${reprise_of}` as any)}
          className="p-2 rounded-full hover:bg-muted active:bg-muted"
        >
          <ChevronLeft size={24} color={isDark ? "#FFFFFF" : "#09090B"} />
        </Pressable>
        <Text className="text-lg font-bold ml-2 text-foreground dark:text-white">
          Clôture du RDV
        </Text>
      </View>

      {/* Tout doit tenir sur un seul écran, sans scroll global : seule la
          liste des RDV existants scrolle (elle est la seule partie de taille
          variable), les deux boutons restent toujours visibles. */}
      <View
        style={{
          flex: 1,
          padding: 20,
          gap: 16,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            fontWeight: "800",
            textAlign: "center",
            color: isDark ? "#F8FAFC" : "#09090B",
          }}
        >
          Faut-il repasser ?
        </Text>

        <Pressable
          onPress={goToRepriseForm}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#15803D" : "#16A34A",
            borderRadius: 26,
            paddingVertical: 20,
            paddingHorizontal: 20,
            alignItems: "center",
            gap: 6,
            shadowColor: "#16A34A",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 6,
          })}
        >
          <CalendarPlus size={30} color="#fff" strokeWidth={2.4} />
          <Text
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            Planifier une reprise
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
            Il faut repasser chez ce client
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setConfirmNoReprise(true)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#B91C1C" : "#DC2626",
            borderRadius: 26,
            paddingVertical: 20,
            paddingHorizontal: 20,
            alignItems: "center",
            gap: 6,
            shadowColor: "#DC2626",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 6,
          })}
        >
          <XCircle size={30} color="#fff" strokeWidth={2.4} />
          <Text
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            Pas de reprise
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
            Le chantier est terminé
          </Text>
        </Pressable>

        {isLoading && !intervention ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : null}

        {upcoming.length > 0 && (
          <View
            style={{
              // Occupe toute la place restante, jusqu'à la barre d'onglets.
              flex: 1,
              gap: 8,
              padding: 12,
              borderRadius: 20,
              backgroundColor: isDark ? "rgba(249,115,22,0.1)" : "#FFF7ED",
              borderWidth: 1,
              borderColor: isDark ? "rgba(249,115,22,0.3)" : "#FED7AA",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: isDark ? "#FDBA74" : "#C2410C",
              }}
            >
              {upcoming.length > 1
                ? `Ce client a déjà ${upcoming.length} RDV prévus`
                : "Ce client a déjà un RDV prévu"}
            </Text>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator
            >
              {upcoming.map((it: any) => (
                <Pressable
                  key={it.id}
                  // Vers l'écran de modification : depuis ici on veut typiquement
                  // ajuster un RDV déjà prévu plutôt que d'en créer un nouveau.
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/calendar/add",
                      params: { id: it.id },
                    } as any)
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    backgroundColor: pressed
                      ? isDark
                        ? "rgba(249,115,22,0.2)"
                        : "#FFEDD5"
                      : isDark
                        ? "rgba(15,23,42,0.4)"
                        : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(249,115,22,0.25)" : "#FED7AA",
                  })}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      backgroundColor: "#F97316",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CalendarClock size={15} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: isDark ? "#FDBA74" : "#C2410C",
                      }}
                    >
                      {new Date(it.start_time).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: isDark ? "#CBD5E1" : "#78716C" }}
                      numberOfLines={1}
                    >
                      {it.title}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={isDark ? "#FDBA74" : "#EA580C"} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

      </View>

      {/* Confirmation + motif dans la même étape : plus d'écran intermédiaire
          après le choix "Pas de reprise". */}
      <Dialog
        open={confirmNoReprise}
        onClose={() => setConfirmNoReprise(false)}
      >
        <View style={{ padding: 20, gap: 14 }}>
          <Text
            style={{
              fontSize: 19,
              fontWeight: "800",
              textAlign: "center",
              color: isDark ? "#F8FAFC" : "#09090B",
            }}
          >
            Clôturer sans reprise ?
          </Text>
          <Text
            style={{
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
              color: isDark ? "#94A3B8" : "#64748B",
            }}
          >
            {upcoming.length > 0
              ? "Ce RDV sera clôturé sans en replanifier un nouveau. Ce client a déjà des RDV prévus."
              : "Ce RDV sera clôturé sans en replanifier un nouveau."}
          </Text>
          {/* Motif demandé seulement quand le client n'a aucun RDV à venir :
              sinon le prochain passage est déjà planifié, il n'y a rien à
              justifier. */}
          {upcoming.length === 0 && (
            <TextInput
              value={noRepriseNote}
              onChangeText={setNoRepriseNote}
              placeholder="Pourquoi pas de reprise ? (optionnel)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              style={[
                {
                  fontSize: 14,
                  color: isDark ? "#F1F5F9" : "#0f172a",
                  backgroundColor: isDark ? "#0F172A" : "#FFF7ED",
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 80,
                  borderWidth: 1.5,
                  borderColor: "#FED7AA",
                },
                Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {},
              ]}
            />
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => setConfirmNoReprise(false)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: isDark ? "#F8FAFC" : "#09090B",
                }}
              >
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={handleNoReprise}
              disabled={isSubmittingNoReprise}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor: "#DC2626",
                opacity: isSubmittingNoReprise ? 0.6 : 1,
              }}
            >
              {isSubmittingNoReprise ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontWeight: "800", color: "#fff" }}>
                  Confirmer
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Dialog>
    </View>
  );
}
