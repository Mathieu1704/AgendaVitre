import React from "react";
import Toast, { BaseToast, ErrorToast } from "react-native-toast-message";

export const toast = {
  success: (title: string, message?: string) =>
    Toast.show({ type: "success", text1: title, text2: message }),
  error: (title: string, message?: string) =>
    Toast.show({ type: "error", text1: title, text2: message }),
  info: (title: string, message?: string) =>
    Toast.show({ type: "info", text1: title, text2: message }),
};

export function ToastHost() {
  return (
    <Toast
      position="top"
      topOffset={40}
      config={{
        success: (props) => (
          <BaseToast
            {...props}
            style={{
              borderLeftColor: "#22c55e", // Ligne à gauche verte
              borderLeftWidth: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#bcf0da", // Contour léger vert
              backgroundColor: "#ffffff",
              width: "auto", // Permet de réduire la largeur
              minWidth: 280, // Largeur minimum
              maxWidth: "90%", // Pas trop large sur mobile
              height: 60,
              paddingRight: 20,
              // Ombre portée pour le côté flottant
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15, fontWeight: "800", color: "#0b1020" }}
            text2Style={{ fontSize: 13, color: "#4b5563" }}
          />
        ),
        error: (props) => (
          <ErrorToast
            {...props}
            style={{
              borderLeftColor: "#ef4444",
              borderLeftWidth: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#fee2e2",
              backgroundColor: "#ffffff",
              width: "auto",
              minWidth: 280,
              maxWidth: "90%",
              height: 60,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15, fontWeight: "800", color: "#0b1020" }}
            text2Style={{ fontSize: 13, color: "#4b5563" }}
          />
        ),
        info: (props) => (
          <BaseToast
            {...props}
            style={{
              borderLeftColor: "#3b82f6",
              borderLeftWidth: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#dbeafe",
              backgroundColor: "#ffffff",
              width: "auto",
              minWidth: 280,
              maxWidth: "90%",
              height: 60,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15, fontWeight: "800", color: "#0b1020" }}
            text2Style={{ fontSize: 13, color: "#4b5563" }}
          />
        ),
      }}
    />
  );
}
