import React from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import {
  Text,
  Appbar,
  FAB,
  ActivityIndicator,
  Card,
  Avatar,
} from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api } from "../../../src/lib/api";

type Client = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
};

export default function ClientsListScreen() {
  const router = useRouter();

  // 1. Récupération des clients via FastAPI
  const {
    data: clients,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await api.get("/api/clients/");
      return res.data as Client[];
    },
  });

  const renderItem = ({ item }: { item: Client }) => (
    <Card
      style={styles.card}
      onPress={() => console.log("Ouvrir détail client", item.id)}
    >
      <Card.Title
        title={item.name}
        subtitle={item.address}
        left={(props) => <Avatar.Icon {...props} icon="account" />}
      />
      <Card.Content>
        {item.phone && <Text variant="bodyMedium">📞 {item.phone}</Text>}
        {item.email && <Text variant="bodyMedium">✉️ {item.email}</Text>}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Mes Clients" />
        <Appbar.Action icon="refresh" onPress={() => refetch()} />
      </Appbar.Header>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 10 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>Aucun client trouvé.</Text>
            </View>
          }
        />
      )}

      {/* Bouton pour aller vers l'écran "Ajouter" */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/(app)/clients/add")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  card: { marginBottom: 10, backgroundColor: "white" },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#2196F3",
  },
});
