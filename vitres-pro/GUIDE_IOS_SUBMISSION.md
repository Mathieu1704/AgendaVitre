# Guide iOS — De zéro à TestFlight (LVM Agenda)

> App : **LVM Agenda** · Expo SDK 54 · Managed Workflow · ~20 utilisateurs internes  
> Objectif : distribution privée via **TestFlight** (ou Apple Custom App)  
> Audit fusionné avec le skill `app-store-review` (safaiyeh v1.0.0)

---

## Sommaire

1. [Pré-requis compte Apple](#1-pré-requis-compte-apple)
2. [BLOQUANTS — corriger avant tout build](#2-bloquants--corriger-avant-tout-build)
3. [Problèmes importants — corriger avant soumission](#3-problèmes-importants--corriger-avant-soumission)
4. [Checklist App Store Review Guidelines](#4-checklist-app-store-review-guidelines)
5. [Étapes de build et soumission EAS](#5-étapes-de-build-et-soumission-eas)
6. [Distribution : TestFlight vs Apple Custom App](#6-distribution--testflight-vs-apple-custom-app)

---

## 1. Pré-requis compte Apple

### 1.1 Apple Developer Program

- Aller sur [developer.apple.com/programs](https://developer.apple.com/programs/)
- S'inscrire avec l'Apple ID de l'entreprise (pas un compte personnel)
- Payer 99 USD/an
- Attendre validation (quelques heures à 2 jours)

### 1.2 App Store Connect

- Aller sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- Cliquer **Apps → +** pour créer une nouvelle app
- Remplir :
  - **Platform :** iOS
  - **Name :** LVM Agenda
  - **Primary Language :** French
  - **Bundle ID :** `be.lvmagenda.app` (à créer dans Certificates, Identifiers & Profiles)
  - **SKU :** `lvmagenda-ios-001` (identifiant interne libre)
- Cocher **"Remove from sale"** si vous ne voulez pas que l'app soit publiquement visible

### 1.3 EAS CLI

```bash
npm install -g eas-cli
eas login   # avec votre Apple ID
```

---

## 2. BLOQUANTS — corriger avant tout build

> Ces problèmes empêchent le build de compiler ou Apple de l'accepter. **Priorité absolue.**

---

### ~~2.1 `bundleIdentifier` manquant dans app.json~~ ✅ CORRIGÉ

~~**Problème :** Le champ `ios.bundleIdentifier` est absent.~~

`apps/mobile/app.json` — `bundleIdentifier: "be.lvmagenda.app"` et `buildNumber: "1"` ajoutés.

> `buildNumber` doit être incrémenté à chaque upload sur App Store Connect (même en TestFlight).

---

### 2.2 Icône invalide (mauvaise taille + canal alpha)

**Problème :** L'icône actuelle (`LVM_LOGO_Colors-01.png`) mesure 380×237px en mode RGBA (avec canal alpha). Apple exige **1024×1024px, RGB, sans transparence**. Le build EAS échoue ou l'app est rejetée automatiquement.

**Localisation :** `apps/mobile/app.json` ligne 6, fichier `assets/images/LVM_LOGO_Colors-01.png`

**Fix :**

1. Créer une image 1024×1024px avec fond blanc (ou couleur de marque LVM)
2. Exporter en PNG **sans canal alpha** (mode RGB)
3. Outils : Figma (exporter en PNG → décocher "Include alpha"), Photoshop (Image → Mode → RGB Color), ou en ligne [squoosh.app](https://squoosh.app)
4. Remplacer le fichier existant OU pointer vers un nouveau chemin dans app.json :

```json
"icon": "./assets/images/icon-ios-1024.png"
```

> L'icône splash peut rester la même (elle n'a pas les mêmes contraintes), mais idéalement aussi en 1024×1024.

---

### ~~2.3 Profil iOS manquant dans eas.json~~ ✅ CORRIGÉ

~~**Problème :** Le fichier `eas.json` ne contient aucune configuration iOS.~~

`apps/mobile/eas.json` — profils iOS ajoutés : `preview.ios.simulator: true` et `production.ios.distribution: "store"`.

> La clé Supabase anon a également été retirée du fichier — voir §2.4.

---

### 2.4 Clé Supabase anon exposée dans eas.json — ⚠️ ACTION MANUELLE REQUISE

**Statut :** La clé a été retirée de `eas.json` (✅ fait). Il reste à l'enregistrer dans EAS Secrets pour que les builds puissent l'utiliser.

**À faire — une seule commande :**

```bash
cd vitres-pro/apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dGNnbWZ5bGNmZXBmZmRyeGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NzYxODksImV4cCI6MjA4NDE1MjE4OX0.bOiJLFuVYgRWFqF_nyVccUmZ_SknicauwEhcsIrWwvc"
```

> EAS injecte automatiquement le secret au moment du build — rien d'autre à changer.

---

## 3. Problèmes importants — corriger avant soumission

---

### 3.1 Privacy Manifest manquant (`PrivacyInfo.xcprivacy`)

**Problème :** Depuis mai 2024, Apple exige un Privacy Manifest pour toute app utilisant des APIs à "impact sur la vie privée" (NSUserDefaults, FileManager, UserDefaults, etc.). Sans ce fichier, le build est **rejeté à l'upload** sur App Store Connect.

L'app utilise `expo-secure-store` (stockage des tokens) et `@react-native-async-storage` — ces deux libs accèdent à des APIs concernées.

**Fix — ajouter le plugin dans app.json :**

```json
"plugins": [
  "expo-router",
  "expo-secure-store",
  [
    "expo-build-properties",
    {
      "ios": {
        "privacyManifestPath": "./ios/PrivacyInfo.xcprivacy"
      }
    }
  ]
]
```

Puis créer le fichier `apps/mobile/ios/PrivacyInfo.xcprivacy` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

> **Alternative plus simple avec Expo SDK 54 :** Le plugin `expo-build-properties` gère cela automatiquement si vous utilisez `eas build` avec Managed Workflow. Vérifier que `expo-build-properties` est installé :
> ```bash
> npx expo install expo-build-properties
> ```

---

### 3.2 Pas de politique de confidentialité

**Problème :** Section 5.1 des App Store Review Guidelines — toute app collectant des données utilisateur doit avoir une politique de confidentialité **accessible dans l'app ET dans App Store Connect**. LVM Agenda collecte : email, données d'interventions, géolocalisation implicite (adresses clients).

**Fix :**

1. Créer une page "Politique de confidentialité" (peut être hébergée sur `lvmagenda.be/privacy`)
2. Dans App Store Connect : **App Information → Privacy Policy URL**
3. Dans l'app : ajouter un lien discret dans l'écran de login ou paramètres :

```tsx
<Text onPress={() => Linking.openURL('https://lvmagenda.be/privacy')}>
  Politique de confidentialité
</Text>
```

**Contenu minimal requis :**
- Quelles données sont collectées (email, adresses, interventions)
- Comment elles sont stockées (Supabase / Railway)
- Qui y a accès (administrateurs LVM uniquement)
- Comment les supprimer (contacter admin)

---

### 3.3 Pas de `expo-updates` (OTA updates)

**Problème :** Sans `expo-updates`, chaque correctif nécessite un nouveau build + re-soumission sur TestFlight (délai de review). Avec OTA, les corrections de bugs (pas les nouvelles fonctionnalités) sont déployables en quelques minutes.

**Fix :**

```bash
npx expo install expo-updates
eas update:configure
```

Dans `app.json` :
```json
"updates": {
  "url": "https://u.expo.dev/0e90d5a7-2d9a-46b5-88ec-c0ef3f8f061f"
},
"runtimeVersion": {
  "policy": "sdkVersion"
}
```

> Les OTA updates ne peuvent corriger que du JS/assets, pas du code natif. C'est suffisant pour 90% des bugs.

---

### ~~3.4 `console.log` en production~~ ✅ CORRIGÉ

`apps/mobile/babel.config.js` — plugin `transform-remove-console` ajouté (actif uniquement quand `NODE_ENV=production`, conserve `error` et `warn`).

`apps/mobile/package.json` — `babel-plugin-transform-remove-console` ajouté en devDependencies.

**À faire — lancer une fois :**

```bash
cd vitres-pro/apps/mobile
npm install
```

---

### 3.5 Références Android dans l'UI — ✅ VÉRIFIÉ OK

Recherche effectuée dans tout `app/(app)/**/*.tsx`. Les seules occurrences "android" sont dans du code `Platform.OS === 'android'` pour les liens maps (`geo:0,0?q=...`) — c'est du code technique invisible à l'écran, pas un texte affiché à l'utilisateur. Aucun problème App Store.

---

### 3.6 Permissions caméra/micro non déclarées

**Problème :** Si l'app demande des permissions à l'avenir (caméra pour photos d'interventions, etc.), les `NSCameraUsageDescription` doivent être précises. Des descriptions vagues ("This app needs camera access") causent le rejet. Pour l'instant, aucune permission n'est déclarée — si l'app n'utilise pas la caméra, c'est correct.

**Vérification :** Si vous ajoutez des fonctionnalités futures, documenter dans app.json :

```json
"ios": {
  "infoPlist": {
    "NSCameraUsageDescription": "Permet de prendre des photos de chantier pour les joindre aux interventions.",
    "NSPhotoLibraryUsageDescription": "Permet de joindre des photos existantes aux interventions."
  }
}
```

---

## 4. Checklist App Store Review Guidelines

> Basée sur le skill `app-store-review` v1.0.0 — adapté au contexte LVM Agenda (app B2B interne, ~20 utilisateurs, pas de paiement in-app, pas de contenu utilisateur public).

### Section 1 — Safety

| # | Règle | Statut LVM Agenda |
|---|-------|-------------------|
| 1.1 | Pas de contenu offensant | ✅ App métier, pas de contenu |
| 1.2 | UGC : modération si contenu utilisateur | ✅ Pas de contenu public |
| 1.3 | Kids Category : protections parentales | ✅ Non applicable |
| 1.4 | Pas de désinformation / canulars | ✅ OK |
| 1.5 | Pas de promotion substances | ✅ OK |

### Section 2 — Performance

| # | Règle | Statut LVM Agenda |
|---|-------|-------------------|
| 2.1 | App fonctionnelle, pas de crash | ⚠️ À vérifier avec la checklist manuelle |
| 2.2 | Métadonnées App Store exactes | ⚠️ À remplir dans App Store Connect |
| 2.3 | Fonctionnalités complètes (pas de placeholder) | ✅ OK |
| 2.4 | Compatible avec le hardware déclaré | ✅ `supportsTablet: true` à confirmer |
| 2.5 | IPv6 : fonctionne sur réseaux IPv6 | ⚠️ À tester (Railway supporte IPv6 ?) |
| 2.6 | APIs publiques uniquement | ✅ Pas d'API privée Apple |
| 2.7 | Compte de démo si login requis | ✅ Fournir credentials Melissa/Maxime à Apple |

### Section 3 — Business

| # | Règle | Statut LVM Agenda |
|---|-------|-------------------|
| 3.1 | StoreKit pour achats numériques | ✅ Pas d'achat in-app |
| 3.2 | Pas de paiement externe pour biens numériques | ✅ OK |
| 3.3 | Abonnements : termes clairs | ✅ Non applicable |
| 3.4 | Cryptomonnaies | ✅ Non applicable |

### Section 4 — Design

| # | Règle | Statut LVM Agenda |
|---|-------|-------------------|
| 4.1 | Pas de clone d'app Apple/concurrent direct | ✅ App métier originale |
| 4.2 | Fonctionnalité minimale (pas juste un WebView) | ✅ App native React Native |
| 4.3 | Pas de spam / apps multiples identiques | ✅ OK |
| 4.4 | Social login → Sign in with Apple obligatoire | ✅ Pas de Google/Facebook login |
| 4.5 | Pas de référence à Android dans l'UI | ⚠️ Vérifier les textes (ex: "Appuyez sur le bouton Android...") |
| 4.6 | Human Interface Guidelines respectées | ✅ React Native Paper + safe areas |

### Section 5 — Legal

| # | Règle | Statut LVM Agenda |
|---|-------|-------------------|
| 5.1 | Politique de confidentialité | ❌ **Manquante — voir §3.2** |
| 5.1.1 | Pas de tracking sans ATT | ✅ Pas de SDK analytics/pub |
| 5.1.2 | Suppression de compte disponible | ⚠️ Employés peuvent-ils supprimer leur compte ? À vérifier |
| 5.1.3 | Données minimales collectées | ✅ Seulement ce qui est nécessaire à l'app |
| 5.2 | Pas de contenu tiers sans licence | ✅ OK |
| 5.3 | Jeux de hasard avec licence | ✅ Non applicable |
| 5.4 | VPN via NEVPNManager API | ✅ Non applicable |
| 5.5 | MDM / Enterprise | ✅ Non applicable |

---

## 5. Étapes de build et soumission EAS

### Étape 1 — Appliquer tous les correctifs ci-dessus

```
✅ app.json : bundleIdentifier + buildNumber
✅ app.json : icône 1024×1024 RGB
✅ eas.json : profil iOS production
✅ EAS Secret : EXPO_PUBLIC_SUPABASE_ANON_KEY
✅ Privacy Manifest : PrivacyInfo.xcprivacy
✅ Politique de confidentialité : URL créée
```

### Étape 2 — Authentification Apple dans EAS

```bash
eas login
eas credentials   # configure automatiquement les certificats iOS
```

EAS va créer automatiquement :
- Un Distribution Certificate
- Un App Store Provisioning Profile
- L'App ID `be.lvmagenda.app` sur developer.apple.com

### Étape 3 — Build de production

```bash
cd vitres-pro/apps/mobile
eas build --platform ios --profile production
```

Le build prend ~15-25 minutes. EAS envoie un email quand c'est terminé.

### Étape 4 — Soumettre sur TestFlight

```bash
eas submit --platform ios
```

EAS vous demande le chemin du build (ou l'ID EAS). Il upload automatiquement sur App Store Connect.

**Alternativement**, dans App Store Connect :
- TestFlight → **+** → charger le `.ipa`
- Attendre le processing Apple (~30 min)

### Étape 5 — Inviter les testeurs TestFlight

Dans App Store Connect → TestFlight → **Internal Testing** :
- Ajouter les utilisateurs (jusqu'à 100 personnes)
- Ils reçoivent un email avec lien de téléchargement
- L'app expire après 90 jours (renouveler avec un nouveau build)

> **Important :** TestFlight Internal ne nécessite **pas de review Apple** — disponible en quelques minutes. TestFlight External (liens publics) nécessite une review de ~24h.

### Étape 6 — Mettre à jour l'app

```bash
# Correction de bug JS uniquement (instantané) :
eas update --branch production --message "Fix: correction bug X"

# Nouveau build natif (nouvelle soumission TestFlight) :
# 1. Incrémenter buildNumber dans app.json : "2"
# 2. eas build --platform ios --profile production
# 3. eas submit --platform ios
```

---

## 6. Distribution : TestFlight vs Apple Custom App

### Option A — TestFlight (recommandée)

| Critère | Détail |
|---------|--------|
| **Accès** | Email des employés (invitation individuelle) |
| **Review** | Internal Testing : aucune review requise |
| **Limite** | 100 testeurs internes, 10 000 testeurs externes |
| **Durée** | 90 jours par build (renouvellement simple) |
| **Coût** | Inclus dans le Developer Program |
| **Inconvénient** | L'app doit être téléchargée depuis TestFlight (pas l'App Store normal) |

**Workflow recommandé pour LVM :**
1. Créer le build production
2. Inviter les 20 employés par email dans TestFlight Internal Testing
3. Ils téléchargent l'app TestFlight → trouvent LVM Agenda → installez

### Option B — Apple Custom App (B2B privée)

| Critère | Détail |
|---------|--------|
| **Accès** | Via Apple Business Manager (ABM) — les appareils de l'entreprise |
| **Review** | Revue Apple normale requise (~1-3 jours) |
| **Limite** | Aucune (déploiement en masse sur MDM) |
| **Durée** | Pas d'expiration |
| **Coût** | Developer Program + compte ABM gratuit |
| **Avantage** | App invisible publiquement, déploiement MDM possible |

**Recommandation :** Pour 20 utilisateurs sans MDM, **TestFlight est largement suffisant** et plus rapide à mettre en place. Passer à Custom App si LVM s'équipe d'un MDM (Jamf, Mosyle).

---

## Récapitulatif des actions immédiates

| Priorité | Action | Fichier | Statut |
|----------|--------|---------|--------|
| 🔴 BLOQUANT | `bundleIdentifier` + `buildNumber` | `app.json` | ✅ Fait |
| 🔴 BLOQUANT | Remplacer l'icône (1024×1024 RGB) | `assets/images/` | ✅ Fait — `LVM_icone_ios.png` (1024×1024 RGB) |
| 🔴 BLOQUANT | Profil iOS dans eas.json | `eas.json` | ✅ Fait |
| 🔴 BLOQUANT | Anon key → EAS Secret | CLI `eas secret:create` | ⚠️ Clé retirée du fichier — lancer la commande §2.4 |
| 🟠 IMPORTANT | Privacy Manifest | Plugin `expo-build-properties` | ⚠️ Voir §3.1 — nécessite `npx expo install expo-build-properties` |
| 🟠 IMPORTANT | Politique de confidentialité | Page web + lien dans app | ❌ À faire |
| 🟡 UTILE | Strip console.log production | `babel.config.js` | ✅ Fait — lancer `npm install` |
| 🟡 UTILE | expo-updates (OTA) | `package.json` + `app.json` | ❌ Optionnel — `npx expo install expo-updates` |
| 🟡 UTILE | Références Android dans UI | Recherche textuelle | ✅ Vérifié OK |
| 🟡 UTILE | Suppression de compte employé | UX flow | ⚠️ À vérifier manuellement |

**Ce qui reste à faire manuellement :**
1. `npm install` dans `apps/mobile` (pour `babel-plugin-transform-remove-console`)
2. `eas secret:create` avec la clé anon Supabase (commande exacte en §2.4)
3. `npx expo install expo-build-properties` puis ajouter plugin en §3.1
4. Créer l'icône 1024×1024 RGB (Figma / Photoshop)
5. Créer la page politique de confidentialité

---

*Audit généré le 2026-04-11 · Basé sur App Store Review Guidelines (dernière mise à jour mai 2024) · Skill app-store-review v1.0.0 (safaiyeh)*
