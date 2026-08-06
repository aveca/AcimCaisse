# État courant du projet

> Dernière mise à jour : 2026-08-06 (post-merge Sprint 4.1)

## Branche active

- **Branche** : `gh-pages` (branche de déploiement principale du repo)
- **HEAD** : `e2ea09d Merge pull request #1 from aveca/feat/pr-c-audit-hardening`
- **Tag jalon** : `sprint-4.1-audit-complete` (poussé sur origin)

## situSprint livré

### Sprint 4.1 — Audit Core + Atomic mutations + Operator identity

Livré sur `gh-pages` via PR [#1](https://github.com/aveca/AcimCaisse/pull/1) le 2026-08-06.

3 PRs fusionnées en une seule PR (chaînage de dépendances A → B → C) :

| PR | Titre | Commit | Tests |
|---|---|---|---|
| A | feat(audit): add IndexedDB audit core and legacy DB migration | `97081db` | 35 pass |
| B | feat(audit): atomic business audit integration in checkout and undo | `e95d353` | 28 pass |
| C | fix(audit): cover PR C invariants + fix _createUser tx.abort race | `eea8681` | 69 pass |
| — | Merge PR #1 | `e2ea09d` | — |

### Couverture E2E totale (post-merge,	validée 2026-08-06 00:28 UTC)

| Suite | Résultat | Statut |
|---|---|---|
| `run-e2e.js` (smoke Sprint 2.x) | 13/13 | ✅ |
| `run-e2e-robust.js` (Sprint 4.0) | 20/20 | ✅ |
| `run-e2e-sprint3.js` | 8/8 | ✅ |
| `run-e2e-audit.js` (PR A) | 35/35 | ✅ |
| `run-e2e-audit-b.js` (PR B) | 28/28 | ✅ |
| `run-e2e-audit-c.js` (PR C) | 69/69 | ✅ |
| **Total** | **173 assertions vertes** | ✅ |

## Capacités fonctionnelles actuelles

### Fondations audit (PR A + B + C)
- DB unifiée IndexedDB `acim` v3 avec 5 stores : `products`, `sales`, `meta`, `audit_events`, `users`
- 6 indexes secondaires sur `audit_events` (timestamp, type, actorId, sessionId, entityType, entityId)
- `audit_events` append-only strict (aucun update/delete/clear exposé en v1)
- 11 event types v1 : SALE_CREATED, SALE_COMPLETED, SALE_CANCELLED, STOCK_DECREMENT/INCREMENT/ADJUSTED, SESSION_START/END, SYSTEM_ERROR, MIGRATION_COMPLETED
- Checkout (`_finalizeSale`) et undo (`_undoLastSale`) transactionnels sur `[sales, products, meta, audit_events]` — rollback atomique si audit échoue
- `_adjustStock` manuel transactionnel sur `[products, audit_events]` avec contrôle `newStock >= 0`

### Identité opérateur (PR C)
- Store `users` v3 : `{id, salt, pinHash, name, role, active, createdAt}`
- PIN salé via SHA-256 (`crypto.subtle`) — 16 octets de sel aléatoire par utilisateur
- Login `_loginWithPin` + logout `_logout` + restauration session `_restoreSessionIfAny` au boot
- Alimentation automatique de `audit_events.actorId` depuis la session courante (zéro modification des callers métier)
- Badge opérateur UI dans le POS header (`_refreshActorBadge`)
- Race condition `_createUser` corrigée : handlers `tx.oncomplete/onerror/onabort` installés **avant** `getReq.onsuccess` pour éviter la perte d'événement `abort` sur doublon

### Invariants P0 tenus
- ✅ Toute mutation métier réussie produit son event audit dans la même TX IDB
- ✅ Si l'audit échoue, la TX entière aborte (métier + audit) — preuve par tests 5 (PR C) + 2 (PR B)
- ✅ `actorId` dans `audit_events` = `users.id` immuable (jamais `name`)
- ✅ Aucun ajustement de stock négatif possible (garde `newStock >= 0`)
- ✅ Historique audit immuable (append-only strict, pas d'API mutateur exposée)

## Environnement

- **Runtime** : Electron 43.2 / navigateur (HTTPS ou localhost requis pour `crypto.subtle`)
- **Stockage** : IndexedDB `acim` v3 (offline-first, mono-poste)
- **Tests** : Playwright 1.40 + server local `http://localhost:8765` via `tests/serve.js`
- **CI** : non configurée (pas de `.github/workflows/`)
- **Pas de stack LLM locale** (Ollama / LiteTTM désinstallés le 2026-04-17)

## Risques connus / dette technique

| Risque | Mitigation actuelle | P1/P2 ? |
|---|---|---|
| Pas de lockout/rate-limit login PIN | Accepté en v1 (offline, mono-poste). Sel rend rainbow impossible. | P1 |
| Pas de recovery PIN oublié | Documenté. Manager-approved reset prévu Sprint 5.x. | P1 |
| `docs/DATA_MODEL_CURRENT.md` non mis à jour pour le store `users` v3 | Doc dit encore "aucune notion d'opérateur/PIN". | P1 (doc) |
| Pas de sync Supabase | Offline-first v1. Queue + push prévu PR D (Sprint 4.2). | P1 |
| Pas de hash chain | Append-only immuable mais pas tamper-evident au-delà d'IDB. | P2 |
| Pas d'UI admin users / d'UI audit timeline | v1 a juste badge + modal login. | P1 |
| Pas de backup/restauration testable | Prévu PR E (Sprint 4.2). | P1 |

## Snapshot repo

- 6 runners E2E Playwright dans `tests/`
- 4 docs de plan dans `docs/` (PR_A_PLAN.md, PR_B_PLAN.md, PR_C_PLAN.md, DATA_MODEL_CURRENT.md)
- 1 fichier de plan non commité à date : `docs/PR_C_PLAN.md` (à committer)
