# Tasks — Prochaines P0 / P1 / P2

> Source de priorité : `docs/PR_C_PLAN.md` §11 + §12 (Hors scope PR C, suite logique) + incident du 2026-08-06 (commits UX externes non-validés).
> État : Sprint 4.1 livré + correctif UX poussé le 2026-08-06, working tree propre. Toutes les 6 suites E2E vertes (173 assertions).

## P0 — immédiat (cette session, optionnel)

- [x] **Committer la doc restante** : `docs/PR_C_PLAN.md` + `.ai/*` — fait dans `bf206e8` (avalé par c27b50d mais présent).
- [x] **Mettre à jour `docs/DATA_MODEL_CURRENT.md` pour le store `users` v3** — fait (et étendu pour couvrir `audit_events`, modèle de session, flows mutation Sprint 4.1).
- [ ] **CI GitHub Actions sur `gh-pages`** (escaladé suite à l'incident du 2026-08-06) — voir Backlog ci-dessous pour le contenu. Sans CI, n'importe quel commit direct peut casser sans alerte et le jalon `sprint-4.1-audit-complete` n'est protégé que par discipline manuelle.

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
- [x] ~~Mettre à jour `docs/DATA_MODEL_CURRENT.md` pour le store `users` v3~~ — fait (commit mélangé dans c27b50d par accident, mais contenu présent)
- [ ] Backporter les doc updates dans le changelog si jamais on split c27b50d
- [ ] Documenter la politique PIN (sel SHA-256, 4-8 digits, pas de lockout v1 — assumption mono-poste)
- [ ] Documenter le flow de restauration de session au boot (trust local)

### Process / Sécurité repo
- [ ] **Branch protection rule sur `gh-pages`** : interdire les push directs sauf pour le bot/owner via PR. Mettre en place via GitHub settings.
- [ ] **Pre-commit hook local** : `node --check` sur tous `.js` du repo (détecte syntax errors avant push)
- [ ] **CONTRIBUTING.md** : formatter qu'aucun commit direct sur `gh-pages` n'est admis sans PR + validation E2E

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

### Multi-postes (suite)
- [ ] Auth centralisée (Supabase Auth ou OIDC externe)
- [ ] Config `storeId` au boot + tag sur chaque event
- [ ] Conflits de stock gérés par `last_updated` (LWW) ou CRDT si besoin

---

## Backlog technique

- [ ] **CI GitHub Actions** (escaladé P0 après l'incident c27b50d) :
  - Workflow sur `push` à `gh-pages` + sur PR
  - Matrix : Playwright + Node 18
  - Steps : `npm ci` → `node tests/serve.js &` (background) → 6 runners lancés en série (`run-e2e.js`, `run-e2e-robust.js`, `run-e2e-sprint3.js`, `run-e2e-audit.js`, `run-e2e-audit-b.js`, `run-e2e-audit-c.js`)
  - Fail-fast : n'importe quel runner en échec → PR/commit bloqué (ou alerte si push direct autorisé)
  - Upload screenshots en artifacts pour debug
- [ ] Refactor `acim-caisse.js` (5100+ lignes désormais) en modules ES pour préparer la maintenance multi-contributeurs
- [ ] Migration `electron-main.js` pour dernier Electron LTS
- [ ] Tests de charge : 10k audit_events → bench queries indexées + perf render UI

---

## Comment ajouter une tâche

1. Si P0/P1 : ajoute dans la bonne section ci-dessus avec contexte (source : quel PR plan, quel invariant)
2. Si Backlog : ajoute sans priorité, juste une description d'une ligne + bénéfice attendu
3. Toujours préciser si la tâche casse ou non l'invariant P0 (aucune mutation métier sans audit atomique)
