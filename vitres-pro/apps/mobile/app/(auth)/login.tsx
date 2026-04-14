import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  useWindowDimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toast } from "../../src/ui/toast";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Eye, EyeOff, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../src/ui/components/ThemeToggle";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (val: string) => {
    setEmail(val);
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (val.length > 0 && !regex.test(val)) {
      setEmailError("Format d'email invalide");
    } else {
      setEmailError("");
    }
  };

  const validatePassword = (val: string) => {
    setPassword(val);
    if (val.length > 0 && val.length < 8) {
      setPasswordError("8 caractères minimum");
    } else {
      setPasswordError("");
    }
  };

  const handleSubmit = async () => {
    if (!email || !password)
      return toast.error("Erreur", "Tous les champs sont requis");
    if (emailError || passwordError)
      return toast.error(
        "Attention",
        "Corrigez les erreurs avant de continuer",
      );

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error("Erreur de connexion", error.message || "Email ou mot de passe incorrect.");
      } else {
        router.replace("/(app)");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- VARIABLES DE COULEURS GLOBALES ---
  // Déplacées ici pour être utilisables par le Mobile ET le Desktop
  const cardBg = isDark ? "#0F172A" : "#FFFFFF";
  const inputBg = isDark ? "#1E293B" : "#F8FAFC";
  const inputBorder = isDark ? "#334155" : "#E2E8F0";
  const textColor = isDark ? "#F1F5F9" : "#09090B";
  const subtitleColor = isDark ? "#94A3B8" : "#71717A";

  // --- FORMULAIRE DESKTOP (Corrigé et aligné) ---
  const AuthForm = () => (
    <Animated.View
      layout={LinearTransition.springify()}
      style={{ width: "100%", maxWidth: 400 }}
    >
      {/* Ajout du Logo */}
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Image
          source={require("../../assets/images/LVM_LOGO_Colors-01.png")}
          style={{ width: 160, height: 65 }}
          resizeMode="contain"
        />
      </View>

      {/* Textes centrés */}
      <View style={{ marginBottom: 32 }}>
        <Animated.View entering={FadeIn.delay(100)} key="login-text">
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: textColor,
              textAlign: "center",
            }}
          >
            Bon retour !
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 16,
              color: subtitleColor,
              textAlign: "center",
            }}
          >
            Connectez-vous pour accéder à votre espace
          </Text>
        </Animated.View>
      </View>

      <View style={{ gap: 20 }}>
        {/* Email */}
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: textColor,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            Email
          </Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: inputBg,
                borderColor: emailError ? "#EF4444" : inputBorder,
              },
            ]}
          >
            <TextInput
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={validateEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                styles.textInput,
                { color: emailError ? "#EF4444" : textColor },
              ]}
            />
          </View>
          {emailError ? (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <AlertCircle size={12} color="#EF4444" />
              <Text style={styles.errorText}>{emailError}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Mot de passe */}
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: textColor,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            Mot de passe
          </Text>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: inputBg,
                borderColor: passwordError ? "#EF4444" : inputBorder,
              },
            ]}
          >
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={validatePassword}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              style={[styles.textInput, { color: textColor, paddingRight: 45 }]}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              {showPassword ? (
                <EyeOff size={22} color="#64748B" />
              ) : (
                <Eye size={22} color="#64748B" />
              )}
            </Pressable>
          </View>
          {passwordError ? (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <AlertCircle size={12} color="#EF4444" />
              <Text style={styles.errorText}>{passwordError}</Text>
            </Animated.View>
          ) : null}
        </View>

        {/* Bouton */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: "#3B82F6",
              opacity: loading || pressed ? 0.8 : 1,
              marginTop: 4,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  // --- RENDER MOBILE ---
  if (!isDesktop) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: cardBg,
          height: (Platform.OS === "web" ? "100dvh" : "100%") as any,
          minHeight: (Platform.OS === "web"
            ? "-webkit-fill-available"
            : "100%") as any,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* BACKGROUND HERO */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: -1,
          }}
        >
          <Image
            source={require("../../assets/login-hero.jpg")}
            style={{
              position: "absolute",
              width: Dimensions.get("screen").width,
              height: Dimensions.get("screen").height,
              top: 0,
              left: 0,
            }}
            resizeMode="cover"
          />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "#3B82F6", opacity: 0.35 },
            ]}
          />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "#000", opacity: 0.2 },
            ]}
          />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 20,
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 40,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Texte Hero au dessus de la carte */}
            <View style={{ marginBottom: 24, paddingHorizontal: 10 }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  lineHeight: 26,
                  fontWeight: "600",
                  textAlign: "center",
                  ...(Platform.OS === "web"
                    ? ({ textShadow: "0px 1px 4px rgba(0, 0, 0, 0.4)" } as any)
                    : {
                        textShadowColor: "rgba(0, 0, 0, 0.4)",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 4,
                      }),
                }}
              >
                La solution pour gérer votre{"\n"}entreprise de nettoyage de
                vitres
              </Text>
            </View>

            {/* Carte Formulaire */}
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 32,
                padding: 28,
                width: "100%",
                maxWidth: 400,
                alignSelf: "center",
                ...(Platform.OS === "web"
                  ? ({ boxShadow: "0px 10px 15px rgba(0,0,0,0.15)" } as any)
                  : {
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 8,
                    }),
              }}
            >
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <Image
                  source={require("../../assets/images/LVM_LOGO_Colors-01.png")}
                  style={{ width: 140, height: 56 }}
                  resizeMode="contain"
                />
              </View>

              <View style={{ gap: 6, marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "700",
                    color: textColor,
                    textAlign: "center",
                  }}
                >
                  Bon retour !
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: subtitleColor,
                    textAlign: "center",
                  }}
                >
                  Connectez-vous pour accéder à votre espace
                </Text>
              </View>

              <View style={{ gap: 16 }}>
                <View>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: inputBg,
                        borderColor: emailError ? "#EF4444" : inputBorder,
                      },
                    ]}
                  >
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={validateEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={[
                        styles.textInput,
                        { color: emailError ? "#EF4444" : textColor },
                      ]}
                    />
                  </View>
                  {emailError && (
                    <Animated.View entering={FadeIn} style={styles.errorBox}>
                      <AlertCircle size={12} color="#EF4444" />
                      <Text style={styles.errorText}>{emailError}</Text>
                    </Animated.View>
                  )}
                </View>

                <View>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: inputBg,
                        borderColor: passwordError ? "#EF4444" : inputBorder,
                      },
                    ]}
                  >
                    <TextInput
                      placeholder="Mot de passe"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={validatePassword}
                      style={[
                        styles.textInput,
                        { color: textColor, paddingRight: 45 },
                      ]}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      {showPassword ? (
                        <EyeOff size={22} color="#64748B" />
                      ) : (
                        <Eye size={22} color="#64748B" />
                      )}
                    </Pressable>
                  </View>
                  {passwordError && (
                    <Animated.View entering={FadeIn} style={styles.errorBox}>
                      <AlertCircle size={12} color="#EF4444" />
                      <Text style={styles.errorText}>{passwordError}</Text>
                    </Animated.View>
                  )}
                </View>

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: "#3B82F6",
                      opacity: loading || pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Se connecter</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // --- RENDER DESKTOP ---
  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: cardBg }}>
      <View className="flex-1 relative hidden lg:flex bg-muted">
        <Image
          source={require("../../assets/login-hero.jpg")}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
        <View className="absolute inset-0 bg-primary/40" />
        <View className="absolute inset-0 bg-black/10" />
        <View className="flex-1 justify-end p-12 z-10">
          <View>
            <Text className="text-4xl font-bold text-white mb-4">
              LVM Agenda
            </Text>
            <Text className="text-xl text-white/90 max-w-md leading-relaxed">
              La solution moderne pour gérer votre entreprise de nettoyage de
              vitres
            </Text>
          </View>
        </View>
      </View>
      <View
        className="flex-1 items-center justify-center p-12"
        style={{ backgroundColor: cardBg }}
      >
        {AuthForm()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    textAlignVertical: "center",
    ...(Platform.OS === "web" && ({ outlineStyle: "none" } as any)),
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginLeft: 4,
  },
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
