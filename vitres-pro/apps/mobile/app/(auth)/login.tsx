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
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // États pour la validation visuelle
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // --- LOGIQUE DE VALIDATION ---
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
    if (!isLogin) {
      // On ne valide la complexité qu'à l'inscription
      if (val.length > 0 && val.length < 8) {
        setPasswordError("8 caractères minimum");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }
  };

  const getRedirectTo = () => {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/callback`;
    }
    return "lvmagenda://callback";
  };

  const switchMode = () => {
    // Animation propre : on reset les erreurs
    setIsLogin((v) => !v);
    setSignupDone(false);
    setPassword("");
    setEmailError("");
    setPasswordError("");
    setShowPassword(false);
  };

  const handleSubmit = async () => {
    // Check final avant envoi
    if (!email || !password)
      return toast.error("Erreur", "Tous les champs sont requis");

    // Bloquer si erreurs présentes
    if (emailError || passwordError)
      return toast.error(
        "Attention",
        "Corrigez les erreurs avant de continuer",
      );

    // Validation stricte inscription
    if (!isLogin) {
      if (password.length < 8)
        return toast.error(
          "Mot de passe",
          "Il doit faire au moins 8 caractères",
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
            "Erreur de connexion",
            "Email ou mot de passe incorrect.",
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
          toast.error("Erreur Inscription", error.message);
        } else {
          // ✅ C'est ici qu'on déclenche l'écran de succès
          setSignupDone(true);
          // On vide le formulaire pour éviter la confusion
          setEmail("");
          setPassword("");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // --- ECRAN DE SUCCES (Feedback clair) ---
  if (signupDone && !isLogin) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-8">
        <Animated.View
          entering={FadeIn.duration(500)}
          className="bg-card w-full max-w-sm p-8 rounded-2xl border border-border items-center gap-6 shadow-sm"
        >
          <View className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full">
            <Mail size={48} color="#22C55E" />
          </View>

          <View className="items-center">
            <Text className="text-2xl font-bold text-foreground text-center mb-2">
              Vérifiez vos emails !
            </Text>
            <Text className="text-muted-foreground text-center leading-relaxed">
              Un lien de confirmation a été envoyé à votre adresse. Cliquez
              dessus pour activer votre compte.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              setIsLogin(true);
              setSignupDone(false);
            }}
            className="w-full h-12 bg-primary rounded-xl items-center justify-center mt-2 active:opacity-90"
          >
            <Text className="text-white font-bold text-base">
              Retour à la connexion
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // --- FORMULAIRE PRINCIPAL ---
  const AuthForm = () => (
    <Animated.View
      layout={LinearTransition.springify()} // ✅ Fluidifie le changement de hauteur du conteneur
      className="w-full max-w-[400px]"
    >
      {/* HEADER AVEC TRANSITION PROPRE */}
      <View className="mb-8 min-h-[80px]">
        {isLogin ? (
          <Animated.View
            entering={FadeIn.delay(100)}
            exiting={FadeOut.duration(50)}
            key="login-text"
          >
            <Text className="text-3xl font-bold text-foreground text-center lg:text-left">
              Bon retour !
            </Text>
            <Text className="mt-2 text-muted-foreground text-center lg:text-left text-base">
              Connectez-vous pour accéder à votre espace
            </Text>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.delay(100)}
            exiting={FadeOut.duration(50)}
            key="signup-text"
          >
            <Text className="text-3xl font-bold text-foreground text-center lg:text-left">
              Créer un compte
            </Text>
            <Text className="mt-2 text-muted-foreground text-center lg:text-left text-base">
              Remplissez les infos ci-dessous
            </Text>
          </Animated.View>
        )}
      </View>

      <View className="gap-5">
        {/* Input Email */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground ml-1">
            Email
          </Text>
          <TextInput
            className={`h-12 w-full rounded-xl border bg-background px-4 text-base text-foreground ${
              emailError
                ? "border-destructive text-destructive"
                : "border-input focus:border-primary"
            }`}
            placeholder="votre@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={validateEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {/* Message d'erreur validation */}
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

        {/* Input Password */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground ml-1">
            Mot de passe
          </Text>
          <View className="relative justify-center">
            <TextInput
              className={`h-12 w-full rounded-xl border bg-background px-4 pr-12 text-base text-foreground ${
                passwordError
                  ? "border-destructive"
                  : "border-input focus:border-primary"
              }`}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={validatePassword}
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
          {/* Message d'erreur validation */}
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
      </View>

      {/* Toggle Login/Signup */}
      <View className="items-center mt-8">
        <Pressable onPress={switchMode} className="p-2">
          <Text className="text-sm text-muted-foreground">
            {isLogin ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <Text className="text-primary font-semibold">
              {isLogin ? "S'inscrire" : "Se connecter"}
            </Text>
          </Text>
        </Pressable>
      </View>
    </Animated.View>
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

  // --- RENDER DESKTOP ---
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
