import React from "react";
import { Modal, Pressable, View } from "react-native";
import { cn } from "../cn";

export function Dialog({
  open,
  onClose,
  children,
  position = "center",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: "center" | "bottom";
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
        className={cn(
          "p-4",
          position === "bottom" ? "justify-end" : "justify-center",
        )}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-md self-center"
        >
          {/* On enlève le View p-6 interne pour éviter les coupures */}
          <View className="rounded-3xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900 shadow-2xl overflow-hidden">
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
