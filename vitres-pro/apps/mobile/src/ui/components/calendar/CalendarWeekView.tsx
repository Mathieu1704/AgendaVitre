import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Text,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CalEvent, CalendarEventBlock } from "./CalendarEventBlock";
import { TimeGridBackground } from "./TimeGridBackground";
import { EventDetailPopover } from "./EventDetailPopover";

interface Props {
  weekStart: Date; // Monday
  interventions: any[];
  isDark: boolean;
  onEventUpdate?: (id: string, newStart: string, newEnd: string) => void;
}

const LABEL_W = 44;
const DAYS_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

function getBrusselsOffset(date: Date): number {
  try {
    const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
    const bxlStr = date.toLocaleString("en-US", { timeZone: "Europe/Brussels" });
    return (new Date(bxlStr).getTime() - new Date(utcStr).getTime()) / 60000;
  } catch { return 60; }
}

function getISODateBrussels(date: Date): string {
  return date.toLocaleDateString("fr-CA", { timeZone: "Europe/Brussels" });
}

function getNowMinutesInDay(): number {
  const now = new Date();
  const offset = getBrusselsOffset(now);
  const minutesSinceEpoch = now.getTime() / 60000 + offset;
  const dayStart = Math.floor(minutesSinceEpoch / (24 * 60)) * (24 * 60);
  return minutesSinceEpoch - dayStart;
}

function computeDayLayout(
  events: CalEvent[],
  colW: number,
  hourPx: number,
): Array<{ event: CalEvent; top: number; height: number; colLeft: number; colWidth: number }> {
  if (events.length === 0) return [];
  const items = events.map((e) => ({
    event: e,
    start: new Date(e.start_time).getTime(),
    end: new Date(e.end_time).getTime(),
  })).sort((a, b) => a.start - b.start);

  const colAssigned: number[] = new Array(items.length).fill(0);
  const cols: number[] = []; // last end time per column

  items.forEach((item, i) => {
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c] <= item.start) {
        cols[c] = item.end;
        colAssigned[i] = c;
        placed = true;
        break;
      }
    }
    if (!placed) { colAssigned[i] = cols.length; cols.push(item.end); }
  });

  return items.map((item, i) => {
    const overlapping = items.filter(o => o.start < item.end && o.end > item.start);
    const totalCols = Math.max(...overlapping.map((_, j) => colAssigned[items.indexOf(overlapping[j])])) + 1;

    const offset = getBrusselsOffset(new Date(item.event.start_time));
    const startMin = new Date(item.event.start_time).getTime() / 60000 + offset;
    const endMin = new Date(item.event.end_time).getTime() / 60000 + offset;
    const dayStart = Math.floor(startMin / (24 * 60)) * (24 * 60);

    const top = ((startMin - dayStart) / 60) * hourPx;
    const height = Math.max(((endMin - startMin) / 60) * hourPx, hourPx / 4);
    const cw = (colW - 4) / totalCols;
    return { event: item.event, top, height, colLeft: colAssigned[i] * cw + 2, colWidth: cw - 1 };
  });
}

export function CalendarWeekView({ weekStart, interventions, isDark, onEventUpdate }: Props) {
  const { width: screenW } = useWindowDimensions();
  const isMobile = screenW < 768;
  const HOUR_PX = isMobile ? 56 : 64;
  const TOTAL_H = 24 * HOUR_PX;

  // On mobile: show 3 days at 120px each; on desktop: flex columns
  const MOBILE_COL_W = 120;
  const desktopColW = Math.floor((screenW - LABEL_W - 16) / 7);

  const scrollRef = useRef<ScrollView>(null);
  const hScrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [popover, setPopover] = useState<{ event: any; x: number; y: number } | null>(null);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutesInDay());

  const todayISO = getISODateBrussels(new Date());

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const colW = isMobile ? MOBILE_COL_W : desktopColW;

  // Group events by date
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const iv of interventions) {
      if (!iv.start_time) continue;
      const dayISO = getISODateBrussels(new Date(iv.start_time));
      (map[dayISO] ||= []).push(iv);
    }
    return map;
  }, [interventions]);

  // Scroll to 7am on mount
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 7 * HOUR_PX - 20, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [weekStart, HOUR_PX]);

  // Scroll horizontal to today on mobile
  useEffect(() => {
    if (!isMobile) return;
    const todayIdx = weekDays.findIndex(d => getISODateBrussels(d) === todayISO);
    if (todayIdx >= 0) {
      const t = setTimeout(() => {
        hScrollRef.current?.scrollTo({ x: todayIdx * MOBILE_COL_W, animated: false });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [weekStart, isMobile]);

  // Update now indicator every minute
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(getNowMinutesInDay()), 60000);
    return () => clearInterval(id);
  }, []);

  const nowTop = (nowMinutes / 60) * HOUR_PX;

  const handleEventPress = useCallback((event: CalEvent, pageX: number, pageY: number) => {
    setPopover({ event, x: pageX, y: pageY });
  }, []);

  const handleDragEnd = useCallback(
    (eventId: string, newStart: string, newEnd: string, dayOffset?: number) => {
      setPopover(null);
      if (dayOffset && dayOffset !== 0) {
        // Shift start+end by dayOffset days
        const newStartDate = new Date(newStart);
        newStartDate.setDate(newStartDate.getDate() + dayOffset);
        const newEndDate = new Date(newEnd);
        newEndDate.setDate(newEndDate.getDate() + dayOffset);
        onEventUpdate?.(eventId, newStartDate.toISOString(), newEndDate.toISOString());
      } else {
        onEventUpdate?.(eventId, newStart, newEnd);
      }
    },
    [onEventUpdate]
  );

  // Column x offsets for cross-day drag (week view)
  const weekDayOffsets = useMemo(
    () => weekDays.map((_, i) => LABEL_W + i * colW),
    [weekDays, colW]
  );

  const headerBg = isDark ? "#0F172A" : "#FFFFFF";
  const headerBorder = isDark ? "#1E293B" : "#E2E8F0";
  const todayCircleBg = "#3B82F6";

  const DayHeaders = () => (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: headerBorder,
        backgroundColor: headerBg,
        paddingLeft: LABEL_W,
      }}
    >
      {weekDays.map((day) => {
        const iso = getISODateBrussels(day);
        const isToday = iso === todayISO;
        const dayNum = day.getDate();
        const dayName = DAYS_FR[day.getDay()];
        return (
          <View
            key={iso}
            style={{
              width: colW,
              alignItems: "center",
              paddingVertical: 8,
              borderRightWidth: 1,
              borderColor: headerBorder,
            }}
          >
            <Text style={{
              fontSize: 10,
              fontWeight: "600",
              color: isToday ? todayCircleBg : isDark ? "#64748B" : "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}>
              {dayName}
            </Text>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isToday ? todayCircleBg : "transparent",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}>
              <Text style={{
                fontSize: 15,
                fontWeight: "700",
                color: isToday ? "#FFFFFF" : isDark ? "#F8FAFC" : "#0F172A",
              }}>
                {dayNum}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const GridContent = () => (
    <View style={{ flexDirection: "row", height: TOTAL_H, position: "relative" }}>
      {/* Hour labels */}
      <View style={{ width: LABEL_W, position: "relative" }}>
        <TimeGridBackground hourPx={HOUR_PX} isDark={isDark} labelWidth={LABEL_W} />
      </View>

      {/* Day columns */}
      {weekDays.map((day, dayIdx) => {
        const iso = getISODateBrussels(day);
        const isToday = iso === todayISO;
        const colEvents = eventsByDay[iso] ?? [];
        const layout = computeDayLayout(colEvents, colW, HOUR_PX);

        return (
          <View
            key={iso}
            style={{
              width: colW,
              height: TOTAL_H,
              position: "relative",
              borderRightWidth: 1,
              borderColor: isDark ? "#1E293B" : "#F1F5F9",
              backgroundColor: isToday ? (isDark ? "#1D4ED808" : "#EFF6FF33") : "transparent",
            }}
          >
            {/* Hour lines (shared visual) */}
            {Array.from({ length: 24 }, (_, h) => (
              <View
                key={h}
                style={{
                  position: "absolute",
                  top: h * HOUR_PX,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                }}
              />
            ))}

            {layout.map(({ event, top, height, colLeft, colWidth }) => (
              <CalendarEventBlock
                key={event.id}
                event={event}
                top={top}
                height={height}
                left={colLeft}
                width={colWidth}
                hourPx={HOUR_PX}
                containerScrollOffset={scrollOffset}
                columnWidth={colW}
                columnIndex={dayIdx}
                weekDayOffsets={weekDayOffsets}
                onPress={handleEventPress}
                onDragEnd={handleDragEnd}
                isDark={isDark}
                compact={isMobile}
              />
            ))}

            {/* Now indicator */}
            {isToday && (
              <View
                style={{
                  position: "absolute",
                  top: nowTop,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: "#EF4444",
                  zIndex: 10,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Sticky header */}
        {!isMobile ? (
          <DayHeaders />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={hScrollRef} scrollEnabled={false}>
            <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: headerBorder, backgroundColor: headerBg, paddingLeft: LABEL_W }}>
              {weekDays.map((day) => {
                const iso = getISODateBrussels(day);
                const isToday = iso === todayISO;
                return (
                  <View key={iso} style={{ width: MOBILE_COL_W, alignItems: "center", paddingVertical: 8, borderRightWidth: 1, borderColor: headerBorder }}>
                    <Text style={{ fontSize: 9, fontWeight: "600", color: isToday ? todayCircleBg : isDark ? "#64748B" : "#94A3B8", textTransform: "uppercase" }}>
                      {DAYS_FR[day.getDay()]}
                    </Text>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isToday ? todayCircleBg : "transparent", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: isToday ? "#FFFFFF" : isDark ? "#F8FAFC" : "#0F172A" }}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Scrollable grid */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
        >
          {isMobile ? (
            <ScrollView
              horizontal
              ref={hScrollRef}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
            >
              <GridContent />
            </ScrollView>
          ) : (
            <GridContent />
          )}
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
