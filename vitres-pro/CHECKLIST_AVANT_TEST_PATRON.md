# Checklist avant test patron — LVM Agenda

> Dernière mise à jour : 2026-04-02

---

## ✅ Déjà OK — rien à faire

- `.env` gitignorés — aucun secret exposé dans le repo
- 53 endpoints backend, tous authentifiés
- Rate limiting (slowapi, 200 req/min) + CORS configuré
- `console.log` nettoyés côté mobile
- Session persistante 60 jours — employés jamais déconnectés involontairement
- EAS configuré pour build APK (`eas.json` profil `preview`)
- Guide build APK disponible (`GUIDE_BUILD_APK.md`)

---

## 🔴 BLOQUANT — À faire avant le test

### Web — UI/UX
- [ ] Audit et corrections UI web (voir `AUDIT_WEB.md` à créer)

### Mobile — Vérifications
- [ ] Confirmer visuellement la tab bar custom (pill slide + icon scale)
- [ ] Vérifier le badge alertes toujours visible
- [ ] Test manuel des flows critiques sur vrai device :
  - Login → Dashboard
  - Créer intervention → assigner employé → changer statut
  - Fiche client → historique
  - Logs → pagination
  - Réglages → zones, taux, équipe

### Build & Accès
- [ ] Build APK Android : `eas build --profile preview --platform android`
- [ ] Vérifier compte admin Maxime Berdoux (`Max.berdoux@gmail.com`) dans Supabase → `role: admin`
- [ ] "Réveiller" Railway avant la démo : ouvrir `https://api.lvmagenda.be` (cold start ~30s)

---

## 🟡 RECOMMANDÉ — Avant mise en production large (pas bloquant pour le test)

| Tâche | Effort estimé |
|---|---|
| Tests automatisés (Jest mobile / pytest backend) | 3-5 jours |
| Sentry — error tracking production | 2h |
| Logging structuré backend | 2h |
| Error boundary React (écran de récupération crash) | 1h |
| Rate limits par endpoint (endpoints coûteux) | 2h |

---

## Notes déploiement

- **Backend** : Railway, redéploie automatiquement sur `git push`
- **Web** : Expo Web, hébergé sur Vercel (`https://agenda-vitre.vercel.app`)
- **Mobile** : APK via EAS Build → distribué manuellement au patron
- **URL API prod** : `https://api.lvmagenda.be`
