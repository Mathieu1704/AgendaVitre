import React from "react";
import { Modal, Pressable, View } from "react-native";

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
      {/* Backdrop absolu — ferme la modale sur tap en dehors */}
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Conteneur centré — pointerEvents box-none : laisse passer les touches sur le fond */}
      <View
        style={{
          flex: 1,
          padding: 16,
          justifyContent: position === "bottom" ? "flex-end" : "center",
        }}
        pointerEvents="box-none"
      >
        <View className="w-full max-w-md self-center rounded-3xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900 shadow-2xl overflow-hidden">
          {children}
        </View>
      </View>
    </Modal>
  );
}
