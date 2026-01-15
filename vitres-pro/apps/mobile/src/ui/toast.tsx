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
      topOffset={52}
      config={{
        success: (props) => (
          <BaseToast
            {...props}
            style={{
              borderLeftColor: "#22c55e",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
            }}
            text1Style={{ fontWeight: "800", color: "#0b1020" }}
            text2Style={{ color: "#334155" }}
          />
        ),
        error: (props) => (
          <ErrorToast
            {...props}
            style={{
              borderLeftColor: "#ef4444",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
            }}
            text1Style={{ fontWeight: "800", color: "#0b1020" }}
            text2Style={{ color: "#334155" }}
          />
        ),
        info: (props) => (
          <BaseToast
            {...props}
            style={{
              borderLeftColor: "#3b82f6",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
            }}
            text1Style={{ fontWeight: "800", color: "#0b1020" }}
            text2Style={{ color: "#334155" }}
          />
        ),
      }}
    />
  );
}
