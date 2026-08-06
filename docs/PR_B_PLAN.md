# PR B — Atomic Business Audit Integration (Plan d'implémentation)

> Sprint 4.1 — Branche les mutations métier sur l'Audit Core de PR A.
> Durée plan : 30 min. Lié au contrat `docs/PR_A_PLAN.md` (ne le re-spécifie pas).

## 1. Invariant cible (figé)

> **Toute mutation métier critique réussie doit produire son événement audit dans la même transaction IndexedDB que la mutation.**

Pas d'audit différé. Pas d'event `FAILED` persisté en v1 (on laisse la TX échouer entière). Trois cas concernés :

| Cas | Store métier | Audit events à émettre |
|---|---|---|
| Vente finalisée (validate checkout) | `sales` + `products` | `SALE_COMPLETED` + 1× `STOCK_DECREMENT` par ligne |
| Annulation / undo dernière vente | `sales` (delete) + `products` | `SALE_CANCELLED` + 1× `STOCK_INCREMENT` par ligne |
| Ajustement manuel stock (existant ?) | `products` | `STOCK_ADJUSTED` (uniquement si la fonction existe déjà — sinon hors PR B) |

## 2. Cartographie actuelle (extraite de `acim-caisse.js`)

### `_finalizeSale(payments)` — ligne 1534
```
_finalizeSale(payments)
 ├─ _cartTotal()
 ├─ _nextTicket()  + _saveTicketSeq()                 ── TX #0 acim/meta
 ├─ _persistSale(ticketNum, items, total, …)          ── TX #1 acim/sales (put)
 └─ .then(decPromises = [_decrementStock(bc, amt)…])   ── TX #2..n acim/products (1 par ligne)
     Promise.all(decPromises)                          ── fire-and-forget (H2 du Gate 0)
```

**Trous identifiés en Gate 0 (§ chaîne checkout)** que PR B doit combler :
- H1 : `_persistSale` et `_decrementStock` sont dans **des TX séparées** → risk vente sans stock.
- H2 : `decPromises` est `Promise.all` non attendu → stock insuffisant peut survenir après la validation.
- H4 : aucun audit.

### `_persistSale(...)` — ligne 403
- TX `sales.readwrite`, un seul `put(sale)`. `sale.id` est autoIncrement → on ne connaît pas l'id avant commit.

### `_decrementStock(barcode, qtyOrWeight)` — ligne 438
- TX unique `products.readwrite`. Lit stock, abort si `next < 0`, sinon `put`. **Déjà atomique par produit** (validé Sprint 4.0 TEST 4).
- Retourne `{ok, newStock, currentStock, reason}`.

### `_restoreStock(barcode, qtyOrWeight)` — ligne 472
- Symétrique. Pas de garde max. Retourne `{ok, newStock, reason}`.

### `_undoLastSale()` — ligne 3108
- TX `sales.readwrite` : `openCursor(null,"prev")` → trouve la dernière.
- Sur confirmation user → chaîne `_restoreStock` par item (pas atomique entre items, pas atomique avec le `cursor.delete()`).

## 3. Contrat `logInTx()` (déjà livré par PR A — rappel)

```js
const event = window._acimAudit.logInTx(tx, {
  type:        window._acimAudit.TYPE.SALE_COMPLETED,
  entityType:  "sale",
  entityId:    String(ticketNum),
  action:      "complete",
  payload:     { …données reconstructibles… },
  previousState: null,
  newState:      null
});
// — tx doit avoir été créée avec le store "audit_events" inclus dans la liste.
// — Lance une exception si l'add() échoue (caller doit gérer ou laisser la TX aborter).
```

## 4. Décisions figées (réponses du plan)

| Question | Décision v1 |
|---|---|
| Si l'audit échoue dans la TX → rollback complet ? | **Oui**. Laisser IDB aborter la TX entière (métier + audit). Pas d'évènement `FAILED` persisté. |
| Si payload trop gros (> 256 Ko) ? | **Rejeter la TX**. Pas de truncation silencieuse. Logger `SYSTEM_ERROR` hors-TX ensuite. |
| Évènements `FAILED` persistés ? | **Non, en v1**. Une TX qui échoue ne produit rien. Le caller loggue `SYSTEM_ERROR` standalone via `_acimAudit.log()` si voulu. |
| `actorId` ? | `null` (v1, comme PR A). Sera peuplé quand PR C livrera le login PIN. |
| `sessionId` ? | Pris automatiquement par `_buildEvent()` depuis la session en cours. |
| Snapshot complet produit dans `payload` ? | **Non**, seulement les champs reconstructibles (ticket, items résumés, totalCents, paymentMethods). `previousState`/`newState` = champs impactés (pour stock : `{stockQty}` avant/après). |
| Ordre d'écriture des events dans la TX ? | Peu importe (même TX = même commit). Pour lisibilité : `SALE_COMPLETED` d'abord, puis chaque `STOCK_DECREMENT`. |

## 5. Refactor cible — transactions unifiées

### 5.1 `_finalizeSale(payments)` (réécriture)

```
_prepareFinalizeSale(payments)
 ├─ validations UI (reçu >= total, mixte valide) — sans DB
 └─ return {payments, totalCents}

_finalizeSale(payments)
 ├─ _openUnifiedDB() → db
 ├─ saleId sera autoIncrement ; on ne le connaît qu'après commit.
 ├─ saleData = {ticketNumber, timestamp, isoTime, items, totalCents,
 │              discountCents, payments, itemCount, status:"COMPLETED"}
 ├─ TX UNIQUE (db, ["sales","products","meta","audit_events"], "readwrite")
 │    ├─ store.get + put → incrémente _ticketSeq (en place dans meta)
 │    ├─ sSales.put(saleData) → on récupère l'id via req.result (keyPath id)
 │    ├─ for each item:
 │    │    storeProd.get(bc) → check stock >= amount, sinon tx.abort()
 │    │    produit.stockQty -= amount ; produit.last_updated = now
 │    │    storeProd.put(produit)
 │    │    _acimAudit.logInTx(tx, {type: STOCK_DECREMENT, entityType:"stock",
 │    │                            entityId: bc, action:"decrement",
 │    │                            payload:{barcode, amount:..., reason:"sale"},
 │    │                            previousState:{stockQty: oldStock},
 │    │                            newState:{stockQty: newStock}})
 │    ├─ sSales.put en place, on récupère saleId (integer) →
 │    │    _acimAudit.logInTx(tx, {type: SALE_COMPLETED, entityType:"sale",
 │    │                            entityId: String(saleId-or-ticketNum),
 │    │                            action:"complete",
 │    │                            payload:{ticket:saleData.ticketNumber,
 │    │                                     itemCount: items.length,
 │    │                                     totalCents, discountCents,
 │    │                                     paymentMethods: [method,...]}})
 │    └─ tx.oncomplete → showReceipt, _broadcastClear, _myCart=[]
 │    tx.onerror / tx.onabort → toast, jamais sale stock muté.
```

**Casse la clé d'autoIncrement** : on peut récupérer l'id après `put` via le `request.result` — mais c'est avant `oncomplete`. La TX n'est pas encore commise. Pour l'`entityId` de l'event `SALE_COMPLETED`, on peut utiliser `ticketNumber` (déjà connu, unique) plutôt que `sale.id`. Décision : **`entityId = String(ticketNumber)`**. Le `sale.id` reste l'autoIncrement IDB interne.

### 5.2 `_persistSale` → obsolète

Serait incorporé dans la nouvelle `_finalizeSale`. Conserver l'ancienne fonction pour les éventuels autres callers (recherche : grep `_persistSale`).

### 5.3 `_undoLastSale()` (réécriture)

```
_undoLastSale()
 ├─ TX ["sales","products","audit_events"] readwrite
 │    ├─ storeSales.openCursor(null,"prev") → cursor.value = sale
 │    ├─ sale trouvée ? sinon tx.abort + toast "Aucune vente à annuler"
 │    ├─ for each item:
 │    │    storeProd.get(bc) → produit.stockQty += amount ; produit.last_updated
 │    │    storeProd.put(produit)
 │    │    logInTx STOCK_INCREMENT, payload:{barcode, amount, reason:"undo"}
 │    ├─ logInTx SALE_CANCELLED, entityId = String(sale.ticketNumber),
 │    │            payload:{ticket, itemCount, totalCents, reason:"undo"}
 │    └─ cursor.delete()
 └─ tx.oncomplete → toast + refresh + filter
```

### 5.4 `_decrementStock` / `_restoreStock` standalone

Ces deux fonctions restent **intactes** pour préserver l'API publique (Sprint 4.0 TEST 2/3/4 les utilisent directement via `window._acimTest`). PR B n'y ajoute **pas d'audit standalone** — l'audit n'est émis que dans la TX unifiée de `_finalizeSale` / `_undoLastSale`. 

> Note : si un caller externe appelle `_decrementStock` seul (ex: depuis un futur endpoint d'ajustement de stock), **pas d'audit**. Ce sera couvert par `STOCK_ADJUSTED` en PR C quand le stock-adjust UI sera câblé. Décision figée : en PR B, on n'instrumente que `_finalizeSale` + `_undoLastSale`.

### 5.5 `_acimTest` surface (compat tests Sprint 4.0)

`window._acimTest.finalizeSale` continue de pointer vers `_finalizeSale`. Tests Sprint 4.0 voient le même comportement + audit events maintenant émis (vérifiables via `window._acimAudit.count()`).

## 6. Tests PR B obligatoires (`tests/run-e2e-audit-b.js`)

### 6.1 Test nominal — vente émet SALE_COMPLETED + STOCK_DECREMENT
- Setup : 1 produit, stock=10.
- `_acimTest.clearCart()` ; `_acimProcessBarcode(bc)` ; `_acimTest.finalizeSale([{method:"cb",…}])`.
- Attendre 1.5 s.
- Assertions :
  - `audit.getByType("SALE_COMPLETED").length === 1`
  - `audit.getByType("STOCK_DECREMENT").length === 1`
  - `event.entityId === String(ticketNumber)` pour SALE_COMPLETED
  - `event.previousState.stockQty === 10` && `event.newState.stockQty === 9` pour STOCK_DECREMENT
  - `audit.getByEntity("sale", ticketNumber).length >= 1`
  - `product.stockQty === 9`

### 6.2 Test rollback audit — si audit échoue, TX aborte
- Setup : monkey-patch `window._acimAudit.logInTx` pour qu'il `throw` sur le second appel (i.e. sur STOCK_DECREMENT).
- Lancer une vente.
- Assertions :
  - `product.stockQty` **inchangé** (toujours 10)
  - `window._acimAudit.getByType("SALE_COMPLETED").length === 0` (la TX a rollback tout)
  - `window._acimAudit.getByType("STOCK_DECREMENT").length === 0`
- Restore le monkey-patch.

### 6.3 Test 5 ventes + 5 undo — invariant Sprint 4.0 + audit cohérent
- Setup : stock=50, 1 produit.
- Pour 5 itérations :
  - `_processBarcode(bc)` × 1 (qty=1)
  - `finalizeSale([{method:"cb", amountCents=240, …}])`
  - attendre 0.5 s
  - `_undoLastSale()` (programmatic — bypass UI confirm)
  - attendre 0.5 s
- Assertions finales :
  - `product.stockQty === 50` (Sprint 4.0 invariant conservé)
  - `audit.getByType("SALE_COMPLETED").length === 5`
  - `audit.getByType("STOCK_DECREMENT").length === 5`
  - `audit.getByType("SALE_CANCELLED").length === 5`
  - `audit.getByType("STOCK_INCREMENT").length === 5`

### 6.4 Test 3 produits pesés (kg) — audit par item avec weight
- Setup : 3 produits kg, stock = 10 / 20 / 30.
- Checkout avec 0.5 + 2.3 + 1.7.
- Assertions :
  - 3 `STOCK_DECREMENT` events, chacun avec `payload.amount` = 0.5 / 2.3 / 1.7
  - `previousState.stockQty` / `newState.stockQty` corrects par product

### 6.5 Test stock insuffisant — checkout doit échouer, audit vide
- Setup : stock=2, vente de 5 items (qty=1 each — un seul produit répété).
- `_processBarcode(bc)` × 5 ; `_finalizeSale([{method:"cb", amountCents=5*price}])`.
- Assertions :
  - TX abort → `product.stockQty === 2` (inchangé)
  - `audit.getByType("SALE_COMPLETED").length === 0`
  - `audit.getByType("STOCK_DECREMENT").length === 0`
  - Toast "Stock insuffisant" (vérifiable via la présence d'un event SYSTEM_ERROR? — `FAILED` non persisté en v1, donc on ne vérifie que l'absence d'events métier)

### 6.6 Non-régression Sprint 4.0 (systématique)
- Relancer `tests/run-e2e-robust.js` après PR B → doit rester 20 pass / 0 fail.

### 6.7 PAGEERROR check
- 0 pageerror pendant toute la suite.

## 7. Risques identifiés

| Risque | Mitigation |
|---|---|
| Transaction IDB multi-stores peut être plus lente qu'avant ( locks sur sales + products + meta + audit_events ) | IDB est conçu pour ça — verrouillage par store ; pas de risque sur un POS mono-poste. À monitorer en multi-postes. |
| Si on `Promise.all` sur les opérations item, on perd l'atomicité ; si on sequentialise, on perd perf. | On fait **séquençage synchrone dans la TX** — IDB exécute les ops en file, plus rapide que des awaits séparés. |
| `cursor.delete()` dans `_undoLastSale` ne peut pas être reporté. C'est `cursor` dépendant — si on lit `cursor.value` puis restoreStock dans une autre TX puis revient, le cursor est invalid. | Toute la chaîne **dans la même TX** — on lit `cursor.value` une fois, puis on fait les `storeProd.get/put` via la TX partagée, puis `cursor.delete()` avant commit. |
| `_acimTest` surface pourrait casser si on change la signature de `_finalizeSale` | On garde la même signature publique `finalizeSale(payments)`. Seul le comportement interne change. |
| Les tests Sprint 4.0 TEST 2/3/4 appellent `_decrementStock`/`_restoreStock` hors-vente → audit non émis pour eux | Comportement attendu. Si l'utilisateur veut aussi auditer les `decrement` standalone, ce sera `STOCK_ADJUSTED` en PR C. |

## 8. Hors scope PR B (explicitement exclus)

- ❌ UI audit (timeline, admin)
- ❌ Export JSON/CSV
- ❌ Sync cloud / Supabase / multi-caisse
- ❌ Login PIN / rôles / manager approval (PR C)
- ❌ STOCK_ADJUSTED standalone (PR C avec UI aparté)
- ❌ Signature / hash chain (reporté)
- ❌ Refactor des autres `_addToCart` paths (seul le checkout est instrumenté)

## 9. Fichiers ajoutés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `acim-caisse.js` | MODIFIE | `_finalizeSale` + `_undoLastSale` réécrits avec TX unifiée + `logInTx()` |
| `tests/run-e2e-audit-b.js` | NOUVEAU | 5 scénarios PR B + PAGEERROR check |
| Pas de nouveau module | — | Audit Core livré en PR A suffit |
| `docs/PR_B_PLAN.md` | NOUVEAU | Ce document |

## 10. Critère d'acceptation PR B

- ✅ `tests/run-e2e-audit-b.js` : 5 scénarios + pageerror verts (≈30-40 assertions).
- ✅ `tests/run-e2e-robust.js` : 20 pass / 0 fail (zéro régression).
- ✅ `tests/run-e2e-audit.js` : 35 pass / 0 fail (PR A toujours intact).
- ✅ Aucune mutation métier sans event audit dans la même TX.
- ✅ Test rollback audit (§6.2) vert : prouve l'atomicité.
