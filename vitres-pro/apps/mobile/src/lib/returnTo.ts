/**
 * Mémorise le dernier écran (app) visité pour pouvoir y revenir après une
 * déconnexion forcée (401 sur une requête API — voir api.ts).
 *
 * Sans ça, un token expiré au mauvais moment (ex: pendant l'annulation d'une
 * intervention) renvoie l'utilisateur au login via `router.replace`, ce qui
 * vide toute la pile de navigation : après reconnexion, il atterrit sur
 * l'Accueil et doit tout re-naviguer depuis zéro (date, zone, vue...).
 */
let lastAppPath: string | null = null;

export function rememberAppPath(pathname: string, search: string): void {
  if (!pathname || pathname.startsWith("/(auth)") || pathname === "/login") return;
  lastAppPath = search ? `${pathname}?${search}` : pathname;
}

export function consumeReturnTo(): string | null {
  const path = lastAppPath;
  lastAppPath = null;
  return path;
}
