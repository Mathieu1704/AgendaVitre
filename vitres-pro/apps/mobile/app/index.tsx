import { Redirect } from "expo-router";

export default function Index() {
  // On redirige vers l'espace protégé (app).
  // C'est le _layout de (app) qui se chargera de renvoyer vers le login si besoin.
  return <Redirect href="/(app)" />;
}
