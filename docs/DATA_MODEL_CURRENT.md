# AcimCaisse — Data Model Current State

> Sprint 4.1 Gate 0 — baseline storage cartography.
> Captured from `acim-caisse.js` (lines 28-330) and `acim-voice-flash.js`.
> Aucune dépendance à SQLite/Drizzle/Supabase à ce stade : **100% IndexedDB navigateur**.

## Glossaire

- **DB** = IndexedDB database. Chaque DB a son propre numéro de version.
- **Object store** = équivalent d'une table (key-value, no foreign keys, pas de JOIN).
- **keyPath** = champ servant de clé primaire.
- **Migration runtime** = patchs JS exécutés au boot sur les documents existants (pas de ALTER TABLE — IDB n'en a pas).

## Enumération des bases IndexedDB

| DB | Version | Stores | Rôle | Mécanisme de migration |
|---|---|---|---|---|
| `acim-meta` | 1 | `meta` (keyPath: `key`) | Clés/valeurs système (seq, flags) | Manuelle via `_migrations` (appliquée sur `products`, pas sur `meta`) |
| `acim-catalog` | 1 | `products` (keyPath: `barcode`) | Catalogue produits + stock | Manuelle via `_migrateSchema()` |
| `acim-sales` | 1 | `sales` (keyPath: `id`, autoIncrement) | Historique des ventes validées | Aucune |

### Détail `acim-meta.meta`

Stocke paires `{key, value}`. Clés connues :

| key | type | Rôle | Code source |
|---|---|---|---|
| `acim-bc-seq` | number | Prochain numéro de code-barres interne (`ACIM-XXXX`) | `acim-caisse.js:29-43` |
| `acim-ticket-seq` | number | Prochain numéro de ticket | `acim-caisse.js:51-65` |
| `acim-backup-imported-v1` | boolean | Empêche la réimport du backup embarqué | `acim-caisse.js:332,359,404` |
| `schema-version` | number | Version du schéma produits courant (actuellement `4`) | `acim-caisse.js:117-182` |

### Détail `acim-catalog.products`

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

### Détail `acim-sales.sales`

Document écrit par `_persistSale()` (`acim-caisse.js:238-258`) :

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

## Flux mutation stock actuel

### `_decrementStock(barcode, qtyOrWeight)` — `acim-caisse.js:273-305`

Transaction **single-store** `products` en `readwrite` :
1. `get(barcode)` → lit stock courant
2. Si stock futur < 0 → `tx.abort()` + return `{ok:false, reason:"stock:N"}`
3. Sinon → `put(p)` avec `stockQty -= amount` + `last_updated = Date.now()`
4. `tx.oncomplete` → resolve `{ok:true, newStock, reason:"ok"}`

**Atomique par produit** — c'est ce que Sprint 4.0 TEST 4 a validé (5 concurrents → 2 OK / 3 KO). ✅

### `_restoreStock(barcode, qtyOrWeight)` — `acim-caisse.js:307-329`

Symétrique du décrément. Utilisé pour annulations / void ticket. Pas de garde "stock max" — peut dépasser la valeur initiale.

### `_persistSale(...)` — `acim-caisse.js:238-258`

TX `sales.readwrite` : un seul `put(sale)`. **Indépendant** du décrément stock.

## Chaîne checkout actuelle (le point critique pour Sprint 4.1)

`_finalizeSale(payments)` à `acim-caisse.js:1369-1404` :

```
1. _cartTotal()
2. _nextTicket()  ── incrémente seq en mémoire (pas de TX meta)
3. _saveTicketSeq()  ── persiste la nouvelle valeur de seq dans acim-meta (TX séparée)
4. _persistSale(ticketNum, items, total, ...)  TX acim-sales (1)
   on success:
   5. decPromises.push(_decrementStock(bc, amount))  ── TX acim-catalog (1 par ligne)  (2)
      Promise.all(decPromises)  ── n'est pas attendu (fire-and-forget)
   6. _showReceipt(...)
   7. _broadcastClear()  ── BroadcastChannel "acim-customer-display"
   8. _myCart = []; _renderPOS();
```

**Trous de cohérence identifiés** (à combler en Sprint 4.1 PR A/B) :

| # | Trou | Conséquence |
|---|---|---|
| H1 | `_persistSale` et les `_decrementStock` sont dans **des transactions IDB séparées** | Une vente peut être persistée sans que le stock soit décrémenté si la page est fermée entre les deux |
| H2 | `decPromises` est fire-and-forget (pas `await`) | Le toast `⚠️ Stock insuffisant` peut s'afficher mais la vente reste validée → stock négatif masqué |
| H3 | `_saveTicketSeq` est en TX séparée | Si crash entre `_nextTicket()` et `_saveTicketSeq()`, deux ventes peuvent partager le même numéro |
| H4 | Pas d'audit | Aucune trace de qui a validé, quand, de quelle valeur stockelle venait |

Sprint 4.0 a validé l'atomicité **par produit** (TEST 4) mais pas l'atomicité **de l'ensemble du checkout**. C'est exactement ce que Sprint 4.1 doit couvrir.

## Canaux de sync cross-tab / cross-window existants

| Canal | Type | Usage | Code |
|---|---|---|---|
| `acim-customer-display` | BroadcastChannel | Sync panier → onglet "customer display" séparé | `acim-caisse.js:676`, `acim-voice-flash.js:263-266` |

**Pas de canal de sync audit**. À ajouter en Sprint 4.1 si on veut qu'un autre onglet réagisse aux events.

## Ce qui n'existe PAS (encore)

- Aucun système d'identité (pas de `user_id`, `device_id`, `session_id`).
- Aucun journal d'audit.
- Aucune file d'attente sync (pas de `sync_queue`).
- Aucune notion d'opérateur/caissier ni de PIN.
- Aucune notion de Manager approval.
- Aucune transaction multi-store cross-database (IDB ne supporte pas nativement les transactions cross-DB ; il faudrait soit une seule DB agrégée, soit un WAL applicatif).
- Aucune hash chain.
- Aucune connexion Supabase.

## Décision Sprint 4.1 — conséquences techniques

Pour respecter l'invariant P0 "toute action métier a un event audit + mutation atomique", et vu que **IDB ne supporte pas les transactions cross-database** :

- **Option retenue** : créer une nouvelle DB `acim-audit` (version 1) avec stores `audit_events` + `sync_queue`. Audit **extérieur** à la transaction métier — pas atomique au sens DB, mais **compensé par ordre d'écriture** :
  1. `audit_events.put(event)` — buter le BEFORE en premier
  2. `_decrementStock(...)` — si cette TX échoue, on écrit un event `STOCK_ROLLBACK` qui annule l'event BEFORE

- **Alternative écartée** : migrer `products` + `audit_events` dans une seule DB agrégée. Trop risqué en Sprint 4.1 (touche l'existant, risque de régression sur les invariants Sprint 4.0).

- **Hash chain** : optionnelle en PR A, activée en PR C (tests). `hash_current = SHA256(prev_hash + JSON.stable(event))`. Pas de crypto navigateur à part `crypto.subtle` — suffisant.

## Prochaines étapes

- Gate 0 ✅ (ce document)
- PR A : schema `acim-audit` (audit_events + sync_queue) + Audited IDs (device_id init) — ne touche pas au code métier
- PR B : AuditService + emission des 4 events P0 + transaction orchestration
- PR C : tests robust4.1 (audit vente + crash recovery + immutabilité)
