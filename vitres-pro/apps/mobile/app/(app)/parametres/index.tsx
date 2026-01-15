import React, { useState } from "react";
import { View, ScrollView, Text, Switch, Pressable } from "react-native";
import {
  User,
  Building2,
  Bell,
  Palette,
  Save,
  LogOut,
} from "lucide-react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../src/ui/components/Card";
import { Button } from "../../../src/ui/components/Button";
import { Input } from "../../../src/ui/components/Input";
import { Avatar } from "../../../src/ui/components/Avatar";
import { toast } from "../../../src/ui/toast";
import { supabase } from "../../../src/lib/supabase";

export default function ParametresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // États (Simulés pour l'instant comme sur Lovable)
  const [notifications, setNotifications] = useState({
    email: true,
    newClient: true,
    intervention: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(
        "Paramètres sauvegardés",
        "Vos préférences ont été mises à jour."
      );
    }, 1000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  const SectionTitle = ({
    icon: Icon,
    title,
  }: {
    icon: any;
    title: string;
  }) => (
    <View className="flex-row items-center mb-4 mt-2">
      <View className="bg-primary/10 p-2 rounded-lg mr-3">
        <Icon size={20} color="#3B82F6" />
      </View>
      <Text className="text-lg font-bold text-foreground">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header simple pour mobile */}
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-6 py-4 border-b border-border bg-background">
        <Text className="text-2xl font-bold text-foreground">Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* 1. PROFIL */}
        <Card className="mb-6">
          <CardHeader>
            <SectionTitle icon={User} title="Mon Profil" />
          </CardHeader>
          <CardContent>
            <View className="flex-row items-center mb-6">
              <Avatar name="Mathieu Zilli" size="lg" />
              <View className="ml-4">
                <Text className="text-lg font-bold text-foreground">
                  Mathieu Zilli
                </Text>
                <Text className="text-muted-foreground">Administrateur</Text>
              </View>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-1.5">
                  Email
                </Text>
                <Input
                  value="mathieu@lvm-agenda.com"
                  editable={false}
                  className="bg-muted opacity-70"
                />
              </View>
              <View>
                <Text className="text-sm font-medium text-muted-foreground mb-1.5">
                  Téléphone
                </Text>
                <Input placeholder="06 12 34 56 78" />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 2. ENTREPRISE */}
        <Card className="mb-6">
          <CardHeader>
            <SectionTitle icon={Building2} title="Entreprise" />
          </CardHeader>
          <CardContent>
            <View className="gap-4">
              <Input
                placeholder="Nom de l'entreprise"
                defaultValue="LVM Agenda"
              />
              <Input placeholder="SIRET" />
              <Input
                placeholder="Adresse complète"
                multiline
                numberOfLines={2}
                className="h-20 py-2"
              />
            </View>
          </CardContent>
        </Card>

        {/* 3. NOTIFICATIONS */}
        <Card className="mb-6">
          <CardHeader>
            <SectionTitle icon={Bell} title="Notifications" />
          </CardHeader>
          <CardContent>
            <View className="gap-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="font-medium text-foreground">
                    Rappels par email
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Recevoir un récapitulatif hebdo
                  </Text>
                </View>
                <Switch
                  value={notifications.email}
                  onValueChange={(v) =>
                    setNotifications({ ...notifications, email: v })
                  }
                  trackColor={{ true: "#3B82F6" }}
                />
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="font-medium text-foreground">
                    Nouveau Client
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Notification à la création
                  </Text>
                </View>
                <Switch
                  value={notifications.newClient}
                  onValueChange={(v) =>
                    setNotifications({ ...notifications, newClient: v })
                  }
                  trackColor={{ true: "#3B82F6" }}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* BOUTON SAUVEGARDER */}
        <Button onPress={handleSave} loading={loading} className="mb-6">
          <Save size={18} color="white" />
          <Text className="ml-2 text-white font-bold">
            Sauvegarder les modifications
          </Text>
        </Button>

        {/* DÉCONNEXION (Zone Danger) */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center p-4 rounded-xl border border-destructive/30 bg-destructive/5 active:bg-destructive/10"
        >
          <LogOut size={18} color="#EF4444" />
          <Text className="ml-2 text-destructive font-bold">
            Se déconnecter
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
