import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  Platform,
  PanResponder,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Pencil, Check, X, ArrowLeftRight, Plus, Trash2 } from "lucide-react-native";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import {
  useCities,
  usePatchCity,
  useCreateCity,
  useDeleteCity,
  useUnassignedInterventions,
  useAssignInterventionCity,
  CityOut,
  UnassignedInterventionGroup,
} from "../../../src/hooks/useCities";
import { toast } from "../../../src/ui/toast";

const ZONE_LABELS: Record<string, string> = {
  hainaut: "Hainaut",
  ardennes: "Ardennes",
};

const ZONE_COLORS: Record<string, { pill: string }> = {
  hainaut: { pill: "#3B82F6" },
  ardennes: { pill: "#22C55E" },
};

const DELETE_WIDTH = 72;
const DELETE_GAP = 8;

function CityCard({
  city,
  colors,
  isDark,
  onOpen,
}: {
  city: CityOut;
  colors: { pill: string };
  isDark: boolean;
  onOpen: (close: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(city.city);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeOpen = useRef(false);
  const justSwiped = useRef(false);
  const patchCity = usePatchCity();
  const deleteCity = useDeleteCity();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        const base = swipeOpen.current ? -(DELETE_WIDTH + DELETE_GAP) : 0;
        const clamped = Math.max(-(DELETE_WIDTH + DELETE_GAP), Math.min(0, base + g.dx));
        swipeX.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        justSwiped.current = true;
        setTimeout(() => { justSwiped.current = false; }, 200);

        const shouldOpen = swipeOpen.current
          ? g.dx < (DELETE_WIDTH + DELETE_GAP) / 2
          : g.dx < -(DELETE_WIDTH + DELETE_GAP) / 2;

        if (shouldOpen) {
          onOpen(closeSwipe);
          Animated.spring(swipeX, { toValue: -(DELETE_WIDTH + DELETE_GAP), useNativeDriver: true, damping: 20, stiffness: 200 }).start();
          swipeOpen.current = true;
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
          swipeOpen.current = false;
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    swipeOpen.current = false;
    justSwiped.current = false;
  };

  const doDelete = async () => {
    try {
      await deleteCity.mutateAsync(city.city);
      toast.success("Ville supprimée");
    } catch (e: any) {
      closeSwipe();
      const msg = e?.response?.data?.detail ?? "Erreur lors de la suppression";
      toast.error("Suppression impossible", msg);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === "web") {
      setConfirmDelete(true);
    } else {
      Alert.alert(
        "Supprimer la ville",
        `Voulez-vous vraiment supprimer "${city.city}" ?`,
        [
          { text: "Annuler", style: "cancel", onPress: closeSwipe },
          { text: "Supprimer", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handleRename = async () => {
    if (!editName.trim() || editName === city.city) { setEditing(false); return; }
    try {
      await patchCity.mutateAsync({ city: city.city, city_name: editName.trim() });
      toast.success("Ville renommée");
    } catch {
      toast.error("Erreur lors du renommage");
    }
    setEditing(false);
  };

  const otherZone = city.zone === "hainaut" ? "ardennes" : "hainaut";
  const handleMove = async () => {
    try {
      await patchCity.mutateAsync({ city: city.city, zone: otherZone });
      toast.success(`${city.city} déplacée vers ${ZONE_LABELS[otherZone]}`);
    } catch {
      toast.error("Erreur lors du déplacement");
    }
  };

  return (
    <View className="mb-2" style={{ overflow: "hidden", borderRadius: 16 }}>
      <View
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: DELETE_WIDTH, backgroundColor: "#EF4444",
          alignItems: "center", justifyContent: "center", borderRadius: 16,
        }}
      >
        <Pressable onPress={handleDelete} style={{ alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }}>
          {deleteCity.isPending
            ? <ActivityIndicator color="white" size="small" />
            : <Trash2 size={20} color="white" />}
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[{ transform: [{ translateX: swipeX }], borderRadius: 16, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", backgroundColor: isDark ? "#0F172A" : "#FFFFFF", overflow: "hidden" }]}
      >
        <Pressable
          onPress={() => {
            if (justSwiped.current) return;
            if (swipeOpen.current) { closeSwipe(); return; }
          }}
          className="flex-row items-center justify-between px-4 py-3"
        >
          <View className="flex-1 flex-row items-center gap-3">
            {editing ? (
              <TextInput
                value={editName}
                onChangeText={setEditName}
                autoFocus
                style={{
                  flex: 1, fontSize: 15, fontWeight: "600",
                  color: isDark ? "#fff" : "#0f172a",
                  borderBottomWidth: 1, borderBottomColor: colors.pill, paddingVertical: 2,
                  ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
                }}
                onSubmitEditing={handleRename}
              />
            ) : (
              <Text className="text-base font-semibold text-foreground dark:text-white flex-1">
                {city.city}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {editing ? (
              <>
                <Pressable onPress={handleRename} className="p-1" hitSlop={8}>
                  <Check size={18} color="#22C55E" />
                </Pressable>
                <Pressable onPress={() => { setEditing(false); setEditName(city.city); }} className="p-1" hitSlop={8}>
                  <X size={18} color="#EF4444" />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleMove} hitSlop={8} className="p-1 mr-1" disabled={patchCity.isPending}>
                  <ArrowLeftRight size={15} color={isDark ? "#94A3B8" : "#64748B"} />
                </Pressable>
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setEditing(true); }}
                  className="p-1 mr-1" hitSlop={8}
                >
                  <Pencil size={15} color={isDark ? "#94A3B8" : "#64748B"} />
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Animated.View>
      <Dialog open={confirmDelete} onClose={() => { setConfirmDelete(false); closeSwipe(); }}>
        <View style={{ padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: "800" }} className="text-foreground dark:text-white">
            Supprimer la ville ?
          </Text>
          <Text className="text-muted-foreground">
            Voulez-vous vraiment supprimer «{city.city}» ?
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              variant="outline"
              style={{ flex: 1, borderRadius: 24 }}
              onPress={() => { setConfirmDelete(false); closeSwipe(); }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1, borderRadius: 24 }}
              onPress={() => { setConfirmDelete(false); doDelete(); }}
            >
              Supprimer
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  );
}

export default function ZonesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { cities, isLoading } = useCities();
  const { unassignedGroups } = useUnassignedInterventions();
  const assignCity = useAssignInterventionCity();

  const [createModal, setCreateModal] = useState<"hainaut" | "ardennes" | null>(null);
  const [newCityName, setNewCityName] = useState("");
  const createCity = useCreateCity();
  const activeSwipeClose = useRef<(() => void) | null>(null);

  const [assignModal, setAssignModal] = useState<UnassignedInterventionGroup | null>(null);
  const [assignCityName, setAssignCityName] = useState("");

  const handleCardOpen = (close: () => void) => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = close;
  };

  const hainautCities = cities.filter((c) => c.zone === "hainaut");
  const ardennesCities = cities.filter((c) => c.zone === "ardennes");

  const handleCreateCity = async () => {
    if (!newCityName.trim() || !createModal) return;
    try {
      await createCity.mutateAsync({ city: newCityName.trim(), zone: createModal });
      toast.success("Ville créée");
      setCreateModal(null);
      setNewCityName("");
    } catch (e: any) {
      toast.error("Erreur lors de la création", e?.response?.data?.detail);
    }
  };

  const handleAssign = async (targetCity: string) => {
    if (!assignModal || !targetCity.trim()) return;
    try {
      await assignCity.mutateAsync({ intervention_ids: assignModal.intervention_ids, city: targetCity.trim() });
      toast.success(`${assignModal.intervention_ids.length} intervention(s) assignée(s) à ${targetCity.trim()}`);
      setAssignModal(null);
      setAssignCityName("");
    } catch (e: any) {
      toast.error("Erreur lors de l'assignation", e?.response?.data?.detail);
    }
  };

  const renderSection = (list: CityOut[], zone: string) => {
    const colors = ZONE_COLORS[zone] ?? ZONE_COLORS.hainaut;
    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View style={{ backgroundColor: colors.pill, borderRadius: 99 }} className="px-4 py-2">
            <Text className="text-white font-bold text-sm">{ZONE_LABELS[zone]} ({list.length})</Text>
          </View>
          <Pressable
            onPress={() => { setCreateModal(zone as "hainaut" | "ardennes"); setNewCityName(""); }}
            hitSlop={8}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: colors.pill + "22",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Plus size={18} color={colors.pill} />
          </Pressable>
        </View>
        {list.length === 0 ? (
          <Text className="text-sm text-muted-foreground py-2 italic">Aucune ville</Text>
        ) : (
          list
            .slice()
            .sort((a, b) => a.city.localeCompare(b.city))
            .map((city) => (
              <CityCard
                key={city.city}
                city={city}
                colors={colors}
                isDark={isDark}
                onOpen={handleCardOpen}
              />
            ))
        )}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-1 bg-background dark:bg-slate-950"
        style={{ paddingTop: Platform.OS === "web" ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}
      >
        <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
          <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/parametres")}>
            <ChevronLeft size={24} color={isDark ? "white" : "black"} />
          </Button>
          <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
            Villes
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          onScrollBeginDrag={() => { activeSwipeClose.current?.(); activeSwipeClose.current = null; }}
        >
          <Pressable
            onPress={() => { activeSwipeClose.current?.(); activeSwipeClose.current = null; }}
            style={{ flex: 1 }}
          >
            {isLoading ? (
              <ActivityIndicator size="large" style={{ marginTop: 40 }} />
            ) : (
              <>
                <Text className="text-xs text-muted-foreground mb-4">
                  {cities.length} villes
                  {unassignedGroups.length > 0 ? ` · ${unassignedGroups.length} groupe(s) d'interventions sans ville` : ""}
                </Text>

                {unassignedGroups.length > 0 && (
                  <View className="mb-6">
                    <View style={{ backgroundColor: "#F59E0B", borderRadius: 99 }} className="px-4 py-2 self-start mb-3">
                      <Text className="text-white font-bold text-sm">Interventions sans ville ({unassignedGroups.length})</Text>
                    </View>
                    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: isDark ? "#334155" : "#FDE68A", backgroundColor: isDark ? "#1C1408" : "#FFFBEB", overflow: "hidden" }}>
                      {unassignedGroups.map((group, i) => (
                        <View
                          key={`${group.title}-${i}`}
                          style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                            paddingHorizontal: 16, paddingVertical: 12,
                            borderBottomWidth: i < unassignedGroups.length - 1 ? 1 : 0,
                            borderBottomColor: isDark ? "#334155" : "#FDE68A",
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 14, color: isDark ? "#FDE68A" : "#92400E", fontWeight: "600" }}>{group.title}</Text>
                            {!!group.address && (
                              <Text style={{ fontSize: 12, color: isDark ? "#FDE68A" : "#92400E", opacity: 0.8 }} numberOfLines={1}>{group.address}</Text>
                            )}
                            <Text style={{ fontSize: 11, color: isDark ? "#FDE68A" : "#92400E", opacity: 0.6 }}>
                              {group.intervention_ids.length} intervention(s)
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => { setAssignModal(group); setAssignCityName(""); }}
                            hitSlop={8}
                            style={{ borderRadius: 10, backgroundColor: "#F59E0B22", paddingHorizontal: 10, paddingVertical: 5 }}
                          >
                            <Text style={{ fontSize: 12, color: "#F59E0B", fontWeight: "600" }}>Assigner</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {renderSection(hainautCities, "hainaut")}
                {renderSection(ardennesCities, "ardennes")}
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>

      {/* Modal création ville */}
      <Modal
        visible={!!createModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setCreateModal(null)}
          />
          <View
            className="bg-white dark:bg-slate-900 rounded-t-3xl"
            style={{ width: "100%", paddingBottom: 8 }}
          >
            <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-base font-bold text-foreground dark:text-white">
                  Nouvelle ville
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {createModal ? ZONE_LABELS[createModal] : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setCreateModal(null)}
                hitSlop={12}
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: isDark ? "#334155" : "#F1F5F9",
                  alignItems: "center", justifyContent: "center", marginTop: 2,
                }}
              >
                <X size={14} color={isDark ? "#94A3B8" : "#64748B"} />
              </Pressable>
            </View>
            <View className="px-5 pt-4 pb-2 gap-3">
              <TextInput
                value={newCityName}
                onChangeText={setNewCityName}
                placeholder="Nom de la ville"
                autoFocus
                placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                style={{
                  fontSize: 15, color: isDark ? "#fff" : "#0f172a",
                  borderWidth: 1, borderColor: createModal ? ZONE_COLORS[createModal]?.pill : "#CBD5E1",
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                }}
                onSubmitEditing={handleCreateCity}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleCreateCity}
                disabled={!newCityName.trim() || createCity.isPending}
                style={{
                  backgroundColor: !newCityName.trim() ? "#CBD5E1" : (createModal ? ZONE_COLORS[createModal]?.pill : "#3B82F6"),
                  borderRadius: 14, paddingVertical: 13, alignItems: "center",
                }}
              >
                {createCity.isPending
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Créer</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal assignation ville à un groupe d'interventions */}
      <Modal
        visible={!!assignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModal(null)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setAssignModal(null)} />
        <View
          className="bg-white dark:bg-slate-900 rounded-t-3xl"
          style={{ width: "100%", paddingBottom: insets.bottom + 24 }}
        >
          <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-foreground dark:text-white">
                Assigner «{assignModal?.title}»
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Choisir une ville existante ou en taper une nouvelle
              </Text>
            </View>
            <Pressable
              onPress={() => setAssignModal(null)}
              hitSlop={12}
              style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: isDark ? "#334155" : "#F1F5F9",
                alignItems: "center", justifyContent: "center", marginTop: 2,
              }}
            >
              <X size={14} color={isDark ? "#94A3B8" : "#64748B"} />
            </Pressable>
          </View>
          <View className="px-5 pt-4 pb-2 gap-3">
            <TextInput
              value={assignCityName}
              onChangeText={setAssignCityName}
              placeholder="Nom de la ville"
              placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
              style={{
                fontSize: 15, color: isDark ? "#fff" : "#0f172a",
                borderWidth: 1, borderColor: "#CBD5E1",
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
              }}
              onSubmitEditing={() => handleAssign(assignCityName)}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => handleAssign(assignCityName)}
              disabled={!assignCityName.trim() || assignCity.isPending}
              style={{
                backgroundColor: !assignCityName.trim() ? "#CBD5E1" : "#3B82F6",
                borderRadius: 14, paddingVertical: 13, alignItems: "center",
              }}
            >
              {assignCity.isPending
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Assigner</Text>
              }
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 280 }}>
            {cities
              .slice()
              .sort((a, b) => a.city.localeCompare(b.city))
              .map((c) => (
                <Pressable
                  key={c.city}
                  onPress={() => handleAssign(c.city)}
                  className="px-5 py-3 flex-row items-center justify-between border-b border-border/40 dark:border-slate-800"
                >
                  <Text className="text-sm font-medium text-foreground dark:text-white">{c.city}</Text>
                  <Text className="text-xs text-muted-foreground">{ZONE_LABELS[c.zone]}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
