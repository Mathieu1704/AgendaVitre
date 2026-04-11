import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Animated, useWindowDimensions, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../components/ThemeToggle";

const TAB_HEIGHT = 62;
const PILL_W = 50;
const PILL_H = 34;

export function CustomTabBar({ state, descriptors, navigation }: any) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Seulement les routes avec une icône (exclut les écrans href: null)
  const visibleRoutes = state.routes.filter(
    (r: any) => !!descriptors[r.key].options.tabBarIcon
  );

  const activeVisibleIndex = visibleRoutes.findIndex(
    (r: any) => r.key === state.routes[state.index]?.key
  );

  // Si la route active est cachée (href: null), trouver la tab parente par préfixe
  const activeIndex = (() => {
    if (activeVisibleIndex >= 0) return activeVisibleIndex;
    const currentName: string = state.routes[state.index]?.name ?? "";
    const prefix = currentName.split("/")[0]; // ex: "calendar", "clients", "parametres"
    const parentIndex = visibleRoutes.findIndex((r: any) =>
      r.name.startsWith(prefix)
    );
    return parentIndex >= 0 ? parentIndex : 0;
  })();

  const numTabs = visibleRoutes.length;
  const tabWidth = width / numTabs;

  // Pill slide
  const pillX = useRef(
    new Animated.Value(activeIndex * tabWidth + (tabWidth - PILL_W) / 2)
  ).current;

  // Scale par icône
  const scaleAnims = useRef(
    visibleRoutes.map((_: any, i: number) =>
      new Animated.Value(i === activeIndex ? 1.15 : 1.0)
    )
  ).current;

  useEffect(() => {
    Animated.spring(pillX, {
      toValue: activeIndex * tabWidth + (tabWidth - PILL_W) / 2,
      useNativeDriver: true,
      tension: 180,
      friction: 22,
    }).start();

    visibleRoutes.forEach((_: any, i: number) => {
      Animated.spring(scaleAnims[i], {
        toValue: i === activeIndex ? 1.15 : 1.0,
        useNativeDriver: true,
        tension: 200,
        friction: 18,
      }).start();
    });
  }, [activeIndex, tabWidth]);

  const bg = isDark ? "#0F172A" : "#FFFFFF";
  const border = isDark ? "#1E293B" : "#E4E4E7";
  const inactive = isDark ? "#94A3B8" : "#71717A";
  const bottomPad = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);

  return (
    <View style={{
      backgroundColor: bg,
      borderTopWidth: 1,
      borderTopColor: border,
      height: TAB_HEIGHT + bottomPad,
      paddingBottom: bottomPad,
      paddingTop: 10,
      flexDirection: "row",
    }}>
      {/* Pill glissante */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 10,
          left: 0,
          width: PILL_W,
          height: PILL_H,
          borderRadius: PILL_H / 2,
          backgroundColor: "#3B82F6",
          transform: [{ translateX: pillX }],
        }}
      />

      {visibleRoutes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isActive = index === activeIndex;
        const label = (options.title ?? route.name) as string;
        const icon = options.tabBarIcon?.({
          focused: isActive,
          color: isActive ? "#FFFFFF" : inactive,
          size: 22,
        });

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={{ flex: 1, alignItems: "center", justifyContent: "flex-start" }}
          >
            <Animated.View style={{
              transform: [{ scale: scaleAnims[index] }],
              width: PILL_W,
              height: PILL_H,
              alignItems: "center",
              justifyContent: "center",
            }}>
              {icon}
            </Animated.View>
            <Text style={{
              fontSize: 11,
              fontWeight: "600",
              color: isActive ? "#3B82F6" : inactive,
              marginTop: 2,
            }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
