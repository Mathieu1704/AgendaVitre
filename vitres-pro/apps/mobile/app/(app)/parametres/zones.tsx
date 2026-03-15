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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, ChevronLeft, Pencil, Check, X, MapPin, Plus, Trash2 } from "lucide-react-native";
import { Button } from "../../../src/ui/components/Button";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useSubZones, useRenameZone, useReassignCity, useCreateZone, useDeleteZone, SubZoneOut } from "../../../src/hooks/useZones";
import { toast } from "../../../src/ui/toast";

const PARENT_LABELS: Record<string, string> = {
  hainaut: "Hainaut",
  ardennes: "Ardennes",
};

const PARENT_COLORS: Record<string, { pill: string }> = {
  hainaut: { pill: "#3B82F6" },
  ardennes: { pill: "#22C55E" },
};

const DELETE_WIDTH = 72;
const DELETE_GAP = 8; // espace entre la card et le bouton supprimer

// Composant sous-zone avec animation d'expansion
function ZoneCard({
  zone,
  colors,
  isDark,
  onReassign,
  onOpen,
}: {
  zone: SubZoneOut;
  colors: { pill: string };
  isDark: boolean;
  onReassign: (city: string, zoneId: string) => void;
  onOpen: (close: () => void) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(zone.label);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeOpen = useRef(false);
  const justSwiped = useRef(false);
  const renameZone = useRenameZone();
  const deleteZone = useDeleteZone();

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

  const handleDelete = async () => {
    try {
      await deleteZone.mutateAsync(zone.id);
      toast.success("Sous-zone supprimée");
    } catch (e: any) {
      closeSwipe();
      const msg = e?.response?.data?.detail ?? "Erreur lors de la suppression";
      toast.error(msg);
    }
  };

  const toggle = () => {
    if (!expanded) {
      setExpanded(true);
      fadeAnim.setValue(0);
      slideAnim.setValue(-8);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() =>
        setExpanded(false)
      );
    }
  };

  const handleRename = async () => {
    if (!editLabel.trim() || editLabel === zone.label) { setEditing(false); return; }
    try {
      await renameZone.mutateAsync({ id: zone.id, label: editLabel.trim() });
      toast.success("Sous-zone renommée");
    } catch {
      toast.error("Erreur lors du renommage");
    }
    setEditing(false);
  };

  return (
    <View className="mb-2" style={{ overflow: "hidden", borderRadius: 16 }}>
      {/* Bouton supprimer (derrière) */}
      <View
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: DELETE_WIDTH, backgroundColor: "#EF4444",
          alignItems: "center", justifyContent: "center", borderRadius: 16,
        }}
      >
        <Pressable onPress={handleDelete} style={{ alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }}>
          {deleteZone.isPending
            ? <ActivityIndicator color="white" size="small" />
            : <Trash2 size={20} color="white" />}
        </Pressable>
      </View>

      {/* Card principale (par dessus, translate X) */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[{ transform: [{ translateX: swipeX }], borderRadius: 16, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", backgroundColor: isDark ? "#0F172A" : "#FFFFFF", overflow: "hidden" }]}
      >
      <Pressable
        onPress={() => {
          if (justSwiped.current) return;
          if (swipeOpen.current) { closeSwipe(); return; }
          toggle();
        }}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-1 flex-row items-center gap-3">
          {editing ? (
            <TextInput
              value={editLabel}
              onChangeText={setEditLabel}
              autoFocus
              style={{
                flex: 1, fontSize: 15, fontWeight: "600",
                color: isDark ? "#fff" : "#0f172a",
                borderBottomWidth: 1, borderBottomColor: colors.pill, paddingVertical: 2,
              }}
              onSubmitEditing={handleRename}
            />
          ) : (
            <Text className="text-base font-semibold text-foreground dark:text-white flex-1">
              {zone.label}
            </Text>
          )}
          <Text className="text-xs text-muted-foreground ml-1">{zone.cities.length} villes</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {editing ? (
            <>
              <Pressable onPress={handleRename} className="p-1" hitSlop={8}>
                <Check size={18} color="#22C55E" />
              </Pressable>
              <Pressable onPress={() => { setEditing(false); setEditLabel(zone.label); }} className="p-1" hitSlop={8}>
                <X size={18} color="#EF4444" />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation(); setEditing(true); if (!expanded) toggle(); }}
              className="p-1 mr-1" hitSlop={8}
            >
              <Pencil size={15} color={isDark ? "#94A3B8" : "#64748B"} />
            </Pressable>
          )}
          {expanded
            ? <ChevronUp size={18} color={isDark ? "#94A3B8" : "#64748B"} />
            : <ChevronDown size={18} color={isDark ? "#94A3B8" : "#64748B"} />}
        </View>
      </Pressable>

      {expanded && (
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="border-t border-border dark:border-slate-700 px-4 py-2"
        >
          {zone.cities.length === 0 ? (
            <Text className="text-sm text-muted-foreground py-2 italic">Aucune ville</Text>
          ) : (
            zone.cities
              .slice()
              .sort((a, b) => a.localeCompare(b))
              .map((city) => (
                <View
                  key={city}
                  className="flex-row items-center justify-between py-1.5 border-b border-border/40 dark:border-slate-800/60 last:border-0"
                >
                  <Text className="text-sm text-foreground dark:text-slate-200 flex-1">{city}</Text>
                  <Pressable
                    onPress={() => onReassign(city, zone.id)}
                    hitSlop={8}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <Text className="text-xs text-muted-foreground">Déplacer</Text>
                  </Pressable>
                </View>
              ))
          )}
        </Animated.View>
      )}
      </Animated.View>
    </View>
  );
}

export default function ZonesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { subZones, isLoading } = useSubZones();
  const reassignCity = useReassignCity();

  const [reassignModal, setReassignModal] = useState<{ city: string; currentZoneId: string } | null>(null);
  const [createModal, setCreateModal] = useState<"hainaut" | "ardennes" | null>(null);
  const activeSwipeClose = useRef<(() => void) | null>(null);

  const handleCardOpen = (close: () => void) => {
    activeSwipeClose.current?.();
    activeSwipeClose.current = close;
  };
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const createZone = useCreateZone();

  const hainauts = subZones.filter((z) => z.parent_zone === "hainaut");
  const ardennes = subZones.filter((z) => z.parent_zone === "ardennes");

  const handleReassign = async (newZoneId: string) => {
    if (!reassignModal) return;
    try {
      await reassignCity.mutateAsync({ city: reassignModal.city, sub_zone_id: newZoneId });
      toast.success(`${reassignModal.city} déplacée`);
    } catch {
      toast.error("Erreur lors du déplacement");
    }
    setReassignModal(null);
  };

  const handleCreateZone = async () => {
    if (!newZoneLabel.trim() || !createModal) return;
    try {
      await createZone.mutateAsync({ label: newZoneLabel.trim(), parent_zone: createModal });
      toast.success("Sous-zone créée");
      setCreateModal(null);
      setNewZoneLabel("");
    } catch {
      toast.error("Erreur lors de la création");
    }
  };

  const renderSection = (zones: SubZoneOut[], parentZone: string) => {
    const colors = PARENT_COLORS[parentZone] ?? PARENT_COLORS.hainaut;
    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View style={{ backgroundColor: colors.pill }} className="px-4 py-2 rounded-2xl">
            <Text className="text-white font-bold text-sm">{PARENT_LABELS[parentZone]}</Text>
          </View>
          <Pressable
            onPress={() => { setCreateModal(parentZone as "hainaut" | "ardennes"); setNewZoneLabel(""); }}
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
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            colors={colors}
            isDark={isDark}
            onReassign={(city, zoneId) => setReassignModal({ city, currentZoneId: zoneId })}
            onOpen={handleCardOpen}
          />
        ))}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-1 bg-background dark:bg-slate-950"
        style={{ paddingTop: Platform.OS === "web" ? 0 : insets.top }}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
          <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/parametres")}>
            <ChevronLeft size={24} color={isDark ? "white" : "black"} />
          </Button>
          <Text className="text-xl font-bold text-foreground dark:text-white ml-2">
            Zones géographiques
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
                  {subZones.length} sous-zones · {subZones.reduce((s, z) => s + z.cities.length, 0)} villes
                </Text>
                {renderSection(hainauts, "hainaut")}
                {renderSection(ardennes, "ardennes")}
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>

      {/* Modal création sous-zone */}
      <Modal
        visible={!!createModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModal(null)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setCreateModal(null)} />
        <View
          className="bg-white dark:bg-slate-900 rounded-t-3xl"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-foreground dark:text-white">
                Nouvelle sous-zone
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {createModal ? PARENT_LABELS[createModal] : ""}
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
              value={newZoneLabel}
              onChangeText={setNewZoneLabel}
              placeholder="Nom de la sous-zone"
              autoFocus
              placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
              style={{
                fontSize: 15, color: isDark ? "#fff" : "#0f172a",
                borderWidth: 1, borderColor: createModal ? PARENT_COLORS[createModal]?.pill : "#CBD5E1",
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
              }}
              onSubmitEditing={handleCreateZone}
              returnKeyType="done"
            />
            <Pressable
              onPress={handleCreateZone}
              disabled={!newZoneLabel.trim() || createZone.isPending}
              style={{
                backgroundColor: !newZoneLabel.trim() ? "#CBD5E1" : (createModal ? PARENT_COLORS[createModal]?.pill : "#3B82F6"),
                borderRadius: 14, paddingVertical: 13, alignItems: "center",
              }}
            >
              {createZone.isPending
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Créer</Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal réassignation */}
      <Modal
        visible={!!reassignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReassignModal(null)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setReassignModal(null)} />
        <View
          className="bg-white dark:bg-slate-900 rounded-t-3xl"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-foreground dark:text-white">
                Déplacer «{reassignModal?.city}»
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Choisir la nouvelle sous-zone</Text>
            </View>
            <Pressable
              onPress={() => setReassignModal(null)}
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
          <ScrollView style={{ maxHeight: 360 }}>
            {subZones.map((zone) => {
              const isCurrent = zone.id === reassignModal?.currentZoneId;
              const colors = PARENT_COLORS[zone.parent_zone] ?? PARENT_COLORS.hainaut;
              return (
                <Pressable
                  key={zone.id}
                  onPress={() => !isCurrent && handleReassign(zone.id)}
                  className={`px-5 py-3.5 flex-row items-center justify-between border-b border-border/40 dark:border-slate-800 ${isCurrent ? "opacity-40" : ""}`}
                >
                  <View className="flex-row items-center gap-3">
                    <View style={{ backgroundColor: colors.pill + "22", borderRadius: 6, padding: 4 }}>
                      <MapPin size={14} color={colors.pill} />
                    </View>
                    <Text className="text-sm font-medium text-foreground dark:text-white">{zone.label}</Text>
                  </View>
                  {isCurrent && <Text className="text-xs text-muted-foreground">actuelle</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
