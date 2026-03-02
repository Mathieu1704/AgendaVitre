import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  MapPin,
  Clock,
  UserCheck,
  UserX,
  EyeOff,
  Shuffle,
  Check,
  Sparkles,
} from "lucide-react-native";

import {
  useRawEvent,
  useAssignRawEvent,
  useIgnoreRawEvent,
  useConvertRawEvent,
  useAiParseRawEvent,
  useAiConfirmRawEvent,
  AiParsedEvent,
} from "../../../../src/hooks/useRawEvents";
import { useEmployees } from "../../../../src/hooks/useEmployees";

export default function RawEventDetailScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { rawEvent, isLoading } = useRawEvent(id);
  const { employees } = useEmployees();
  const assignMutation = useAssignRawEvent();
  const ignoreMutation = useIgnoreRawEvent();
  const convertMutation = useConvertRawEvent();

  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const aiParseMutation = useAiParseRawEvent();
  const aiConfirmMutation = useAiConfirmRawEvent();
  const [aiSuggestion, setAiSuggestion] = useState<AiParsedEvent | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Ouvre le picker en pré-sélectionnant les employés déjà assignés
  const openPicker = () => {
    setSelectedIds(rawEvent?.assigned_employees?.map((e) => e.id) ?? []);
    setShowEmployeePicker(true);
  };

  const toggleEmployee = (empId: string) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((x) => x !== empId) : [...prev, empId],
    );
  };

  // Navigation retour vers le jour du planning
  const goBack = () => {
    if (date) {
      router.push(`/(app)/calendar?date=${date}` as any);
    } else {
      router.back();
    }
  };

  const handleConfirmAssign = () => {
    setShowEmployeePicker(false);
    assignMutation.mutate(
      { id, employee_ids: selectedIds },
      {
        onSuccess: goBack,
        onError: () => Alert.alert("Erreur", "Impossible d'assigner."),
      },
    );
  };

  const handleUnassign = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Retirer toutes les assignations ?")) return;
      assignMutation.mutate({ id, employee_ids: [] }, { onSuccess: goBack });
    } else {
      Alert.alert(
        "Retirer l'assignation",
        "Remettre cet événement en 'Non assigné' ?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: () =>
              assignMutation.mutate(
                { id, employee_ids: [] },
                { onSuccess: goBack },
              ),
          },
        ],
      );
    }
  };

  const handleIgnore = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Ignorer cet événement ?")) return;
      ignoreMutation.mutate(id, { onSuccess: goBack });
    } else {
      Alert.alert("Ignorer", "Masquer cet événement du planning ?", [
        { text: "Annuler", style: "cancel" },
        {
          text: "Ignorer",
          style: "destructive",
          onPress: () => ignoreMutation.mutate(id, { onSuccess: goBack }),
        },
      ]);
    }
  };

  const handleConvert = () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Convertir en intervention structurée ?")) return;
      convertMutation.mutate(id, { onSuccess: goBack });
    } else {
      Alert.alert(
        "Convertir",
        "Créer une intervention depuis cet événement ?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Convertir",
            onPress: () => convertMutation.mutate(id, { onSuccess: goBack }),
          },
        ],
      );
    }
  };

  if (isLoading || !rawEvent) {
    return (
      <View className="flex-1 bg-background dark:bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const startTime = new Date(rawEvent.start_time);
  const endTime = new Date(rawEvent.end_time);
  // Toujours afficher en heure de Bruxelles (CET/CEST), quel que soit le fuseau du device
  const fmt = (d: Date) =>
    d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Brussels",
    });

  const isBusy =
    assignMutation.isPending ||
    ignoreMutation.isPending ||
    convertMutation.isPending;

  return (
    <View className="flex-1 bg-background dark:bg-slate-950">
      {/* Header */}
      <View
        className="px-4 pb-3 bg-background dark:bg-slate-950 border-b border-border dark:border-slate-800"
        style={{ paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={goBack}
            className="p-2 rounded-full active:opacity-50"
          >
            <ChevronLeft size={24} color="#64748B" />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-base font-bold text-foreground dark:text-white flex-1"
              >
                {rawEvent.summary}
              </Text>
              <View className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">
                  RAW
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted-foreground capitalize mt-0.5">
              {startTime.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "Europe/Brussels",
              })}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      >
        {/* Heure */}
        <View className="flex-row items-center gap-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl p-4 mb-3">
          <Clock size={20} color="#3B82F6" />
          <Text className="text-base font-semibold text-foreground dark:text-white">
            {fmt(startTime)} → {fmt(endTime)}
          </Text>
        </View>

        {/* Localisation */}
        {rawEvent.location ? (
          <View className="flex-row items-start gap-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl p-4 mb-3">
            <MapPin size={20} color="#64748B" style={{ marginTop: 2 }} />
            <Text className="text-sm text-foreground dark:text-white flex-1 leading-relaxed">
              {rawEvent.location}
            </Text>
          </View>
        ) : null}

        {/* Description complète */}
        {rawEvent.description ? (
          <View className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl p-4 mb-3">
            <Text className="text-xs font-bold text-muted-foreground uppercase mb-3 tracking-wider">
              Description
            </Text>
            <Text className="text-sm text-foreground dark:text-white leading-loose">
              {rawEvent.description}
            </Text>
          </View>
        ) : null}

        {/* Employés assignés */}
        <View className="bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl p-4 mb-3">
          <Text className="text-xs font-bold text-muted-foreground uppercase mb-3 tracking-wider">
            Assigné à
          </Text>
          {rawEvent.assigned_employees &&
          rawEvent.assigned_employees.length > 0 ? (
            <View className="gap-2">
              {rawEvent.assigned_employees.map((emp) => (
                <View key={emp.id} className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: emp.color + "33" }}
                  >
                    <Text
                      className="font-bold text-sm"
                      style={{ color: emp.color }}
                    >
                      {emp.full_name?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">
                    {emp.full_name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground italic">
              Non assigné
            </Text>
          )}
        </View>

        {/* Statut coloré */}
        {(() => {
          const statusConfig: Record<
            string,
            { bg: string; text: string; label: string }
          > = {
            raw: { bg: "#F59E0B22", text: "#D97706", label: "Non traité" },
            assigned: { bg: "#22C55E22", text: "#16A34A", label: "Assigné" },
            converted: { bg: "#8B5CF622", text: "#7C3AED", label: "Converti" },
            ignored: { bg: "#94A3B822", text: "#64748B", label: "Ignoré" },
          };
          const cfg = statusConfig[rawEvent.status] ?? statusConfig.raw;
          return (
            <View
              className="rounded-xl p-3 mb-6 items-center"
              style={{ backgroundColor: cfg.bg }}
            >
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: cfg.text }}
              >
                {cfg.label}
              </Text>
            </View>
          );
        })()}

        {/* Actions */}
        {isBusy ? (
          <ActivityIndicator size="large" />
        ) : (
          <View className="gap-3">
            <Pressable
              onPress={openPicker}
              className="flex-row items-center justify-center gap-3 bg-primary p-4 rounded-2xl active:opacity-80"
            >
              <UserCheck size={20} color="white" />
              <Text className="text-white font-bold text-base">
                {rawEvent.assigned_employees?.length > 0
                  ? "Modifier l'assignation"
                  : "Assigner à un employé"}
              </Text>
            </Pressable>

            {rawEvent.assigned_employees?.length > 0 && (
              <Pressable
                onPress={handleUnassign}
                className="flex-row items-center justify-center gap-3 bg-card dark:bg-slate-900 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl active:opacity-80"
              >
                <UserX size={20} color="#D97706" />
                <Text className="text-amber-600 dark:text-amber-400 font-bold text-base">
                  Retirer l'assignation
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleIgnore}
              className="flex-row items-center justify-center gap-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-700 p-4 rounded-2xl active:opacity-80"
            >
              <EyeOff size={20} color="#EF4444" />
              <Text className="text-red-500 font-bold text-base">Ignorer</Text>
            </Pressable>

            <Pressable
              onPress={handleConvert}
              className="flex-row items-center justify-center gap-3 bg-card dark:bg-slate-900 border border-border dark:border-slate-700 p-4 rounded-2xl active:opacity-80"
            >
              <Shuffle size={20} color="#8B5CF6" />
              <Text className="text-purple-500 font-bold text-base">
                Convertir en intervention
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                aiParseMutation.mutate(id, {
                  onSuccess: (data) => {
                    setAiSuggestion(data);
                    setShowAiModal(true);
                  },
                  onError: () =>
                    Alert.alert("Erreur", "Impossible d'analyser cet événement. Vérifiez que la clé ANTHROPIC_API_KEY est configurée."),
                });
              }}
              disabled={aiParseMutation.isPending}
              className="flex-row items-center justify-center gap-3 p-4 rounded-2xl active:opacity-80"
              style={{ backgroundColor: "#4F46E5" }}
            >
              {aiParseMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Sparkles size={20} color="white" />
              )}
              <Text className="text-white font-bold text-base">
                {aiParseMutation.isPending ? "Analyse en cours..." : "Analyser avec IA"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Employee Multi-Select Picker */}
      <Modal
        visible={showEmployeePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmployeePicker(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setShowEmployeePicker(false)}
        >
          <View
            className="bg-background dark:bg-slate-900 rounded-t-3xl px-6 pt-6"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <Text className="text-lg font-bold text-foreground dark:text-white mb-1 text-center">
              Assigner des employés
            </Text>
            <Text className="text-xs text-muted-foreground text-center mb-4">
              Sélectionne un ou plusieurs employés
            </Text>

            {employees.map((emp) => {
              const isSelected = selectedIds.includes(emp.id);
              return (
                <Pressable
                  key={emp.id}
                  onPress={() => toggleEmployee(emp.id)}
                  className="flex-row items-center gap-3 p-4 rounded-2xl active:opacity-70 mb-2 border"
                  style={{
                    backgroundColor: isSelected ? emp.color + "18" : undefined,
                    borderColor: isSelected ? emp.color : "#E2E8F0",
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: emp.color + "33" }}
                  >
                    <Text
                      className="font-bold text-sm"
                      style={{ color: emp.color }}
                    >
                      {emp.full_name?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <Text className="font-semibold text-foreground dark:text-white flex-1">
                    {emp.full_name}
                  </Text>
                  {isSelected && <Check size={20} color={emp.color} />}
                </Pressable>
              );
            })}

            <Pressable
              onPress={handleConfirmAssign}
              className="mt-2 p-4 rounded-2xl items-center"
              style={{
                backgroundColor: selectedIds.length > 0 ? "#3B82F6" : "#EF4444",
              }}
            >
              <Text className="text-white font-bold text-base">
                {selectedIds.length > 0
                  ? `Confirmer (${selectedIds.length} employé${selectedIds.length > 1 ? "s" : ""})`
                  : "Retirer l'assignation"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* AI Review Modal */}
      <Modal
        visible={showAiModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setShowAiModal(false)}
        >
          <Pressable onPress={() => {}}>
            <ScrollView
              className="bg-background dark:bg-slate-900 rounded-t-3xl"
              style={{ maxHeight: "85%", paddingBottom: insets.bottom + 24 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: insets.bottom + 24 }}
            >
              {/* Header */}
              <View className="flex-row items-center gap-2 mb-1">
                <Sparkles size={18} color="#4F46E5" />
                <Text className="text-lg font-bold text-foreground dark:text-white">
                  Suggestion IA
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground mb-5">
                Vérifie les informations avant de confirmer
              </Text>

              {aiSuggestion && (
                <>
                  {/* Client */}
                  <View className="bg-card dark:bg-slate-800 rounded-2xl p-4 mb-3">
                    <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Client
                    </Text>
                    <Text className="text-sm font-semibold text-foreground dark:text-white">
                      {aiSuggestion.client_name}
                    </Text>
                    {(aiSuggestion.client_street || aiSuggestion.client_city) && (
                      <Text className="text-xs text-muted-foreground mt-1">
                        {[aiSuggestion.client_street, aiSuggestion.client_zip, aiSuggestion.client_city]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    )}
                    {aiSuggestion.client_phone ? (
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {aiSuggestion.client_phone}
                      </Text>
                    ) : null}
                    {aiSuggestion.client_notes ? (
                      <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        ⚠️ {aiSuggestion.client_notes}
                      </Text>
                    ) : null}
                  </View>

                  {/* Prestations */}
                  {aiSuggestion.services_json.length > 0 && (
                    <View className="bg-card dark:bg-slate-800 rounded-2xl p-4 mb-3">
                      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Prestations
                      </Text>
                      {aiSuggestion.services_json.map((svc, i) => (
                        <View key={i} className="flex-row justify-between items-center py-1">
                          <Text className="text-sm text-foreground dark:text-white flex-1 pr-2">
                            {svc.description}
                          </Text>
                          {svc.price > 0 && (
                            <Text className="text-sm font-semibold text-foreground dark:text-white">
                              {svc.price.toFixed(2)}€
                            </Text>
                          )}
                        </View>
                      ))}
                      {aiSuggestion.total_price > 0 && (
                        <View className="flex-row justify-between items-center border-t border-border dark:border-slate-700 mt-2 pt-2">
                          <Text className="text-sm font-bold text-foreground dark:text-white">
                            Total
                          </Text>
                          <Text className="text-sm font-bold text-foreground dark:text-white">
                            {aiSuggestion.total_price.toFixed(2)}€
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Facture */}
                  <View className="flex-row items-center gap-2 mb-5">
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: aiSuggestion.is_invoice ? "#22C55E22" : "#94A3B822" }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: aiSuggestion.is_invoice ? "#16A34A" : "#64748B" }}
                      >
                        {aiSuggestion.is_invoice ? "À facturer" : "Sans facture"}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* Boutons */}
              <Pressable
                onPress={() => {
                  if (!aiSuggestion) return;
                  setShowAiModal(false);
                  aiConfirmMutation.mutate(
                    { id, data: aiSuggestion },
                    {
                      onSuccess: goBack,
                      onError: () => Alert.alert("Erreur", "Impossible de créer l'intervention."),
                    },
                  );
                }}
                disabled={aiConfirmMutation.isPending}
                className="p-4 rounded-2xl items-center mb-3"
                style={{ backgroundColor: "#4F46E5" }}
              >
                {aiConfirmMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Confirmer et créer</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowAiModal(false)}
                className="p-4 rounded-2xl items-center bg-card dark:bg-slate-800 border border-border dark:border-slate-700"
              >
                <Text className="text-muted-foreground font-semibold text-base">Annuler</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
