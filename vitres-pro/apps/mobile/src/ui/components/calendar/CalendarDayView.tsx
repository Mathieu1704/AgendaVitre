import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CalEvent, CalendarEventBlock } from "./CalendarEventBlock";
import { TimeGridBackground } from "./TimeGridBackground";
import { EventDetailPopover } from "./EventDetailPopover";

interface Props {
  date: string; // ISO date "YYYY-MM-DD"
  interventions: any[];
  isDark: boolean;
  onEventUpdate?: (id: string, newStart: string, newEnd: string) => void;
  labelWidth?: number;
}

const LABEL_W = 44;

/** Calculate non-overlapping column layout for events */
function computeLayout(
  events: CalEvent[],
  containerW: number,
  labelW: number,
  hourPx: number,
): Array<{ event: CalEvent; top: number; height: number; left: number; width: number }> {
  if (events.length === 0) return [];

  const available = containerW - labelW - 4;

  // Convert each event to { start, end, event }
  const items = events.map((e) => ({
    event: e,
    start: new Date(e.start_time).getTime(),
    end: new Date(e.end_time).getTime(),
  }));

  // Sort by start time
  items.sort((a, b) => a.start - b.start);

  // Assign columns (greedy algorithm)
  const columns: number[][] = []; // columns[col] = array of item indices ending times
  const colAssigned: number[] = new Array(items.length).fill(0);

  items.forEach((item, i) => {
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastEnd = columns[col][columns[col].length - 1];
      if (lastEnd <= item.start) {
        columns[col].push(item.end);
        colAssigned[i] = col;
        placed = true;
        break;
      }
    }
    if (!placed) {
      colAssigned[i] = columns.length;
      columns.push([item.end]);
    }
  });

  // For each event, find how many columns its overlap group spans
  return items.map((item, i) => {
    // Find all events that overlap with this one
    const overlapping = items.filter(
      (other) => other.start < item.end && other.end > item.start
    );
    const maxCol = Math.max(...overlapping.map((_, j) => {
      const idx = items.indexOf(overlapping[j]);
      return colAssigned[idx];
    }));
    const totalCols = maxCol + 1;

    const startDate = new Date(item.event.start_time);
    const endDate = new Date(item.event.end_time);
    const startH = startDate.getUTCHours() + startDate.getTimezoneOffset() / -60;
    // Use Brussels time (UTC+1 or UTC+2)
    const brusselsOffset = getBrusselsOffset(startDate);
    const startMin = (startDate.getTime() / 60000) + brusselsOffset;
    const endMin = (endDate.getTime() / 60000) + brusselsOffset;
    const dayStart = Math.floor(startMin / (24 * 60)) * (24 * 60);
    const startMinOfDay = startMin - dayStart;
    const endMinOfDay = endMin - dayStart;

    const top = (startMinOfDay / 60) * hourPx;
    const height = Math.max(((endMinOfDay - startMinOfDay) / 60) * hourPx, hourPx / 4);
    const colW = available / totalCols;
    const left = labelW + colAssigned[i] * colW;
    const width = colW - 2;

    return { event: item.event, top, height, left, width };
  });
}

function getBrusselsOffset(date: Date): number {
  // Returns offset in minutes from UTC for Europe/Brussels
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const bxlStr = date.toLocaleString("en-US", { timeZone: "Europe/Brussels" });
    const utcDate = new Date(utcStr);
    const bxlDate = new Date(bxlStr);
    return (bxlDate.getTime() - utcDate.getTime()) / 60000;
  } catch {
    return 60; // fallback UTC+1
  }
}

function getNowMinutesInDay(): number {
  const now = new Date();
  const brusselsOffset = getBrusselsOffset(now);
  const minutesSinceEpoch = now.getTime() / 60000 + brusselsOffset;
  const dayStart = Math.floor(minutesSinceEpoch / (24 * 60)) * (24 * 60);
  return minutesSinceEpoch - dayStart;
}

export function CalendarDayView({ date, interventions, isDark, onEventUpdate, labelWidth = LABEL_W }: Props) {
  const { width: screenW } = useWindowDimensions();
  const isMobile = screenW < 768;
  const HOUR_PX = isMobile ? 56 : 64;
  const TOTAL_H = 24 * HOUR_PX;

  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const containerRef = useRef<View>(null);
  const [containerW, setContainerW] = useState(screenW);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutesInDay());
  const [popover, setPopover] = useState<{ event: any; x: number; y: number } | null>(null);

  // Filter interventions for this date
  const dayEvents: CalEvent[] = interventions.filter((iv) => {
    if (!iv.start_time) return false;
    const bxlDate = new Date(iv.start_time).toLocaleDateString("fr-FR", {
      timeZone: "Europe/Brussels",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    // Convert bxlDate "DD/MM/YYYY" to "YYYY-MM-DD"
    const parts = bxlDate.split("/");
    const iso = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : "";
    return iso === date;
  });

  // Scroll to 7am on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 7 * HOUR_PX - 20, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [date, HOUR_PX]);

  // Update now indicator every minute
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getNowMinutesInDay()), 60000);
    return () => clearInterval(id);
  }, []);

  const isToday = date === new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Brussels" });
  const nowTop = (nowMinutes / 60) * HOUR_PX;

  const layout = computeLayout(dayEvents, containerW, labelWidth, HOUR_PX);

  const handleEventPress = useCallback((event: CalEvent, pageX: number, pageY: number) => {
    setPopover({ event, x: pageX, y: pageY });
  }, []);

  const handleDragEnd = useCallback(
    (eventId: string, newStart: string, newEnd: string) => {
      setPopover(null);
      onEventUpdate?.(eventId, newStart, newEnd);
    },
    [onEventUpdate]
  );

  const handleResizeEnd = useCallback(
    (eventId: string, newEnd: string) => {
      const ev = dayEvents.find((e) => e.id === eventId);
      if (ev) onEventUpdate?.(eventId, ev.start_time, newEnd);
    },
    [dayEvents, onEventUpdate]
  );

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
        >
          <View
            ref={containerRef}
            style={{ height: TOTAL_H, position: "relative" }}
            onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
          >
            <TimeGridBackground hourPx={HOUR_PX} isDark={isDark} labelWidth={labelWidth} />

            {layout.map(({ event, top, height, left, width }) => (
              <CalendarEventBlock
                key={event.id}
                event={event}
                top={top}
                height={height}
                left={left}
                width={width}
                hourPx={HOUR_PX}
                containerScrollOffset={scrollOffset}
                columnWidth={containerW - labelWidth}
                onPress={handleEventPress}
                onDragEnd={handleDragEnd}
                onResizeEnd={handleResizeEnd}
                isDark={isDark}
                compact={isMobile}
              />
            ))}

            {/* Now indicator */}
            {isToday && (
              <>
                <View
                  style={{
                    position: "absolute",
                    top: nowTop,
                    left: labelWidth - 4,
                    right: 0,
                    height: 2,
                    backgroundColor: "#EF4444",
                    zIndex: 10,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: nowTop - 5,
                    left: labelWidth - 8,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#EF4444",
                    zIndex: 10,
                  }}
                />
              </>
            )}
          </View>
        </ScrollView>
      </GestureHandlerRootView>

      {/* Popover */}
      {popover && (
        <EventDetailPopover
          event={popover.event}
          anchorX={popover.x}
          anchorY={popover.y}
          onClose={() => setPopover(null)}
          isDark={isDark}
        />
      )}
    </View>
  );
}
