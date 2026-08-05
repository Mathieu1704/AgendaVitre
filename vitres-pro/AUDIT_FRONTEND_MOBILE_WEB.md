# Audit Frontend Mobile Web

Audit statique du frontend `apps/mobile` orienté "petite largeur web" (`mobile web` / tablette étroite).

Périmètre relu :
- `apps/mobile/app/**`
- `apps/mobile/src/**`

Limites :
- audit basé sur la lecture du code, sans campagne visuelle exhaustive viewport par viewport
- ce fichier liste uniquement les points non optimisés ou potentiellement fragiles pour le mobile web

## Priorité Haute

- [`apps/mobile/app/(app)/calendar/add.tsx`](./apps/mobile/app/(app)/calendar/add.tsx)
  Risque de compression horizontale sur le formulaire de création / édition.
  Indices : carte principale très desktop (`max-w-2xl`, ligne 494), footer d'actions en ligne avec marges manuelles et négatives (`lines 855-869`), plusieurs champs de récurrence en largeur fixe `60` (`lines 777, 903, 985`), sélecteur jours avec `maxWidth: 40` (`line 942`), bloc "nouveau client" CP/Ville en `flex-row` (`line 1046`).
  Impact : boutons, chips et petits inputs peuvent se tasser, se couper ou créer des alignements bancals sur faible largeur web.

- [`apps/mobile/app/(app)/calendar/index.tsx`](./apps/mobile/app/(app)/calendar/index.tsx)
  Header très dense et très horizontal pour une vue mobile web.
  Indices : titre + toggle liste/calendrier + bouton aujourd'hui dans la même ligne (`lines 1277-1299`), barre navigation/date/zone aussi en ligne (`line 1342`), sélecteur "Liste/Calendrier" avec largeur fixe `160`, année mini-calendriers basée sur largeur calculée (`line 1231`).
  Impact : sur largeur web étroite, la barre haute peut manquer d'air, pousser des éléments sur 2 lignes de façon non maîtrisée ou provoquer une sensation de contenu tassé.

- [`apps/mobile/app/(app)/clients/add.tsx`](./apps/mobile/app/(app)/clients/add.tsx)
  Formulaire encore piloté par des hacks de marge non adaptés au mobile web.
  Indices : ligne CP/Ville en `flex-row` (`line 169`) avec `marginLeft: -15`, `marginRight: 16/15` (`lines 174-192`).
  Impact : risque de léger débordement, de champ décalé ou de rendu asymétrique selon la largeur exacte et le zoom navigateur.

- [`apps/mobile/app/(app)/facturation/add.tsx`](./apps/mobile/app/(app)/facturation/add.tsx)
  La ligne "Montant HT + TVA" reste forcée sur une seule ligne.
  Indices : `flex-row gap-4 w-full` (`line 122`).
  Impact : sur petite largeur web, le résumé TVA et le champ montant se compressent au lieu de se stacker proprement.

- [`apps/mobile/src/ui/toast.tsx`](./apps/mobile/src/ui/toast.tsx)
  Toasts trop rigides pour des messages longs.
  Indices : `minWidth: 280`, `maxWidth: "90%"`, `height: 60` sur les trois variantes (`lines 30-32`, `57-59`, `82-84`).
  Impact : les messages d'erreur ou de succès longs peuvent être tronqués verticalement ou donner une impression de bloc trop large sur très petit viewport.

## Priorité Moyenne

- [`apps/mobile/src/ui/components/DateTimePicker.tsx`](./apps/mobile/src/ui/components/DateTimePicker.tsx)
  La modale horaire web reste large et desktop-first.
  Indices : `width: 500`, `maxHeight: "80vh"` (`line 209`).
  Impact : sur iPad mini, petit laptop ou navigateur mobile web un peu large, la popup peut paraître disproportionnée et occuper trop d'espace horizontal.

- [`apps/mobile/src/ui/components/OptionsModal.tsx`](./apps/mobile/src/ui/components/OptionsModal.tsx)
  Menu d'options ancré en absolu en haut à droite.
  Indices : `absolute right-4`, `min-w-[200px]` (`line 32`), `top` fixe selon plateforme (`line 34`).
  Impact : positionnement fragile sur mobile web si header différent, zoom navigateur, ou hauteur réduite.

- [`apps/mobile/src/ui/components/ConfirmModal.tsx`](./apps/mobile/src/ui/components/ConfirmModal.tsx)
  Boutons d'action toujours côte à côte.
  Indices : modal `max-w-sm` (`line 35`) et ligne d'actions `flex-row gap-3` (`line 44`).
  Impact : sur largeur serrée ou avec labels plus longs, les boutons peuvent devenir trop comprimés.

- [`apps/mobile/src/ui/components/Select.tsx`](./apps/mobile/src/ui/components/Select.tsx)
  Les valeurs longues sont tronquées sans alternative inline.
  Indices : trigger en `h-12` (`line 57`), texte en `numberOfLines={1}` (`line 71`), liste max height `320` (`line 113`).
  Impact : adresses ou intitulés longs sont masqués dans le champ lui-même, ce qui pénalise la lecture mobile web.

- [`apps/mobile/src/ui/components/MultiSelect.tsx`](./apps/mobile/src/ui/components/MultiSelect.tsx)
  Même problème sur la sélection multiple.
  Indices : trigger en `h-12` (`line 61`), texte sélectionné en `numberOfLines={1}` (`line 75`), badge compteur collé à droite (`line 82`).
  Impact : plusieurs employés sélectionnés deviennent vite illisibles sur petite largeur.

- [`apps/mobile/app/(app)/clients/index.tsx`](./apps/mobile/app/(app)/clients/index.tsx)
  Les informations de cartes clients se tronquent vite.
  Indices : adresse en `numberOfLines={1}` (`line 81`), email en `numberOfLines={1}` (`line 108`), footer contact en `flex-row gap-4 ml-6` (`line 94`), FAB flottante fixe (`line 182`).
  Impact : pertes d'info sur les adresses/emails longs et risque de recouvrement visuel du dernier item par le bouton flottant.

- [`apps/mobile/app/(app)/calendar/[id].tsx`](./apps/mobile/app/(app)/calendar/[id].tsx)
  La fiche détail reste pensée pour tablette/desktop dès `768px`.
  Indices : breakpoint `width >= 768` (`line 51`), marges manuelles dans les cartes (`line 276`), éléments en `numberOfLines={1}` (`line 333`), groupe d'actions `flex-row gap-6` (`line 457`).
  Impact : entre mobile large et petite tablette web, certains blocs peuvent rester trop horizontaux avant de vraiment se réorganiser.

- [`apps/mobile/app/(app)/clients/[id].tsx`](./apps/mobile/app/(app)/clients/[id].tsx)
  Quelques sections restent rigides.
  Indices : édition CP/Ville en `flex-row gap-3` (`line 182`), boutons d'action rapide en cercles fixes `h-14 w-14` (`lines 226-239`), actions bas de formulaire encore en ligne (`line 319`).
  Impact : densité élevée sur petite largeur, surtout si le navigateur applique un zoom ou si le texte système est agrandi.

- [`apps/mobile/app/(app)/facturation/index.tsx`](./apps/mobile/app/(app)/facturation/index.tsx)
  Grille KPI et listes encore trop orientées desktop en web.
  Indices : KPI web forcés à `24%` (`line 189`), labels tronqués (`lines 212, 331`), FAB fixe (`line 370`).
  Impact : à largeur intermédiaire web, quatre cartes par ligne peuvent devenir trop étroites avant de réellement respirer.

- [`apps/mobile/app/(app)/parametres/team.tsx`](./apps/mobile/app/(app)/parametres/team.tsx)
  Bloc absence très rigide.
  Indices : boutons centrés à `width: "90%"` (`lines 347, 365`), calendriers fixes `width: 300` (`lines 383, 412`).
  Impact : bonne tenue sur certains écrans, mais peu flexible si viewport plus étroit ou si le panneau s'insère dans un contexte réduit.

- [`apps/mobile/app/(app)/parametres/logs.tsx`](./apps/mobile/app/(app)/parametres/logs.tsx)
  Lecture partielle des contenus et dépendance au scroll horizontal.
  Indices : barre filtres uniquement horizontale (`contentContainerStyle` du `ScrollView`), description log limitée à `numberOfLines={2}` (`line 100`).
  Impact : sur mobile web, on masque vite les détails utiles et on dépend d'un geste latéral pas toujours évident.

## Priorité Basse

- [`apps/mobile/app/(app)/notifications/index.tsx`](./apps/mobile/app/(app)/notifications/index.tsx)
  Header et item notification encore assez compacts.
  Indices : dot absolu en haut à droite (`line 53`), icône fixe `40x40` (`line 59`), bouton "Tout lu" dans la même ligne que le titre.
  Impact : pas forcément cassé, mais largeur réduite = tension visuelle plus forte dans le header.

- [`apps/mobile/src/ui/components/calendar/EventDetailPopover.tsx`](./apps/mobile/src/ui/components/calendar/EventDetailPopover.tsx)
  Le tooltip web du titre est très large et pensé desktop.
  Indices : `tooltipWidth = Math.min(Math.max(460, screenW * 0.55), screenW - 64)` (`line 107`), `left: -24` (`line 131`), titre tronqué à 2 lignes (`line 119`), popover desktop max `360` (`line 205`).
  Impact : près du breakpoint web/mobile, l'expérience hover reste moins propre que sur un vrai desktop large.

- [`apps/mobile/app/(auth)/login.tsx`](./apps/mobile/app/(auth)/login.tsx)
  Le découpage responsive est un peu abrupt.
  Indices : breakpoint desktop unique `width >= 1024` (`line 35`), formulaires bornés par `max-w-sm` / `max-w-[400px]` (`lines 160, 196`).
  Impact : sur tablette web ou fenêtre réduite, l'écran reste utilisable mais manque d'états intermédiaires plus fins.

## Patterns transverses à surveiller

- Plusieurs écrans utilisent encore des `flex-row` pour des paires de champs qui devraient passer en pile plus tôt sur mobile web.
- Les chips, badges et compteurs sont souvent corrects visuellement, mais plusieurs listes et triggers coupent encore le texte avec `numberOfLines={1}` sans solution de repli immédiate.
- Les modales et overlays sont souvent pensées soit mobile natif, soit desktop, avec peu d'état intermédiaire pour le web étroit.
- Quelques largeurs fixes (`60`, `160`, `300`, `500`) restent présentes dans les formulaires et dialogs ; ce sont les premiers candidats à casser quand le viewport web se resserre.
