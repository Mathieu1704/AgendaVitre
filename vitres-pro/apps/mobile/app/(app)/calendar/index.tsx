// C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\mobile\app\(app)\calendar\index.tsx
import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { CalendarList } from "react-native-calendars";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Text,
  FAB,
  Appbar,
  Button,
} from "react-native-paper";
import { api } from "../../../src/lib/api";
import { supabase } from "../../../src/lib/supabase";
import { useRouter } from "expo-router";

// Objet vide stable pour éviter les re-renders
const EMPTY_ITEMS = {};

type Intervention = {
  id: string;
  title: string;
  start_time: string;
  status: string;
  client?: { name: string };
};

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const {
    data: interventions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["interventions"],
    queryFn: async () => {
      console.log("Fetching interventions...");
      const res = await api.get("/api/interventions/");

      const formattedItems: any = {};

      // Si la réponse est vide, on retourne un objet vide
      if (!res.data || !Array.isArray(res.data)) return formattedItems;

      res.data.forEach((item: Intervention) => {
        if (!item.id) return;
        if (!item.start_time) return;
        const dateKey = item.start_time.split("T")[0];

        if (!formattedItems[dateKey]) {
          formattedItems[dateKey] = [];
        }

        formattedItems[dateKey].push({
          ...item,

          name: item.title,
          client: item.client?.name || "Client inconnu",
          height: 80,
        });
      });
      return formattedItems;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  // 1. MEMOIZATION DES ITEMS (Crucial)
  // On s'assure que 'items' est une référence stable
  const items = useMemo(() => {
    return interventions || EMPTY_ITEMS;
  }, [interventions]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    Object.keys(items).forEach((date) => {
      marks[date] = { marked: true };
    });
    // jour sélectionné en surbrillance
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true };
    return marks;
  }, [items, selectedDate]);

  // 2. RENDU STABLE
  const renderItem = useCallback((item: any) => {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          item.id && router.push(`/(app)/calendar/${item.id}` as any)
        }
      >
        <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
          {item.name}
        </Text>
        <Text variant="bodyMedium">{item.client}</Text>
        <Text variant="labelSmall" style={{ color: "gray" }}>
          {new Date(item.start_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  }, []);

  const renderEmptyData = useCallback(() => {
    return (
      <View style={styles.center}>
        <Text>Aucune intervention.</Text>
      </View>
    );
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>Erreur de chargement</Text>
        <Button mode="contained" onPress={() => refetch()}>
          Réessayer
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, height: "100%" }}>
      <Appbar.Header>
        <Appbar.Content title="Planning" />
        <Appbar.Action icon="logout" onPress={handleLogout} />
      </Appbar.Header>

      {Platform.OS === "web" ? (
        <View style={{ flex: 1 }}>
          <CalendarList
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            pastScrollRange={12}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator
          />

          <View style={{ padding: 12 }}>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Interventions du {selectedDate}
            </Text>

            {(items[selectedDate] ?? []).length === 0 ? (
              <Text>Aucune intervention ce jour-là.</Text>
            ) : (
              (items[selectedDate] ?? []).map((it: any) => (
                <TouchableOpacity
                  key={it.id}
                  style={styles.item}
                  onPress={() => router.push(`/(app)/calendar/${it.id}` as any)}
                >
                  <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                    {it.name}
                  </Text>
                  <Text variant="bodyMedium">{it.client}</Text>
                  <Text variant="labelSmall" style={{ color: "gray" }}>
                    {new Date(it.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      ) : (
        // ✅ Mobile : tu peux garder Agenda ici si tu veux
        // (mais pour l’instant, on peut aussi utiliser CalendarList partout)
        <View style={{ flex: 1 }}>
          <CalendarList
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            pastScrollRange={12}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator
          />

          <View style={{ padding: 12 }}>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Interventions du {selectedDate}
            </Text>

            {(items[selectedDate] ?? []).length === 0 ? (
              <Text>Aucune intervention ce jour-là.</Text>
            ) : (
              (items[selectedDate] ?? []).map((it: any) => (
                <TouchableOpacity key={it.id} style={styles.item}>
                  <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                    {it.name}
                  </Text>
                  <Text variant="bodyMedium">{it.client}</Text>
                  <Text variant="labelSmall" style={{ color: "gray" }}>
                    {new Date(it.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        // MODIFICATION ICI : Navigation vers l'écran d'ajout
        onPress={() => router.push("/(app)/calendar/add")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    backgroundColor: "white",
    flex: 1,
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    marginTop: 17,
    elevation: 2,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#2196F3",
  },
});
