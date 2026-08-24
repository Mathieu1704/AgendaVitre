import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, ChevronRight, FolderInput, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { Button } from "../../../src/ui/components/Button";
import { Dialog } from "../../../src/ui/components/Dialog";
import { useTheme } from "../../../src/ui/components/ThemeToggle";
import {
  CityGroupOut,
  CityOut,
  useCities,
  useCityGroups,
  useCreateCity,
  useCreateCityGroup,
  useDeleteCity,
  useDeleteCityGroup,
  usePatchCity,
  usePatchCityGroup,
} from "../../../src/hooks/useCities";
import { toast } from "../../../src/ui/toast";

type ZoneKey = "hainaut" | "ardennes";

const ZONES: { id: ZoneKey; label: string; color: string }[] = [
  { id: "hainaut", label: "Hainaut", color: "#3B82F6" },
  { id: "ardennes", label: "Ardennes", color: "#22C55E" },
];

type NameModal =
  | { kind: "create-group"; zone: ZoneKey }
  | { kind: "rename-group"; group: CityGroupOut }
  | { kind: "create-city"; zone: ZoneKey; groupId: string | null }
  | { kind: "rename-city"; city: CityOut };

type DeleteTarget =
  | { kind: "group"; group: CityGroupOut }
  | { kind: "city"; city: CityOut };

function CityRow({
  city,
  color,
  isDark,
  onRename,
  onMove,
  onDelete,
}: {
  city: CityOut;
  color: string;
  isDark: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderTopWidth: 1,
        borderTopColor: isDark ? "#1E293B" : "#F1F5F9",
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, marginRight: 10 }} />
      <Text className="text-sm font-semibold text-foreground dark:text-white" style={{ flex: 1 }}>
        {city.city}
      </Text>
      <Pressable onPress={onMove} hitSlop={8} style={{ padding: 6 }}>
        <FolderInput size={16} color={isDark ? "#94A3B8" : "#64748B"} />
      </Pressable>
      <Pressable onPress={onRename} hitSlop={8} style={{ padding: 6 }}>
        <Pencil size={15} color={isDark ? "#94A3B8" : "#64748B"} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 6 }}>
        <Trash2 size={15} color="#EF4444" />
      </Pressable>
    </View>
  );
}

export default function ZonesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { cities, isLoading: citiesLoading } = useCities();
  const { cityGroups, isLoading: groupsLoading } = useCityGroups();
  const createCity = useCreateCity();
  const patchCity = usePatchCity();
  const deleteCity = useDeleteCity();
  const createGroup = useCreateCityGroup();
  const patchGroup = usePatchCityGroup();
  const deleteGroup = useDeleteCityGroup();

  const [nameModal, setNameModal] = useState<NameModal | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [moveCity, setMoveCity] = useState<CityOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupsByZone = useMemo(() => {
    const result: Record<ZoneKey, CityGroupOut[]> = { hainaut: [], ardennes: [] };
    for (const group of cityGroups) result[group.zone].push(group);
    for (const zone of ZONES) {
      result[zone.id].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "fr"));
    }
    return result;
  }, [cityGroups]);

  const openNameModal = (modal: NameModal) => {
    setNameModal(modal);
    if (modal.kind === "rename-group") setNameValue(modal.group.name);
    else if (modal.kind === "rename-city") setNameValue(modal.city.city);
    else setNameValue("");
  };

  const submitName = async () => {
    const name = nameValue.trim();
    if (!name || !nameModal) return;
    try {
      if (nameModal.kind === "create-group") {
        await createGroup.mutateAsync({ name, zone: nameModal.zone });
        toast.success("Groupe créé");
      } else if (nameModal.kind === "rename-group") {
        await patchGroup.mutateAsync({ id: nameModal.group.id, name });
        toast.success("Groupe renommé");
      } else if (nameModal.kind === "create-city") {
        await createCity.mutateAsync({ city: name, zone: nameModal.zone, group_id: nameModal.groupId });
        toast.success("Ville créée");
      } else {
        await patchCity.mutateAsync({ city: nameModal.city.city, city_name: name });
        toast.success("Ville renommée");
      }
      setNameModal(null);
      setNameValue("");
    } catch (error: any) {
      toast.error("Enregistrement impossible", error?.response?.data?.detail);
    }
  };

  const moveTo = async (zone: ZoneKey, groupId: string | null) => {
    if (!moveCity) return;
    try {
      await patchCity.mutateAsync({ city: moveCity.city, zone, group_id: groupId });
      toast.success(`${moveCity.city} déplacée`);
      setMoveCity(null);
    } catch (error: any) {
      toast.error("Déplacement impossible", error?.response?.data?.detail);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "group") {
        await deleteGroup.mutateAsync(deleteTarget.group.id);
        toast.success("Groupe supprimé", "Ses villes sont maintenant sans groupe.");
      } else {
        await deleteCity.mutateAsync(deleteTarget.city.city);
        toast.success("Ville supprimée");
      }
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error("Suppression impossible", error?.response?.data?.detail);
    }
  };

  const renderCity = (city: CityOut, color: string) => (
    <CityRow
      key={city.city}
      city={city}
      color={color}
      isDark={isDark}
      onRename={() => openNameModal({ kind: "rename-city", city })}
      onMove={() => setMoveCity(city)}
      onDelete={() => setDeleteTarget({ kind: "city", city })}
    />
  );

  const renderZone = ({ id: zone, label, color }: (typeof ZONES)[number]) => {
    const groups = groupsByZone[zone];
    const ungrouped = cities
      .filter((city) => city.zone === zone && !city.group_id)
      .sort((a, b) => a.city.localeCompare(b.city, "fr"));

    return (
      <View key={zone} style={{ marginBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={{ backgroundColor: color, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: "white", fontSize: 14, fontWeight: "800" }}>{label}</Text>
          </View>
          <Text className="text-xs text-muted-foreground" style={{ marginLeft: 10, flex: 1 }}>
            Zone fixe
          </Text>
          <Pressable
            onPress={() => openNameModal({ kind: "create-group", zone })}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: color + "18", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }}
          >
            <Plus size={15} color={color} />
            <Text style={{ color, fontSize: 12, fontWeight: "700" }}>Groupe</Text>
          </Pressable>
        </View>

        {groups.map((group) => {
          const groupCities = cities
            .filter((city) => city.group_id === group.id)
            .sort((a, b) => a.city.localeCompare(b.city, "fr"));
          const groupColor = group.color ?? color;
          const isCollapsed = collapsedGroups.has(group.id);
          return (
            <View
              key={group.id}
              style={{ borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", borderRadius: 16, overflow: "hidden", backgroundColor: isDark ? "#0F172A" : "#FFFFFF", marginBottom: 10 }}
            >
              <Pressable
                onPress={() => toggleGroup(group.id)}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: groupColor + "10" }}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} color={isDark ? "#94A3B8" : "#64748B"} />
                ) : (
                  <ChevronDown size={16} color={isDark ? "#94A3B8" : "#64748B"} />
                )}
                <Pressable
                  onPress={() => openNameModal({ kind: "rename-group", group })}
                  hitSlop={6}
                  style={{ flex: 1, marginLeft: 8 }}
                >
                  <Text className="text-base font-bold text-foreground dark:text-white">{group.name}</Text>
                  <Text className="text-xs text-muted-foreground">{groupCities.length} ville{groupCities.length === 1 ? "" : "s"}</Text>
                </Pressable>
                <Pressable onPress={() => openNameModal({ kind: "create-city", zone, groupId: group.id })} hitSlop={8} style={{ padding: 6 }}>
                  <Plus size={17} color={groupColor} />
                </Pressable>
                <Pressable onPress={() => setDeleteTarget({ kind: "group", group })} hitSlop={8} style={{ padding: 6 }}>
                  <Trash2 size={15} color="#EF4444" />
                </Pressable>
              </Pressable>
              {!isCollapsed && (
                groupCities.length === 0 ? (
                  <Text className="text-xs text-muted-foreground" style={{ paddingHorizontal: 14, paddingVertical: 12, fontStyle: "italic", borderTopWidth: 1, borderTopColor: isDark ? "#1E293B" : "#F1F5F9" }}>
                    Aucune ville dans ce groupe
                  </Text>
                ) : groupCities.map((city) => renderCity(city, groupColor))
              )}
            </View>
          );
        })}

        <View style={{ borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", borderRadius: 16, overflow: "hidden", backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11 }}>
            <View style={{ flex: 1 }}>
              <Text className="text-sm font-bold text-foreground dark:text-white">Sans groupe</Text>
              <Text className="text-xs text-muted-foreground">{ungrouped.length} ville{ungrouped.length === 1 ? "" : "s"}</Text>
            </View>
            <Pressable onPress={() => openNameModal({ kind: "create-city", zone, groupId: null })} hitSlop={8} style={{ padding: 6 }}>
              <Plus size={17} color={color} />
            </Pressable>
          </View>
          {ungrouped.map((city) => renderCity(city, color))}
        </View>
      </View>
    );
  };

  const nameTitle = nameModal?.kind === "create-group"
    ? "Nouveau groupe de villes"
    : nameModal?.kind === "rename-group"
      ? "Renommer le groupe"
      : nameModal?.kind === "create-city"
        ? "Nouvelle ville"
        : "Renommer la ville";
  const saving = createCity.isPending || patchCity.isPending || createGroup.isPending || patchGroup.isPending;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background dark:bg-slate-950" style={{ paddingTop: Platform.OS === "web" ? 0 : insets.top, backgroundColor: isDark ? "#020817" : "#FFFFFF" }}>
        <View className="px-4 pt-4 pb-2 flex-row items-center border-b border-border dark:border-slate-800">
          <Button variant="ghost" size="icon" onPress={() => router.push("/(app)/parametres")}>
            <ChevronLeft size={24} color={isDark ? "white" : "black"} />
          </Button>
          <Text className="text-xl font-bold text-foreground dark:text-white ml-2">Zones géographiques</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <Text className="text-sm text-muted-foreground" style={{ marginBottom: 20, lineHeight: 20 }}>
            Hainaut et Ardennes restent les zones principales. Crée des groupes de villes pour simplifier leur affichage dans le planning.
          </Text>
          {citiesLoading || groupsLoading ? <ActivityIndicator size="large" style={{ marginTop: 30 }} /> : ZONES.map(renderZone)}
        </ScrollView>
      </View>

      <Modal visible={!!nameModal} transparent animationType="slide" onRequestClose={() => setNameModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" } as any} onPress={() => setNameModal(null)} />
          <View className="bg-white dark:bg-slate-900 rounded-t-3xl" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-center">
              <Text className="text-base font-bold text-foreground dark:text-white" style={{ flex: 1 }}>{nameTitle}</Text>
              <Pressable onPress={() => setNameModal(null)} hitSlop={12}><X size={18} color="#94A3B8" /></Pressable>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <TextInput
                value={nameValue}
                onChangeText={setNameValue}
                placeholder={nameModal?.kind.includes("group") ? "Nom du groupe" : "Nom de la ville"}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitName}
                placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                style={{ fontSize: 15, color: isDark ? "#fff" : "#0F172A", borderWidth: 1, borderColor: isDark ? "#475569" : "#CBD5E1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}
              />
              <Pressable onPress={submitName} disabled={!nameValue.trim() || saving} style={{ backgroundColor: !nameValue.trim() ? "#CBD5E1" : "#3B82F6", borderRadius: 14, paddingVertical: 13, alignItems: "center" }}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700" }}>Enregistrer</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!moveCity} transparent animationType="slide" onRequestClose={() => setMoveCity(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setMoveCity(null)} />
        <View className="bg-white dark:bg-slate-900 rounded-t-3xl" style={{ paddingBottom: insets.bottom + 16, maxHeight: "75%" }}>
          <View className="px-5 pt-5 pb-3 border-b border-border dark:border-slate-700 flex-row items-center">
            <View style={{ flex: 1 }}>
              <Text className="text-base font-bold text-foreground dark:text-white">Déplacer {moveCity?.city}</Text>
              <Text className="text-xs text-muted-foreground">Choisir une zone fixe et un groupe</Text>
            </View>
            <Pressable onPress={() => setMoveCity(null)} hitSlop={12}><X size={18} color="#94A3B8" /></Pressable>
          </View>
          <ScrollView>
            {ZONES.map((zone) => (
              <View key={zone.id} style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <Text style={{ color: zone.color, fontWeight: "800", marginBottom: 6 }}>{zone.label}</Text>
                <Pressable onPress={() => moveTo(zone.id, null)} style={{ paddingVertical: 11 }}>
                  <Text className="text-sm font-semibold text-foreground dark:text-white">Sans groupe</Text>
                </Pressable>
                {groupsByZone[zone.id].map((group) => (
                  <Pressable key={group.id} onPress={() => moveTo(zone.id, group.id)} style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: isDark ? "#1E293B" : "#F1F5F9" }}>
                    <Text className="text-sm font-semibold text-foreground dark:text-white">{group.name}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <View style={{ padding: 24, gap: 16 }}>
          <Text className="text-lg font-bold text-foreground dark:text-white">
            Supprimer {deleteTarget?.kind === "group" ? "ce groupe" : "cette ville"} ?
          </Text>
          <Text className="text-muted-foreground">
            {deleteTarget?.kind === "group"
              ? "Les villes du groupe resteront dans leur zone et passeront dans « Sans groupe »."
              : "La ville ne peut être supprimée si des interventions y sont encore rattachées."}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button variant="outline" style={{ flex: 1, borderRadius: 24 }} onPress={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" style={{ flex: 1, borderRadius: 24 }} onPress={confirmDelete}>Supprimer</Button>
          </View>
        </View>
      </Dialog>
    </>
  );
}
