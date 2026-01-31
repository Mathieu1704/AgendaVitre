import React from "react";
import { View, Text, Modal, Pressable, Platform } from "react-native";
import { Edit2, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const OptionsModal = ({
  visible,
  onClose,
  onEdit,
  onDelete,
}: OptionsModalProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* OVERLAY : Clic en dehors pour fermer */}
      <Pressable className="flex-1 bg-black/20" onPress={onClose}>
        {/* LE MENU (Positionné en haut à droite) */}
        <View
          className="absolute right-4 bg-card dark:bg-slate-900 rounded-2xl shadow-xl border border-border dark:border-slate-800 overflow-hidden min-w-[200px]"
          style={{
            top: Platform.OS === "web" ? 60 : insets.top + 50, // Ajustement position sous le header
          }}
        >
          {/* Option MODIFIER */}
          <Pressable
            onPress={() => {
              onClose();
              onEdit();
            }}
            className="flex-row items-center p-4 border-b border-border dark:border-slate-800 active:bg-muted/50 hover:bg-muted/50"
          >
            <Edit2
              size={20}
              className="text-foreground dark:text-white mr-3"
              color="#3B82F6"
            />
            <Text className="font-semibold text-foreground dark:text-white">
              Modifier
            </Text>
          </Pressable>

          {/* Option SUPPRIMER */}
          <Pressable
            onPress={() => {
              onClose();
              // Petit délai pour laisser le menu se fermer avant la popup de confirmation finale
              setTimeout(onDelete, 100);
            }}
            className="flex-row items-center p-4 active:bg-red-50 dark:active:bg-red-900/20 hover:bg-red-50"
          >
            <Trash2 size={20} color="#EF4444" className="mr-3" />
            <Text className="font-semibold text-red-600 dark:text-red-400">
              Supprimer
            </Text>
          </Pressable>

          {/* Bouton Annuler (Optionnel, surtout utile sur mobile) */}
          <Pressable
            onPress={onClose}
            className="flex-row items-center p-3 justify-center bg-muted/30 active:bg-muted"
          >
            <Text className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Annuler
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};
