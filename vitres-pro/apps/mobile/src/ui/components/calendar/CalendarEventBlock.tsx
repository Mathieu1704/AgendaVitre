import React, { useRef } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export interface CalEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  type?: string;
  status?: string;
  recurrence_rule?: {
    freq?: string;
    interval?: number;
    count?: number;
    until?: string;
    byday?: string[] | number[];
  } | null;
  client?: { name?: string | null; address?: string | null } | null;
}

interface Props {
  event: CalEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  hourPx: number;
  containerScrollOffset: React.MutableRefObject<number>;
  columnWidth: number;
  columnIndex?: number; // which day column (0-6) for week view
  weekDayOffsets?: number[]; // x positions of each day column (for week drag)
  onPress: (event: CalEvent, pageX: number, pageY: number) => void;
  onDragEnd?: (eventId: string, newStartTime: string, newEndTime: string, newDayOffset?: number) => void;
  onResizeEnd?: (eventId: string, newEndTime: string) => void;
  isDark: boolean;
  compact?: boolean;
}

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  intervention: { bg: "#DBEAFE", text: "#1D4ED8", border: "#3B82F6" },
  devis:        { bg: "#EDE9FE", text: "#6D28D9", border: "#8B5CF6" },
  tournee:      { bg: "#FFEDD5", text: "#C2410C", border: "#F97316" },
  note:         { bg: "#F1F5F9", text: "#475569", border: "#94A3B8" },
};

const STATUS_LEFT_COLOR: Record<string, string> = {
  planned:     "#3B82F6",
  in_progress: "#F97316",
  done:        "#22C55E",
};

function snapToSlot(minutes: number, slotMin = 15): number {
  return Math.round(minutes / slotMin) * slotMin;
}

function addMinutesToISO(iso: string, deltaMin: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + deltaMin);
  return d.toISOString();
}

export function CalendarEventBlock({
  event,
  top,
  height,
  left,
  width,
  hourPx,
  containerScrollOffset,
  columnWidth,
  columnIndex = 0,
  weekDayOffsets,
  onPress,
  onDragEnd,
  onResizeEnd,
  isDark,
  compact = false,
}: Props) {
  const type = event.type ?? "intervention";
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG["intervention"];
  const accentColor = STATUS_LEFT_COLOR[event.status ?? "planned"] ?? cfg.border;

  // Drag state
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);

  // Resize state
  const extraHeight = useSharedValue(0);
  const isResizing = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: isDragging.value ? 0.75 : 1,
    zIndex: isDragging.value || isResizing.value ? 999 : 1,
    shadowOpacity: isDragging.value ? 0.3 : 0.08,
    shadowRadius: isDragging.value ? 12 : 4,
    elevation: isDragging.value ? 8 : 2,
  }));

  const resizeAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(height + extraHeight.value, hourPx / 4),
  }));

  function handleDragEnd(tx: number, ty: number) {
    if (!onDragEnd) return;
    const deltaMinY = (ty / hourPx) * 60;
    const snappedDeltaMin = snapToSlot(deltaMinY);

    let newDayOffset: number | undefined;
    if (weekDayOffsets && weekDayOffsets.length > 1) {
      // Find which column the drop landed in
      const currentColX = weekDayOffsets[columnIndex] ?? 0;
      const landX = currentColX + tx;
      let closest = columnIndex;
      let closestDist = Infinity;
      weekDayOffsets.forEach((ox, i) => {
        const dist = Math.abs(ox - landX);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      newDayOffset = closest - columnIndex;
    }

    const newStart = addMinutesToISO(event.start_time, snappedDeltaMin);
    const durationMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
    const newEnd = new Date(new Date(newStart).getTime() + durationMs).toISOString();
    onDragEnd(event.id, newStart, newEnd, newDayOffset);
  }

  function handleResizeEnd(dh: number) {
    if (!onResizeEnd) return;
    const deltaMinH = (dh / hourPx) * 60;
    const snappedDelta = snapToSlot(deltaMinH);
    const newEnd = addMinutesToISO(event.end_time, snappedDelta);
    onResizeEnd(event.id, newEnd);
  }

  const dragGesture = Gesture.Pan()
    .minDistance(8)
    .activateAfterLongPress(Platform.OS === "web" ? 0 : 300)
    .onStart(() => {
      isDragging.value = true;
      startTranslateX.value = translateX.value;
      startTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startTranslateX.value + e.translationX;
      translateY.value = startTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
      isDragging.value = false;
      const tx = translateX.value;
      const ty = translateY.value;
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      if (onDragEnd) runOnJS(handleDragEnd)(tx, ty);
    });

  const resizeGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => { isResizing.value = true; })
    .onUpdate((e) => { extraHeight.value = e.translationY; })
    .onEnd(() => {
      isResizing.value = false;
      const dh = extraHeight.value;
      extraHeight.value = withSpring(0, { damping: 20, stiffness: 300 });
      if (onResizeEnd) runOnJS(handleResizeEnd)(dh);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(onPress)(event, e.absoluteX, e.absoluteY);
    });

  const composedGesture = Gesture.Simultaneous(
    dragGesture,
    tapGesture,
  );

  const startHour = new Date(event.start_time).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  });
  const endHour = new Date(event.end_time).toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  });
  const displayTitle = event.client?.address || event.client?.name || event.title;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top,
            left,
            width,
          },
          animatedStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              backgroundColor: isDark ? cfg.border + "30" : cfg.bg,
              borderRadius: 6,
              borderLeftWidth: 3,
              borderLeftColor: accentColor,
              overflow: "hidden",
              paddingLeft: 6,
              paddingRight: 4,
              paddingVertical: 3,
            },
            resizeAnimatedStyle,
          ]}
        >
          <Text
            style={{ fontSize: compact ? 9 : 11, fontWeight: "700", color: isDark ? "#F8FAFC" : cfg.text }}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
          {!compact && height > hourPx * 0.5 && (
            <Text
              style={{ fontSize: 9, color: isDark ? "#94A3B8" : cfg.text + "CC", marginTop: 1 }}
              numberOfLines={1}
            >
              {startHour} – {endHour}
            </Text>
          )}

          {/* Resize handle */}
          {onResizeEnd && (
            <GestureDetector gesture={resizeGesture}>
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "ns-resize" as any,
                }}
              >
                <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: accentColor + "88" }} />
              </View>
            </GestureDetector>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
