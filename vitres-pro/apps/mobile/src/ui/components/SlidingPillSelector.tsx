import React, { useState, useEffect } from "react";
import { View, Pressable, LayoutChangeEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

export type PillOption = {
  id: string;
  label: string;
  pillColor?: string;
  activeTextColor?: string;
  icon?: (color: string) => React.ReactNode;
};

type SlidingPillSelectorProps = {
  options: PillOption[];
  selected: string;
  onSelect: (id: string) => void;
  pillColor: string;
  bgColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
  containerStyle?: object;
  itemPy?: number;
  itemPx?: number;
  fontSize?: number;
};

export function SlidingPillSelector({
  options,
  selected,
  onSelect,
  pillColor,
  bgColor,
  activeTextColor,
  inactiveTextColor,
  containerStyle,
  itemPy = 8,
  itemPx = 0,
  fontSize = 13,
}: SlidingPillSelectorProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const selectedIndex = options.findIndex((o) => o.id === selected);
  const itemWidth = containerWidth > 0 ? containerWidth / options.length : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (itemWidth > 0) {
      translateX.value = withSpring(selectedIndex * itemWidth, {
        mass: 0.5,
        stiffness: 280,
        damping: 28,
      });
    }
  }, [selectedIndex, itemWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: itemWidth,
    backgroundColor: options[selectedIndex]?.pillColor ?? pillColor,
  }));

  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: bgColor,
          borderRadius: 100,
          padding: 3,
          position: "relative",
        },
        containerStyle,
      ]}
      onLayout={(e: LayoutChangeEvent) =>
        setContainerWidth(e.nativeEvent.layout.width - 6)
      }
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 3,
              left: 3,
              bottom: 3,
              borderRadius: 100,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
            pillStyle,
          ]}
        />
      )}

      {options.map((opt) => {
        const isActive = opt.id === selected;
        const textColor = isActive
          ? (opt.activeTextColor ?? activeTextColor)
          : inactiveTextColor;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
              paddingVertical: itemPy,
              paddingHorizontal: itemPx,
              borderRadius: 100,
              zIndex: 1,
            }}
          >
            {opt.icon?.(textColor)}
            <Animated.Text numberOfLines={1} style={{ fontSize, fontWeight: "600", color: textColor }}>
              {opt.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}
