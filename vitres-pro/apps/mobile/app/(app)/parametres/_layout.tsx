import { Stack } from "expo-router";

export default function ParametresLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team" />
      <Stack.Screen name="zones" />
      <Stack.Screen name="tarifs" />
      <Stack.Screen name="logs" />
      <Stack.Screen name="create-employee" />
    </Stack>
  );
}
