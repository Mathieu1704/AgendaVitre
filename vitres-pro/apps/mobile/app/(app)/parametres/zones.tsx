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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, ChevronLeft, Pencil, Check, X, MapPin } from "lucide-react-native";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useSubZones, useRenameZone, useReassignCity, SubZoneOut } from "../../../src/hooks/useZones";
import { toast } from "../../../src/ui/toast";

const PARENT_LABELS: Record<string, string> = {
  hainaut: "Hainaut",
  ardennes: "Ardennes",
};

const PARENT_COLORS: Record<string, { pill: string }> = {
  hainaut: { pill: "#3B82F6" },
  ardennes: { pill: "#22C55E" },
};

// Composant sous-zone avec animation d'expansion
function ZoneCard({
  zone,
  colors,
  isDark,
  onReassign,
}: {
  zone: SubZoneOut;
  colors: { pill: string };
  isDark: boolean;
  onReassign: (city: string, zoneId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(zone.label);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  const renameZone = useRenameZone();

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
    <View className="mb-2 rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <Pressable
        onPress={toggle}
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

  const renderSection = (zones: SubZoneOut[], parentZone: string) => {
    const colors = PARENT_COLORS[parentZone] ?? PARENT_COLORS.hainaut;
    return (
      <View className="mb-6">
        <View style={{ backgroundColor: colors.pill }} className="px-4 py-2 rounded-2xl mb-3 self-start">
          <Text className="text-white font-bold text-sm">{PARENT_LABELS[parentZone]}</Text>
        </View>
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            colors={colors}
            isDark={isDark}
            onReassign={(city, zoneId) => setReassignModal({ city, currentZoneId: zoneId })}
          />
        ))}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background dark:bg-slate-950">
        {/* Header manuel avec flèche retour */}
        <View
          style={{ paddingTop: insets.top }}
          className="bg-background dark:bg-slate-950 border-b border-border dark:border-slate-800"
        >
          <View className="flex-row items-center px-3 py-3 gap-2">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10,
              }}
              className="active:bg-slate-100 dark:active:bg-slate-800"
            >
              <ChevronLeft size={22} color={isDark ? "#93C5FD" : "#3B82F6"} />
              <Text style={{ color: isDark ? "#93C5FD" : "#3B82F6", fontSize: 15, fontWeight: "500" }}>
                Paramètres
              </Text>
            </Pressable>
          </View>
          <View className="px-4 pb-3">
            <Text className="text-xl font-bold text-foreground dark:text-white">Zones géographiques</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
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
        </ScrollView>
      </View>

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
