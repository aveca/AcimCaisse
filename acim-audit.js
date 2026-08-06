// acim-audit.js — AcimCaisse Audit Core (Sprint 4.1 PR A)
// Append-only event log stored in unified IndexedDB "acim" (v2).
// Exposes window._acimAudit — single entry point. Never write to audit_events directly.
//
// Schema: see docs/PR_A_PLAN.md §3. Versionné via schemaVersion field of each event.
// Immutable: no update, no delete exposed in v1. Append-only strict.
(function(){
  "use strict";

  // ─── CONSTANTS ─────────────────────────────────────────────────────
  var SCHEMA_VERSION = 1;             // version of the AuditEvent shape (independent of IDB version)
  var DB_NAME = "acim";                // unified DB — must match acim-caisse.js
  var DB_VERSION = 2;                  // bump when adding stores/indexes
  var STORE_AUDIT = "audit_events";
  var STORE_META = "meta";

  // Event types (UPPER_SNAKE). v1 = 10 values.
  var TYPE = {
    SALE_CREATED:        "SALE_CREATED",
    SALE_COMPLETED:      "SALE_COMPLETED",
    SALE_CANCELLED:      "SALE_CANCELLED",
    STOCK_DECREMENT:     "STOCK_DECREMENT",
    STOCK_INCREMENT:     "STOCK_INCREMENT",
    STOCK_ADJUSTED:      "STOCK_ADJUSTED",
    SESSION_START:       "SESSION_START",
    SESSION_END:         "SESSION_END",
    SYSTEM_ERROR:        "SYSTEM_ERROR",
    MIGRATION_COMPLETED: "MIGRATION_COMPLETED"
  };

  // Entity types — v1 = 5 values.
  var ENTITY = {
    SALE:    "sale",
    PRODUCT: "product",
    STOCK:   "stock",
    SESSION: "session",
    SYSTEM:  "system"
  };

  // Actions — verbs qualifying the event type.
  var ACTION = {
    CREATE:    "create",
    COMPLETE:  "complete",
    CANCEL:    "cancel",
    DECREMENT: "decrement",
    INCREMENT: "increment",
    ADJUST:    "adjust",
    START:     "start",
    END:       "end",
    ERROR:     "error",
    MIGRATE:   "migrate"
  };

  // ─── STATE ─────────────────────────────────────────────────────────
  var _auditDb = null;        // cached IDBDatabase (same as caisse's _unifiedDb)
  var _sessionId = null;       // UUID generated at boot, persisted in meta
  var _actorId = null;         // null in v1 (no auth). PR C will populate from login.
  var _sessionStartTs = null;  // boot timestamp

  var META_SESSION_KEY = "acim-audit-session-id";
  var META_ACTOR_KEY   = "acim-audit-actor-id";

  // ─── UTILS ─────────────────────────────────────────────────────────
  function _uuid(){
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch(e){}
    // Fallback RFC4122 v4 (sufficient; not collusion-proof)
    var s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "x") out += Math.floor(Math.random()*16).toString(16);
      else if (c === "y") out += Math.floor(Math.random()*4 + 8).toString(16);
      else out += c;
    }
    return out;
  }

  function _now(){ return Date.now(); }

  // ─── DB HANDLE ─────────────────────────────────────────────────────
  // We don't open the DB here — the caisse module owns the unified DB and
  // calls _acimAudit.bind(db) once migration is done. This avoids a second
  // open() that could race with onupgradeneeded.
  function _bind(db){
    _auditDb = db;
  }

  function _getDb(){
    if (_auditDb) return Promise.resolve(_auditDb);
    // Fallback: open our own handle. Used by tests that bypass caisse init.
    return new Promise(function(resolve){
      try {
        var r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onsuccess = function(e){ _auditDb = e.target.result; resolve(_auditDb); };
        r.onerror   = function(){ resolve(null); };
      } catch(e){ resolve(null); }
    });
  }

  // ─── SESSION MANAGEMENT ────────────────────────────────────────────
  function ensureSession(){
    if (_sessionId) return Promise.resolve(_sessionId);
    return _getDb().then(function(db){
      if (!db) return null;
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_META, "readwrite");
        var store = tx.objectStore(STORE_META);
        var req = store.get(META_SESSION_KEY);
        req.onsuccess = function(){
          // We always start a fresh session per boot — do NOT reuse persisted id.
          // Persisted id is kept only for forensic correlation across boots.
          _sessionId = _uuid();
          _sessionStartTs = _now();
          store.put({ key: META_SESSION_KEY, value: _sessionId, bootTime: _sessionStartTs });
          tx.oncomplete = function(){ resolve(_sessionId); };
          tx.onerror    = function(){ resolve(_sessionId); /* session persists in memory even if meta write fails */ };
        };
        req.onerror = function(){ resolve(null); };
      });
    });
  }

  function setActor(actorId){
    _actorId = actorId || null;
    // Persist for forensic continuity across refreshes within same browser session.
    return _getDb().then(function(db){
      if (!db) return;
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_META, "readwrite");
        tx.objectStore(STORE_META).put({ key: META_ACTOR_KEY, value: _actorId });
        tx.oncomplete = function(){ resolve(); };
        tx.onerror    = function(){ resolve(); };
      });
    });
  }

  function getSessionId(){ return _sessionId; }
  function getActorId(){   return _actorId; }

  // ─── INTERNAL: build event envelope ────────────────────────────────
  function _buildEvent(partial){
    return {
      id:            partial.id || _uuid(),
      schemaVersion: SCHEMA_VERSION,
      timestamp:     partial.timestamp || _now(),
      type:          partial.type,
      actorId:       partial.actorId !== undefined ? partial.actorId : _actorId,
      sessionId:     partial.sessionId || _sessionId,
      entityType:    partial.entityType,
      entityId:      partial.entityId || null,
      action:        partial.action,
      payload:       partial.payload || {},
      previousState: partial.previousState || null,
      newState:      partial.newState || null,
      status:        partial.status || "COMMITTED"
    };
  }

  // ─── PUBLIC API: log ───────────────────────────────────────────────
  // log(event) → Promise<{ok, eventId?, error?}>
  //
  // Standalone write — used by SESSION_START, SYSTEM_ERROR, MIGRATION_COMPLETED
  // (events outside a métier transaction).
  //
  // For events co-transactional with a métier mutation, PR B will use
  // logInTx(tx, event) — not exposed in PR A.
  function log(partial){
    return _getDb().then(function(db){
      if (!db) return { ok: false, error: "no-db" };
      var event = _buildEvent(partial);
      return new Promise(function(resolve){
        try {
          var tx = db.transaction(STORE_AUDIT, "readwrite");
          tx.objectStore(STORE_AUDIT).add(event);   // add() — fails if key already exists (immutability guard)
          tx.oncomplete = function(){ resolve({ ok: true, eventId: event.id }); };
          tx.onerror   = function(e){
            resolve({ ok: false, error: "tx-error", detail: String(e && e.target && e.target.error && e.target.error.name || "unknown") });
          };
          tx.onabort = function(e){
            resolve({ ok: false, error: "tx-aborted", detail: String(e && e.target && e.target.error && e.target.error.name || "aborted") });
          };
        } catch(e){
          resolve({ ok: false, error: "exception", detail: String(e && e.message || e) });
        }
      });
    }).catch(function(e){
      return { ok: false, error: "exception", detail: String(e && e.message || e) };
    });
  }

  // ─── PUBLIC API: logInTx ───────────────────────────────────────────
  // Adds an event inside an existing readwrite transaction on the audit_events
  // store. Caller MUST include "audit_events" in the tx store list.
  // Returns the event object (sync — written via tx.objectStore("audit_events").add()).
  // PR B will use this to co-commit métier mutation + audit event.
  function logInTx(tx, partial){
    var event = _buildEvent(partial);
    try {
      tx.objectStore(STORE_AUDIT).add(event);
    } catch(e){
      // We can't abort the caller's tx from here without side effects.
      // Rethrow so caller can decide. Tests verify immutability via this path.
      throw e;
    }
    return event;
  }

  // ─── PUBLIC API: queries ────────────────────────────────────────────
  function _queryByIndex(indexName, value){
    return _getDb().then(function(db){
      if (!db) return [];
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_AUDIT, "readonly");
        var idx = tx.objectStore(STORE_AUDIT).index(indexName);
        var req = idx.getAll(value);
        req.onsuccess = function(){
          var arr = req.result || [];
          arr.sort(function(a,b){ return a.timestamp - b.timestamp; });
          resolve(arr);
        };
        req.onerror = function(){ resolve([]); };
      });
    });
  }

  function getByEntity(entityType, entityId){ return _queryByIndex("by_entityType", entityType).then(function(all){
    if (entityId == null) return all;
    return all.filter(function(e){ return e.entityId === entityId; });
  }); }

  function getByType(type){      return _queryByIndex("by_type", type); }
  function getByActor(actorId){  return _queryByIndex("by_actorId", actorId); }
  function getBySession(sId){    return _queryByIndex("by_sessionId", sId); }
  function getByTimeRange(t0, t1){
    return _getDb().then(function(db){
      if (!db) return [];
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_AUDIT, "readonly");
        var idx = tx.objectStore(STORE_AUDIT).index("by_timestamp");
        var req = idx.getAll(IDBKeyRange.bound(t0, t1));
        req.onsuccess = function(){ resolve(req.result || []); };
        req.onerror   = function(){ resolve([]); };
      });
    });
  }

  function count(){
    return _getDb().then(function(db){
      if (!db) return 0;
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_AUDIT, "readonly");
        var req = tx.objectStore(STORE_AUDIT).count();
        req.onsuccess = function(){ resolve(req.result || 0); };
        req.onerror   = function(){ resolve(0); };
      });
    });
  }

  function first(){
    return _getDb().then(function(db){
      if (!db) return null;
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_AUDIT, "readonly");
        var idx = tx.objectStore(STORE_AUDIT).index("by_timestamp");
        var req = idx.openCursor(); // asc by default
        req.onsuccess = function(){
          var c = req.result;
          resolve(c ? c.value : null);
        };
        req.onerror = function(){ resolve(null); };
      });
    });
  }

  function last(){
    return _getDb().then(function(db){
      if (!db) return null;
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_AUDIT, "readonly");
        var idx = tx.objectStore(STORE_AUDIT).index("by_timestamp");
        var req = idx.openCursor(null, "prev");
        req.onsuccess = function(){
          var c = req.result;
          resolve(c ? c.value : null);
        };
        req.onerror = function(){ resolve(null); };
      });
    });
  }

  // ─── EXPORTS ────────────────────────────────────────────────────────
  window._acimAudit = {
    // Constants — exposed for tests and caller code
    TYPE: TYPE,
    ENTITY: ENTITY,
    ACTION: ACTION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORE_AUDIT: STORE_AUDIT,

    // Internal binding — called by acim-caisse.js after unified DB open
    _bind: _bind,

    // Lifecycle
    ensureSession: ensureSession,
    setActor:      setActor,
    getSessionId:  getSessionId,
    getActorId:    getActorId,

    // Write
    log:     log,      // standalone (out-of-transaction)
    logInTx: logInTx,  // inside a caller-owned rw tx that includes audit_events

    // Read
    getByEntity:    getByEntity,
    getByType:      getByType,
    getByActor:     getByActor,
    getBySession:   getBySession,
    getByTimeRange: getByTimeRange,
    count:          count,
    first:          first,
    last:           last
  };
})();
