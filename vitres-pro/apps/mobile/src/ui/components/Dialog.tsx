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
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
        className={cn(
          "p-3",
          position === "bottom" ? "justify-end" : "justify-center"
        )}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        >
          <View className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-4">
            {children}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
