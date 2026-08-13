import React from "react";
import { View, Text, Modal, Pressable, Platform } from "react-native";
import { Edit2, Copy, Ban, RotateCcw, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onCancelIntervention?: () => void;
  isCancelled?: boolean;
  onDelete: () => void;
}

export const OptionsModal = ({
  visible,
  onClose,
  onEdit,
  onDuplicate,
  onCancelIntervention,
  isCancelled = false,
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
          className="absolute right-4 bg-card dark:bg-slate-900 shadow-xl border border-border dark:border-slate-800 min-w-[200px]"
          style={{
            top: Platform.OS === "web" ? 60 : insets.top + 50,
            borderRadius: 20,
            overflow: "hidden",
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

          {/* Option DUPLIQUER */}
          {onDuplicate && (
            <Pressable
              onPress={() => {
                onClose();
                onDuplicate();
              }}
              className="flex-row items-center p-4 border-b border-border dark:border-slate-800 active:bg-muted/50 hover:bg-muted/50"
            >
              <Copy
                size={20}
                className="text-foreground dark:text-white mr-3"
                color="#8B5CF6"
              />
              <Text className="font-semibold text-foreground dark:text-white">
                Dupliquer
              </Text>
            </Pressable>
          )}

          {/* Option MARQUER ANNULÉE / RÉACTIVER (statut, distinct du bouton
              "Annuler" ci-dessous qui ferme juste ce menu) */}
          {onCancelIntervention && (
            <Pressable
              onPress={() => {
                onClose();
                setTimeout(onCancelIntervention, 100);
              }}
              className={
                isCancelled
                  ? "flex-row items-center p-4 border-b border-border dark:border-slate-800 active:bg-green-50 dark:active:bg-green-900/20 hover:bg-green-50"
                  : "flex-row items-center p-4 border-b border-border dark:border-slate-800 active:bg-orange-50 dark:active:bg-orange-900/20 hover:bg-orange-50"
              }
            >
              {isCancelled ? (
                <>
                  <RotateCcw size={20} color="#22C55E" className="mr-3" />
                  <Text className="font-semibold text-green-600 dark:text-green-400">
                    Réactiver
                  </Text>
                </>
              ) : (
                <>
                  <Ban size={20} color="#F97316" className="mr-3" />
                  <Text className="font-semibold text-orange-600 dark:text-orange-400">
                    Marquer annulée
                  </Text>
                </>
              )}
            </Pressable>
          )}

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
