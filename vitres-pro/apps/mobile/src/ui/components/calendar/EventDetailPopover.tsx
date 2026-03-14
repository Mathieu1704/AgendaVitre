import React from "react";
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Clock, User, Eye, Edit3, Trash2, X, Repeat } from "lucide-react-native";
import { CalEvent } from "./CalendarEventBlock";
import { api } from "../../../lib/api";
import { toast } from "../../toast";
import { ConfirmModal } from "../ConfirmModal";

interface Props {
  event: CalEvent & {
    assigned_employees?: Array<{ id: string; full_name: string; color?: string }>;
    price_estimated?: number | null;
  };
  anchorX: number;
  anchorY: number;
  onClose: () => void;
  isDark: boolean;
}

const TYPE_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  intervention: { bg: "#DBEAFE", color: "#1D4ED8", label: "Intervention" },
  devis:        { bg: "#EDE9FE", color: "#6D28D9", label: "Devis" },
  tournee:      { bg: "#FFEDD5", color: "#C2410C", label: "Tournée" },
  note:         { bg: "#F1F5F9", color: "#475569", label: "Note" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getOrdinalLabel(n: number) {
  if (n === 1) return "premier";
  if (n === 2) return "deuxieme";
  if (n === 3) return "troisieme";
  if (n === 4) return "quatrieme";
  if (n === 5) return "cinquieme";
  return `${n}e`;
}

function formatRecurrenceLabel(
  recurrenceRule: CalEvent["recurrence_rule"],
  startTimeIso: string,
) {
  if (!recurrenceRule?.freq) return null;

  const start = new Date(startTimeIso);
  const interval = Math.max(1, Number(recurrenceRule.interval) || 1);
  const weekday = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    timeZone: "Europe/Brussels",
  });
  const monthDay = start.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels",
  });
  const weekOfMonth = Math.ceil(start.getUTCDate() / 7);

  switch ((recurrenceRule.freq || "").toLowerCase()) {
    case "daily":
    case "day":
      return interval === 1 ? "Tous les jours" : `Tous les ${interval} jours`;
    case "weekly":
    case "week":
      return interval === 1
        ? `Chaque semaine le ${weekday}`
        : `Toutes les ${interval} semaines le ${weekday}`;
    case "monthly":
    case "month":
      return interval === 1
        ? `Tous les mois le ${getOrdinalLabel(weekOfMonth)} ${weekday}`
        : `Tous les ${interval} mois le ${getOrdinalLabel(weekOfMonth)} ${weekday}`;
    case "yearly":
    case "year":
      return interval === 1
        ? `Chaque annee le ${monthDay}`
        : `Tous les ${interval} ans le ${monthDay}`;
    case "weekdays":
      return "Tous les jours de semaine";
    default:
      return "Evenement recurrent";
  }
}

function HoverableTitle({
  title,
  textColor,
  tooltipBg,
  screenW,
}: {
  title: string;
  textColor: string;
  tooltipBg: string;
  screenW: number;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const isWeb = Platform.OS === "web";
  const tooltipWidth = Math.min(Math.max(460, screenW * 0.55), screenW - 64);

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <Pressable
        disabled={!isWeb}
        onHoverIn={() => setShowTooltip(true)}
        onHoverOut={() => setShowTooltip(false)}
        style={{ alignSelf: "stretch" }}
      >
        <Text
          style={{ fontSize: 15, fontWeight: "700", color: textColor }}
          numberOfLines={2}
        >
          {title}
        </Text>
      </Pressable>

      {isWeb && showTooltip && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: "100%",
            left: -24,
            width: tooltipWidth,
            marginBottom: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: tooltipBg,
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
            zIndex: 2000,
          }}
        >
          <Text
            style={{ fontSize: 15, lineHeight: 22, color: "#FFFFFF", fontWeight: "600" }}
          >
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

export function EventDetailPopover({
  event,
  anchorX,
  anchorY,
  onClose,
  isDark,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isMobile = screenW < 768;
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/api/interventions/${event.id}`),
    onMutate: () => {
      queryClient.setQueryData(["interventions"], (old: any[]) =>
        Array.isArray(old) ? old.filter((i) => i.id !== event.id) : old,
      );
    },
    onSuccess: () => {
      setShowDeleteConfirm(false);
      onClose();
      toast.success("Supprimé", "Intervention supprimée.");
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      queryClient.invalidateQueries({ queryKey: ["planning-stats"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["interventions"] });
      toast.error("Erreur", "Impossible de supprimer.");
    },
  });

  const startStr = new Date(event.start_time).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels",
  });
  const startTime = new Date(event.start_time).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  });
  const endTime = new Date(event.end_time).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  });
  const recurrenceLabel = formatRecurrenceLabel(event.recurrence_rule, event.start_time);

  const type = event.type ?? "intervention";
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG["intervention"];

  const desktopMargin = 16;
  const popoverW = Math.min(360, screenW - desktopMargin * 2);
  const estimatedPopoverH = recurrenceLabel ? 300 : 260;

  // Desktop: keep the popover visually linked to the click,
  // but pull it back toward the center so it never feels stuck to an edge.
  const horizontalOffset = anchorX < screenW / 2 ? 72 : -72;
  const targetCenterX = anchorX + horizontalOffset;
  const centeredX = screenW / 2;
  const blendedCenterX = centeredX + (targetCenterX - centeredX) * 0.35;
  const popX = clamp(
    blendedCenterX - popoverW / 2,
    desktopMargin,
    screenW - popoverW - desktopMargin,
  );

  const targetTopY =
    (anchorY + (anchorY < screenH * 0.55 ? 28 : -28)) - estimatedPopoverH / 2;
  const centeredTopY = (screenH - estimatedPopoverH) / 2;
  const blendedTopY = centeredTopY + (targetTopY - centeredTopY) * 0.35;
  const popY = clamp(
    blendedTopY,
    24,
    screenH - estimatedPopoverH - 24,
  );

  const bg = isDark ? "#1E293B" : "#FFFFFF";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const subtextColor = isDark ? "#94A3B8" : "#64748B";
  const borderColor = isDark ? "#334155" : "#E2E8F0";
  const tooltipBg = isDark ? "#0F172A" : "rgba(15, 23, 42, 0.92)";

  const handleView = () => {
    onClose();
    router.push(`/(app)/calendar/${event.id}` as any);
  };

  const handleEdit = () => {
    onClose();
    router.push(`/(app)/calendar/add?id=${event.id}` as any);
  };

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
          onPress={onClose}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: -4 },
            elevation: 20,
            paddingBottom: 32,
          }}
        >
          <PopoverContent
            event={event}
            cfg={cfg}
            startStr={startStr}
            startTime={startTime}
            endTime={endTime}
            textColor={textColor}
            subtextColor={subtextColor}
            borderColor={borderColor}
            isDark={isDark}
            tooltipBg={tooltipBg}
            screenW={screenW}
            onClose={onClose}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={() => setShowDeleteConfirm(true)}
            recurrenceLabel={recurrenceLabel}
          />
        </View>
        <ConfirmModal
          visible={showDeleteConfirm}
          title="Supprimer l'intervention ?"
          message="Cette action est irréversible. L'intervention sera définitivement effacée du planning."
          confirmText="Supprimer"
          cancelText="Annuler"
          isDestructive={true}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => deleteMutation.mutate()}
        />
      </>
    );
  }

  // Desktop: floating popover
  return (
    <>
      <Modal
        transparent
        visible
        animationType="none"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />
        <View
          style={{
            position: "absolute",
            top: popY,
            left: popX,
            width: popoverW,
            zIndex: 999,
            backgroundColor: bg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 16,
          }}
        >
          <PopoverContent
            event={event}
            cfg={cfg}
            startStr={startStr}
            startTime={startTime}
            endTime={endTime}
            textColor={textColor}
            subtextColor={subtextColor}
            borderColor={borderColor}
            isDark={isDark}
            tooltipBg={tooltipBg}
            screenW={screenW}
            onClose={onClose}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={() => setShowDeleteConfirm(true)}
            recurrenceLabel={recurrenceLabel}
          />
        </View>
      </Modal>
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Supprimer l'intervention ?"
        message="Cette action est irréversible. L'intervention sera définitivement effacée du planning."
        confirmText="Supprimer"
        cancelText="Annuler"
        isDestructive={true}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

function PopoverContent({
  event,
  cfg,
  startStr,
  startTime,
  endTime,
  textColor,
  subtextColor,
  borderColor,
  isDark,
  tooltipBg,
  screenW,
  onClose,
  onView,
  onEdit,
  onDelete,
  recurrenceLabel,
}: any) {
  return (
    <>
      {/* Top bar with color + close */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor,
        }}
      >
        {/* Color dot */}
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: cfg.color,
            marginRight: 10,
            flexShrink: 0,
          }}
        />
        {/* Title */}
        <HoverableTitle
          title={event.title}
          textColor={textColor}
          tooltipBg={tooltipBg}
          screenW={screenW}
        />
        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 4, marginLeft: 8 }}>
          <Pressable
            onPress={onView}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isDark ? "#334155" : "#F1F5F9" }}
          >
            <Eye size={16} color={subtextColor} />
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isDark ? "#334155" : "#F1F5F9" }}
          >
            <Edit3 size={16} color={subtextColor} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isDark ? "#334155" : "#F1F5F9" }}
          >
            <Trash2 size={16} color="#EF4444" />
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isDark ? "#334155" : "#F1F5F9" }}
          >
            <X size={16} color={subtextColor} />
          </Pressable>
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 12, gap: 8 }}>
        {/* Date + time */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Clock size={14} color={subtextColor} />
          <Text style={{ fontSize: 13, color: textColor }}>
            <Text style={{ fontWeight: "600" }}>{startStr}</Text>
            {" · "}{startTime} → {endTime}
          </Text>
        </View>

        {recurrenceLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Repeat size={14} color={subtextColor} />
            <Text style={{ fontSize: 13, color: subtextColor }}>
              {recurrenceLabel}
            </Text>
          </View>
        )}

        {/* Client + address */}
        {(event.client?.name || event.client?.address) && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <MapPin size={14} color={subtextColor} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              {event.client?.name && (
                <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>
                  {event.client.name}
                </Text>
              )}
              {event.client?.address && (
                <Text style={{ fontSize: 12, color: subtextColor }} numberOfLines={2}>
                  {event.client.address}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Employees */}
        {event.assigned_employees && event.assigned_employees.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <User size={14} color={subtextColor} />
            <Text style={{ fontSize: 12, color: subtextColor }}>
              {event.assigned_employees.map((e: any) => e.full_name).join(", ")}
            </Text>
          </View>
        )}

        {/* Type badge */}
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 12,
            backgroundColor: cfg.bg,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color, textTransform: "uppercase" }}>
            {cfg.label}
          </Text>
        </View>
      </View>
    </>
  );
}
