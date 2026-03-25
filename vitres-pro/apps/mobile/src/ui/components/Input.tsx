import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from "react-native";
import { cn } from "../../lib/utils";
import { useTheme } from "./ThemeToggle";

interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  className,
  containerStyle,
  inputStyle,
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { isDark } = useTheme();

  return (
    <View style={[{ gap: 6, width: "100%" }, containerStyle]}>
      {label && (
        <Text className="text-sm font-semibold text-foreground dark:text-white">
          {label}
        </Text>
      )}
      <View
        style={[
          { borderRadius: 16, overflow: "hidden" },
          Platform.OS !== "web"
            ? {
                backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                borderColor: isFocused
                  ? "#3B82F6"
                  : isDark
                  ? "#334155"
                  : "#E4E4E7",
                borderWidth: 1,
              }
            : {},
          style,
        ]}
        className={cn(
          "h-12 flex-row items-center border px-4 bg-background dark:bg-slate-900",
          "border-border dark:border-slate-700",
          isFocused && "border-primary dark:border-primary",
          className,
        )}
      >
        <TextInput
          placeholderTextColor={isDark ? "#64748B" : "#A1A1AA"}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlignVertical="center"
          style={[
            {
              flex: 1,
              height: "100%",
              paddingVertical: 0,
              fontSize: 16,
              ...(Platform.OS !== "web" ? { color: isDark ? "#F8FAFC" : "#0F172A" } : {}),
              ...(Platform.OS === "web"
                ? ({ outlineStyle: "none" } as any)
                : {}),
            },
            inputStyle,
          ]}
          className="text-foreground dark:text-white"
          {...props}
        />
      </View>
    </View>
  );
}
