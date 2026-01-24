import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  ViewStyle, // ✅ Ajout
  StyleProp, // ✅ Ajout
} from "react-native";
import { Calendar as CalendarIcon, Clock } from "lucide-react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { useTheme } from "./ThemeToggle";
import { cn } from "../cn"; // ✅ Ajout

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  // ✅ AJOUTS
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function DateTimePicker({
  value,
  onChange,
  label = "Date et Heure",
  // ✅ Props
  className,
  style,
}: DateTimePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { isDark } = useTheme();

  const isWeb = Platform.OS === "web";

  // ... (Logique identique : refs, split value, useEffect scroll) ...
  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);

  const [datePart, timePart = "09:00"] = value.split("T");
  const currentDate = new Date(value);
  const [hours, minutes] = timePart.split(":").map(Number);

  const displayDate = currentDate.toLocaleDateString("fr-FR", {
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

  return (
    <>
      <View>
        <Text className="text-sm font-medium text-foreground dark:text-white mb-2 ml-1">
          {label}
        </Text>

        {/* ✅ BOUTON DATE : Application du style et className */}
        <Pressable
          onPress={() => setShowCalendar(true)}
          style={style} // <-- Le radius forcé ira ici
          className={cn(
            "h-12 flex-row items-center justify-between px-4 rounded-xl border border-border dark:border-slate-700 bg-background dark:bg-slate-900 mb-3",
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

        {/* ✅ BOUTON HEURE : Application du style et className */}
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={style} // <-- Le radius forcé ira ici aussi
          className={cn(
            "h-12 flex-row items-center px-4 rounded-xl border border-border dark:border-slate-700 bg-background dark:bg-slate-900",
            className,
          )}
        >
          <View className="bg-muted dark:bg-slate-800 p-2 rounded-lg mr-3">
            <Clock size={18} color="#94A3B8" />
          </View>
          <Text className="text-foreground dark:text-white font-medium text-lg">
            {timePart}
          </Text>
        </Pressable>
      </View>

      {/* Les Dialogs ne changent pas */}
      <Dialog
        open={showCalendar}
        onClose={() => setShowCalendar(false)}
        position="center"
      >
        <View className="p-2">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Sélectionner une date
          </Text>
          <Calendar
            current={datePart}
            onDayPress={handleDateSelect}
            markedDates={{
              [datePart]: { selected: true, selectedColor: "#3B82F6" },
            }}
            firstDay={1}
            theme={calendarTheme}
            style={{ borderRadius: 12, overflow: "hidden" }}
          />
          <Button
            variant="ghost"
            onPress={() => setShowCalendar(false)}
            className="mt-4"
          >
            Annuler
          </Button>
        </View>
      </Dialog>

      <Dialog
        open={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        position="bottom"
      >
        {/* ... Contenu du TimePicker identique ... */}
        <View className="p-4">
          <Text className="text-lg font-bold mb-4 text-foreground dark:text-white text-center">
            Sélectionner l'heure
          </Text>
          <View className="flex-row justify-center items-center gap-2 h-48 bg-muted/20 dark:bg-slate-800/30 rounded-xl overflow-hidden relative">
            <View
              pointerEvents="none"
              className="absolute w-full h-12 bg-primary/10 border-y border-primary/20 top-[72px] z-10"
            />
            <ScrollView
              ref={hoursScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 72 }}
              className="flex-1"
              snapToInterval={isWeb ? undefined : 48}
              decelerationRate="normal"
            >
              {hoursArray.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => handleTimeSelect(h, minutes)}
                  style={itemStyle}
                  className="h-12 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <Text
                    className={`text-2xl font-bold ${h === hours ? "text-primary scale-110" : "text-muted-foreground opacity-50"}`}
                  >
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text className="text-3xl font-bold text-foreground dark:text-white pb-1 z-0">
              :
            </Text>
            <ScrollView
              ref={minutesScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 72 }}
              className="flex-1"
              snapToInterval={isWeb ? undefined : 48}
              decelerationRate="normal"
            >
              {minutesArray.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => handleTimeSelect(hours, m)}
                  style={itemStyle}
                  className="h-12 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <Text
                    className={`text-2xl font-bold ${m === minutes ? "text-primary scale-110" : "text-muted-foreground opacity-50"}`}
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
