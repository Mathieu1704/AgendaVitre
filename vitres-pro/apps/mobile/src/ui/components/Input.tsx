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

  return (
    <View className="gap-1.5 w-full" style={containerStyle}>
      {label && (
        // ✅ SUPPRESSION de ml-1 pour alignement strict
        <Text className="text-sm font-semibold text-foreground dark:text-white">
          {label}
        </Text>
      )}
      <View
        style={[{ borderRadius: 16, overflow: "hidden" }, style]}
        className={cn(
          // ✅ PASSAGE à px-4 et h-12 pour matcher Select/MultiSelect
          "h-12 flex-row items-center border px-4 bg-background dark:bg-slate-900",
          "border-border dark:border-slate-700",
          isFocused && "border-primary dark:border-primary",
          className,
        )}
      >
        <TextInput
          placeholderTextColor="#A1A1AA"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlignVertical="center"
          style={[
            {
              flex: 1,
              height: "100%",
              paddingVertical: 0,
              fontSize: 16,
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
