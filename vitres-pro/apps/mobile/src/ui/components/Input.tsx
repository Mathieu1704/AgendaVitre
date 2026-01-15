import React, { useState } from "react";
import { TextInput, View, Text, TextInputProps } from "react-native";
import { cn } from "../../lib/utils";

interface InputProps extends TextInputProps {
  label?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="gap-2 w-full">
      {label && (
        <Text className="text-sm font-medium text-foreground dark:text-white ml-1">
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor="#A1A1AA"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "h-11 rounded-lg border px-3 text-base",
          // Couleurs par défaut
          "bg-background text-foreground border-input",
          // Dark mode
          "dark:bg-slate-900 dark:text-white dark:border-slate-700",
          // Focus
          isFocused && "border-primary dark:border-primary",
          className
        )}
        {...props}
      />
    </View>
  );
}
