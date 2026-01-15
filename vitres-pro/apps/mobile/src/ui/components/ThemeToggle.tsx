import React, { useEffect, useState } from "react";
import { Pressable, Platform } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@lvmagenda_theme";

// ✅ Hook personnalisé qui fonctionne partout
export function useTheme() {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        setColorScheme(saved);
        applyTheme(saved);
      }
    } catch (error) {
      console.error("Erreur chargement thème:", error);
    }
  };

  const applyTheme = (theme: "light" | "dark") => {
    // ✅ Pour le WEB uniquement
    if (Platform.OS === "web" && typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(newTheme);
    applyTheme(newTheme);

    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
    } catch (error) {
      console.error("Erreur sauvegarde thème:", error);
    }
  };

  return { colorScheme, toggleTheme, isDark: colorScheme === "dark" };
}

// ✅ Composant ThemeToggle
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const rotation = useSharedValue(isDark ? 180 : 0);

  useEffect(() => {
    rotation.value = withSpring(isDark ? 180 : 0);
  }, [isDark]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      onPress={toggleTheme}
      className="p-2 rounded-full hover:bg-muted dark:hover:bg-slate-800 active:opacity-70"
      accessibilityLabel="Changer le thème"
      accessibilityRole="button"
    >
      <Animated.View style={animatedStyle}>
        {isDark ? (
          <Moon size={20} color="#E2E8F0" />
        ) : (
          <Sun size={20} color="#0F172A" />
        )}
      </Animated.View>
    </Pressable>
  );
}
