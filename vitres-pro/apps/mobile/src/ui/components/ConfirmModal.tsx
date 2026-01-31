import React from "react";
import { View, Text, Modal, Pressable } from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean; // Pour mettre le bouton en rouge
}

export const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  isDestructive = false,
}: ConfirmModalProps) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Fond sombre */}
      <View className="flex-1 bg-black/40 justify-center items-center px-6">
        {/* La Boîte de dialogue */}
        <View className="bg-card dark:bg-slate-900 w-full max-w-sm rounded-[24px] p-6 shadow-xl border border-border dark:border-slate-800">
          <Text className="text-xl font-bold text-foreground dark:text-white text-center mb-2">
            {title}
          </Text>
          <Text className="text-muted-foreground text-center mb-6 leading-5">
            {message}
          </Text>

          {/* Boutons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 py-3.5 bg-muted dark:bg-slate-800 rounded-2xl items-center active:opacity-80"
            >
              <Text className="font-semibold text-foreground dark:text-white">
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className={`flex-1 py-3.5 rounded-2xl items-center active:opacity-80 ${
                isDestructive ? "bg-red-500" : "bg-primary"
              }`}
            >
              <Text className="font-bold text-white">{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
