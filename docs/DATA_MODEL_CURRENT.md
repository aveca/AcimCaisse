# AcimCaisse — Data Model Current State

> Mise à jour post-Sprint 4.1 (2026-08-06).
> Capture depuis `acim-caisse.js` + `acim-audit.js`.
> **100% IndexedDB navigateur** (offline-first, mono-poste). Pas de SQLite/Drift/Supabase à ce stade.

## Glossaire

- **DB** = IndexedDB database. Chaque DB a son propre numéro de version.
- **Object store** = équivalent d'une table (key-value, no foreign keys, pas de JOIN).
- **keyPath** = champ servant de clé primaire.
- **Migration runtime** = patchs JS exécutés au boot sur les documents existants (pas de ALTER TABLE — IDB n'en a pas).

## Enumération des bases IndexedDB

### Base courante — `acim` (v3, unifiée)

Depuis PR A (Sprint 4.1), une **base unifiée `acim`** (version 3) regroupe tous les stores applicatifs. La migration in-place au boot lit les anciennes bases legacy (`acim-meta`, `acim-catalog`, `acim-sales`) puis les supprime une fois la copie terminée (idempotente via le flag meta `acim-migrated-v2`).

| Store | keyPath | Indexes | Rôle |
|---|---|---|---|
| `products` | `barcode` | — | Catalogue produits + stock |
| `sales` | `id` (autoIncrement) | — | Historique des ventes validées |
| `meta` | `key` | — | Clés/valeurs système (seq, flags, session) |
| `audit_events` | `id` (UUID) | `by_timestamp`, `by_type`, `by_actorId`, `by_sessionId`, `by_entityType`, `by_entityId` | Journal d'audit append-only strict |
| `users` | `id` (string) | `by_active` | Employés enregistrés (login PIN salé) — ajouté en v3 (PR C) |

### Bases legacy (pré-Sprint 4.1, supprimées après migration)

| DB | Version | Store | Devenu |
|---|---|---|---|
| `acim-meta` | 1 | `meta` | → `acim.meta` |
| `acim-catalog` | 1 | `products` | → `acim.products` |
| `acim-sales` | 1 | `sales` (autoIncrement) | → `acim.sales` (autoIncrement reset à max+1) |

La migration est **idempotente** : un flag `acim-migrated-v2` dans `acim.meta` empêche la recopie. Un probe non-mutateur via `indexedDB.databases()` détecte l'absence des legacy DB sans les recréer.

### Détail `acim.meta`

Paires `{key, value, ...}`. Clés connues :

| key | type | Rôle | Origine |
|---|---|---|---|
| `acim-bc-seq` | number | Prochain numéro de code-barres interne (`ACIM-XXXX`) | Hérité de `acim-meta` |
| `acim-ticket-seq` | number | Prochain numéro de ticket | Hérité de `acim-meta` |
| `acim-backup-imported-v1` | boolean | Empêche la réimport du backup embarqué | Hérité de `acim-meta` |
| `schema-version` | number | Version du schéma produits courant (actuellement `4`) | Hérité de `acim-catalog` |
| `acim-migrated-v2` | boolean | Flag de idempotence migration legacy→unifiée | PR A |
| `acim-audit-session-id` | string (UUID) | `sessionId` courant (généré au boot, persisté pour corrélation cross-boots) | PR A — `acim-audit.js:60` |
| `acim-audit-actor-id` | string\|null | Cache interne de `_actorId` pour le service audit (persisté par `setActor()` mais source de vérité = `acim-current-actor-id` ci-dessous) | PR A — `acim-audit.js:61` |
| `acim-current-actor-id` | string | **Session opérateur courante** — id du user loggé. Login l'écrit (avec `loginAt`), logout le supprime, boot le lit pour `_restoreSessionIfAny()` | PR C — `acim-caisse.js:1859` |

> Note : deux clés audit/actor coexistent. `acim-audit-actor-id` est un cache interne au module audit (PR A, pouvait être null en v1). `acim-current-actor-id` est la clé de session applicative (PR C, alimentée par `_loginWithPin`). En pratique depuis PR C, `_loginWithPin` écrit `acim-current-actor-id` et appelle `_acimAudit.setActor(u.id)` qui met à jour `_actorId` en mémoire (le cache `acim-audit-actor-id` est secondaire).

### Détail `acim.products`

Chaque document = un produit. **keyPath: `barcode`** (string).

Schéma observé (champs effectivement écrits par le code) :

| Champ | Type | Défaut | Migration | Notes |
|---|---|---|---|---|
| `barcode` | string | — | — | Clé primaire. Ex: `"ACIM-2000"` ou EAN externe |
| `name` | string | — | — | |
| `sale_price_cents` | number | — | — | Prix unitaire en centimes |
| `category` | string | — | — | Une des 12 CATS |
| `stockQty` | number | 0 | v1→v4 sanitize | **Décimal autorisé** pour produits pesés |
| `unit` | string | `"unit"` | v1→v2 | `unit` / `kg` |
| `unitType` | string\|null | null | v1→v2 | `kg` / `g` / `L` / `unit` |
| `pricePerUnit` | number\|null | null | v1→v2 | Prix/kg en centimes |
| `low_stock_threshold` | number | 5 | v2→v3 | |
| `expiry_date` | string\|null | null | v2→v3 | |
| `source` | string | `"migration"` | v2→v3 | Origine du produit |
| `last_updated` | number | `Date.now()` | v3→v4 | Timestamp ms |

**Migrations JS** (`acim-caisse.js:119-143`) :

- v1 → v2: ajoute `unitType`, `pricePerUnit`, `unit`
- v2 → v3: ajoute `low_stock_threshold`, `expiry_date`, `source`
- v3 → v4: ajoute `last_updated`, sanitize `stockQty`

### Détail `acim.sales`

Document écrit par `_finalizeSale()` (depuis PR B, dans la même TX atomique que les decrements stock et l'event `SALE_COMPLETED`) :

```js
{
  ticketNumber: number,            // ex: 100, 101...
  timestamp: number,              // Date.now() au moment de la validation
  isoTime: string,                 // new Date().toISOString()
  items: [                         // un élément par ligne de panier
    {
      name: string,
      price: number,               // priceCents par ligne (peut être 0 pour pesé)
      barcode: string,
      cat: string,
      weight: number | null,
      unitType: "kg" | "g" | "L" | "unit" | null,
      pricePerUnit: number | null,
      discountCents: number,
      qty: number                   // défaut 1 ; >1 pour "× N"
    }
  ],
  totalCents: number,
  discountCents: number,            // remise globale du ticket
  payments: [                       // typiquement 1, ou 2 en mixte
    { method: "especes" | "cb",
      amountCents: number,
      tenderedCents: number,
      changeCents: number }
  ],
  itemCount: number
}
```

**Clé : `id` autoIncrement.** Aucun index secondaire. Pas de relation au ticket stocké ailleurs.

### Détail `acim.audit_events` (PR A)

**Append-only strict** : aucune API publique d'update/delete/clear n'est exposée en v1. L'écriture utilise `add()` (pas `put()`) — échec si la clé existe déjà (immutabilité garantie par IDB lui-même).

Schema de l'enveloppe commune (build par `_buildEvent()`, `acim-audit.js:144-161`) :

```js
{
  id:            string (UUID),           // clé primaire — immuable
  schemaVersion: number,                  // actuellement 1
  timestamp:     number (ms),             // Date.now()
  type:          EventType,               // voir enum ci-dessous
  actorId:       string | null,           // users.id immuable ; null si pas de login
  sessionId:     string (UUID),           // généré au boot, persisté dans meta
  entityType:    EntityType,               // "sale" | "product" | "stock" | "session" | "system"
  entityId:      string | null,           // ex: ticketNumber, barcode, userId
  action:        Action,                   // "create" | "complete" | "cancel" | ...
  payload:       object,                   // détails spécifiques à l'event, libre
  previousState: object | null,           // snapshot avant mutation
  newState:      object | null,           // snapshot après mutation
  status:        "COMMITTED" | "ROLLED_BACK"
}
```

**Event types v1** (`acim-audit.js:18-29`) :

| Type | Émis par | entityId typique | payload typique |
|---|---|---|---|
| `SALE_CREATED` | (réservé — pas émis en v1, future PR) | `String(ticketNumber)` | ticket draft |
| `SALE_COMPLETED` | `_finalizeSale` (PR B) | `String(ticketNumber)` | `{ticket, itemCount, totalCents, discountCents, paymentMethods}` |
| `SALE_CANCELLED` | `_undoLastSale` (PR B) | `String(saleId)` | `{originalTicket, items}` |
| `STOCK_DECREMENT` | `_finalizeSale` (PR B, une fois par item) | `barcode` | `{amount, weight, unitType}` + `previousState/newState {stockQty}` |
| `STOCK_INCREMENT` | `_undoLastSale` (PR B, une fois par item) | `barcode` | `{amount, weight, unitType}` + `previousState/newState {stockQty}` |
| `STOCK_ADJUSTED` | `_adjustStock` (PR C) | `barcode` | `{delta, reason}` + `previousState/newState {stockQty}` |
| `SESSION_START` | (réservé — pas émis en v1) | `sessionId` | `{bootTime}` |
| `SESSION_END` | (réservé — pas émis en v1) | `sessionId` | `{endTime}` |
| `SYSTEM_ERROR` | (réservé — pas émis en v1) | `null` | `{error}` |
| `MIGRATION_COMPLETED` | `_maybeMigrateLegacy` (PR A) | `"acim-v2"` | `{copied, legacyDBsRemoved}` |

**Indexes secondaires** (6) :
- `by_timestamp` — range queries chronologiques
- `by_type` — `getByType(type)`
- `by_actorId` — `getByActor(actorId)` (filtre par opérateur)
- `by_sessionId` — `getBySession(sId)` (corrélation cross-boots)
- `by_entityType` — utilisé par `getByEntity(entityType, entityId)` (combiné avec `by_entityId`)
- `by_entityId` — voir ci-dessus

**API publique** (`window._acimAudit`) :
- `log(partial)` — écriture standalone (hors TX métier)
- `logInTx(tx, partial)` — écriture co-transactionnelle (utilisée par `_finalizeSale`, `_undoLastSale`, `_adjustStock`)
- `getByEntity`, `getByType`, `getByActor`, `getBySession`, `getByTimeRange`, `count`, `first`, `last`
- `setActor(actorId)` — met à jour l'actorId courant (_in-memory + meta_)
- `getActorId()` — getter sync

### Détail `acim.users` (PR C)

Stocké dans la DB unifiée `acim` v3. **Append-friendly** : on peut `put` un user (idempotent par `id`), mais il n'y a pas d'API de `delete` exposée en v1 (soft-delete via `active=false`).

**Schema** :

```js
{
  id:        string,        // ex: "u001" — IMMUABLE. Jamais réassigné.
                           // Utilisé comme actorId dans audit_events.
  salt:      string,        // base64 de 16 octets aléatoires (crypto.getRandomValues).
                           // Unique par utilisateur. Empêche le bruteforce par rainbow table.
  pinHash:   string,        // base64 de SHA-256(saltBytes || utf8(pin)).
                           // Jamais comparé directement sans sel.
  name:      string,        // "Alice" — modifiable. N'est JAMAIS utilisé comme
                           // identifiant dans audit_events (uniquement actorId = id).
  role:      "cashier" | "manager",   // v1: seulement pour futur manager approval
  active:    boolean,       // soft-delete sans perte historique audit
  createdAt: number
}
```

**Index secondaire** : `by_active` (unique: false) — permet `users.where(active=true)`.

**Invariant d'identité** (verrouillé) :
- `audit_events.actorId` = `users.id`, immuable.
- `users.name` modifiable librement ; les événements déjà émis ne sont **jamais** rétro-mis-à-jour (append-only).
- Aucun event audit ne contient `name` comme identifiant. Seul `actorId` est persisté dans `audit_events.actorId`.

## Modèle de session opérateur (PR C)

### Cycle login → opération → logout

```
boot → _restoreSessionIfAny()
        └─ lit meta.acim-current-actor-id
        └─ si présent + user toujours active:
           _acimAudit.setActor(userId)
           actor disponible pour tous les prochains events
        └─ sinon: actorId null (mode "open")

login  → _loginWithPin(pin)
         └─ parcours users actifs, _verifyPin(pin, u.salt, u.pinHash)
         └─ sur match:
            _acimAudit.setActor(u.id)
            meta.put({key:"acim-current-actor-id", value:u.id, loginAt:Date.now()})
         └─ sur no-match: pas d'écriture meta, acteur reste null

logout → _logout()
         └─ _acimAudit.setActor(null)
         └─ meta.delete("acim-current-actor-id")
```

### Politique de sécurité PIN (v1)

- **Algorithme** : SHA-256 via `crypto.subtle.digest` (natif navigateur, pas de dépendance).
- **Sel** : 16 octets aléatoires par utilisateur via `crypto.getRandomValues(new Uint8Array(16))`, stocké base64 dans `users.salt`.
- **Taille PIN** : 4 à 8 chiffres. Validation regex `/^\d{4,8}$/`.
- **Pas de lockout / rate-limit** en v1 (offline-first, mono-poste). Le sel rend les attaques par rainbow table impossibles ; seule l'attaque exhaustive par utilisateur reste possible, ce qui est acceptable sur poste isolé.
- **Pas de recovery PIN oublié** en v1. Une future PR implémentera "reset PIN si manager-approved".
- **Pas de re-auth au boot** : si `meta.acim-current-actor-id` existe, l'utilisateur est restauré sans redemander le PIN (trust local, offline-first).
- **Prérequis crypto.subtle** : HTTPS ou localhost requis. `tests/serve.js` tourne sur http://localhost — OK. Prod via https://*.netlify.app — OK.

## Flux mutation stock actuel (Sprint 4.1)

### `_finalizeSale(payments)` — `acim-caisse.js` (PR B)

**TX unique `readwrite` sur `[sales, products, meta, audit_events]`**. Tous les decrements, le `SALE_COMPLETED` et les `STOCK_DECREMENT` par item sont co-commités synchro dans le corps de la TX (pas d'`await`, pas de fire-and-forget).

Sequence :
1. `put(ticketSeq)` dans `meta`
2. `put(sale)` dans `sales` (autoIncrement id)
3. Pour chaque item du panier : `get(product)` → si stock futur < 0, `tx.abort()`. Sinon `put(product)` avec `stockQty -= amount` + `logInTx(tx, STOCK_DECREMENT, ...)`.
4. `logInTx(tx, SALE_COMPLETED, ...)` avec entityId = `String(ticketNumber)`
5. `tx.oncomplete` → showReceipt + `_broadcastClear` + `_myCart = []`
6. En cas d'échec audit : `tx.onabort` → décrémente `_ticketSeq` en mémoire + renvoie `{ok:false, reason:"audit-error"}`

**Invariant P0 tenu** : si l'audit échoue, la TX entière aborte (vente + stock + audit). Aucune mutation partielle.

### `_undoLastSale(...)` — `acim-caisse.js` (PR B)

Refactor en 3 étapes pour éviter le piège cursor IDB (TX morte à la fin du read) :

1. **TX read-only sur `sales`** → snapshot dernière vente (par `id` store)
2. **Modal UI de confirmation** (multi-secondes, hors TX)
3. **TX readwrite fraîche sur `[sales, products, audit_events]`** :
   - `sales.get(saleId)` (re-fetch by id — ne pas compter sur le snapshot)
   - pour chaque item : `products.get(barcode)` → `put(stock += amount)` + `logInTx(STOCK_INCREMENT, ...)`
   - `logInTx(SALE_CANCELLED, ...)`
   - `sales.delete(saleId)`
   - `tx.oncomplete` → resolve

### `_adjustStock(barcode, delta, reason)` — `acim-caisse.js` (PR C)

Point d'entrée unique pour ajustement manuel (hors checkout/undo).

- **TX atomique sur `[products, audit_events]`** en `readwrite`.
- Garde : `newStock = currentStock + delta` ; si `newStock < 0` → `tx.abort()` + return `{ok:false, reason:"stock:N" ou "stock-kg:N"}`.
- Sinon : `products.put({…, stockQty: newStock, last_updated: Date.now()})` + `logInTx(STOCK_ADJUSTED, ...)`.
- `reason` obligatoire, enum frozen `STOCK_ADJUST_REASON = { RESTOCK, INVENTORY, LOSS, CORRECTION, MANUAL }`.
- `previousState.stockQty` + `newState.stockQty` toujours présents (jamais null pour cet event).
- Si `logInTx` throw → TX aborte (atomicité garantie, même pattern que PR B).

**Invariant P0 tenu** : aucune mutation de stock sans event audit atomique.

## Canaux de sync cross-tab / cross-window

| Canal | Type | Usage | Code |
|---|---|---|---|
| `acim-customer-display` | BroadcastChannel | Sync panier → onglet "customer display" séparé | `acim-caisse.js:676`, `acim-voice-flash.js:263-266` |

**Pas de canal de sync audit** en v1. Si on veut qu'un autre onglet réagisse aux events, à ajouter en Sprint 5.x (EventSource ou listeurs sur `audit_events` via BroadcastChannel).

## Ce qui existe désormais (Sprint 4.1 livré)

- ✅ Système d'identité opérateur : store `users` v3 avec PIN salé SHA-256.
- ✅ Journal d'audit immuable : `audit_events` append-only strict, 6 indexes secondaires, 10 event types v1.
- ✅ Session opérateur persistée : login/logout + restauration au boot depuis `meta`.
- ✅ Invariant P0 : toute mutation métier (`_finalizeSale`, `_undoLastSale`, `_adjustStock`) est co-transactionnelle avec son event audit.
- ✅ Atomicité multi-store : une seule TX IDB par opération métier (checkout, undo, adjust).
- ✅ Migration legacy → unifiée idempotente (`acim-migrated-v2`).

## Ce qui n'existe PAS (encore)

- ❌ File d'attente sync (pas de `sync_queue`) — prévu PR D (Sprint 4.2).
- ❌ Connexion Supabase — prévue PR D (Sprint 4.2).
- ❌ Backup/restauration testable — prévu PR E (Sprint 4.2).
- ❌ UI audit timeline / export CSV-JSON — prévu Sprint 5.x.
- ❌ UI admin users complète (liste, edit, soft-delete) — prévu Sprint 5.x (v1 a seulement badge opérateur + modal login + mini-mode setup).
- ❌ Roles / permissions / Manager approval flow — prévu Sprint 5.x.
- ❌ Recovery PIN oublié (manager-approved reset) — prévu Sprint 5.x.
- ❌ Lockout / rate-limit login — prévu Sprint 5.x.
- ❌ Hash chain (tamper-evidence au-delà d'IDB) — prévu Sprint 5.x.
- ❌ Multi-postes auth centralisée — prévu Sprint 5.x.

## Prochaines étapes (Sprint 4.2)

- PR D : sync queue + push Supabase (offline-first, idempotence via UUID, RLS par `actorId` + `storeId`)
- PR E : backup/restauration JSON avec validation de schéma + E2E export → wipe → reimport
