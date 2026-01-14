import React, { useState } from "react";
import {
  View,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { TextInput, Text } from "react-native-paper";
import { supabase } from "../../src/lib/supabase";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      Alert.alert("Succès", "Vous êtes connecté !");
      router.replace("/(app)/calendar");
    }
  }

  async function handleSignUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: "Nouvel Employé" },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert("Erreur", error.message);
    } else {
      Alert.alert(
        "Compte créé !",
        "Vérifiez vos emails (si confirmation activée) ou connectez-vous."
      );
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className={`flex-1 ${isDark ? "bg-dark-900" : "bg-gray-50"}`}
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo/Hero Section */}
        <View className="items-center mb-12">
          <View className="bg-primary-500 w-24 h-24 rounded-3xl items-center justify-center mb-6 shadow-xl">
            <FontAwesome name="calendar-check-o" size={48} color="#FFFFFF" />
          </View>

          <Text
            className={`text-4xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            } mb-2`}
          >
            Window Planner
          </Text>
          <Text
            className={`text-lg ${isDark ? "text-dark-400" : "text-gray-500"}`}
          >
            Planning Professionnel
          </Text>
        </View>

        {/* Formulaire */}
        <View
          className={`p-6 rounded-3xl ${
            isDark ? "bg-dark-800" : "bg-white"
          } shadow-2xl`}
        >
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            } mb-6`}
          >
            Connexion
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            left={<TextInput.Icon icon="email" />}
            className="mb-4"
            outlineColor={isDark ? "#475569" : "#E2E8F0"}
            activeOutlineColor="#3B82F6"
            style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
            theme={{
              colors: {
                onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                onSurface: isDark ? "#E2E8F0" : "#1F2937",
              },
            }}
          />

          <TextInput
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            mode="outlined"
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            className="mb-6"
            outlineColor={isDark ? "#475569" : "#E2E8F0"}
            activeOutlineColor="#3B82F6"
            style={{ backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }}
            theme={{
              colors: {
                onSurfaceVariant: isDark ? "#94A3B8" : "#64748B",
                onSurface: isDark ? "#E2E8F0" : "#1F2937",
              },
            }}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="bg-primary-500 rounded-2xl p-5 shadow-lg active:scale-98 items-center justify-center mb-4"
          >
            <View className="flex-row items-center">
              <FontAwesome name="sign-in" size={20} color="#FFFFFF" />
              <Text className="ml-3 text-white text-lg font-bold">
                {loading ? "Connexion..." : "Se connecter"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            className={`${
              isDark ? "bg-dark-700" : "bg-gray-100"
            } rounded-2xl p-5 active:scale-98 items-center justify-center`}
          >
            <Text
              className={`text-base font-semibold ${
                isDark ? "text-dark-300" : "text-gray-700"
              }`}
            >
              Créer un compte
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text
          className={`mt-8 text-center text-sm ${
            isDark ? "text-dark-400" : "text-gray-500"
          }`}
        >
          Powered by Lavage de Vitres Maxime
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
