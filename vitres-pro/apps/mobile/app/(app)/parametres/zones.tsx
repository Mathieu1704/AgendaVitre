import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, ChevronLeft, Pencil, Check, X, MapPin } from "lucide-react-native";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import { useSubZones, useRenameZone, useReassignCity, SubZoneOut } from "../../../src/hooks/useZones";
import { toast } from "../../../src/ui/toast";

// Activer LayoutAnimation sur Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PARENT_LABELS: Record<string, string> = {
  hainaut: "Hainaut",
  ardennes: "Ardennes",
};

const PARENT_COLORS: Record<string, { bg: string; text: string; pill: string }> = {
  hainaut: { bg: "#EFF6FF", text: "#1D4ED8", pill: "#3B82F6" },
  ardennes: { bg: "#F0FDF4", text: "#15803D", pill: "#22C55E" },
};

export default function ZonesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { subZones, isLoading } = useSubZones();
  const renameZone = useRenameZone();
  const reassignCity = useReassignCity();

  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [reassignModal, setReassignModal] = useState<{ city: string; currentZoneId: string } | null>(null);

  const hainauts = subZones.filter((z) => z.parent_zone === "hainaut");
  const ardennes = subZones.filter((z) => z.parent_zone === "ardennes");

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "spring", springDamping: 0.75 },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    setExpandedZone((prev) => (prev === id ? null : id));
  };

  const handleRename = async (zone: SubZoneOut) => {
    if (!editingLabel.trim() || editingLabel === zone.label) {
      setEditingZoneId(null);
      return;
    }
    try {
      await renameZone.mutateAsync({ id: zone.id, label: editingLabel.trim() });
      toast.success("Sous-zone renommée");
    } catch {
      toast.error("Erreur lors du renommage");
    }
    setEditingZoneId(null);
  };

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

  const renderZoneSection = (zones: SubZoneOut[], parentZone: string) => {
    const colors = PARENT_COLORS[parentZone] ?? PARENT_COLORS.hainaut;
    return (
      <View className="mb-6">
        <View
          style={{ backgroundColor: colors.pill }}
          className="px-4 py-2 rounded-2xl mb-3 self-start"
        >
          <Text className="text-white font-bold text-sm">{PARENT_LABELS[parentZone]}</Text>
        </View>
        {zones.map((zone) => {
          const isExpanded = expandedZone === zone.id;
          const isEditing = editingZoneId === zone.id;
          return (
            <View
              key={zone.id}
              className="mb-2 rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <Pressable
                onPress={() => toggleExpand(zone.id)}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <View className="flex-1 flex-row items-center gap-3">
                  {isEditing ? (
                    <TextInput
                      value={editingLabel}
                      onChangeText={setEditingLabel}
                      autoFocus
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: "600",
                        color: isDark ? "#fff" : "#0f172a",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.pill,
                        paddingVertical: 2,
                      }}
                      onSubmitEditing={() => handleRename(zone)}
                    />
                  ) : (
                    <Text className="text-base font-semibold text-foreground dark:text-white flex-1">
                      {zone.label}
                    </Text>
                  )}
                  <Text className="text-xs text-muted-foreground ml-1">
                    {zone.cities.length} villes
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {isEditing ? (
                    <>
                      <Pressable onPress={() => handleRename(zone)} className="p-1" hitSlop={8}>
                        <Check size={18} color="#22C55E" />
                      </Pressable>
                      <Pressable onPress={() => setEditingZoneId(null)} className="p-1" hitSlop={8}>
                        <X size={18} color="#EF4444" />
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditingZoneId(zone.id);
                        setEditingLabel(zone.label);
                        if (!isExpanded) toggleExpand(zone.id);
                      }}
                      className="p-1 mr-1"
                      hitSlop={8}
                    >
                      <Pencil size={15} color={isDark ? "#94A3B8" : "#64748B"} />
                    </Pressable>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                  ) : (
                    <ChevronDown size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                  )}
                </View>
              </Pressable>

              {isExpanded && (
                <View className="border-t border-border dark:border-slate-700 px-4 py-2">
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
                          <Text className="text-sm text-foreground dark:text-slate-200 flex-1">
                            {city}
                          </Text>
                          <Pressable
                            onPress={() => setReassignModal({ city, currentZoneId: zone.id })}
                            hitSlop={8}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                          >
                            <Text className="text-xs text-muted-foreground">Déplacer</Text>
                          </Pressable>
                        </View>
                      ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Zones géographiques",
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{ marginRight: 8, padding: 4 }}
            >
              <ChevronLeft size={24} color={isDark ? "white" : "black"} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background dark:bg-slate-950"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {isLoading ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text className="text-xs text-muted-foreground mb-4">
              {subZones.length} sous-zones · {subZones.reduce((s, z) => s + z.cities.length, 0)} villes
            </Text>
            {renderZoneSection(hainauts, "hainaut")}
            {renderZoneSection(ardennes, "ardennes")}
          </>
        )}
      </ScrollView>

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
          {/* Header modal avec croix */}
          <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-foreground dark:text-white">
                Déplacer «{reassignModal?.city}»
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Choisir la nouvelle sous-zone
              </Text>
            </View>
            <Pressable
              onPress={() => setReassignModal(null)}
              hitSlop={12}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: isDark ? "#334155" : "#F1F5F9",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
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
                    <View
                      style={{ backgroundColor: colors.pill + "22", borderRadius: 6, padding: 4 }}
                    >
                      <MapPin size={14} color={colors.pill} />
                    </View>
                    <Text className="text-sm font-medium text-foreground dark:text-white">
                      {zone.label}
                    </Text>
                  </View>
                  {isCurrent && (
                    <Text className="text-xs text-muted-foreground">actuelle</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
