/**
 * UUID v4 manuel : `crypto.randomUUID` n'est pas garanti disponible sur
 * toutes les versions de Hermes (voir aussi `offline/idMap.ts`), et son
 * absence fait planter l'appelant avec un throw non catché explicitement.
 */
export function newUuidV4(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += "-";
    } else if (i === 14) {
      out += "4"; // version
    } else if (i === 19) {
      out += hex[(Math.floor(Math.random() * 16) & 0x3) | 0x8]; // variante
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}
