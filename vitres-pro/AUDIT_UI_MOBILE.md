# Audit UI Mobile — LVM Agenda

> Focus : harmonisation visuelle sur téléphone. Les corrections ne doivent pas impacter le web.
> Dernière mise à jour : 2026-03-23

---

## Vue 1 — Dashboard (`index.tsx`)

- [x] KPI cards : chiffres par mois (CA ce mois / Interventions ce mois) au lieu des totaux
- [x] Tendance % repositionnée sur le côté de la valeur
- [x] Graphique "Évolution des revenus" : données réelles (6 derniers mois)
- [x] Cards "Aujourd'hui" : coins arrondis + bordure visible (`border border-border`)
- [x] Badge statut dans "Aujourd'hui" : taille réduite (`py-0.5 px-1.5`)
- [x] ScrollView "Aujourd'hui" : maxHeight augmenté (320 → 480) pour réduire l'espace blanc en bas

---

## Vue 2 — Alertes (`notifications/index.tsx`)

- [x] Scrollbar indicateur visible sur la droite (mobile uniquement)

---

## Vue 3 — Clients (`clients/index.tsx`)

- [x] Scrollbar indicateur visible + `indicatorStyle="black"`

---

## Vue 4 — Détail client (`clients/[id].tsx`)

- [x] Boutons Y aller/Appeler/Email : style carte avec icône `rounded-full`
- [x] Boutons alignés sur `calendar/[id].tsx` : icônes 24px fill, `rounded-3xl`, ordre Y aller/Appeler/Email, couleurs vert/bleu/orange

---

## Vue 5 — Ajout client (`clients/add.tsx`)

- [x] Icône hero centrée via `alignItems: "center"` inline
- [x] Icône UserPlus décalée à droite (`marginLeft: 6`)
- [x] Espacement gauche augmenté sur les deux CardContent (`paddingLeft: 32`)

---

## Vue 6 — Planning / Calendrier (`calendar/index.tsx`)

- [x] Slider zone "Ardennes" : `numberOfLines={1}` + `adjustsFontSizeToFit` pour éviter le retour à la ligne
- [x] Vue Mois : ajout du `PlanningHeader` (barre de progression + stats) sous la date du jour sélectionné
- [x] Vue Mois : espacement bas réduit (`pb-24` → `pb-6`)
- [x] ScrollView (semaine/mois/année) : `paddingBottom` réduit (100 → 80)
- [ ] Réduire la taille de la police de la première ligne en gras (titre du jour sélectionné dans la vue Mois) pour mieux lire
- [x] Badges statut (Planifiée / En cours / Terminée) : taille réduite (`px-2 py-0.5`, `fontSize: 10`)

---

## Vue 7 — Détail intervention (`calendar/[id].tsx`)

- [x] Header : 3 points d'options à droite des 2 tags (INTERVENTION + PLANIFIÉE), tous même taille (`fontSize: 10`)
- [x] Titre en gras : `text-2xl`, `numberOfLines={4}` pour afficher tout le texte sans réduire la police
- [x] Encadré "À ENCAISSER SUR PLACE" : layout horizontal (`flex-row`), coins arrondis `rounded-2xl`, les deux variantes (rouge + orange)
- [x] Date + horaire fusionnés en une ligne compacte (date à gauche, pill bleue heure à droite) — suppression de la grosse card horaire
- [x] Notes : bords arrondis via `borderRadius: 16` inline
- [x] Notes entièrement visibles au scroll : `pb-20` → `pb-32`
- [x] Bouton flottant : suppression `bg-background border-t` du footer
- [x] Bouton "Démarrer l'intervention" : couleur orange → bleu

---

## Vue 8 — Ajout intervention (`calendar/add.tsx`)

- [x] Sélecteur de type : grille 2×2 unifiée (`flex: 1`, `minWidth: "45%"`) — plus de 3+1 selon la taille d'écran
- [x] Sélecteur de type : "Devis" affiche le même formulaire que "Note" et "Tournée" (sans section client/items)
- [x] Alignement global : suppression de tous les `ml-1` sur les labels — titres et contrôles au même bord gauche
- [x] Champ recherche employés (`MultiSelect.tsx`) : `borderRadius: 12` inline
- [x] Espace entre l'input heure et le label "Durée (heures)" : `marginTop: 8` sur l'Input Durée
- [x] Taux horaire masqué quand total estimé = 0
- [x] Wrappers NativeWind `gap-*` / `w-full` → inline style dans `Input`, `Select`, `MultiSelect`, `DateTimePicker`
- [x] Police date/heure agrandie (`fontSize: 16`)
- [x] Placeholders des inputs prestation visibles (`placeholderTextColor="#94A3B8"`)
- [x] Boutons valider/annuler prestation : cercles 34×34, icônes 16px, bordure visible sur la croix
- [x] Fond de la ligne d'ajout prestation : adapté au thème (plus de bleu clair)
- [x] Bordures inputs prestation : bleu primaire (`#3B82F6`)
- [x] Formulaire "Nouveau client" : CP/Ville — wrapper `flex-row gap` en inline style
- [x] Formulaire "Nouveau client" : chaque cadre en `Pressable` → focus immédiat sur tout le cadre, bordure bleue sans lag

---

## Vue 9 — Évaluation session (`calendar/rate-session.tsx`)

- [x] Boutons footer (flèche/Passer/Valider) : `borderRadius` inline + suppression ligne séparation
- [x] Séparateurs dans la card : `borderTopWidth/Color` inline
- [x] "Nouveau taux" : style identique au bouton "Ajouter" (`PlusCircle` + fond bleu/10)
- [x] Cadre "Heures calculées" : `borderRadius: 16` inline
- [x] Scroll automatique vers le bas quand un taux est appliqué
- [x] Input "Libellé" : `paddingVertical: 0` + `textAlignVertical: "center"` pour centrage vertical

---

## Vue 10 — Événement brut (`calendar/raw-event/[id].tsx`)

- [x] Titre header : `text-base` → `text-lg`
- [x] Tous les `gap-*` NativeWind → inline style (header, employés assignés, boutons d'action, modal IA)

---

## Vue 11 — Réglages (`parametres/index.tsx`)

- [x] Card "Mon Profil" : icône et Avatar dans la couleur de l'employé (prop `color` ajoutée à Avatar.tsx)
- [x] Cards Administration : fond coloré forcé via inline style (contournement NativeWind/bg-card conflict)
- [x] Card "Taux horaires" : couleur bleue → orange (doublon avec "Ajouter un employé")

---

## Vue 12 — Équipe (`parametres/team.tsx`)

- [x] Badges (rôle/zone/heures) : `gap-2` → inline style `gap: 8`
- [x] Contenu modale : `gap-6` → inline style `gap: 24`
- [x] Formulaire absence : `gap-4` → inline style `gap: 16`
- [x] Select rôle : `searchable={false}`
- [x] Icône `UserCog` : `w-20 h-20 rounded-full` + `marginLeft: 6`
- [x] Bouton "Sauvegarder" : `borderRadius: 28` inline
- [x] Modale web : wrapper `Pressable` → `View` (évite fermeture au clic sur input)
- [x] Scroll modale : `Dialog.tsx` refactorisé (backdrop absolu + `pointerEvents="box-none"`) — corrige le scroll sur espaces vides sur tous les dialogs
- [x] ScrollView modale : `max-h-[85vh]` → `style={{ maxHeight: screenHeight * 0.85 }}`, suppression `flexGrow: 1`
- [x] Calendriers absence : remplacés par `DateTimePicker dateOnly` (plus de conflit scroll)
- [x] Animation expand/collapse formulaire absence : `Animated` + `maxHeight` interpolation
- [x] Dates absence : début = aujourd'hui, fin = lendemain par défaut, réinitialisées à chaque ouverture
- [x] Liste des absences existantes sous le bouton : date début → fin + suppression
- [x] Bouton "Reset MDP" : dialog dédié avec champ MDP + route backend `POST /api/employees/{id}/reset-password`

---

## Vue 13 — Créer employé (`parametres/create-employee.tsx`)

- [x] CardContent : `gap-4` className → `style={{ gap: 16 }}` inline (mobile + web identique)
- [x] Icône hero `UserPlus` : `marginLeft: 6` pour centrage visuel

---

## Vue 14 — Zones (`parametres/zones.tsx`)

- [x] Pills Hainaut/Ardennes : `borderRadius: 99` inline
- [x] Boutons "Déplacer" : `borderRadius: 10` inline
- [x] Icône crayon : `marginLeft: 10` pour espacement
- [x] TextInput renommage (web) : `outlineStyle: "none"` pour supprimer l'encadré bleu navigateur
- [x] Suppression sous-zone : `Alert.alert` natif sur mobile, `Dialog` custom sur web
- [x] Toast erreur suppression : message complet dans `text2`
- [x] Modal création : bottom sheet avec `KeyboardAvoidingView` + fill blanc conditionnel (`keyboardWillShow/Hide`) pour couvrir les coins arrondis du clavier sans masquer le contenu
- [x] Modal création : `width: "100%"` pour éviter les bords gris latéraux
- [x] Section "Non assignées" : villes présentes sur clients mais sans mapping `city_sub_zones`, section jaune en haut avec bouton "Assigner" → réutilise le modal de réassignation existant
- [x] Backend : `GET /settings/zones/unassigned-cities` — villes clients sans mapping
- [x] Backend : `normalize_city()` — uniformise apostrophes + trim à la saisie et à la comparaison
- [x] Backend : déduplication des villes normalisées dans la réponse `list_zones`
- [x] Cache : invalidation `unassigned-cities` sur création/modification/suppression client

---

## Vue 15 — Tarifs (`parametres/tarifs.tsx`)

- [x] `router.back()` → `router.push("/(app)/parametres")` (règle navigation explicite)
- [x] `gap-*` NativeWind → inline `style={{ gap: N }}`
- [x] `className={inputClass}` sur TextInput → inline `style` (plus fiable sur native)
- [x] Suppression taux : `Alert.alert` natif sur mobile, `Dialog` custom sur web
- [x] Cards arrondies : remplacement `Card` + `CardContent` par `View` plain avec `borderRadius: 16` inline (NativeWind `rounded-2xl` ignoré sur native)
- [x] Formulaire "Ajouter" déplacé en haut, liste des taux en dessous
- [x] Police taux : 15→17px (label) et 13→15px (valeur)

---

## Vue 16 — Logs (`parametres/logs.tsx`)

- [x] Empty state View : `gap-3` className → `style={{ gap: 12, paddingHorizontal: 32 }}`
- [x] Icône container : `bg-slate-100 dark:bg-slate-800 p-5 rounded-full` → inline style `{ backgroundColor, padding: 20, borderRadius: 999 }`
- [x] LogItem : déjà en full inline styles ✓
- [x] Filter pills : déjà en inline styles ✓
- [x] Navigation : `router.push("/(app)/parametres")` déjà correct ✓
