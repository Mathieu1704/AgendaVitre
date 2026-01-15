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

  // Logique d'authentification identique à Auth.tsx
  const handleSubmit = async () => {
    if (!email || !password) return toast.error("Erreur", "Champs requis");

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error(
            "Erreur",
            error.message.includes("Invalid")
              ? "Identifiants incorrects"
              : error.message
          );
        } else {
          toast.success("Connexion réussie !");
          router.replace("/(app)/calendar");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: "Nouvel Utilisateur" } },
        });
        if (error) {
          toast.error("Erreur", error.message);
        } else {
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
      <Animated.View entering={FadeInUp.delay(100).duration(500)}>
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
      </Animated.View>

      {/* Toggle Login/Signup */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(500)}
        className="items-center"
      >
        <Pressable onPress={() => setIsLogin(!isLogin)} className="p-2">
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
