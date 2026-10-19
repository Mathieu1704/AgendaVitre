import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

// Courbe "ease-out" douce : démarre vite, se pose en douceur.
export const COLLAPSE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Bloc dépliable animé à la hauteur réelle du contenu (pas de maxHeight
 * arbitraire qui donne un temps mort) : hauteur + fondu + léger glissement.
 * Le contenu est mesuré en position absolue, donc même replié. Une fois
 * ouvert, la hauteur suit directement le contenu (ex. un bloc Collapsible
 * imbriqué qui s'anime) pour éviter tout décalage.
 */
export function Collapsible({
  open,
  children,
  duration = 300,
  style,
}: {
  open: boolean;
  children: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [contentHeight, setContentHeight] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const toggling = useRef(false);
  const lastOpen = useRef(open);

  useEffect(() => {
    const target = open ? contentHeight : 0;
    if (lastOpen.current !== open || toggling.current) {
      lastOpen.current = open;
      toggling.current = true;
      Animated.parallel([
        Animated.timing(height, { toValue: target, duration, easing: COLLAPSE_EASING, useNativeDriver: false }),
        Animated.timing(progress, { toValue: open ? 1 : 0, duration, easing: COLLAPSE_EASING, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (finished) toggling.current = false;
      });
    } else if (open) {
      height.setValue(contentHeight);
    }
  }, [open, contentHeight]);

  return (
    <Animated.View style={[{ height, overflow: "hidden" }, style]}>
      <Animated.View
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
