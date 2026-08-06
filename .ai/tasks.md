# Tasks — Prochaines P0 / P1 / P2

> Source de priorité : `docs/PR_C_PLAN.md` §11 + §12 (Hors scope PR C, suite logique).
> État : Sprint 4.1 livré le 2026-08-06, working tree propre.

## P0 — immédiat (cette session, optionnel)

- [ ] **Committer la doc restante** : `docs/PR_C_PLAN.md` (actuellement untracked) + `.ai/current_state.md` + `.ai/changelog.md` + `.ai/tasks.md`. Un seul commit `docs(sprint-4.1): finalize plan + ai state` dans `gh-pages` directement (pas de PR pour de la doc).

---

## P1 — prochain sprint (Sprint 4.2 / 5.x)

### PR D — Sync Supabase (Sprint 4.2)
Source : PR_C_PLAN.md §11 "Sync Supabase → PR D (Sprint 4.2)".

- [ ] Queue offline-first des `audit_events` non-encore-poussés (champ `syncedAt: null` ou table `outbox`)
- [ ] Worker de push périodique vers Supabase (HTTP keepalive, retry exponentiel, conflits last-write-wins via `updatedAt`)
- [ ] Auth Supabase (Postgres RLS sur `actorId` + sur `storeId`)
- [ ] Multi-postes : la queue offline se syncde depuis chaque poste, déduplication via `audit_events.id` (UUID) en clé primaire côté Supabase
- [ ] Tests E2E : mock réseau + validation queue/flush/retry
- [ ] **Invariants à tenir** : si sync échoue, métier continue (offline-first) ; pas de double-push (idempotence via UUID) ; pas de mutation locale rétro-convertie

### PR E — Backup/restauration testable (Sprint 4.2)
Source : PR_C_PLAN.md §12 "PR E : backup/restauration testable".

- [ ] Export DB `acim` en JSON (tous stores) — bouton UI dans le pos header
- [ ] Restauration depuis JSON avec validation de schéma + bump version éventuel
- [ ] Test E2E : export → wipe IDB → reimport → vérifier intégrité événementielle (count + derniers events)
- [ ] Documenter le format d'export (utilisé aussi pour migrations agressives futures)

### Sécurité / UX identité opérateur (PR F pré-Sprint 5.x)
Source : PR_C_PLAN.md §11.

- [ ] Lockout / rate-limit login (après N PIN erronés, blocage X secondes)
- [ ] Recovery PIN oublié — flow "manager-approved reset" (manager auth + reset)
- [ ] UI complète gestion users : liste, edit name, soft-delete (active=false), create avec rôle
- [ ] Permissions / roles : manager approval flow pour `_adjustStock` > seuil (ex: delta > 10) et pour undo
- [ ] Re-auth au boot optionnel (configurable par flag `meta.acim-require-boot-auth`)

### Doc
- [ ] **Mettre à jour `docs/DATA_MODEL_CURRENT.md` pour le store `users` v3** (actuellement dit "aucune notion d'opérateur/Caissier ni de PIN")
- [ ] Ajouter schéma `users` + modèle de session + invariant `actorId`
- [ ] Documenter la politique PIN (sel SHA-256, 4-8 digits, pas de lockout v1 — assumption mono-poste)
- [ ] Documenter le flow de restauration de session au boot (trust local)

---

## P2 — Sprint 5.x

### UI audit admin
- [ ] Timeline `audit_events` filtrable par type/actor/entity/date
- [ ] Export CSV/JSON avec filtres
- [ ] Dashboard d'activité (top actors, ventes/jour, anomalies)

### Hash chain (tamper-evidence)
- [ ] `audit_events[n].prevHash = audit_events[n-1].hash` ; `hash = SHA-256(canonicalize(event) || prevHash)`
- [ ] Verification pass au boot (any tampering flags a SYSTEM_ERROR event)
- [ ] Multi-postes : la hash chain est locale par poste, sync Supabase stocke les hash pour audit forensique global

### Multi-postes
- [ ] Auth centralisée (Supabase Auth ou OIDC externe)
- [ ] Config `storeId` au boot + tag sur chaque event
- [ ] Conflits de stock gérés par `last_updated` (LWW) ou CRDT si besoin

---

## Backlog technique (non priorisé)

- [ ] CI GitHub Actions : 6 runners E2E Playwright en matrix sur `push` à `gh-pages`
- [ ] Pré-commit hooks : `node --check` sur tous `.js` du repo (détecte syntax errors avant push)
- [ ] Refactor `acim-caisse.js` (5105 lignes) en modules ES pour préparer la maintenance multi-contributeurs
- [ ] Migration `electron-main.js` pour dernier Electron LTS
- [ ] Tests de charge : 10k audit_events → bench queries indexées + perf render UI

---

## Comment ajouter une tâche

1. Si P0/P1 : ajoute dans la bonne section ci-dessus avec contexte (source : quel PR plan, quel invariant)
2. Si Backlog : ajoute sans priorité, juste une description d'une ligne + bénéfice attendu
3. Toujours préciser si la tâche casse ou non l'invariant P0 (aucune mutation métier sans audit atomique)
