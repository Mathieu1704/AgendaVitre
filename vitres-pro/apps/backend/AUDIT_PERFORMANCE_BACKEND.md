# Audit performance backend

Date: 2026-04-27
Dernière mise à jour: 2026-05-09
Périmètre audité: `vitres-pro/apps/backend`

## Méthode

Audit statique du code backend FastAPI/SQLAlchemy.
Je n'ai pas exécuté de benchmark runtime, ni de `EXPLAIN ANALYZE` sur la base de prod.
Les constats ci-dessous sont donc des risques/pertes de perf déduits du code, pas des temps mesurés.

## Résumé exécutif

Les plus gros risques de lenteur étaient concentrés dans 3 zones. Les points P0 les plus urgents ont été corrigés. Il reste quelques points P1 ouverts non bloquants pour un usage à 16 utilisateurs.

## Points corrigés ✅

### `func.date(...)` dans planning.py — CORRIGÉ
- `planning.py` : tous les filtres `func.date(col) == date` remplacés par des bornes UTC (`col >= day_start AND col < day_end`, `range_start_utc / range_end_utc`)
- Les index b-tree sur `start_time`, `absences.start_date/end_date` sont maintenant utilisables

### N+1 sur `/api/logs` — CORRIGÉ
- `logs.py:27` : `selectinload(AuditLog.employee)` ajouté
- Réduit de ~201 requêtes à 2 pour une page de 200 logs

### `/api/notifications` non bornée — CORRIGÉ
- `notifications.py:23` : `.limit(100)` en place

### `absent_ids` en set — DÉJÀ OK
- `planning.py:66` : `absent_ids = {a.employee_id for a in absences}` — set natif, pas de régression

---

## Findings encore ouverts

### P1 - `func.date(...)` dans interventions.py — OUVERT
Référence: `app/routers/interventions.py:189`

```python
func.date(Intervention.start_time) == body.date,
```

Contexte: endpoint bulk-assign par sous-zone (admin only, appelé manuellement). Faible impact en pratique mais l'index n'est pas utilisé sur ce filtre.

Recommandation: remplacer par bornes UTC comme dans planning.py.

### P1 - `/api/interventions` peut charger tout le planning sans borne — OUVERT
Références: `app/routers/interventions.py:77-105`

Si `start` et `end` ne sont pas fournis, toute la table est renvoyée avec les relations (`client`, `employees`, `items`, `hourly_rate`). Le front envoie toujours une fenêtre aujourd'hui, mais pas de garde côté backend.

Recommandation: imposer une fenêtre par défaut (ex: ±3 mois) si `start`/`end` absents.

### P1 - Index SQL — ✅ CRÉÉS (2026-05-09)
Tous les index ont été créés sur Supabase prod via l'éditeur SQL.

### P2 - `range-stats` complexité Python — OUVERT (non bloquant)
Références: `app/routers/planning.py:173-247`

La structure de boucle `jours × employés × absences` est inchangée. Non bloquant à 16 employés et sur des plages courtes (semaine/mois). À surveiller si le nombre d'employés ou d'absences augmente significativement.

### P2 - Appels réseau bloquants sur création employé / reset mdp — OUVERT
Références: `app/routers/employees.py:55-61`, `app/routers/employees.py:154`

Supabase Admin SDK appelé en sync. Lent mais acceptable car ces endpoints sont rares (admin only, pas en refresh automatique).

---

## Endpoints les plus à risque (état actuel)

| Endpoint | Risque | Statut |
|----------|--------|--------|
| `/api/planning/range-stats` | Moyen (était très élevé) | Filtres SQL corrigés, boucles Python inchangées |
| `/api/interventions` | Moyen si appelé sans `start/end` | Front envoie toujours une fenêtre, pas de garde backend |
| `/api/logs` | Faible | N+1 corrigé |
| `/api/notifications` | Faible | limit(100) en place |
| `/api/clients` | Faible | Liste complète, acceptable à l'échelle actuelle |

## Conclusion

Les 3 quick wins P0 sont traités. Le backend est sain pour un lancement à 16 utilisateurs.
Les points restants (func.date interventions.py, index SQL, garde sur /api/interventions) sont recommandés pour une itération post-lancement.
