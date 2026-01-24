import React from "react";
// 1. AJOUT de StyleProp et ViewStyle dans les imports
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { cn } from "../../lib/utils";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "icon";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  // 2. AJOUT de la définition du style ici
  style?: StyleProp<ViewStyle>;
}

export function Button({
  onPress,
  children,
  variant = "default",
  loading,
  disabled,
  className,
  // 3. RÉCUPÉRATION de la variable style ici
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantStyles = {
    default: cn(
      "bg-primary border-primary",
      "dark:bg-blue-600 dark:border-blue-600",
    ),
    outline: cn("bg-transparent border-border", "dark:border-slate-700"),
    ghost: "bg-transparent border-transparent",
    destructive: cn(
      "bg-destructive border-destructive",
      "dark:bg-red-600 dark:border-red-600",
    ),
  };

  const textStyles = {
    default: "text-primary-foreground dark:text-white",
    outline: "text-foreground dark:text-white",
    ghost: "text-foreground dark:text-white",
    destructive: "text-destructive-foreground dark:text-white",
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      // 4. APPLICATION du style ici (ajouté au tableau)
      style={[animatedStyle, style]}
      className={cn(
        "h-11 flex-row items-center justify-center rounded-lg border px-4",
        variantStyles[variant],
        (loading || disabled) && "opacity-50",
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "default" || variant === "destructive" ? "#fff" : "#000"
          }
        />
      ) : typeof children === "string" ? (
        <Text className={cn("text-base font-medium", textStyles[variant])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}
