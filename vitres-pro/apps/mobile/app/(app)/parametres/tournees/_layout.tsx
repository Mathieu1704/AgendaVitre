import { Stack } from "expo-router";

export default function TourneesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="template/[id]" />
      <Stack.Screen name="prepare/[id]" />
      <Stack.Screen name="run/[id]" />
    </Stack>
  );
}
