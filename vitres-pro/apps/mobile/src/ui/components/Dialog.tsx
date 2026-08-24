import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  UIManager,
  View,
  ViewStyle,
} from "react-native";
import { Portal } from "react-native-paper";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Dialog({
  open,
  onClose,
  children,
  position = "center",
  maxWidth,
  containerStyle,
  cardStyle,
  keyboardVerticalOffset = 0,
  onShow,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: "center" | "bottom";
  maxWidth?: number;
  containerStyle?: ViewStyle;
  // Style de la carte elle-même. Utile pour `flexShrink: 1` quand le contenu
  // est scrollable : sans ça la carte garde sa hauteur naturelle et déborde
  // de l'écran au lieu de se limiter à la place disponible.
  cardStyle?: ViewStyle;
  keyboardVerticalOffset?: number;
  // Fiable pour focus un champ (autoFocus ne se redéclenche pas quand le
  // Modal reste monté et ne fait que changer de `visible` — onShow, si, à
  // chaque ouverture, une fois la Modal réellement affichée).
  onShow?: () => void;
}) {
  // KeyboardAvoidingView ne se comporte pas de façon fiable dans un Modal RN
  // sur Android (fenêtre native séparée, indépendante du windowSoftInputMode
  // de l'Activity) : on suit la hauteur du clavier nous-mêmes et on l'ajoute
  // en paddingBottom. iOS reste sur KeyboardAvoidingView/"padding", déjà
  // fonctionnel.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    // KeyboardAvoidingView met bien son padding à jour, mais n'anime pas
    // toujours ce changement de layout dans une Modal. On réutilise les
    // durée et courbe natives du clavier pour le prochain layout React.
    const syncWithKeyboard = (
      event: Parameters<typeof Keyboard.scheduleLayoutAnimation>[0],
    ) => {
      Keyboard.scheduleLayoutAnimation(event);
    };
    const showSub = Keyboard.addListener("keyboardWillShow", syncWithKeyboard);
    const hideSub = Keyboard.addListener("keyboardWillHide", syncWithKeyboard);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAndroidKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAndroidKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const basePaddingBottom = containerStyle?.paddingBottom ?? 16;
  const resolvedPaddingBottom =
    typeof basePaddingBottom === "number"
      ? basePaddingBottom + androidKeyboardHeight
      : basePaddingBottom;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
    >
      <Portal.Host>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={{ flex: 1 }}
          pointerEvents="box-none"
        >
          <View
            style={{
              flex: 1,
              padding: 16,
              justifyContent: position === "bottom" ? "flex-end" : "center",
              ...containerStyle,
              paddingBottom: resolvedPaddingBottom,
            }}
            pointerEvents="box-none"
          >
            <View
              className="w-full max-w-md self-center rounded-3xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900 shadow-2xl overflow-hidden"
              style={{ ...(maxWidth ? { maxWidth } : null), ...cardStyle }}
            >
              {children}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Portal.Host>
    </Modal>
  );
}
