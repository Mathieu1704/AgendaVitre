# Audit Mobile UX — LVM Agenda
> Réalisé le 2026-03-22. Focus exclusif sur l'expérience téléphone réelle.
> Dernière mise à jour : 2026-03-23

### Corrections appliquées ✅
- **#2** KeyboardAvoidingView sur `add.tsx`, `clients/[id].tsx`, `parametres/index.tsx`
- **#5** Violation hooks React dans `facturation/index.tsx` — corrigé
- **#6** `router.back()` remplacé par `router.push()` dans `calendar/[id].tsx`
- **#8** Timeout axios 15s + intercepteur 401/offline/timeout dans `api.ts`
- **Bonus** `useAuth.ts` — gestion `SIGNED_OUT` + `signOut()` si refresh token corrompu
- **Facturation** masquée partout (tab bar mobile + desktop sidebar)
- **Button `size`** prop enfin implémentée (`icon` = 40×40, `sm` = h-8)
- **Debounce 150ms** sur la recherche clients
- **FlatList optimisée** clients (`initialNumToRender`, `maxToRenderPerBatch`, `removeClippedSubviews`)
- **`returnKeyType="search"`** sur la barre de recherche clients
- **Validation MDP** cohérente (< 8 partout au lieu de 6 vs 8)
- **Confirmation déconnexion** — Dialog "Vous êtes sûr ?" avant signOut
- **Footer `calendar/[id].tsx`** — `paddingBottom: Math.max(insets.bottom, 16)` + `pt-12` → `pt-4`
- **`numberOfLines={2}`** sur le titre dans `calendar/[id].tsx`
- **FAB planning** — passe `from_view` + `from_date` à `add.tsx`, retour correct vers la vue source
- **FAB `clients/index.tsx`** — `insets.bottom` corrigé (home indicator iPhone)
- **#1 Pagination interventions** — backend filtre `start`/`end` activé + frontend fenêtre 3 mois (⚠️ nécessite push Railway)
- **#4 `GET /api/employees/me`** — endpoint backend ajouté + `parametres/index.tsx` migré avec fallback (⚠️ nécessite push Railway)

---

## PARTIE 1 — Top problèmes critiques mobile

---

### 1. Toutes les interventions chargées d'un coup
**Fichier :** `src/hooks/useInterventions.ts`, ligne 9
**Code :** `api.get("/api/interventions")` — 2800+ interventions sans pagination.
**Pourquoi c'est grave :** Sur 3G ou réseau instable (un chantier, une zone rurale), ce payload peut prendre 10-15 secondes à charger. L'app est inutilisable pendant ce temps. Sur mobile, un payload > 500KB est une faute.
**Fix :** Passer à un filtrage par plage de dates (`?start=&end=`) ou ajouter `?limit=100&skip=0`. Le calendrier n'affiche jamais 2800 items à la fois.

---

### 2. `useAuth()` — pas de singleton, multiples listeners
**Fichier :** `src/hooks/useAuth.ts`
**Pourquoi c'est grave :** Si 5 composants utilisent `useAuth()`, 5 listeners `onAuthStateChange` sont créés et potentiellement 5 appels à `/api/employees` sont déclenchés au login. Sur mobile, ça multiplie la consommation réseau et peut causer des race conditions sur `isAdmin`.
**Fix :** Déplacer la logique d'auth dans un Context Provider unique au niveau de `_layout.tsx`.

---

### 3. `calendar/add.tsx` — formulaire monstre de 1300+ lignes, ~30 useState
**Fichier :** `app/(app)/calendar/add.tsx`
**Pourquoi c'est grave :** Chaque frappe dans n'importe quel champ trigger un re-render du composant entier, ce qui inclut les calculs de récurrence, les validations, le build du formulaire. Sur mobile mid-range, le lag est perceptible lors de la saisie.
**Fix :** Migrer vers `react-hook-form` (qui isole les re-renders par champ) ou au minimum structurer avec `useReducer`.

---

### 4. Profil chargé en filtrant toute la liste des employés
**Fichier :** `app/(app)/parametres/index.tsx`, lignes 74-76
**Code :** `api.get("/api/employees")` puis `.find(e => e.email === user.email)`.
**Pourquoi c'est grave :** Un employé télécharge la liste de TOUS ses collègues (noms, emails, téléphones) pour trouver son propre profil. C'est un payload inutile ET une fuite de données entre employés.
**Fix :** Créer un endpoint `/api/employees/me` ou passer l'ID de l'employé directement depuis `useAuth`.

---

## PARTIE 2 — Audit écran par écran

---

### Calendrier (`calendar/index.tsx`)
**Ce qui va :** Animations pilotées par Reanimated, SlidingPillSelector fluide, code de filtrage par zone bien pensé.
**Ce qui ne va pas :**
- Fichier de 1300+ lignes avec `InterventionCard`, `RawEventCard`, `FilterChipsBar` définis inline dans le composant parent — re-render total à chaque frappe
- Aucune virtualisation (FlatList) — tout est rendu dans un `View.map()`
- Filter chips avec touch target ~30px, sous les 44px minimum
- Bouton "Assigner" avec `hitSlop={10}` sur une zone tactile de 30x24px
- Pas de pull-to-refresh — geste natif attendu sur mobile
- Pas d'indicateur visuel pour le scroll horizontal de la semaine
- `numberOfLines` manquant sur les titres des cards — un titre long casse le layout

**Gravité :** Critique (performance), Majeur (UX)
**Recommandations :** Extraire les sous-composants en fichiers séparés avec `React.memo`. Remplacer les `View.map()` par des `FlashList` ou `FlatList` optimisées.

---

### Ajout / Modification d'intervention (`calendar/add.tsx`)
**Ce qui va :** Le flux en une seule page est correct conceptuellement. La création de client inline est un bon choix UX.
**Ce qui ne va pas :**
- ~30 `useState` — re-renders massifs à chaque frappe
- Pas de validation en temps réel sur la durée (accepte "abc")
- Formulaire de création client dans le Dialog sans gestion du clavier
- Bouton "Enregistrer" pas `disabled` pendant soumission — double-submit possible

**Gravité :** Sévère (perf), Moyen (validation)
**Recommandations :** Migrer vers `react-hook-form`.

---

### Détail d'intervention (`calendar/[id].tsx`)
**Ce qui va :** Structure de la page claire, actions rapides bien placées, ConfirmModal pour suppression. Footer et header corrigés.
**Ce qui ne va pas :**
- Rien de critique restant.

---

### Liste clients (`clients/index.tsx`)
**Ce qui va :** Recherche debounce, FlatList optimisée, empty state présent, returnKeyType correct.
**Ce qui ne va pas :**
- FAB sans `insets.bottom` — chevauche le home indicator iPhone

**Gravité :** Moyen

---

### Fiche client (`clients/[id].tsx`)
**Ce qui va :** Boutons d'action rapide correctement dimensionnés (56x56), confirmation suppression, historique en bottom sheet. `KeyboardAvoidingView` présent.
**Ce qui ne va pas :**
- Dialog historique avec `maxHeight: 400` fixe — ne s'adapte pas à la taille d'écran (iPhone SE)
- Notes sans `numberOfLines` en lecture — des notes longues rendent la page interminable
- Boutons phone/mail/maps sans label textuel — affordance repose uniquement sur l'icône et la couleur

**Gravité :** Moyen

---

### Paramètres (`parametres/index.tsx`)
**Ce qui va :** Organisation par sections correcte, validation MDP cohérente, confirmation déconnexion présente.
**Ce qui ne va pas :**
- Profil chargé en téléchargeant tous les employés
- Pas de feedback visuel pendant la mise à jour du mot de passe (autre que le loading)

**Gravité :** Moyen

---

### Connexion (`login.tsx`)
**Ce qui va :** `KeyboardAvoidingView` correctement implémenté, validation email en temps réel, animation logo.
**Ce qui ne va pas :**
- Bouton show/hide password avec touch target ~30px (sous les 44px)
- Pas de gestion offline — "Network Error" brut si pas de connexion
- Bouton submit sans état pressed visible (`active:` class absente)

**Gravité :** Mineur
**Note :** C'est l'écran le mieux fait de l'app. Servir de référence pour les autres formulaires.

---

### Navigation générale (`_layout.tsx`)
**Ce qui va :** Prefetch des données au login, gestion de l'onglet Facturation selon le rôle.
**Ce qui ne va pas :**
- `paddingBottom: Platform.OS === "web" ? 8 : 20` — magic number qui ne correspond pas à `insets.bottom`

**Gravité :** Mineur

---

## PARTIE 3 — Problèmes techniques qui dégradent l'expérience mobile

---

### Architecture des composants
- **`calendar/index.tsx` et `add.tsx`** : composants de 1300+ lignes avec sous-composants définis inline. React ne peut pas optimiser ces sous-composants avec `memo()` puisqu'ils sont redéfinis à chaque render.

### Performance
- **Zéro virtualisation** dans les vues Mois et Semaine du calendrier — tout est rendu dans des `View.map()`. Sur une semaine chargée, cela peut représenter 50-100 cartes dans le DOM simultanément.
- **2800 interventions** chargées sans pagination via `useInterventions.ts`.
- **`useAuth()`** n'est pas singleton — plusieurs composants créent plusieurs listeners `onAuthStateChange` et peuvent déclencher plusieurs appels API parallèles.

### API / Backend
- **`/api/employees/me` inexistant** — les paramètres téléchargent toute la liste pour se trouver dedans.

### Navigation
- Pas de `<Redirect>` protégeant les routes admin au niveau layout — chaque écran gère ça individuellement avec des patterns différents.

### État global
- L'auth devrait être dans un Context Provider singleton (actuellement recréé par chaque composant qui appelle `useAuth()`).

---

## PARTIE 4 — Quick wins restants

| # | Correction | Fichier | Impact |
|---|-----------|---------|--------|
| 1 | FAB avec `insets.bottom` | `clients/index.tsx` | iPhone home indicator |
| 2 | `numberOfLines` sur titres des cards planning | `calendar/index.tsx` | Évite layout cassé |
| 3 | `keyboardDismissMode="on-drag"` sur ScrollView formulaires | `add.tsx`, `clients/[id].tsx` | Clavier se ferme au scroll |
| 4 | Bouton Enregistrer `disabled={isSubmitting}` | `add.tsx` | Évite double-submit |
| 5 | Notes avec `numberOfLines={5}` en lecture | `clients/[id].tsx` | Page lisible |
| 6 | Endpoint `/api/employees/me` | backend + `parametres/index.tsx` | Sécurité + perf |

---

## PARTIE 5 — Roadmap de correction

### Sprint 1 — Architecture (prioritaire)
1. **Singleton useAuth** — déplacer dans un Context Provider.
2. **Pagination interventions** — filtrage par plage de dates `?start=&end=`.

### Sprint 2 — Polish UX
3. FAB `clients/index.tsx` avec `insets.bottom`
4. `numberOfLines` sur les cards planning
5. `keyboardDismissMode` sur les ScrollView formulaires
6. Bouton Enregistrer `disabled` pendant soumission
7. Notes `numberOfLines` dans `clients/[id].tsx`

### Sprint 3 — Refactors profonds
8. **`react-hook-form`** dans `add.tsx` pour isoler les re-renders.
9. **Endpoint `/api/employees/me`** côté backend.
10. **Pull-to-refresh** sur le calendrier.
11. **Extraire sous-composants** de `calendar/index.tsx` en fichiers séparés avec `React.memo`.

---

## Ce qui est déjà bien fait

- `login.tsx` : formulaire avec `KeyboardAvoidingView` + `ScrollView`. Référence à copier.
- `Card.tsx` : composant propre, bien structuré.
- `Input.tsx` : bien structuré, gestion focus, hauteur correcte (48px).
- Animations `SlidingPillSelector` : fluides et bien pensées pour mobile.
- React Query + prefetch au login : bonne stratégie de chargement.
- Gestion des rôles admin/employé : cohérente entre backend et frontend.
- `useSafeAreaInsets()` présent sur la majorité des écrans.
