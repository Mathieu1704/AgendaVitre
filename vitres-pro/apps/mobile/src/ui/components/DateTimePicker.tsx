import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Calendar as CalendarIcon, Clock } from "lucide-react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { useTheme } from "./ThemeToggle";
import { cn } from "../cn";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function DateTimePicker({
  value,
  onChange,
  label = "Date et Heure",
  className,
  style,
}: DateTimePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { isDark } = useTheme();
  const isWeb = Platform.OS === "web";
  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);
  const [datePart, timePart = "09:00"] = value.split("T");
  const [hours, minutes] = timePart.split(":").map(Number);
  // Parse les parties date directement (évite tout décalage de fuseau)
  const [dpY, dpM, dpD] = datePart.split("-").map(Number);
  const displayDate = new Date(dpY, dpM - 1, dpD).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    if (showTimePicker) {
      setTimeout(() => {
        try {
          hoursScrollRef.current?.scrollTo({ y: hours * 48, animated: true });
          minutesScrollRef.current?.scrollTo({
            y: (minutes / 5) * 48,
            animated: true,
          });
        } catch (e) {
          console.log(e);
        }
      }, 100);
    }
  }, [showTimePicker]);

  const handleDateSelect = (day: DateData) => {
    onChange(`${day.dateString}T${timePart}`);
    setShowCalendar(false);
  };

  const handleTimeSelect = (h: number, m: number) => {
    const newTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange(`${datePart}T${newTime}`);
  };

  const calendarTheme = {
    calendarBackground: isDark ? "#1E293B" : "#FFFFFF",
    textSectionTitleColor: isDark ? "#94A3B8" : "#64748B",
    selectedDayBackgroundColor: "#3B82F6",
    selectedDayTextColor: "#ffffff",
    todayTextColor: "#3B82F6",
    dayTextColor: isDark ? "#F8FAFC" : "#09090B",
    textDisabledColor: isDark ? "#334155" : "#E4E4E7",
    monthTextColor: isDark ? "#F8FAFC" : "#09090B",
    textDayFontWeight: "500" as const,
    textMonthFontWeight: "bold" as const,
    textDayHeaderFontWeight: "600" as const,
    textDayFontSize: 15,
  };

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const minutesArray = Array.from({ length: 12 }, (_, i) => i * 5);
  const itemStyle = isWeb
    ? { cursor: "pointer" as const, userSelect: "none" as const }
    : {};

  const handleScrollEnd = (e: any, type: "hours" | "minutes") => {
    const y = e.nativeEvent.contentOffset.y;
    const itemHeight = 48; // Correspond à h-12 (48px)
    const index = Math.round(y / itemHeight);

    if (type === "hours") {
      const val = hoursArray[index];
      if (val !== undefined && val !== hours) {
        handleTimeSelect(val, minutes);
      }
    } else {
      const val = minutesArray[index];
      if (val !== undefined && val !== minutes) {
        handleTimeSelect(hours, val);
      }
    }
  };

  return (
    <>
      <View className="gap-1.5 w-full">
        {label && (
          <Text className="text-sm font-semibold text-foreground dark:text-white">
            {label}
          </Text>
        )}

        {/* BOUTON DATE */}
        <Pressable
          onPress={() => setShowCalendar(true)}
          style={[{ borderRadius: 16, overflow: "hidden" }, style]}
          className={cn(
            "h-12 flex-row items-center justify-between px-4 border",
            "bg-background border-border",
            "dark:bg-slate-900 dark:border-slate-700",
            "active:opacity-80 mb-2",
            className,
          )}
        >
          <View className="flex-row items-center gap-3">
            <CalendarIcon size={18} color="#3B82F6" />
            <Text className="text-foreground dark:text-white font-medium capitalize">
              {displayDate}
            </Text>
          </View>
        </Pressable>

        {/* BOUTON HEURE */}
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={[{ borderRadius: 16, overflow: "hidden" }, style]}
          className={cn(
            "h-12 flex-row items-center px-4 border",
            "bg-background border-border",
            "dark:bg-slate-900 dark:border-slate-700",
            "active:opacity-80",
            className,
          )}
        >
          <View className="flex-row items-center gap-3">
            <Clock size={18} color="#3B82F6" />
            <Text className="text-foreground dark:text-white font-medium">
              {timePart}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* DIALOG DATE (Calendrier) */}
      <Dialog
        open={showCalendar}
        onClose={() => setShowCalendar(false)}
        // ✅ FIX WEB : Centré sur Web, Bottom sur Mobile
        position={isWeb ? "center" : "bottom"}
      >
        <View className="p-2">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Sélectionner une date
          </Text>
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <Calendar
              current={datePart}
              onDayPress={handleDateSelect}
              markedDates={{
                [datePart]: { selected: true, selectedColor: "#3B82F6" },
              }}
              firstDay={1}
              theme={calendarTheme}
            />
          </View>
          <Button
            variant="ghost"
            onPress={() => setShowCalendar(false)}
            className="mt-4"
          >
            Annuler
          </Button>
        </View>
      </Dialog>

      {/* DIALOG HEURE */}
      <Dialog
        open={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        // ✅ WEB : Modale centrée. MOBILE : En bas.
        position={isWeb ? "center" : "bottom"}
      >
        <View
          className="p-4"
          // ✅ FIX WEB : On limite la hauteur max sur PC pour éviter que ça dépasse de l'écran
          style={
            isWeb
              ? ({ maxHeight: "80vh", width: 500, maxWidth: "100%" } as any)
              : {}
          }
        >
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Sélectionner l'heure
          </Text>

          <View
            className={cn(
              "flex-row justify-center gap-2 overflow-hidden relative",
              // ✅ MOBILE : Hauteur fixe 48 (roulette). WEB : Hauteur flexible (liste)
              isWeb
                ? "h-64 bg-transparent"
                : "h-48 bg-muted/30 dark:bg-slate-800/30 items-center",
            )}
            style={{ borderRadius: 20 }}
          >
            {/* Barre de sélection (Uniquement sur MOBILE) */}
            {!isWeb && (
              <View
                pointerEvents="none"
                className="absolute w-full h-12 bg-primary/10 border-y border-primary/20 top-[72px] z-10"
              />
            )}

            {/* ScrollView HEURES */}
            <ScrollView
              ref={hoursScrollRef}
              showsVerticalScrollIndicator={isWeb} // On affiche la barre sur Web
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingVertical: isWeb ? 0 : 72 }}
              className={cn("flex-1", isWeb && "border-r border-border")} // Séparateur sur Web
              snapToInterval={isWeb ? 0 : 48} // Pas de snap sur Web
              decelerationRate="normal"
              onMomentumScrollEnd={(e) => !isWeb && handleScrollEnd(e, "hours")}
              onScrollEndDrag={(e) => !isWeb && handleScrollEnd(e, "hours")}
            >
              {hoursArray.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => {
                    handleTimeSelect(h, minutes);
                    if (!isWeb) {
                      hoursScrollRef.current?.scrollTo({
                        y: h * 48,
                        animated: true,
                      });
                    }
                  }}
                  style={itemStyle}
                  className={cn(
                    "h-12 items-center justify-center rounded-md mx-1",
                    // ✅ WEB : Style bouton classique (fond bleu si sélectionné)
                    isWeb && h === hours && "bg-primary",
                    isWeb && h !== hours && "hover:bg-muted",
                  )}
                >
                  <Text
                    className={cn(
                      "font-bold",
                      // ✅ MOBILE : Gros texte + opacité. WEB : Texte normal + couleur selon sélection
                      !isWeb && "text-2xl",
                      !isWeb && h === hours && "text-primary scale-110",
                      !isWeb &&
                        h !== hours &&
                        "text-muted-foreground opacity-50",
                      isWeb && h === hours && "text-white",
                      isWeb && h !== hours && "text-foreground dark:text-white",
                    )}
                  >
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Séparateur (Uniquement sur MOBILE) */}
            {!isWeb && (
              <Text className="text-3xl font-bold text-foreground dark:text-white pb-1 z-0">
                :
              </Text>
            )}

            {/* ScrollView MINUTES */}
            <ScrollView
              ref={minutesScrollRef}
              showsVerticalScrollIndicator={isWeb}
              nestedScrollEnabled={true}
              contentContainerStyle={{ paddingVertical: isWeb ? 0 : 72 }}
              className="flex-1"
              snapToInterval={isWeb ? 0 : 48}
              decelerationRate="normal"
              onMomentumScrollEnd={(e) =>
                !isWeb && handleScrollEnd(e, "minutes")
              }
              onScrollEndDrag={(e) => !isWeb && handleScrollEnd(e, "minutes")}
            >
              {minutesArray.map((m, index) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    handleTimeSelect(hours, m);
                    if (!isWeb) {
                      minutesScrollRef.current?.scrollTo({
                        y: index * 48,
                        animated: true,
                      });
                    }
                  }}
                  style={itemStyle}
                  className={cn(
                    "h-12 items-center justify-center rounded-md mx-1",
                    // ✅ WEB : Style bouton classique
                    isWeb && m === minutes && "bg-primary",
                    isWeb && m !== minutes && "hover:bg-muted",
                  )}
                >
                  <Text
                    className={cn(
                      "font-bold",
                      // ✅ Styles conditionnels Mobile vs Web
                      !isWeb && "text-2xl",
                      !isWeb && m === minutes && "text-primary scale-110",
                      !isWeb &&
                        m !== minutes &&
                        "text-muted-foreground opacity-50",
                      isWeb && m === minutes && "text-white",
                      isWeb &&
                        m !== minutes &&
                        "text-foreground dark:text-white",
                    )}
                  >
                    {String(m).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => setShowTimePicker(false)}
              className="flex-1"
            >
              Fermer
            </Button>
            <Button onPress={() => setShowTimePicker(false)} className="flex-1">
              Valider
            </Button>
          </View>
        </View>
      </Dialog>
    </>
  );
}
