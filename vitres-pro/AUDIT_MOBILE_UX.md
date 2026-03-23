# Audit Mobile UX — LVM Agenda

> Réalisé le 2026-03-22. Focus exclusif sur l'expérience téléphone réelle.
> Dernière mise à jour : 2026-03-23

---

## Corrections appliquées ✅

- **#1 Pagination interventions** — Backend filtre `start`/`end` activé. Frontend fenêtre 3 mois centrée sur `cursorDate`.
- **#4 `GET /api/employees/me`** — Endpoint backend ajouté. `parametres/index.tsx` migré avec fallback.
- **KeyboardAvoidingView** sur `add.tsx`, `clients/[id].tsx`, `parametres/index.tsx`
- **Violation hooks React** dans `facturation/index.tsx` — corrigé
- **`router.back()` remplacé** par `router.push()` dans `calendar/[id].tsx`
- **Timeout axios 15s** + intercepteur 401/offline/timeout dans `api.ts`
- **`useAuth.ts`** — gestion `SIGNED_OUT` + `signOut()` si refresh token corrompu
- **Facturation** masquée partout (tab bar mobile + desktop sidebar)
- **Button `size`** prop implémentée (`icon` = 40×40, `sm` = h-8)
- **Debounce 150ms** sur la recherche clients
- **FlatList optimisée** clients (`initialNumToRender`, `maxToRenderPerBatch`, `removeClippedSubviews`)
- **`returnKeyType="search"`** sur la barre de recherche clients
- **Validation MDP** cohérente (< 8 partout)
- **Confirmation déconnexion** — Dialog "Vous êtes sûr ?" avant signOut
- **Footer `calendar/[id].tsx`** — `paddingBottom: Math.max(insets.bottom, 16)` + `pt-12` → `pt-4`
- **`numberOfLines={2}`** sur le titre dans `calendar/[id].tsx`
- **FAB planning** — passe `from_view` + `from_date` à `add.tsx`, retour correct vers la vue source
- **FAB `clients/index.tsx`** — `insets.bottom` corrigé (home indicator iPhone)
- **`keyboardDismissMode="on-drag"`** sur les ScrollView — `add.tsx` + `clients/[id].tsx`
- **Notes `numberOfLines={5}`** en lecture — `clients/[id].tsx`
- **Pull-to-refresh** — `calendar/index.tsx`
- **Composants extraits + `React.memo`** — `InterventionCard`, `RawEventCard`, `FilterChipsBar`, `DailyStatsBadge`, `MonthView`, `WeekView`, `DayView`, `YearView` sortis de `calendar/index.tsx`
- **`useTransition` sur les pills** — animation 60 FPS pendant les re-renders lourds — `calendar/index.tsx`
- **`clients/[id].tsx`** — dialog historique `maxHeight: "60%"` + labels textuels sur boutons phone/mail/maps
- **`_layout.tsx`** — `paddingBottom` remplacé par `Math.max(insets.bottom, 8)`
- **Virtualisation `DayView`** — `FlatList` auto-scroll avec groupes aplatis, `removeClippedSubviews`, `initialNumToRender=12`

---

## Problèmes restants

---

### useAuth — pas de singleton, multiples listeners

**Fichier :** `src/hooks/useAuth.ts`
**Problème :** Si 5 composants utilisent `useAuth()`, 5 listeners `onAuthStateChange` sont créés → consommation réseau multipliée, race conditions sur `isAdmin`.
**Fix :** Déplacer la logique d'auth dans un Context Provider unique au niveau de `_layout.tsx`.
**Statut :** ⏸️ Reporté — tentative échouée, à retravailler prudemment

---

### `calendar/add.tsx` — ~30 useState, re-renders massifs

**Fichier :** `app/(app)/calendar/add.tsx`
**Problème :** Chaque frappe dans n'importe quel champ re-render le composant entier (1300+ lignes). Lag perceptible sur mobile mid-range.
**Fix :** Migrer vers `react-hook-form` (isole les re-renders par champ).
**Statut :** 🔲 À faire

---

### `calendar/add.tsx` — ~30 useState, re-renders massifs

**Fichier :** `app/(app)/calendar/add.tsx`
**Problème :** Chaque frappe dans n'importe quel champ re-render le composant entier (1300+ lignes). Lag perceptible sur mobile mid-range.
**Fix :** Migrer vers `react-hook-form` (isole les re-renders par champ).
**Statut :** 🔲 À faire
