// !C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\mobile\app\(auth)\login.tsx
import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import { supabase } from "../../src/lib/supabase";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    // 1. Connexion Supabase
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
        data: { full_name: "Nouvel Employé" }, // Meta-data
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
    <View style={styles.container}>
      <Title style={styles.title}>VitresPro Planner</Title>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        style={styles.button}
      >
        Se connecter
      </Button>

      <Button mode="text" onPress={handleSignUp} style={styles.textButton}>
        Créer un compte (Test)
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    textAlign: "center",
    marginBottom: 30,
    fontSize: 28,
    fontWeight: "bold",
    color: "#2196F3",
  },
  input: {
    marginBottom: 15,
    backgroundColor: "white",
  },
  button: {
    marginTop: 10,
    paddingVertical: 5,
  },
  textButton: {
    marginTop: 15,
  },
});
