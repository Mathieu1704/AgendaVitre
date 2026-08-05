# Checklist de test manuel — LVM Agenda

> Tester avec le compte **admin** (Maxime / Melissa) sauf mention contraire.
> Cocher chaque ligne au fur et à mesure. Noter les bugs en bas du fichier.

---

## 1. AUTH — Login

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 1.1 | Ouvrir l'app sans être connecté | Redirigé vers `/login` | ☐ |
| 1.2 | Cliquer "Se connecter" avec champs vides | Toast "Tous les champs sont requis" | ☐ |
| 1.3 | Saisir email invalide (ex: `abc`) | Message rouge "Format d'email invalide" sous le champ | ☐ |
| 1.4 | Saisir mot de passe < 8 caractères | Message rouge "8 caractères minimum" sous le champ | ☐ |
| 1.5 | Saisir email + mdp incorrects et valider | Toast "Email ou mot de passe incorrect" | ☐ |
| 1.6 | Cliquer l'icône œil sur le champ mdp | Le texte du mot de passe devient visible | ☐ |
| 1.7 | Login avec compte **admin** valide | Redirigé vers le dashboard, tab bar visible | ☐ |
| 1.8 | Login avec compte **employé** valide | Redirigé vers le dashboard, pas d'onglet Paramètres admin | ☐ |
| 1.9 | Rafraîchir la page quand connecté | Reste connecté (session persistée) | ☐ |

---

## 2. DASHBOARD

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 2.1 | Ouvrir le dashboard | Statistiques visibles (interventions, clients, €, heures) | ☐ |
| 2.2 | Vérifier le graphique | Courbe d'interventions affichée sans erreur | ☐ |
| 2.3 | Vérifier les RDV du jour | Liste des interventions aujourd'hui visible | ☐ |
| 2.4 | Cliquer sur une intervention du dashboard | Ouvre la fiche de l'intervention | ☐ |
| 2.5 | Basculer dark/light mode | L'interface change de thème correctement | ☐ |

---

## 3. CALENDRIER — Vue Jour

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 3.1 | Ouvrir l'onglet Agenda | Vue Jour affichée par défaut, date du jour | ☐ |
| 3.2 | Filtrer sur **Hainaut** | N'affiche que les interventions Hainaut | ☐ |
| 3.3 | Filtrer sur **Ardennes** | N'affiche que les interventions Ardennes | ☐ |
| 3.4 | Naviguer vers le jour suivant/précédent | La liste se met à jour | ☐ |
| 3.5 | Appuyer longuement sur une intervention | Menu d'assignation employé apparaît | ☐ |
| 3.6 | Assigner un employé via long press | La bande colorée + prénom s'affiche sur la card | ☐ |
| 3.7 | Cliquer sur une intervention | Ouvre la fiche détail de l'intervention | ☐ |

---

## 4. CALENDRIER — Vue Semaine

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 4.1 | Basculer sur "Semaine" | Vue semaine avec les 5-7 jours affichée | ☐ |
| 4.2 | Filtre Hainaut / Ardennes | Filtre fonctionnel sur la vue semaine | ☐ |
| 4.3 | Naviguer semaine suivante/précédente | Les interventions de la bonne semaine s'affichent | ☐ |
| 4.4 | Cliquer une intervention | Ouvre la fiche | ☐ |

---

## 5. CALENDRIER — Vue Mois

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 5.1 | Basculer sur "Mois" | Grille mensuelle affichée avec les jours | ☐ |
| 5.2 | Cliquer sur un jour avec des interventions | Détail du jour visible | ☐ |
| 5.3 | Naviguer mois suivant/précédent | Mise à jour correcte | ☐ |

---

## 6. INTERVENTION — Création

> ⚠️ Créer une intervention **TEST** dédiée, ne pas modifier les données existantes.

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 6.1 | Cliquer le bouton "+" du calendrier | Formulaire d'ajout s'ouvre | ☐ |
| 6.2 | Valider sans remplir les champs requis | Message d'erreur affiché | ☐ |
| 6.3 | Remplir tous les champs et sauvegarder | Intervention créée, visible dans le calendrier | ☐ |
| 6.4 | Vérifier que la carte apparaît avec la bonne sous-zone | Bande colorée correcte | ☐ |
| 6.5 | Créer une intervention avec mode **FAC** (encaissement sur place) | Statut/badge FAC visible | ☐ |
| 6.6 | Cocher des services dans le formulaire | Services enregistrés et visibles sur la fiche | ☐ |

---

## 7. INTERVENTION — Fiche détail

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 7.1 | Ouvrir la fiche d'une intervention existante | Tous les champs affichés correctement | ☐ |
| 7.2 | Modifier le statut (ex: En cours → Terminé) | Statut mis à jour, visible dans le calendrier | ☐ |
| 7.3 | Changer le montant / ajouter un item | Sauvegarde correcte | ☐ |
| 7.4 | Cocher / décocher un service | Persisté après fermeture et réouverture | ☐ |
| 7.5 | Supprimer l'intervention TEST créée en §6 | Intervention disparaît du calendrier | ☐ |

---

## 8. CLIENTS — Liste

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 8.1 | Ouvrir l'onglet Clients | Liste avec adresse en premier, chargement OK | ☐ |
| 8.2 | Chercher un client par nom | Filtrage en temps réel | ☐ |
| 8.3 | Chercher un terme inexistant | Liste vide ou "aucun résultat" | ☐ |
| 8.4 | Effacer la recherche | Tous les clients réapparaissent | ☐ |
| 8.5 | Cliquer sur un client | Ouvre la fiche client | ☐ |

---

## 9. CLIENTS — Création

> ⚠️ Créer un client **TEST** dédié.

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 9.1 | Cliquer "Ajouter un client" | Formulaire s'ouvre | ☐ |
| 9.2 | Valider sans nom | Erreur de validation affichée | ☐ |
| 9.3 | Remplir nom + adresse + CP + ville et sauvegarder | Client créé, visible dans la liste | ☐ |
| 9.4 | Vérifier que l'adresse s'affiche en premier dans la liste | Ordre correct | ☐ |

---

## 10. CLIENTS — Fiche

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 10.1 | Ouvrir la fiche du client TEST | Infos correctes | ☐ |
| 10.2 | Modifier le numéro de téléphone | Sauvegarde OK | ☐ |
| 10.3 | Ajouter un service depuis la fiche | Service ajouté à la liste du client | ☐ |
| 10.4 | Modifier le label d'un service | Persisté | ☐ |
| 10.5 | Supprimer un service | Retiré de la liste | ☐ |
| 10.6 | Voir les interventions passées du client | Liste cohérente | ☐ |
| 10.7 | Supprimer le client TEST | Retiré de la liste clients | ☐ |

---

## 11. FACTURATION

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 11.1 | Ouvrir l'onglet Facturation | Liste des factures chargée | ☐ |
| 11.2 | Cliquer "Nouvelle facture" | Formulaire de création s'ouvre | ☐ |
| 11.3 | Créer une facture TEST (client + montant) | Facture apparaît dans la liste | ☐ |
| 11.4 | Ouvrir la facture TEST | Détail correct | ☐ |
| 11.5 | Générer le PDF de la facture | PDF téléchargé / affiché sans erreur | ☐ |
| 11.6 | Supprimer la facture TEST | Retirée de la liste | ☐ |

---

## 12. PARAMÈTRES — Équipe (admin seulement)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 12.1 | Ouvrir Paramètres → Équipe | Liste des 16 employés visible | ☐ |
| 12.2 | Cliquer sur un employé | Fiche employé avec heures, zone, couleur | ☐ |
| 12.3 | Modifier la couleur d'un employé | Couleur mise à jour (pas de couleur déjà prise proposée) | ☐ |
| 12.4 | Créer un employé TEST | Compte créé dans Supabase Auth + visible dans la liste | ☐ |
| 12.5 | Reset password d'un employé | Confirmation envoyée sans erreur | ☐ |
| 12.6 | Supprimer l'employé TEST | Retiré de la liste | ☐ |

---

## 13. PARAMÈTRES — Tarifs (admin seulement)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 13.1 | Ouvrir Paramètres → Tarifs | Liste des taux horaires affichée | ☐ |
| 13.2 | Ajouter un tarif TEST (label + €/h) | Tarif ajouté | ☐ |
| 13.3 | Supprimer le tarif TEST | Retiré de la liste | ☐ |

---

## 14. PARAMÈTRES — Zones (admin seulement)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 14.1 | Ouvrir Paramètres → Zones | 19 sous-zones affichées (Hainaut + Ardennes) | ☐ |
| 14.2 | Vérifier que les villes sont assignées | Chaque sous-zone a ses villes | ☐ |
| 14.3 | Renommer une sous-zone TEST | Label mis à jour | ☐ |

---

## 15. PARAMÈTRES — Logs (admin seulement)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 15.1 | Ouvrir Paramètres → Logs | Historique d'actions chargé | ☐ |
| 15.2 | Scroller dans les logs | Pagination / scroll fonctionnel | ☐ |
| 15.3 | Vérifier que les actions des tests précédents apparaissent | Traçabilité OK | ☐ |

---

## 16. NOTIFICATIONS

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 16.1 | Ouvrir la cloche de notifications | Liste des notifications | ☐ |
| 16.2 | Marquer une notification comme lue | Badge count diminue | ☐ |
| 16.3 | Marquer tout comme lu | Badge disparaît | ☐ |
| 16.4 | Supprimer une notification | Retirée de la liste | ☐ |
| 16.5 | Supprimer toutes les notifications | Liste vide | ☐ |

---

## 17. PLANNING — Stats (admin seulement)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 17.1 | Ouvrir le planning d'une journée (bouton "Assigner") | Stats de capacité affichées (heures dispo vs planifiées) | ☐ |
| 17.2 | Filtrer par zone Hainaut vs Ardennes | Stats recalculées correctement | ☐ |
| 17.3 | Vérifier les stats sur une journée avec congé | L'employé en congé n'est pas compté | ☐ |

---

## 18. ACCÈS EMPLOYÉ (se connecter avec un compte employé)

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 18.1 | Login avec compte employé | Dashboard visible | ☐ |
| 18.2 | Vérifier que l'onglet Paramètres admin est absent OU restreint | Pas accès à Équipe / Créer employé | ☐ |
| 18.3 | Voir ses propres interventions dans le calendrier | Calendrier filtré sur ses RDV | ☐ |
| 18.4 | Tenter d'accéder à `/parametres/team` directement | Bloqué ou redirigé | ☐ |

---

## 19. RESPONSIVE / CROSS-PLATFORM

| # | Action | Résultat attendu | ✓ |
|---|--------|-----------------|---|
| 19.1 | Tester sur Chrome desktop (>1024px) | Layout desktop (sidebar login, grille large) | ☐ |
| 19.2 | Tester sur Chrome mobile (DevTools, 390px) | Layout mobile (card login, tab bar bas) | ☐ |
| 19.3 | Tester sur iPhone Simulator (Expo Go) | App native fonctionnelle | ☐ |
| 19.4 | Tester la connexion lente (throttle Network → Slow 3G) | Spinners affichés, pas de crash | ☐ |

---

## Bugs trouvés

| # | Écran | Description | Gravité |
|---|-------|-------------|---------|
| — | — | — | — |
