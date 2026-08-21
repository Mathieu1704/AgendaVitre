import * as SplashScreen from "expo-splash-screen";

/**
 * Pilotage de l'écran de démarrage.
 *
 * Par défaut le splash natif (le logo) disparaît dès que la première vue React
 * est montée, alors que l'app n'a pas encore de quoi afficher un écran utile :
 * l'utilisateur voyait donc le logo, puis un rond de chargement, puis enfin le
 * contenu — deux attentes qui s'enchaînent. On garde ici le logo affiché
 * jusqu'à ce que l'app soit réellement prête, comme le font la plupart des
 * applications grand public.
 */

// Durée minimale d'affichage : sans elle, quand tout est déjà en cache le logo
// n'apparaîtrait qu'une poignée d'images, ce qui donne un clignotement.
const MIN_VISIBLE_MS = 900;

// Filet de sécurité : si un état de chargement ne se résolvait jamais, le logo
// resterait indéfiniment et l'app paraîtrait figée. Passé ce délai, on rend la
// main quoi qu'il arrive — l'écran de chargement React prend alors le relais.
const MAX_VISIBLE_MS = 6000;

const startedAt = Date.now();
let hidden = false;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Déjà masqué (rechargement à chaud en développement) : sans importance.
});

/** Masque le splash. Idempotent : sûr à appeler depuis plusieurs écrans. */
export async function hideSplash(): Promise<void> {
  if (hidden) return;
  hidden = true;

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_VISIBLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS - elapsed));
  }
  await SplashScreen.hideAsync().catch(() => {});
}

setTimeout(() => void hideSplash(), MAX_VISIBLE_MS);
