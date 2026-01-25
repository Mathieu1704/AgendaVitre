import React from "react";
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
  style?: StyleProp<ViewStyle>;
}

export function Button({
  onPress,
  children,
  variant = "default",
  loading,
  disabled,
  className,
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
      // ✅ Style avec borderRadius par défaut de 16, overflow hidden pour forcer l'arrondi
      style={[animatedStyle, { borderRadius: 16, overflow: "hidden" }, style]}
      className={cn(
        "h-12 flex-row items-center justify-center border px-4",
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
        <Text className={cn("text-base font-semibold", textStyles[variant])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}
