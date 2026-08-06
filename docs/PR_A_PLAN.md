# PR A — Plan d'implémentation (contrat figé avant code)

> Sprint 4.1 — fondation Audit Core.
> Décidé : **option (b) fusion DB unifiée**, audit dans la même TX IDB que la mutation métier.
> Durée plan : 30-45 min. Code PR A ensuite.

## 1. État actuel (rappel Gate 0)

| DB | Version | Stores | keyPath |
|---|---|---|---|
| `acim-catalog` | 1 | `products` | `barcode` |
| `acim-sales` | 1 | `sales` | `id` (autoIncrement) |
| `acim-meta` | 1 | `meta` | `key` |

Points d'ouverture des DB dans `acim-caisse.js` :
- `_openDB()` ligne 185 (cache dans `_db`)
- `_openSalesDB()` ligne 229 (pas de cache)
- `_openMeta()` ligne 90 (cache dans `_metaDb`)

Helpers :
- `_dbGet`, `_dbPut`, `_dbGetAll`, `_dbDelete`, `_dbDeleteAll` (lignes 217-226)
- `_persistSale` ligne 238
- `_decrementStock` ligne 273, `_restoreStock` ligne 307

## 2. Cible — DB unifiée `acim` (version 2)

Nouvelle structure :

```
acim (v2)
├── products      (keyPath: barcode)        ← copié depuis acim-catalog
├── sales         (keyPath: id, autoInc)   ← copié depuis acim-sales
├── meta          (keyPath: key)           ← copié depuis acim-meta
└── audit_events  (keyPath: id)            ← NOUVEAU, append-only
```

Indexes secondaires **uniquement sur `audit_events`** :

| Index | keyPath | unique |
|---|---|---|
| `by_timestamp` | `timestamp` | non |
| `by_type` | `type` | non |
| `by_actorId` | `actorId` | non |
| `by_sessionId` | `sessionId` | non |
| `by_entityType` | `entityType` | non |
| `by_entityId` | `entityId` | non |

Pas d'index sur `products`/`sales`/`meta` — on garde l'existant à l'identique (zéro changement de comportement).

## 3. Schéma AuditEvent — figé v1

```ts
{
  id:           string,        // UUID v4 (crypto.randomUUID())
  schemaVersion: number,      // = 1 (version du schéma AuditEvent, indépendante de la version DB)
  timestamp:    number,       // Date.now(), monotone par poste
  type:         string,       // ex: "SALE_COMPLETED", "STOCK_DECREMENT", ... ( UPPER_SNAKE )
  actorId:      string|null,  // null si pas d'user (anonyme) — Sprint 4.1 toujours null
  sessionId:    string,       // UUID généré au boot, persisté dans meta.acim-session-id
  entityType:   string,       // "sale" | "product" | "stock" | "session" | "system"
  entityId:     string|null,  // ex: ticket_number, barcode, ...
  action:       string,       // verbe: "create" | "complete" | "cancel" | "decrement" | ...
  payload:      object,       // JSON typé par event — cf. §4
  previousState: object|null, // avant mutation (pour stock)
  newState:     object|null,  // après mutation (pour stock)
  status:       "COMMITTED" | "FAILED"
}
```

**Décisions figées** :

| Question | Décision | Raison |
|---|---|---|
| `payload` typé ou libre ? | **Typé par event** (constantes en JS) | évite la dérive, facilite PR B/C |
| Taille max d'un event ? | **< 32 Ko** (typique) ; à႔ garder sous 256 Ko (limite IDB pratique) | |
| Snapshots avant/après ? | **Différentiel seulement** (`previousState`/`newState` = champs impactés, pas l'objet complet) | économise espace, suffit pour reconstruction |
| UUID génération ? | `crypto.randomUUID()` (natif navigateur) | pas de dépendance |
| Ordre des events ? | chronologique par `timestamp`_MONOTONE_SUR_POSTE | suffisant ; hash chain reportée |
| Immuabilité ? | **append-only strict** — pas de `put`, pas de `delete` exposé en v1 | |
| `sessionId` rotation ? | un nouveau sessionId à chaque `init()` ; persisté pour debug | pas de ré-auth en Sprint 4.1 |

## 4. Liste des event types v1 (figés)

Tous les enums suivants seront des `const` JS en haut de `acim-audit.js`.

### `type` (10 valeurs v1)

```
"SALE_CREATED"
"SALE_COMPLETED"
"SALE_CANCELLED"
"STOCK_DECREMENT"
"STOCK_INCREMENT"
"STOCK_ADJUSTED"
"SESSION_START"
"SESSION_END"
"SYSTEM_ERROR"
"MIGRATION_COMPLETED"
```

### `entityType` (5 valeurs v1)

```
"sale"      // entityId = ticket number (string)
"product"   // entityId = barcode
"stock"     // entityId = barcode (alias pour mutations stock pur sans vente)
"session"   // entityId = sessionId
"system"    // entityId = null (boot, migration, errors globaux)
```

### `action` (verbes, qualifie `type`)

```
"create" | "complete" | "cancel" | "decrement" | "increment"
| "adjust" | "start" | "end" | "error" | "migrate"
```

### Shape `payload` typée par event

Tous les events suivent la même envelope, seule `payload` + `previousState`/`newState` changent.

| type | payload | previousState | newState |
|---|---|---|---|
| `SALE_CREATED` | `{ticket, itemCount, totalCents, discountCents}` | null | null |
| `SALE_COMPLETED` | `{ticket, paymentMethods:string[], totalCents}` | null | null |
| `SALE_CANCELLED` | `{ticket, reason}` | null | null |
| `STOCK_DECREMENT` | `{barcode, amount, reason:"sale"\|"adjust"\|"void"}` | `{stockQty}` | `{stockQty}` |
| `STOCK_INCREMENT` | `{barcode, amount, reason:"restock"\|"void"}` | `{stockQty}` | `{stockQty}` |
| `STOCK_ADJUSTED` | `{barcode, delta, reason:"manual"}` | `{stockQty}` | `{stockQty}` |
| `SESSION_START` | `{bootTime}` | null | null |
| `SESSION_END` | `{durationMs}` | null | null |
| `SYSTEM_ERROR` | `{message, stack?}` | null | null |
| `MIGRATION_COMPLETED` | `{fromVersion, toVersion, copied:{products,sales,meta}}` | null | null |

## 5. Stratégie de migration in-place

### Principe

- La migration est **idempotente**.
- **Aucune suppression de store existant** dans `acim-catalog`/`acim-sales`/`acim-meta` — on les laisse intacts, on copie vers `acim`, et **seulement après copie OK**, on les supprime via `indexedDB.deleteDatabase()`.
- Un flag `acim-migrated-v2` dans `meta` empêche la recaplie.

### Séquence au boot

```
1. init() lance _openUnifiedDB()
   → indexedDB.open("acim", 2)
   → onupgradeneeded:
        create products / sales / meta / audit_events + indexes
        (n'efface rien — les stores sont vides avant première copie)
2. _maybeMigrateLegacy():
   a. lire meta.acim-migrated-v2
   b. si déjà true → done
   c. sinon :
      - ouvrir acim-catalog v1, getAll products
      - ouvrir acim-sales v1, getAll sales
      - ouvrir acim-meta v1, getAll meta
      - dans UNE TX acim v2 (readwrite sur products + sales + meta):
            put tous les products
            put tous les sales
            put tous les meta acim-migrated-v2=true et schema-version=4
            put audit_events MIGRATION_COMPLETED (payload = copiés)
      - en cas de succès de la TX :
            indexedDB.deleteDatabase("acim-catalog")
            indexedDB.deleteDatabase("acim-sales")
            indexedDB.deleteDatabase("acim-meta")
      - en cas d'échec : laisser les anciennes DB intactes, logguer SYSTEM_ERROR
3. _acimAudit.log({type:"SESSION_START", ...})
4. app init existante (catalogue, render, etc.)
```

### Fail-safe

- Si la version IDB d'une ancienne DB était > 1 (cas impossible constaté), on ne migre pas, on loggue `SYSTEM_ERROR`. L'ancien code est en v1 donc ce cas n'existera pas en pratique.
- Si la copie dépasse 30 secondes, abandonner et laisser les anciennes DB (l'utilisateur garde sa caisse fonctionnelle v1). On réessayera au prochain boot.

### Compatibilité avec les tests Playwright

- Les tests ouvrent une page fraîche à chaque `p.goto()` — pattern Empty IDB → migration → populate → _acimTest points vers les helpers unifiés.
- `window._acimTest.dbGet/dbPut/dbDelete/...` doivent fonctionner à l'identique après PR A. C'est le contrat de non-régression Sprint 4.0.

## 6. Refactor helpers existants

`_openDB`, `_openSalesDB` et `_openMeta` deviennent des wrappers qui pointent vers la même DB `acim`. Pareil pour `_dbGet/_dbPut/_persistSale/_decrementStock/_restoreStock`. **Comportement identique observé de l'extérieur**.

`_openMeta` futur :
```js
function _openMeta(){ return _openUnifiedDB().then(db => db); }
// + helper _metaTx(mode) qui prend tx.objectStore("meta")
```

Toutes les fonctions publiques de `window._acimTest` (lignes 4003-4023) doivent rester stables.

## 7. API `window._acimAudit` — stable, figée v1

```js
window._acimAudit = {
  // Append-only. Retourne Promise<{ok:boolean, eventId?:string, error?:string}>.
  log: function(event): Promise<...>,

  // Lecture par index (retourne toujours trié par timestamp asc).
  getByEntity:    function(entityType, entityId): Promise<Event[]>,
  getByType:      function(type):                  Promise<Event[]>,
  getByActor:     function(actorId):               Promise<Event[]>,
  getBySession:   function(sessionId):            Promise<Event[]>,
  getByTimeRange: function(t0, t1):               Promise<Event[]>,

  // Stats minimales pour PR D ( Administration ) plus tard.
  count:  function():                       Promise<number>,
  first:  function():                       Promise<Event|null>,
  last:   function():                       Promise<Event|null>,

  // Utilitaire : génère un sessionId, persisté dans meta.
  // Appelé une fois au boot.
  ensureSession: function():                Promise<string>,
};
```

**Interdits en v1** (et c'est explicitement testé) :
- `audit.update()`, `audit.delete()`, `audit.clear()` → ne pas exposer.

## 8. Tests obligatoires PR A (`tests/run-e2e-audit.js`)

1. **DB neuve** : ouverture page vide → `acim` v2 créée avec les 4 stores + index.
2. **Migration DB existante** : pré-remplir `acim-catalog` avec 3 produits, `acim-sales` avec 1 vente, `acim-meta` avec `schema-version=4` → refresh page → vérifier que `acim.products` contient 3, `acim.sales` contient 1, `acim.meta.schema-version=4`, et que `acim-catalog`/`acim-sales`/`acim-meta` n'existent plus.
3. **Création audit event** : `audit.log({type:"SESSION_START",...})` → resolve OK, `audit.count()` == 1.
4. **Lecture par index** : logguer 3 events avec `entityType:"sale"` différents entityId → `getByEntity("sale","T1")` retourne 1.
5. **Fermeture/relance** : 2 events, refresh page, `audit.count()` == 2 (persistance OK).
6. **Immuabilité** : tenter `audit_events.put` direct → doivent exposer un error. Tenter `audit_events.delete` → idem.
7. **Crash recovery migration** : pré-remplir `acim-catalog` avec 5 produits, intercepter `deleteDatabase("acim-catalog")` pour le faire échouer, refresh → les 5 produits sont dans `acim.products`, mais `acim-catalog` existe encore → second refresh → migration idempotente re-détecte meta.migrated=true, ne recopie pas, et ne crashe pas.
8. **Non-régression Sprint 4.0** : relancer `tests/run-e2e-robust.js` après PR A → doit rester 20 pass / 0 fail.

## 9. Fichiers ajoutés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `acim-audit.js` | NOUVEAU | Audit Core (UUID, types/constants, `window._acimAudit`) |
| `acim-caisse.js` | MODIFIE | `_openUnifiedDB()` + migration in-place + redirection helpers |
| `pos.html` | MODIFIE | `<script src="acim-audit.js">` avant `acim-caisse.js` |
| `tests/run-e2e-audit.js` | NOUVEAU | Tests PR A (8 scénarios ci-dessus) |
| `tests/serve.js` | PAS TOUCHÉ | Le serveur statique reste tel quel |
| `docs/PR_A_PLAN.md` | NOUVEAU | Ce document |

## 10. Critère d'acceptation PR A

- ✅ `tests/run-e2e-audit.js` : 8 scénarios verts.
- ✅ `tests/run-e2e-robust.js` : 20 pass / 0 fail (zéro régression Sprint 4.0).
- ✅ Aucune supression de données utilisateur (migration idempotente vérifiée).
- ✅ `window._acimTest.*` inchangé (compatibilité sandbox existante).
- ✅ Aucune dépendance à Supabase / hash chain / UI — pas de code mort introduit.

## 11. Hors scope (explicitement reporté)

- Sync Supabase → PR D (Sprint 4.2)
- Backup/restauration → PR E (Sprint 4.2)
- Hash chain cryptographique → Sprint 4.3 (si validé)
- UI admin audit → Sprint 5.x
- Rôles utilisateurs / PIN → Sprint 5.x
- Manager approval → Sprint 5.x
- Singleton commande / command journal pattern → Sprint 4.3 (si on voit un besoin
