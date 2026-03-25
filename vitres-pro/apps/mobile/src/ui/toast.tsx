import React from "react";
import { View, Text } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, XCircle, Info } from "lucide-react-native";
import { useTheme } from "./components/ThemeToggle";

export const toast = {
  success: (title: string, message?: string) =>
    Toast.show({ type: "success", text1: title, text2: message }),
  error: (title: string, message?: string) =>
    Toast.show({ type: "error", text1: title, text2: message }),
  info: (title: string, message?: string) =>
    Toast.show({ type: "info", text1: title, text2: message }),
};

function ToastCard({
  text1,
  text2,
  bg,
  border,
  iconBg,
  icon,
  titleColor,
  msgColor,
}: {
  text1?: string;
  text2?: string;
  bg: string;
  border: string;
  iconBg: string;
  icon: React.ReactNode;
  titleColor: string;
  msgColor: string;
}) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: bg,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View
        style={{
          backgroundColor: iconBg,
          borderRadius: 20,
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        {text1 && (
          <Text style={{ fontWeight: "800", fontSize: 14, color: titleColor }}>
            {text1}
          </Text>
        )}
        {text2 && (
          <Text
            style={{
              fontSize: 13,
              color: msgColor,
              marginTop: text1 ? 2 : 0,
              lineHeight: 18,
            }}
          >
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
}

export function ToastHost() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Toast
      position="top"
      topOffset={insets.top + 8}
      config={{
        success: ({ text1, text2 }) => (
          <ToastCard
            text1={text1}
            text2={text2}
            bg={isDark ? "#052e16" : "#f0fdf4"}
            border={isDark ? "#166534" : "#bbf7d0"}
            iconBg={isDark ? "#14532d" : "#dcfce7"}
            icon={<CheckCircle size={20} color="#22c55e" />}
            titleColor={isDark ? "#86efac" : "#15803d"}
            msgColor={isDark ? "#4ade80" : "#166534"}
          />
        ),
        error: ({ text1, text2 }) => (
          <ToastCard
            text1={text1}
            text2={text2}
            bg={isDark ? "#2d0a0a" : "#fff1f2"}
            border={isDark ? "#7f1d1d" : "#fecdd3"}
            iconBg={isDark ? "#450a0a" : "#ffe4e6"}
            icon={<XCircle size={20} color="#ef4444" />}
            titleColor={isDark ? "#fca5a5" : "#b91c1c"}
            msgColor={isDark ? "#f87171" : "#dc2626"}
          />
        ),
        info: ({ text1, text2 }) => (
          <ToastCard
            text1={text1}
            text2={text2}
            bg={isDark ? "#0c1a3a" : "#eff6ff"}
            border={isDark ? "#1e3a8a" : "#bfdbfe"}
            iconBg={isDark ? "#1e3a8a" : "#dbeafe"}
            icon={<Info size={20} color="#3b82f6" />}
            titleColor={isDark ? "#93c5fd" : "#1d4ed8"}
            msgColor={isDark ? "#60a5fa" : "#1e40af"}
          />
        ),
      }}
    />
  );
}
