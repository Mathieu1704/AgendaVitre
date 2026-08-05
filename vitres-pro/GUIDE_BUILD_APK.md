# Générer un APK Android — LVM Agenda

## Contexte
Projet : Expo SDK 54, managed workflow (pas de dossier `android/`).
Objectif : générer un fichier `.apk` installable directement sur un téléphone Android (pas le Play Store).
Solution : **EAS Build** — service cloud Expo (l'ancienne commande `expo build:android` est dépréciée depuis SDK 46).

---

## Prérequis (à faire une seule fois)

### 1. Créer un compte Expo
→ https://expo.dev/signup (gratuit — 30 builds/mois offerts)

### 2. Installer EAS CLI
```bash
npm install -g eas-cli
```

### 3. Se connecter
```bash
eas login
```

---

## Configuration (à faire une seule fois)

### 4. Ajouter le package Android dans `app.json`
Dans `vitres-pro/apps/mobile/app.json`, ajouter sous `"expo"` :
```json
"android": {
  "package": "be.lvmagenda.app"
}
```

### 5. Configurer EAS et créer `eas.json`
```bash
cd vitres-pro/apps/mobile
eas build:configure
```
Ensuite modifier le fichier `eas.json` généré pour avoir un profil `preview` qui produit un `.apk` :
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.lvmagenda.be"
      }
    }
  }
}
```

---

## Générer l'APK

### 6. Lancer le build
```bash
cd vitres-pro/apps/mobile
eas build -p android --profile preview
```

- Le build tourne sur les serveurs Expo (~10-15 min)
- Un lien de téléchargement `.apk` s'affiche dans le terminal à la fin
- Aussi disponible sur https://expo.dev → ton projet → Builds

### 7. Installer sur le téléphone
**Option A — Lien direct (le plus simple) :**
Envoyer le lien par SMS ou WhatsApp → ouvrir sur Android → autoriser "Sources inconnues" → installer

**Option B — ADB (si Android Studio installé) :**
```bash
adb install chemin/vers/app.apk
```

---

## À chaque nouvelle version

```bash
eas build -p android --profile preview
```
Renvoyer le nouveau lien APK aux utilisateurs concernés.

---

## Notes

- L'APK pointe automatiquement vers `https://api.lvmagenda.be` (prod Railway)
- Pas besoin d'Android Studio ni de clé de signature pour ce type de build (EAS gère tout)
- Pour publier sur le Play Store plus tard : changer `buildType` en `"aab"` et utiliser un profil `"production"`
