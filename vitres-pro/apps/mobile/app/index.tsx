// C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\mobile\app\index.tsx
import { Redirect } from "expo-router";

export default function Index() {
  // Redirige immédiatement vers l'écran de login au démarrage
  return <Redirect href="/(auth)/login" />;
}
