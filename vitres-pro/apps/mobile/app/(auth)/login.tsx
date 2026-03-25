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
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toast } from "../../src/ui/toast";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Eye, EyeOff, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../src/ui/components/ThemeToggle";

const HERO_HEIGHT = 280;

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const controlWidthStyle = {
    width: "100%" as any,
    alignSelf: "stretch" as const,
  };

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
        toast.error("Erreur de connexion", "Email ou mot de passe incorrect.");
      } else {
        toast.success("Connexion réussie !");
        router.replace("/(app)");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- FORMULAIRE DESKTOP (inchangé) ---
  const AuthForm = () => (
    <Animated.View
      layout={LinearTransition.springify()}
      className="w-full max-w-[400px]"
    >
      <View className="mb-8 min-h-[80px]">
        <Animated.View entering={FadeIn.delay(100)} key="login-text">
          <Text className="text-3xl font-bold text-foreground text-center lg:text-left">
            Bon retour !
          </Text>
          <Text className="mt-2 text-muted-foreground text-center lg:text-left text-base">
            Connectez-vous pour accéder à votre espace
          </Text>
        </Animated.View>
      </View>

      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground ml-1">
            Email
          </Text>
          <View
            className={`w-full h-12 rounded-xl border bg-background flex-row items-center px-4 ${emailError ? "border-destructive" : "border-input"}`}
            style={controlWidthStyle}
          >
            <TextInput
              className={`flex-1 text-base ${emailError ? "text-destructive" : "text-foreground"}`}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={validateEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ height: "100%", paddingVertical: 0 }}
            />
          </View>
          {emailError ? (
            <Animated.View
              entering={FadeIn}
              className="flex-row items-center ml-1"
            >
              <AlertCircle size={12} color="#EF4444" />
              <Text className="text-destructive text-xs ml-1">
                {emailError}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground ml-1">
            Mot de passe
          </Text>
          <View
            className={`relative justify-center w-full h-12 rounded-xl border bg-background flex-row items-center px-4 ${passwordError ? "border-destructive" : "border-input"}`}
            style={controlWidthStyle}
          >
            <TextInput
              className="flex-1 text-base text-foreground"
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={validatePassword}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              style={{ height: "100%", paddingVertical: 0, paddingRight: 40 }}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4"
            >
              {showPassword ? (
                <EyeOff size={20} color="#64748B" />
              ) : (
                <Eye size={20} color="#64748B" />
              )}
            </Pressable>
          </View>
          {passwordError ? (
            <Animated.View
              entering={FadeIn}
              className="flex-row items-center ml-1"
            >
              <AlertCircle size={12} color="#EF4444" />
              <Text className="text-destructive text-xs ml-1">
                {passwordError}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="h-12 w-full flex-row items-center justify-center rounded-xl bg-primary mt-2"
          style={controlWidthStyle}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              Se connecter
            </Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  // --- RENDER MOBILE ---
  if (!isDesktop) {
    const cardBg = isDark ? "#0F172A" : "#FFFFFF";
    const inputBg = isDark ? "#1E293B" : "#F8FAFC";
    const inputBorder = isDark ? "#334155" : "#E2E8F0";
    const textColor = isDark ? "#F1F5F9" : "#09090B";
    const subtitleColor = isDark ? "#94A3B8" : "#71717A";

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: cardBg }}
      >
        {/* Hero image */}
        <View style={{ height: HERO_HEIGHT }}>
          <Image
            source={require("../../assets/login-hero.jpg")}
            style={StyleSheet.absoluteFillObject}
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
          <View
            style={{ position: "absolute", bottom: 52, left: 28, right: 28 }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 16,
                lineHeight: 24,
                fontWeight: "500",
                opacity: 0.92,
              }}
            >
              La solution pour gérer votre{"\n"}entreprise de nettoyage de
              vitres
            </Text>
          </View>
        </View>

        {/* Carte formulaire — overlap sur le hero */}
        <ScrollView
          style={{
            flex: 1,
            marginTop: -28,
            backgroundColor: cardBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          }}
          contentContainerStyle={{
            paddingHorizontal: 28,
            paddingTop: 32,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Image
              source={require("../../assets/images/LVM_LOGO_Colors-01.png")}
              style={{ width: 150, height: 65 }}
              resizeMode="contain"
            />
          </View>

          {/* Titres */}
          <View style={{ marginBottom: 28 }}>
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
                marginTop: 4,
                fontSize: 14,
                color: subtitleColor,
                textAlign: "center",
              }}
            >
              Connectez-vous pour accéder à votre espace
            </Text>
          </View>

          {/* Champs */}
          <View style={{ gap: 12 }}>
            {/* Email */}
            <View>
              <View
                style={{
                  height: 56,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: inputBg,
                  borderColor: emailError ? "#EF4444" : inputBorder,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                }}
              >
                <TextInput
                  placeholder="Email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={validateEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: emailError ? "#EF4444" : textColor,
                    paddingBottom: 6,
                  }}
                />
              </View>
              {emailError ? (
                <Animated.View
                  entering={FadeIn}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 6,
                    marginLeft: 4,
                  }}
                >
                  <AlertCircle size={12} color="#EF4444" />
                  <Text
                    style={{ color: "#EF4444", fontSize: 12, marginLeft: 4 }}
                  >
                    {emailError}
                  </Text>
                </Animated.View>
              ) : null}
            </View>

            {/* Mot de passe */}
            <View>
              <View
                style={{
                  height: 56,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: inputBg,
                  borderColor: passwordError ? "#EF4444" : inputBorder,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                }}
              >
                <TextInput
                  placeholder="Mot de passe"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={validatePassword}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: textColor,
                    paddingRight: 36,
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 16 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#94A3B8" />
                  ) : (
                    <Eye size={20} color="#94A3B8" />
                  )}
                </Pressable>
              </View>
              {passwordError ? (
                <Animated.View
                  entering={FadeIn}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 6,
                    marginLeft: 4,
                  }}
                >
                  <AlertCircle size={12} color="#EF4444" />
                  <Text
                    style={{ color: "#EF4444", fontSize: 12, marginLeft: 4 }}
                  >
                    {passwordError}
                  </Text>
                </Animated.View>
              ) : null}
            </View>

            {/* Bouton */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={{
                height: 56,
                borderRadius: 16,
                backgroundColor: "#3B82F6",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}
                >
                  Se connecter
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- RENDER DESKTOP (inchangé) ---
  return (
    <View className="flex-1 flex-row bg-background">
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
      <View className="flex-1 items-center justify-center p-12 bg-background">
        {AuthForm()}
      </View>
    </View>
  );
}
