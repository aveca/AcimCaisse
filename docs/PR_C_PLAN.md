# PR C — Manual Stock Adjustment + Operator PIN Identity (Plan d'implémentation)

> Sprint 4.1 — Dernier volet métier du sprint.
> Durée plan : 30 min. Continuité directe de PR A (Audit Core) + PR B (atomic checkout/undo).

## 1. Objectifs (verrouillés)

1. **Couvrir les ajustements manuels de stock** via un point d'entrée dédié `_adjustStock()` émettant `STOCK_ADJUSTED` dans la même TX IDB que la mutation.
2. **Introduire l'identité opérateur** via login PIN local (offline-first, sans serveur).
3. **Alimenter automatiquement `actorId`** dans tous les events émis via `logInTx()` / `log()` — sans modifier les callers métier existants (l'audit récupère l'acteur depuis la session courante).
4. **Conserver l'invariant P0** : aucune mutation métier sans event audit atomique.

## 2. Contrat métier

Toute modification manuelle de stock passe par `_adjustStock(barcode, delta, reason)` :

- TX unique sur `[products, audit_events]` en `readwrite`.
- Lecture `products.get(barcode)` → snapshot `currentStock`.
- Calcul `newStock = currentStock + delta`.
- Garde : `newStock >= 0` (sinon `tx.abort()` + toast).
- `products.put({…, stockQty: newStock, last_updated: Date.now()})`.
- `_acimAudit.logInTx(tx, {type: STOCK_ADJUSTED, entityType: "stock", entityId: barcode, action: "adjust", payload: {barcode, delta, reason}, previousState: {stockQty: currentStock}, newState: {stockQty: newStock}})`.
- Si `logInTx` throw → `tx.abort()` (atomicité garantie, même pattern que PR B).
- `reason` obligatoire, enum contrôlée : `"restock" | "inventory" | "loss" | "correction" | "manual"` (pas de `null`, pas de string libre — évite le "just because").

**`previousState` / `newState` obligatoires** (toujours `{stockQty}`), jamais `null` pour cet event.

## 3. Login PIN employé — design

### 3.1 Stockage

| Store | Rôle | keyPath |
|---|---|---|
| `users` (nouveau store dans DB `acim` v3) | Employés enregistrés | `id` (string, ex: "u001") |
| `meta` (existant) | Session courante : `acim-current-actor-id` | `key` (existant) |

**`users` schema** :
```js
{
  id:        string,        // ex: "u001" — IMMUABLE. Jamais réassigné.
  salt:      string,        // base64 de 16 octets aléatoires (crypto.getRandomValues).
                           // Unique par utilisateur. Empêche le bruteforce par table arc-en-ciel.
  pinHash:   string,        // base64 de SHA-256(salt Bytes || utf8(pin)).
                           // N'est JAMAIS comparé directement sans sel.
  name:      string,        // "Alice" — modifiable. N'est JAMAIS utilisé comme
                           // identifiant dans audit_events (uniquement actorId).
  role:      "cashier" | "manager",   // v1: seulement pour futur manager approval
  active:    boolean,       // soft-delete sans perte historique audit
  createdAt: number
}
```

**Invariant d'identité** (verrouillé, documenté dans `docs/DATA_MODEL_CURRENT.md`) :
- `actorId` dans `audit_events` = `users.id`, immuable.
- `users.name` modifiable librement ; les événements déjà émis ne sont **jamais** rétro-mis-à-jour (append-only).
- Aucun event audit ne contient `name` comme identifiant. Seul `actorId` est persisté dans `audit_events.actorId`.

### 3.2 PIN : hash salé + vérification

- **Sel** : 16 octets aléatoires par utilisateur via `crypto.getRandomValues(new Uint8Array(16))`, stocké en base64 dans `users.salt`.
- **Hash** : `crypto.subtle.digest("SHA-256", concatSaltAndPin)` où `concatSaltAndPin` = `Uint8Array(salt.length + pinBytes.length)` rempli avec `salt` puis `utf8(pin)`. Résultat base64 dans `users.pinHash`.
- **Vérification** : recalcule le hash du pin saisi avec le `salt` de l'utilisateur, compare `=== stored.pinHash`. Pas de timing-safe en v1 (cashier mono-poste).
- **Taille PIN** : 4 à 8 chiffres. Validation regex `/^\d{4,8}$/`.
- **Pas de lockout / rate-limit** en v1 (offline-first, pas de brute-force réaliste sur un POS local). Le sel rend les attaques par rainbow table impossibles ; seule l'attaque exhaustive par utilisateur reste possible, ce qui est acceptable en v1 sur poste isolé. Documenté.

### 3.3 Session courante

- Login success → `_acimAudit.setActor(userId)` (API livrée en PR A) → persiste `meta.acim-current-actor-id = userId`.
- Logout → `_acimAudit.setActor(null)` + retire la clé meta.
- Au boot : `_acimAudit.setActor(metaValue)` pour restaurer la session si l'onglet est rouvert sans relogin (offline-first : on fait confiance au poste). **Décision figée** : pas de re-auth au boot en v1. La session persiste tant que l'utilisateur ne se logout pas explicitement.

### 3.4 Alimentation automatique de `actorId`

- `logInTx(tx, event)` et `log(event)` already prennent `actorId` depuis `_actorId` interne à `acim-audit.js` via `_buildEvent()`. **Aucun caller métier à modifier** — l'audit récupère l'acteur tout seul.
- En v1, sans login : `_actorId === null` → events `actorId: null`. C'est le comportement attendu pour les tests E2E actuels (qui n'ont pas de login).
- Tests PR B (28 pass) restent verts sans modification — `_actorId === null` par défaut.

### 3.5 UI minimale (modal)

Pas d'écran de gestion Users complet en PR C — juste :

1. **Modal de login** : `window._acimShowLogin()` — input PIN (type=password), bouton "Connexion", message erreur. Apparaît au boot SI aucune session active et si au moins 1 user existe en base. Pas de blocage de la caisse si aucun user configuré (mode "open" v1, pour ne pas casser le déploiement existant).
2. **Badge opérateur** dans le POS header : "👤 {name}" avec bouton "Déconnexion". Petit widget, pas un module.
3. **Création d'employés via un mini-mode** : `?setup=1` query param → écran "Créer le premier employé" (PIN + name). Une fois 1 user créé, ce mode se désactive. Pas d'admin UI complexe — la gestion multi-users sera PR F (Sprint 5.x).

## 4. Décisions figées

| Question | Décision v1 |
|---|---|
| PIN hash algorithm | SHA-256 via `crypto.subtle` (natif navigateur, pas de dépendance) |
| PIN length | 4-8 digits, regex validated |
| Session restore au boot ? | Oui (lecture meta). Pas de re-auth. |
| Lockout / rate-limit ? | Non (offline, mono-poste). Documenté. |
| `users` dans `acim` v3 ? | Oui — bump version, `onupgradeneeded` ajoute le store. |
| Manager approval (PR plan §3 SMP) ? | **Reporté Sprint 5.x** — v1 a seulement le role "cashier" + "manager" comme attribut, mais aucune flow d'approval UI. |
| actorId sur events `MIGRATION_COMPLETED`, `SESSION_START`, `SYSTEM_ERROR` ? | `null` — ils précèdent toute auth possible. |
| Suppression d'un employé ? | `users.delete` exposé mais avec audit `STOCK_ADJUSTED` non ; on utilisera un type futur `USER_DISABLED`. **Hors PR C.** |
| Si `_actorId === null` (pas de login) et qu'on appelle `_adjustStock` ? | Autorisé, `actorId: null` dans l'event. Pas de blocage — l'audit trace quand même. |

## 5. API publique (ajouts)

```js
// acim-caisse.js expose :
window._acimAdjustStock = function(barcode, delta, reason) → Promise<{ok, newStock?, reason?}>
window._acimShowLogin = function()
window._acimLogout = function()
window._acimGetCurrentActor = function() → {id, name, role} | null

// tests surface :
window._acimTest.adjustStock = _adjustStock
window._acimTest.createUser = _createUser // for tests only
window._acimTest.listUsers = _listUsers  // for tests only
window._acimTest.loginWithPin = _loginWithPin // bypass UI for tests

// audit constants — already in PR A
_acimAudit.TYPE.STOCK_ADJUSTED  // exists
```

**Pas de `_acimAudit.setActor` exposé au code métier** (déjà exposé mais usage interne). Le test l'utilise pour forcer des contextes.

## 6. Stratégie de migration (acim v2 → v3)

- `onupgradeneeded` v2 → v3 : `if (!db.objectStoreNames.contains("users")) db.createObjectStore("users", {keyPath: "id"})`. Index `by_active` sur `active`.
- Migration idempotente : si l'utilisateur arrive d'une v2 (PR A/B installés), le reboot bump la v3 et ajoute `users` vide. Pas de data re-copie.
- **Aucune regression** PR A/B : tests `run-e2e-audit.js` (35) et `run-e2e-audit-b.js` (28) doivent rester verts. Le bump de version peut casser si PR A attendait explicitement v2 → je dois mettre à jour le check `indexedDB.open("acim", 2)` dans les tests PR A vers `"acim", 3`. Tous les `open` codés en dur à 2 doivent être bumpés à 3 (côté produit ET tests).

## 7. Risques identifiés

| Risque | Mitigation |
|---|---|
| `crypto.subtle` disponible uniquement en HTTPS / localhost | `tests/serve.js` tourne en http://localhost — OK. Prod via https://*.netlify.app — OK. Documenter le prérequis. |
| `crypto.subtle.digest` est async (Promise) alors que la vérification PIN est dans un flow UI | OK — `await` dans le handler `onclick`. Pas de contrainte TX IDB ici. |
| Session restore au boot = trust local storage | Accepté en v1 (mono-poste). Doc dans DATA_MODEL_CURRENT.md mis à jour. |
| Si utilisateur perd son PIN | Pas de recovery en v1. Documenté. Une future PR implémentera "reset PIN si manager-approved". |
| Bump v2→v3 avec `users` store peut interagir avec `_acimAudit._bind(db)` | Vérifier : `_bind` capture le handle qui survit au bump — OK car le boot appelle `_openUnifiedDB()` qui ouvre v3. |
| `actorId` populated retroactivement pour anciens events ? | Non — events existants restent `actorId: null`. Seuls nouveaux events prennent l'acteur courant. Doc clair. |

## 8. Tests PR C obligatoires (`tests/run-e2e-audit-c.js`)

8 scénarios (28-35 assertions attendues) :

### 8.1 Ajustement positif
- Setup : 1 produit stock=10, `_adjustStock("BC", +5, "restock")`.
- Assertions : `product.stockQty === 15`, 1 event `STOCK_ADJUSTED` with `previousState.stockQty=10`, `newState.stockQty=15`, `payload.delta=5`, `payload.reason="restock"`.

### 8.2 Ajustement négatif (loss)
- Setup : stock=10, `_adjustStock("BC", -3, "loss")`.
- Assertions : `stockQty === 7`, 1 event avec `delta=-3, reason="loss"`, prev=10/new=7.

### 8.3 Produit pesé (kg)
- Setup : produit `unitType: "kg"`, stock=2.5, `_adjustStock("BC", +0.5, "restock")`.
- Assertions : `stockQty = 3.0` (verify decimals), 1 event avec prev=2.5/new=3.0.

### 8.4 Ajustement impossible (stock négatif)
- Setup : stock=2, `_adjustStock("BC", -5, "loss")`.
- Assertions : `stockQty === 2` (inchangé), 0 event `STOCK_ADJUSTED` émis, return value `{ok:false, reason:"stock-kg:2"}` ou `"stock:2"`.

### 8.5 Rollback audit — atomicité
- Monkey-patch `_acimAudit.logInTx` throw sur `STOCK_ADJUSTED`.
- `_adjustStock("BC", +5, "restock")` sur stock=10.
- Assertions : `stockQty === 10` (inchangé), 0 event `STOCK_ADJUSTED`.
- Restore monkey-patch.

### 8.6 actorId alimenté après login
- Créer 1 user (`_acimTest.createUser("u001", "1234", "Alice")`).
- `_acimTest.loginWithPin("1234")`.
- `_adjustStock("BC", +5, "restock")` sur stock=10.
- Assertions : event `STOCK_ADJUSTED` a `actorId === "u001"`.

### 8.7 actorId null hors login
- `_acimLogout()` ou pas de login.
- `_adjustStock("BC", +5, "restock")`.
- Assertions : event `STOCK_ADJUSTED` a `actorId === null`.

### 8.8 Plusieurs employés successifs
- Créer Alice (u001) + Bob (u002).
- Login Alice → `_adjustStock("BC", +1, "restock")`.
- Logout → login Bob → `_adjustStock("BC", +1, "restock")`.
- Assertions : 2 events, le premier `actorId==="u001"`, le second `actorId==="u002"`.

### 8.9 Logout → plus d'acteur
- Après §8.8 : `_acimLogout()`.
- `_adjustStock("BC", +1, "restock")`.
- Assertion : event `actorId === null`.

### 8.10 Non-régression Sprint 4.0/PR A/PR B
- Relancer `run-e2e-robust.js`, `run-e2e-audit.js`, `run-e2e-audit-b.js` après PR C → doivent rester 20/35/28 verts.

### 8.11 PAGEERROR check
- 0 pageerror pendant toute la suite.

## 9. Fichiers ajoutés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `acim-audit.js` | MODIFIE mineur | Aucun changement API. _actorId déjà géré. |
| `acim-caisse.js` | MODIFIE | Bump acim v2 → v3 (store `users`), ajout `_adjustStock`, `_createUser`, `_loginWithPin`, `_logout`, `_getCurrentActor `_showLogin modal`, alimentation `_acimAudit.setActor()` |
| `pos.html` | MODIFIE mineur | Header badge opérateur (DOM injecté par JS, pas de script supplémentaire) |
| `tests/run-e2e-audit-c.js` | NOUVEAU | 8 scénarios + PAGEERROR |
| `docs/PR_C_PLAN.md` | NOUVEAU | Ce document |
| `docs/DATA_MODEL_CURRENT.md` | MODIFIE | Ajout du store `users` + modèle session |

## 10. Critère d'acceptation PR C

- ✅ `tests/run-e2e-audit-c.js` : 8 scénarios verts (≈28-35 assertions).
- ✅ `tests/run-e2e-robust.js` : 20 pass / 0 fail (zéro régression Sprint 4.0).
- ✅ `tests/run-e2e-audit.js` : 35 pass / 0 fail (PR A intact, with v2→v3 bump).
- ✅ `tests/run-e2e-audit-b.js` : 28 pass / 0 fail (PR B intact).
- ✅ Login PIN fonctionnel : acteur alimente tous les events automatiquement.
- ✅ `_adjustStock` atomique : test 8.5 prouve rollback.
- ✅ Aucune régression sur `_finalizeSale` / `_undoLastSale` (PR B reste vert).

## 11. Hors scope PR C (explicitement exclus)

- ❌ UI complète de gestion des users (liste, edit, delete) → Sprint 5.x
- ❌ Roles / permissions / manager approval flow → Sprint 5.x
- ❌ Recovery PIN oublié → Sprint 5.x
- ❌ Lockout / rate-limit login → Sprint 5.x
- ❌ Multi-postes auth centralisée → Sprint 5.x
- ❌ UI audit timeline / export → Sprint 5.x
- ❌ Hash chain → Sprint 5.x
- ❌ Sync Supabase → PR D (Sprint 4.2)

## 12. Suite logique après PR C

Sprint 4.1 sera alors complet au sens P0 :
- ✅ Invariants atomiques : PR A fondation + PR B checkout/undo + PR C manual stock + identity.
- ↗️ PR D (P1) : sync queue + push Supabase.
- ↗️ PR E (P1) : backup/restauration testable.
- ↗️ Sprint 5.x : UI audit, rôles, hash chain, multi-postes.
