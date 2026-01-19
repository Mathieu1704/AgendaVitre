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
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toast } from "../../src/ui/toast";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024; // Breakpoint lg

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const isStrongPassword = (v: string) => {
    const s = v.trim();
    return s.length >= 8 && /[A-Z]/.test(s) && /[0-9]/.test(s);
  };

  const getRedirectTo = () => {
    // Web: renvoie vers /callback de ton domaine courant
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/callback`;
    }
    // Mobile fallback (on gérera deep link plus tard)
    return "lvmagenda://callback";
  };

  const switchMode = () => {
    setIsLogin((v) => !v);
    setSignupDone(false);
    setPassword("");
    setShowPassword(false);
    // optionnel: setEmail("");
  };

  // Logique d'authentification identique à Auth.tsx
  const handleSubmit = async () => {
    if (!email || !password) return toast.error("Erreur", "Champs requis");

    //  validations
    if (!isValidEmail(email)) {
      return toast.error("Erreur", "Email invalide");
    }

    // mot de passe robuste seulement en signup
    if (!isLogin && !isStrongPassword(password)) {
      return toast.error(
        "Mot de passe trop faible",
        "Min 8 caractères, 1 majuscule, 1 chiffre",
      );
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          toast.error(
            "Erreur",
            error.message.toLowerCase().includes("invalid")
              ? "Identifiants incorrects"
              : error.message,
          );
        } else {
          toast.success("Connexion réussie !");
          router.replace("/(app)");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: "Nouvel Utilisateur" },
            emailRedirectTo: getRedirectTo(),
          },
        });

        if (error) {
          toast.error("Erreur", error.message);
        } else {
          setSignupDone(true);
          toast.success("Compte créé !", "Vérifiez vos emails.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Composant Formulaire (Réutilisable Mobile/Desktop)
  const AuthForm = () => (
    <View className="w-full max-w-[400px] gap-8">
      <Animated.View
        key={isLogin ? "login" : "signup"}
        entering={FadeInUp.duration(250)}
        exiting={FadeInDown.duration(200)}
        className="gap-8"
      >
        <Text className="text-3xl font-bold text-foreground text-center lg:text-left">
          {isLogin ? "Bon retour !" : "Créer un compte"}
        </Text>
        <Text className="mt-2 text-muted-foreground text-center lg:text-left text-base">
          {isLogin
            ? "Connectez-vous pour accéder à votre espace"
            : "Inscrivez-vous pour commencer"}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        className="gap-4"
      >
        {!isLogin && signupDone ? (
          <Animated.View entering={FadeInUp.duration(250)} className="gap-3">
            <Text className="text-base text-foreground font-semibold">
              Vérifiez vos emails
            </Text>
            <Text className="text-sm text-muted-foreground">
              Un lien de confirmation vous a été envoyé. Cliquez dessus pour
              activer votre compte, puis revenez vous connecter.
            </Text>

            <Pressable
              onPress={() => {
                setIsLogin(true);
                setSignupDone(false);
                setPassword("");
                setShowPassword(false);
              }}
              className="h-12 w-full flex-row items-center justify-center rounded-xl bg-primary mt-2 active:opacity-90"
            >
              <Text className="text-base font-semibold text-primary-foreground">
                Retour à la connexion
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Input Email */}
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground ml-1">
                Email
              </Text>
              <TextInput
                className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground focus:border-primary"
                placeholder="votre@email.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Input Password */}
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground ml-1">
                Mot de passe
              </Text>
              <View className="relative justify-center">
                <TextInput
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-base text-foreground focus:border-primary"
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
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
            </View>

            {/* Bouton Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              className={`h-12 w-full flex-row items-center justify-center rounded-xl bg-primary mt-2 ${
                loading ? "opacity-70" : "active:opacity-90"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-base font-semibold text-primary-foreground">
                  {isLogin ? "Se connecter" : "S'inscrire"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </Animated.View>

      {/* Toggle Login/Signup */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(500)}
        className="items-center"
      >
        <Pressable onPress={switchMode} className="p-2">
          <Text className="text-sm text-muted-foreground">
            {isLogin ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <Text className="text-primary font-semibold">
              {isLogin ? "S'inscrire" : "Se connecter"}
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );

  // --- RENDER MOBILE ---
  if (!isDesktop) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-background"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 32,
          }}
        >
          <View className="items-center mb-8">
            {/* Logo Mobile */}
            <View className="h-12 w-12 rounded-xl bg-primary/10 items-center justify-center mb-4">
              <CheckCircle2 size={24} color="#3B82F6" />
            </View>
            <Text className="text-xl font-bold text-foreground">
              LVM Agenda
            </Text>
          </View>
          {AuthForm()}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- RENDER DESKTOP (Split Screen comme Auth.tsx) ---
  return (
    <View className="flex-1 flex-row bg-background">
      {/* Colonne Gauche : Image + Overlay */}
      <View className="flex-1 relative hidden lg:flex bg-muted">
        <Image
          source={require("../../assets/login-hero.jpg")}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
        {/* Gradient Overlay simulé avec background semi-transparent coloré */}
        <View className="absolute inset-0 bg-primary/40" />
        <View className="absolute inset-0 bg-black/10" />

        <View className="flex-1 justify-end p-12 z-10">
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Text className="text-4xl font-bold text-white mb-4">
              LVM Agenda
            </Text>
            <Text className="text-xl text-white/90 max-w-md leading-relaxed">
              La solution moderne pour gérer votre entreprise de nettoyage de
              vitres
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Colonne Droite : Formulaire */}
      <View className="flex-1 items-center justify-center p-12 bg-background">
        {AuthForm()}
      </View>
    </View>
  );
}
