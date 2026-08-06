# Changelog

## [sprint-4.1-audit-complete] — 2026-08-06

Tag poussé sur origin : `sprint-4.1-audit-complete` (commit `e2ea09d`).

### Résumé
Livraison du Sprint 4.1 complet (3 PRs chaînées) : Audit Core foundation + atomicité des mutations métier (checkout/undo/adjust) + identité opérateur (PIN salé + restauration de session). 173 assertions E2E vertes, zéro régression sur Sprints 2.x/3.x/4.0.

### PRs fusionnées (via PR #1 sur `gh-pages`)

#### PR A — Audit Core foundation (`97081db`)
Audit event immuable IndexedDB + migration in-place des legacy DBs.

**Fondations**
- DB unifiée `acim` v2 puis v3 avec stores `products`, `sales`, `meta`, `audit_events`, `users`
- 6 indexes secondaires sur `audit_events` : `by_timestamp`, `by_type`, `by_actorId`, `by_sessionId`, `by_entityType`, `by_entityId`
- Schema `AuditEvent` v1 : id UUID, timestamp, type, actorId, sessionId, entityType, entityId, action, payload, previousState, newState, status
- 10 event types initiaux (passés à 11 avec `STOCK_ADJUSTED` en PR C)
- API `window._acimAudit.log()` (standalone) + `logInTx(tx, event)` (co-commit dans TX métier)
- Requêtes indexées : `getByEntity`, `getByType`, `getByActor`, `getBySession`, `getByTimeRange`, `count`, `first`, `last`
- Append-only strict : aucun update/delete/clear exposé en v1
- `sessionId` UUID généré au boot, persisté dans `meta` pour corrélation cross-boots
- Migration idempotente via flag meta `acim-migrated-v2` ; probe non-mutateur via `indexedDB.databases()`

**Tests** : `tests/run-e2e-audit.js` — 9 scénarios / 35 assertions.

---

#### PR B — Atomic business audit in checkout and undo (`e95d353`)
Couple les mutations métier (checkout, undo) à l'audit dans la même TX IndexedDB. Invariant P0 : toute mutation métier réussie produit son event audit dans la même TX ; si l'audit échoue, la TX entière aborte (métier + audit).

**Refactor `_finalizeSale`**
- Avant : `_persistSale` en TX#1, puis `_decrementStock` async fire-and-forget par item (TX#2..n, risque vente sans stock)
- Après : 1 TX unique `readwrite` sur `[sales, products, meta, audit_events]` ; tous les decrements, le `SALE_COMPLETED` et le `STOCK_DECREMENT` par item sont co-commités synchro dans le corps de la TX
- Rollback : `tx.onabort` décrémente `_ticketSeq` en mémoire

**Refactor `_undoLastSale`**
- Avant : cursor IDB `openCursor(null, 'prev')` puis attente confirmation UI asynchrone multi-secondes (TX morte à la fin du read en IDB)
- Après : split en 3 étapes — (1) TX read-only snapshot de la dernière vente, (2) modal UI de confirmation, (3) TX readwrite fraîche qui re-fetch by id, incrémente le stock, émet `STOCK_INCREMENT` + `SALE_CANCELLED` puis `sales.delete(saleId)`

**Tests** : `tests/run-e2e-audit-b.js` — 5 scénarios / 28 assertions (nominal, rollback audit, 5 sales+5 undo, kg chain, insufficient stock).

---

#### PR C — Operator identity + manual stock adjust + race fix (`eea8681`)
Dernier volet métier du Sprint 4.1 : ajoute l'identité opérateur (login PIN salé), l'ajustement manuel de stock atomique et corrige une race condition latente dans `_createUser`.

**Identité opérateur**
- Nouveau store `users` (bump `acim` v2 → v3) : `{id, salt, pinHash, name, role, active, createdAt}`
- PIN salé via SHA-256 `crypto.subtle` avec sel de 16 octets aléatoires par utilisateur
- `_hashPin` / `_verifyPin` synchrones-friendly (Promise mais utilisés dans flow UI async)
- `_loginWithPin` parcours tous les users actifs et resolve `no-match` si aucun ne correspond
- `_logout` vide l'acteur + retire `meta.acim-current-actor-id`
- `_restoreSessionIfAny` restore au boot depuis `meta` (trust local, offline-first, pas de re-auth en v1)
- `_refreshActorBadge` injecte un badge opérateur dans le POS header avec bouton login/logout
- Alimentation automatique de `audit_events.actorId` via `_acimAudit.setActor()` — zéro modification des callers métier existants (PR A/B)

**Stock adjustment manuel**
- `_adjustStock(barcode, delta, reason)` — point d'entrée unique pour ajustement manuel
- TX atomique sur `[products, audit_events]` ; garde `newStock >= 0` (sinon `tx.abort`)
- Enum `STOCK_ADJUST_REASON` frozen : `restock | inventory | loss | correction | manual`
- Émet `STOCK_ADJUSTED` avec `previousState.stockQty` + `newState.stockQty` + `payload.{delta, reason}`

**Race condition `_createUser` — fix critique**
- **Problème** : `tx.oncomplete` / `onerror` / `onabort` étaient installés **après** `getReq.onsuccess`. Dans la branche duplicate-id, `tx.abort()` était appelé avant l'installation de `tx.onabort` → l'événement abort se déclenchait sans listener, et la Promise ne résolvait jamais → timeout Playwright + garbage collection au bout de 10s
- **Fix** : les handlers `tx.oncomplete` / `tx.onerror` / `tx.onabort` sont installés **immédiatement après** la création de la transaction, **avant** toute requête IndexedDB. Conforme au contrat IndexedDB (installer les handlers avant d'émettre des opérations qui peuvent provoquer un abort)

**Surface de test exposée via `_acimTest`** (ajout `restoreSessionIfAny`)

**Tests** : `tests/run-e2e-audit-c.js` — 13 scénarios / 69 assertions :
- Tests 1-5 : ajustements positif / négatif / kg / stock insuffisant / rollback audit
- Test 6 (+complété) : actorId peuplé après login + vérification directe `users.{salt, pinHash}` base64 distincts
- Test 6b : PIN invalide (format + mauvais PIN + absence session meta)
- Test 7 : actorId null hors login
- Test 7b : restauration de session via vrai `page.reload()` (cache mémoire wiped)
- Test 8 : plusieurs opérateurs successifs (Alice then Bob then logout)
- Test 8b : stock extrême `-9999` sur stock=10 refuse atomiquement
- Test 8c (bonus) : `_hashPin` non-déterministe (2 hashes d'un même PIN → salts et pinHash différents)
- Test 8d (bonus) : `_verifyPin` true/false pair + garbage salt ne jette pas
- Test 9 : PAGEERROR check

**Adaptations runners de non-régression PR A/B**
- `tests/run-e2e-audit.js` : `indexedDB.open("acim", 2)` → `3` (7 occurrences) ; assertion `=== 4 stores`放宽 à `>= 4 stores` (le nouveau store `users` est accepté)
- `tests/run-e2e-audit-b.js` : `indexedDB.open("acim", 2)` → `3` (1 occurrence) ; retrait d'un BOM UTF-8 parasite en début de fichier

---

### Fichiers modifiés / ajoutés (+1028 / -11 sur 4 fichiers)

| Fichier | Action | Détail |
|---|---|---|
| `acim-caisse.js` | MODIFIED (+377/-2) | Bump v2→v3, store users, `_createUser/_loginWithPin/_logout/_restoreSessionIfAny/_adjustStock`, badge UI, race fix |
| `tests/run-e2e-audit-c.js` | NEW (+643) | 13 scénarios / 69 assertions |
| `tests/run-e2e-audit.js` | MODIFIED (+9/-8) | Montée v3 + assertion `>= 4 stores` |
| `tests/run-e2e-audit-b.js` | MODIFIED (+1/-1) | Montée v3 + retrait BOM |

## [sprint-4.0] — 2026-08-05

Tag pré-existant `2712f1d`.

- `tests/run-e2e-robust.js` (20 scénarios) : scan-panier-checkout atomique, 5 ventes+5 undo, 3 kg en chaîne, 5 décrements concurrents sur stock=2, vente sur stock=0 refusée, fallback catalog.json unreachable.
- Couvre les invariants P0 Sprint 4.0.

## Historique antérieur

Voir `git log --oneline` pour les sprints 2.x, 3.x et le travail pré-audit.
