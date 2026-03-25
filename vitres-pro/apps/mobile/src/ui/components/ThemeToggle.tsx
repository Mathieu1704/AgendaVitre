import React, { createContext, useContext, useEffect, useState } from "react";
import { Pressable, Platform, useColorScheme } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";

const THEME_KEY = "@lvmagenda_theme";

type ThemeContextType = {
  colorScheme: "light" | "dark";
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: "light",
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Native: follows iOS/Android system dark mode automatically
  const systemScheme = useColorScheme() ?? "light";

  // Web: manually controlled via the toggle button
  const [webScheme, setWebScheme] = useState<"light" | "dark">("light");

  // Native: dark mode disabled (NativeWind v2 + New Architecture incompatible)
  // Re-enable by replacing "light" with systemScheme once NativeWind v4 is adopted
  const colorScheme: "light" | "dark" =
    Platform.OS === "web" ? webScheme : "light";
  const isDark = colorScheme === "dark";

  // Web: load saved preference from localStorage on mount
  useEffect(() => {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
    if (saved === "dark" || saved === "light") {
      setWebScheme(saved);
    }
  }, []);

  // Web: apply/remove "dark" class on <html>
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggleTheme = () => {
    if (Platform.OS !== "web") return; // native follows system — no manual toggle
    const next: "light" | "dark" = webScheme === "dark" ? "light" : "dark";
    setWebScheme(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(THEME_KEY, next);
    }
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const rotation = useSharedValue(isDark ? 180 : 0);

  useEffect(() => {
    rotation.value = withSpring(isDark ? 180 : 0);
  }, [isDark]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Only meaningful on web — hide on native
  if (Platform.OS !== "web") return null;

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
