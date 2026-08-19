import { ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "./ThemeToggle";

// Placeholder qui épouse la forme du texte final (même police/taille) au lieu
// d'un bloc géométrique — pour les valeurs numériques où un rectangle plein
// paraît trop massif à côté du reste de la carte.
interface GhostTextProps {
  children: ReactNode;
  className?: string;
}

export function GhostText({ children, className }: GhostTextProps) {
  const { isDark } = useTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.75, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text
      className={className}
      style={[{ color: isDark ? "#475569" : "#CBD5E1" }, animatedStyle]}
    >
      {children}
    </Animated.Text>
  );
}

interface ChartSkeletonProps {
  height?: number;
}

// Reprend la structure du vrai graphique (lignes de grille + une courbe) au
// lieu d'un bloc plein qui balaie — juste une respiration douce d'opacité.
export function ChartSkeleton({ height = 180 }: ChartSkeletonProps) {
  const { isDark } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const gridColor = isDark ? "#334155" : "#E4E4E7";
  const curveColor = isDark ? "#64748B" : "#93C5FD";
  const fillColor = "#3B82F6";
  const gridLines = 4;

  // Points fictifs (fractions de largeur/hauteur) donnant l'allure d'une
  // vraie courbe de revenus — plusieurs ondulations plutôt qu'un trait droit.
  const points = [
    { x: 0, y: 0.62 },
    { x: 0.16, y: 0.68 },
    { x: 0.32, y: 0.55 },
    { x: 0.48, y: 0.6 },
    { x: 0.62, y: 0.42 },
    { x: 0.78, y: 0.48 },
    { x: 0.9, y: 0.3 },
    { x: 1, y: 0.2 },
  ].map((p) => ({ x: p.x * layoutWidth, y: p.y * height }));

  // Courbe lissée : chaque segment rejoint le point courant au milieu du
  // suivant via une quadratique, ce qui donne une ondulation continue sans
  // angles plutôt qu'une simple diagonale.
  const smoothPath = points.reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = points[i - 1];
    const midX = (prev.x + p.x) / 2;
    const midY = (prev.y + p.y) / 2;
    return `${d} Q${prev.x},${prev.y} ${midX},${midY}` + (i === points.length - 1 ? ` L${p.x},${p.y}` : "");
  }, "");
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = layoutWidth > 0 ? `${smoothPath} L${last.x},${height} L${first.x},${height} Z` : "";

  return (
    <View onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {layoutWidth > 0 && (
        <Animated.View style={animatedStyle}>
          <Svg width={layoutWidth} height={height}>
            <Defs>
              <LinearGradient id="chartSkeletonFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={fillColor} stopOpacity={isDark ? 0.18 : 0.16} />
                <Stop offset="1" stopColor={fillColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {Array.from({ length: gridLines }).map((_, i) => {
              const y = (height / (gridLines - 1)) * i;
              return (
                <Line
                  key={i}
                  x1={0}
                  y1={y}
                  x2={layoutWidth}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth={1}
                />
              );
            })}
            <Path d={areaPath} fill="url(#chartSkeletonFill)" />
            <Path d={smoothPath} stroke={curveColor} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={curveColor} />
            ))}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
