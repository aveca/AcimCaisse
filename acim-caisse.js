// ─── AcimCaisse v1.3.0#40 — Transactional stock + kg weight fix + version unification ──
;(function(){
  "use strict";
  var _log=function(m){console.log("[Acim] "+m);};
  var _err=function(m,e){console.error("[Acim] "+m,e);};

  // ─── MULTI-TAB LOCK ──────────────────────────────────
  var _tabLockKey="acim-caisse-tab-lock";
  var _tabId=Date.now()+"-"+Math.floor(Math.random()*99999);
  var _isMainTab=true;
  function _acquireTabLock(){
    try{
      var prev=localStorage.getItem(_tabLockKey);
      var now=Date.now();
      if(prev){var parts=prev.split("|");var ts=parseInt(parts[0]);var id=parts[1];
        if(now-ts<5000&&id!==_tabId){_isMainTab=false;_log("Another tab is active — this tab is secondary");return false;}
      }
      localStorage.setItem(_tabLockKey,now+"|"+_tabId);
      return true;
    }catch(e){return true;}
  }
  function _refreshTabLock(){try{localStorage.setItem(_tabLockKey,Date.now()+"|"+_tabId);}catch(e){}}
  function _releaseTabLock(){try{var prev=localStorage.getItem(_tabLockKey);if(prev&&prev.indexOf(_tabId)>=0)localStorage.removeItem(_tabLockKey);}catch(e){}}
  window.addEventListener("beforeunload",_releaseTabLock);
  setInterval(_refreshTabLock,3000);

  // ─── AUTO-BARCODE ────────────────────────────────────
  var _bcSeq=2000;
  var _bcSeqKey="acim-bc-seq";
  function _nextBarcode(){return "ACIM-"+(_bcSeq++);}
  function _loadBcSeq(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_bcSeqKey);
        r.onsuccess=function(){if(r.result&&typeof r.result.value==="number")_bcSeq=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveBcSeq(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_bcSeqKey,value:_bcSeq});
    }).catch(function(){});
  }
  var _origNextBarcode=_nextBarcode;
  _nextBarcode=function(){var bc=_origNextBarcode();_saveBcSeq();return bc;};

  // ─── TICKET NUMBER ───────────────────────────────────
  var _ticketSeq=100;
  var _ticketSeqKey="acim-ticket-seq";
  function _nextTicket(){return _ticketSeq++;}
  function _loadTicketSeq(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_ticketSeqKey);
        r.onsuccess=function(){if(r.result&&typeof r.result.value==="number")_ticketSeq=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveTicketSeq(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_ticketSeqKey,value:_ticketSeq});
    }).catch(function(){});
  }

  // ─── STORE SETTINGS ──────────────────────────────────
  var _settings={storeName:"AcimCaisse",footer:"Merci de votre visite !"};
  var _settingsKey="acim-store-settings";
  function _loadSettings(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_settingsKey);
        r.onsuccess=function(){if(r.result&&r.result.value)_settings=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveSettings(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_settingsKey,value:_settings});
    }).catch(function(){});
  }

  // ─── META STORE ──────────────────────────────────────
  // Sprint 4.1 PR A — unified DB "acim" (v2). Stores products + sales + meta + audit_events.
  // Old DBs (acim-catalog, acim-sales, acim-meta) are migrated in-place then deleted.
  // Sprint 4.1 PR C — bump to v3: add "users" store for operator identity (PIN salé).
  var _UNIFIED_DB="acim";
  var _UNIFIED_VERSION=3;
  var _unifiedDb=null;
  var _MIGRATED_KEY="acim-migrated-v2";

  function _openUnifiedDB(){
    if(_unifiedDb)return Promise.resolve(_unifiedDb);
    return new Promise(function(ok){
      try{
        var r=indexedDB.open(_UNIFIED_DB,_UNIFIED_VERSION);
        r.onupgradeneeded=function(e){
          var d=e.target.result;
          if(!d.objectStoreNames.contains("products")) d.createObjectStore("products",{keyPath:"barcode"});
          if(!d.objectStoreNames.contains("sales"))    d.createObjectStore("sales",{keyPath:"id",autoIncrement:true});
          if(!d.objectStoreNames.contains("meta"))     d.createObjectStore("meta",{keyPath:"key"});
          if(!d.objectStoreNames.contains("audit_events")){
            var s=d.createObjectStore("audit_events",{keyPath:"id"});
            s.createIndex("by_timestamp","timestamp",{unique:false});
            s.createIndex("by_type","type",{unique:false});
            s.createIndex("by_actorId","actorId",{unique:false});
            s.createIndex("by_sessionId","sessionId",{unique:false});
            s.createIndex("by_entityType","entityType",{unique:false});
            s.createIndex("by_entityId","entityId",{unique:false});
          }
          // PR C — users store for operator identity. Schema:
          //   { id:string (IMMUABLE), salt:base64(16 octets), pinHash:base64(SHA-256(salt||pin)),
          //     name:string (modifiable), role:"cashier"|"manager", active:boolean, createdAt:number }
          // Invariant d'identité: audit_events.actorId = users.id (jamais le name).
          if(!d.objectStoreNames.contains("users")){
            var u=d.createObjectStore("users",{keyPath:"id"});
            u.createIndex("by_active","active",{unique:false});
          }
          _log("Unified DB upgrade v"+e.target.result.version+" — stores: "+Array.prototype.slice.call(d.objectStoreNames).join(", "));
        };
        r.onsuccess=function(e){_unifiedDb=e.target.result;ok(_unifiedDb);};
        r.onerror=function(e){_err("Unified DB open error:",e);ok(null);};
        r.onblocked=function(){_err("Unified DB open blocked");ok(null);};
      }catch(e){_err("Unified DB open exception:",e);ok(null);}
    });
  }

  // Backward-compat shim — kept the same name so all existing callers work unchanged.
  // Returned handle is the unified DB; transactions target the "meta" store as before.
  var _metaDb=null;
  function _openMeta(){
    if(_unifiedDb)return Promise.resolve(_unifiedDb);
    if(_metaDb)return Promise.resolve(_metaDb);
    return _openUnifiedDB().then(function(db){
      _metaDb=db;
      return db;
    });
  }

  // ─── LEGACY DB MIGRATION (in-place, idempotent) ──────
  // See docs/PR_A_PLAN.md §5. Copies acim-catalog/products, acim-sales/sales,
  // acim-meta/meta into the unified DB, then deletes the legacy DBs.
  function _maybeMigrateLegacy(){
    return _openUnifiedDB().then(function(db){
      if(!db)return {ok:false,reason:"no-db"};
      // First check if already migrated
      return new Promise(function(done){
        var tx0=db.transaction("meta","readonly");
        var r0=tx0.objectStore("meta").get(_MIGRATED_KEY);
        r0.onsuccess=function(){
          if(r0.result&&r0.result.value===true){done({ok:true,alreadyMigrated:true});return;}
          // Not yet migrated — open the three legacy DBs and copy.
          _copyLegacyIntoUnified(db).then(done).catch(function(e){
            _err("Legacy migration failed:",e);
            if(window._acimAudit)window._acimAudit.log({type:"SYSTEM_ERROR",entityType:"system",action:"error",payload:{message:"migration error: "+String(e&&e.message||e)}});
            done({ok:false,error:String(e&&e.message||e)});
          });
        };
        r0.onerror=function(){done({ok:false,error:"meta-read-error"});};
      });
    });
  }

  function _openLegacyIfExist(name){
    // Probe WITHOUT onupgradeneeded — if the DB doesn't exist, return null without creating it.
    return new Promise(function(resolve){
      try{
        // open() without version opens existing latest version OR triggers
        // onupgradeneeded only if DB doesn't exist (the docs say: requests a
        // database without changing the version). When the DB is absent,
        // onupgradeneeded fires with version 0→1; we abort to avoid creating it.
        var r=indexedDB.open(name);
        r.onupgradeneeded=function(e){
          try{ e.target.transaction.abort(); }catch(_){}
        };
        r.onsuccess=function(e){resolve(e.target.result);};
        r.onerror=function(){resolve(null);};
        r.onblocked=function(){resolve(null);};
      }catch(e){resolve(null);}
    });
  }

  function _openLegacy(name,upgradeFn){
    return new Promise(function(resolve){
      try{
        var r=indexedDB.open(name,1);
        r.onupgradeneeded=function(e){upgradeFn(e.target.result);};
        r.onsuccess=function(e){resolve(e.target.result);};
        r.onerror=function(){resolve(null);};
      }catch(e){resolve(null);}
    });
  }

  function _copyLegacyIntoUnified(unifiedDb){
    // FIRST: probe each legacy DB without creating it. If none exist, skip migration entirely.
    return Promise.all([
      _openLegacyIfExist("acim-catalog"),
      _openLegacyIfExist("acim-sales"),
      _openLegacyIfExist("acim-meta")
    ]).then(function(probes){
      if(!probes[0] && !probes[1] && !probes[2]){
        // No legacy DBs at all — mark migration done and emit event, skip copy.
        return new Promise(function(resolve){
          var tx=unifiedDb.transaction(["meta","audit_events"],"readwrite");
          tx.objectStore("meta").put({key:_MIGRATED_KEY,value:true,migratedAt:Date.now(),reason:"no-legacy"});
          try{
            if(window._acimAudit){
              var evt={
                id:(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():("m-"+Date.now()+"-"+Math.random().toString(36).slice(2)),
                schemaVersion:window._acimAudit.SCHEMA_VERSION,
                timestamp:Date.now(),
                type:window._acimAudit.TYPE.MIGRATION_COMPLETED,
                actorId:null,
                sessionId:window._acimAudit.getSessionId(),
                entityType:"system",
                entityId:null,
                action:"migrate",
                payload:{fromVersion:1,toVersion:_UNIFIED_VERSION,copied:{products:0,sales:0,meta:0},reason:"no-legacy"},
                previousState:null,
                newState:null,
                status:"COMMITTED"
              };
              tx.objectStore("audit_events").add(evt);
            }
          }catch(e){_err("audit event during migration (no-legacy) failed:",e);}
          tx.oncomplete=function(){resolve({ok:true,alreadyMigrated:false,reason:"no-legacy",copied:{products:0,sales:0,meta:0}});};
          tx.onerror=function(e){resolve({ok:false,error:"no-legacy-tx-error",detail:String(e&&e.target&&e.target.error&&e.target.error.name||"unknown")});};
        });
      }
      // Open the legacy DBs that do exist (with upgradeFn for safety) and copy.
      return Promise.all([
        probes[0] ? Promise.resolve(probes[0]) : _openLegacy("acim-catalog",function(d){if(!d.objectStoreNames.contains("products"))d.createObjectStore("products",{keyPath:"barcode"});}),
        probes[1] ? Promise.resolve(probes[1]) : _openLegacy("acim-sales",  function(d){if(!d.objectStoreNames.contains("sales"))d.createObjectStore("sales",{keyPath:"id",autoIncrement:true});}),
        probes[2] ? Promise.resolve(probes[2]) : _openLegacy("acim-meta",   function(d){if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"key"});})
      ]).then(function(results){
        var catDb=results[0], salesDb=results[1], metaDb=results[2];
        return Promise.all([
          catDb   ? new Promise(function(ok){var rq=catDb.transaction("products","readonly").objectStore("products").getAll();rq.onsuccess=function(){ok(rq.result||[]);};rq.onerror=function(){ok([]);};}) : Promise.resolve([]),
          salesDb ? new Promise(function(ok){var rq=salesDb.transaction("sales","readonly").objectStore("sales").getAll();rq.onsuccess=function(){ok(rq.result||[]);};rq.onerror=function(){ok([]);};}) : Promise.resolve([]),
          metaDb  ? new Promise(function(ok){var rq=metaDb.transaction("meta","readonly").objectStore("meta").getAll();rq.onsuccess=function(){ok(rq.result||[]);};rq.onerror=function(){ok([]);};}) : Promise.resolve([])
        ]).then(function(arr){
          var products=arr[0]||[], sales=arr[1]||[], meta=arr[2]||[];
          return new Promise(function(resolve){
            var tx=unifiedDb.transaction(["products","sales","meta","audit_events"],"readwrite");
            var sProd=tx.objectStore("products");
            var sSal=tx.objectStore("sales");
            var sMet=tx.objectStore("meta");
            var sAud=tx.objectStore("audit_events");
            for(var i=0;i<products.length;i++) sProd.put(products[i]);
            for(var j=0;j<sales.length;j++){
              var sale=Object.assign({},sales[j]);
              if(sale.id!=null) sSal.put(sale);
            }
            for(var k=0;k<meta.length;k++){
              if(meta[k].key===_MIGRATED_KEY) continue;
              sMet.put(meta[k]);
            }
            sMet.put({key:_MIGRATED_KEY,value:true,migratedAt:Date.now()});
            try {
              if(window._acimAudit){
                var evt={
                  id:(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():("m-"+Date.now()+"-"+Math.random().toString(36).slice(2)),
                  schemaVersion:window._acimAudit.SCHEMA_VERSION,
                  timestamp:Date.now(),
                  type:window._acimAudit.TYPE.MIGRATION_COMPLETED,
                  actorId:null,
                  sessionId:window._acimAudit.getSessionId(),
                  entityType:"system",
                  entityId:null,
                  action:"migrate",
                  payload:{fromVersion:1,toVersion:_UNIFIED_VERSION,copied:{products:products.length,sales:sales.length,meta:meta.length}},
                  previousState:null,
                  newState:null,
                  status:"COMMITTED"
                };
                sAud.add(evt);
              }
            } catch(e){ _err("audit event during migration failed:", e); }
            tx.oncomplete=function(){
              try{ indexedDB.deleteDatabase("acim-catalog"); }catch(e){}
              try{ indexedDB.deleteDatabase("acim-sales"); }catch(e){}
              try{ indexedDB.deleteDatabase("acim-meta"); }catch(e){}
              if(catDb) try{catDb.close();}catch(e){}
              if(salesDb) try{salesDb.close();}catch(e){}
              if(metaDb) try{metaDb.close();}catch(e){}
              resolve({ok:true,copied:{products:products.length,sales:sales.length,meta:meta.length}});
            };
            tx.onerror=function(e){resolve({ok:false,error:"copy-tx-error",detail:String(e&&e.target&&e.target.error&&e.target.error.name||"unknown")});};
            tx.onabort=function(e){resolve({ok:false,error:"copy-tx-aborted",detail:String(e&&e.target&&e.target.error&&e.target.error.name||"aborted")});};
          });
        });
      });
    });
  }

  // ─── CATEGORIES ──────────────────────────────────────
  var CATS=[
    {id:"viande",ic:"🥩"}, {id:"volaille",ic:"🐔"}, {id:"poisson",ic:"🐟"}, {id:"laitier",ic:"🧀"}, {id:"epicerie",ic:"🏪"},
    {id:"boulangerie",ic:"🍞"}, {id:"boisson",ic:"🥤"}, {id:"surgelé",ic:"🧊"},
    {id:"snack",ic:"🍪"}, {id:"condiment",ic:"🧂"}, {id:"menager",ic:"🧴"},
    {id:"fruits",ic:"🍎"}, {id:"legumes",ic:"🥬"}, {id:"vin",ic:"🍷"}, {id:"autre",ic:"📦"}
  ];
  function _catIcon(id){
    for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i].ic;
    return "📦";
  }
  var _catBg={viande:"#fce4e4",volaille:"#fef0db",poisson:"#e0f2fe",laitier:"#dbeafe",epicerie:"#dcfce7",boulangerie:"#fef9c3",boisson:"#ccfbf1",snack:"#fef3c7",condiment:"#f3f4f6",menager:"#ede9fe",surgelé:"#cffafe",fruits:"#fef9c3",legumes:"#dcfce7",vin:"#fce7f3",autre:"#f5f5f5"};

  // ─── SVG PRODUCT IMAGE GENERATOR ──
  function _generateProductSVG(name,category,priceCents){
    var cat=(category||"autre").toLowerCase();
    var bg=_catBg[cat]||"#f5f5f5";
    var icon=_catIcon(cat);
    var initials=(name||"?").split(" ").slice(0,2).map(function(w){return w.charAt(0).toUpperCase();}).join("");
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">';
    svg+='<rect width="200" height="200" fill="'+bg+'"/>';
    svg+='<text x="100" y="90" text-anchor="middle" font-size="72" fill="rgba(0,0,0,0.08)">'+icon+'</text>';
    svg+='<text x="100" y="145" text-anchor="middle" font-size="32" font-weight="800" fill="rgba(0,0,0,0.18)" font-family="-apple-system,sans-serif">'+initials+'</text>';
    svg+='</svg>';
    return "data:image/svg+xml,"+encodeURIComponent(svg);
  }


  // ─── CATALOGUE IndexedDB ─────────────────────────────────
  // Schema versioning — must match version.json "schema" field.
  // Migrations run at boot after _openDB succeeds, before any user flow.
  var _SCHEMA_CURRENT=4;
  var _SCHEMA_KEY="schema-version";
  var _migrations={
    2:function(all){ // v1 → v2 : ensure kg fields exist on products
      var n=0;for(var i=0;i<all.length;i++){var p=all[i];
        if(p.unitType===undefined)p.unitType=null;
        if(p.pricePerUnit===undefined)p.pricePerUnit=null;
        if(p.unit===undefined)p.unit="unit";
        n++;
      }return Promise.resolve(n);
    },
    3:function(all){ // v2 → v3 : ensure low_stock_threshold + expiry_date
      var n=0;for(var i=0;i<all.length;i++){var p=all[i];
        if(p.low_stock_threshold===undefined)p.low_stock_threshold=5;
        if(p.expiry_date===undefined)p.expiry_date=null;
        if(p.source===undefined)p.source="migration";
        n++;
      }return Promise.resolve(n);
    },
    4:function(all){ // v3 → v4 : ensure last_updated present + sanitize stockQty
      var n=0;for(var i=0;i<all.length;i++){var p=all[i];
        if(!p.last_updated)p.last_updated=Date.now();
        if(typeof p.stockQty!=="number"||isNaN(p.stockQty))p.stockQty=0;
        n++;
      }return Promise.resolve(n);
    }
  };
  function _migrateSchema(){
    return _openMeta().then(function(d){
      if(!d)return {from:_SCHEMA_CURRENT,to:_SCHEMA_CURRENT,applied:0};
      return new Promise(function(ok){
        var tx=d.transaction("meta","readonly");
        var req=tx.objectStore("meta").get(_SCHEMA_KEY);
        req.onsuccess=function(){
          var current=req.result?parseInt(req.result.value,10)||1:1;
          if(current>=_SCHEMA_CURRENT){_log("Schema v"+current+" — no migration needed");ok({from:current,to:_SCHEMA_CURRENT,applied:0});return;}
          _log("Schema migration: v"+current+" → v"+_SCHEMA_CURRENT);
          var applied=0;
          function next(v){
            if(v>=_SCHEMA_CURRENT){
              return _openMeta().then(function(d2){
                if(!d2)return;
                var tx2=d2.transaction("meta","readwrite");
                tx2.objectStore("meta").put({key:_SCHEMA_KEY,value:_SCHEMA_CURRENT});
                return new Promise(function(r2){tx2.oncomplete=r2;tx2.onerror=r2;});
              }).then(function(){return applied;});
            }
            var mig=_migrations[v+1];
            if(!mig){return next(v+1);}
            return _dbGetAll().then(function(all){
              _log("Applying migration v"+v+"→v"+(v+1)+" on "+(all?all.length:0)+" products");
              return mig(all||[]);
            }).then(function(count){
              return _dbGetAll().then(function(all){
                var chain=Promise.resolve();
                all.forEach(function(p){chain=chain.then(function(){return _dbPut(p);});});
                return chain;
              });
            }).then(function(){applied++;return next(v+1);});
          }
          next(current).then(function(n){_log("Migrations done. "+n+" applied (now v"+_SCHEMA_CURRENT+")");ok({from:current,to:_SCHEMA_CURRENT,applied:n});});
        };
        req.onerror=function(){ok({from:_SCHEMA_CURRENT,to:_SCHEMA_CURRENT,applied:0,error:"meta-read-failed"});};
      });
    }).catch(function(e){_err("Schema migration error:",e);return {error:String(e)};});
  }

  var _db=null;
  function _openDB(){
    // Sprint 4.1 PR A — return unified DB; "products" store lives there now.
    if(_unifiedDb)return Promise.resolve(_unifiedDb);
    if(_db)return Promise.resolve(_db);
    return _openUnifiedDB().then(function(d){
      _db=d;
      return d;
    });
  }
  function _dbGet(bc){return _openDB().then(function(d){if(!d)return null;
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").get(bc);r.onsuccess=function(){ok(r.result||null);};r.onerror=function(){ok(null);};});});}
  function _dbPut(p){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").put(p);tx.oncomplete=ok;tx.onerror=ok;});});}
  function _dbGetAll(){return _openDB().then(function(d){if(!d)return[];
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").getAll();r.onsuccess=function(){ok(r.result||[]);};r.onerror=function(){ok([]);};});});}
  function _dbDelete(bc){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").delete(bc);tx.oncomplete=ok;tx.onerror=ok;});});}
  function _dbDeleteAll(){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").clear();tx.oncomplete=ok;tx.onerror=ok;});});}

  // ─── SALES STORE ─────────────────────────────────────
  // Sprint 4.1 PR A — sales store now lives in unified DB "acim".
  function _openSalesDB(){
    if(_unifiedDb)return Promise.resolve(_unifiedDb);
    return _openUnifiedDB();
  }
  function _persistSale(ticketNumber,items,totalCents,discountCents,payments){
    return _openSalesDB().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var tx=d.transaction("sales","readwrite");
        tx.objectStore("sales").put({
          ticketNumber:ticketNumber,
          timestamp:Date.now(),isoTime:new Date().toISOString(),
          items:items.map(function(it){return{
            name:it.name,price:it.priceCents,barcode:it.bc||"",cat:it.cat,
            weight:it.weight||null,unitType:it.unitType||null,pricePerUnit:it.pricePerUnit||null,
            discountCents:it.discountCents||0,qty:it.qty||1
          };}),
          totalCents:totalCents,
          discountCents:discountCents||0,
          payments:payments||[],
          itemCount:items.length
        });
        tx.oncomplete=function(){ok(true);};tx.onerror=function(){ok(false);};
      });
    }).catch(function(e){_err("Sale persist failed:",e);return Promise.resolve(false);});
  }
  function _getSalesHistory(){
    return _openSalesDB().then(function(d){
      if(!d)return[];
      return new Promise(function(ok){
        var r=d.transaction("sales","readonly").objectStore("sales").getAll();
        r.onsuccess=function(){ok(r.result||[]);};r.onerror=function(){ok([]);};
      });
    }).catch(function(){return[];});
  }

  // ─── STOCK HELPERS ───────────────────────────────────
  // BUG-001 fix: atomic read-modify-write via single readwrite transaction.
  // BUG-002 fix: caller passes the weight for kg products; qty for unit products.
  // Returns a Promise<{ok:boolean,newStock:number,reason:string}> so callers can react.
  function _decrementStock(barcode, qtyOrWeight){
    if(!barcode)return Promise.resolve({ok:false,reason:"no-barcode"});
    var amount=qtyOrWeight||1;
    return _openDB().then(function(d){
      if(!d)return {ok:false,reason:"no-db"};
      return new Promise(function(ok){
        var tx=d.transaction("products","readwrite");
        var store=tx.objectStore("products");
        var req=store.get(barcode);
        tx.oncomplete=function(){
          ok({ok:true,newStock:req.result?(req.result.stockQty||0):0,reason:"ok"});
        };
        tx.onerror=function(){ok({ok:false,reason:"tx-error"});};
        tx.onabort=function(){ok({ok:false,reason:"tx-aborted"});};
        req.onsuccess=function(){
          var p=req.result;
          if(!p){ok({ok:false,reason:"not-found"});tx.abort();return;}
          var cur=(p.stockQty||0);
          var next=cur-amount;
          if(next<0){
            var unit=(p.unitType||"unit");
            var isKg=(unit==="kg"||unit==="g"||unit==="L");
            ok({ok:false,reason:isKg?("stock-kg:"+cur):("stock:"+cur),currentStock:cur,requested:amount});
            tx.abort();return;
          }
          p.stockQty=next;
          p.last_updated=Date.now();
          store.put(p);
        };
        req.onerror=function(){ok({ok:false,reason:"get-error"});};
      });
    });
  }
  // Inverse of _decrementStock — used on ticket void / cancellation.
  function _restoreStock(barcode, qtyOrWeight){
    if(!barcode)return Promise.resolve({ok:false,reason:"no-barcode"});
    var amount=qtyOrWeight||1;
    return _openDB().then(function(d){
      if(!d)return {ok:false,reason:"no-db"};
      return new Promise(function(ok){
        var tx=d.transaction("products","readwrite");
        var store=tx.objectStore("products");
        var req=store.get(barcode);
        tx.oncomplete=function(){ok({ok:true,newStock:req.result?(req.result.stockQty||0):0,reason:"ok"});};
        tx.onerror=function(){ok({ok:false,reason:"tx-error"});};
        tx.onabort=function(){ok({ok:false,reason:"tx-aborted"});};
        req.onsuccess=function(){
          var p=req.result;
          if(!p){ok({ok:false,reason:"not-found"});tx.abort();return;}
          p.stockQty=(p.stockQty||0)+amount;
          p.last_updated=Date.now();
          store.put(p);
        };
        req.onerror=function(){ok({ok:false,reason:"get-error"});};
      });
    });
  }

  // ─── BACKUP IMPORT ───────────────────────────────────
  var _BACKUP_IMPORTED_KEY="acim-backup-imported-v1";
  var _BACKUP_DATA=null;

  // Load the catalog from the external JSON file (single source of truth for JS + Flutter).
  // Falls back to null → _importBackupFromEmbedded will skip the import gracefully.
  function _fetchCatalogJSON(){
    if(_BACKUP_DATA)return Promise.resolve(_BACKUP_DATA);
    var url='catalog.json';
    // On GitHub Pages the page lives at /AcimCaisse/ — relative URL resolves regardless.
    return fetch(url,{cache:'no-store'}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(obj){
      if(!obj||!obj.products||!obj.categories)throw new Error('malformed catalog.json');
      _BACKUP_DATA=obj;
      _log('Loaded catalog.json: '+obj.products.length+' products');
      return obj;
    }).catch(function(e){
      _err('catalog.json load failed:',e.message||e);
      return null;
    });
  }

  function _importBackupFromEmbedded(){
    return _openMeta().then(function(d){
      if(!d)return false;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_BACKUP_IMPORTED_KEY);
        r.onsuccess=function(){ok(!!(r.result&&r.result.value));};
        r.onerror=function(){ok(false);};
      });
    }).then(function(imported){
      if(imported){_log("Backup already imported");return false;}
      return _openDB().then(function(d){
        if(!d)return false;
        if(!d.objectStoreNames.contains("products")){
          _err("DB opened but 'products' store missing — retrying open");
          _db=null;
          return _openDB().then(function(d2){
            if(!d2)return false;
            return new Promise(function(ok){
              var r=d2.transaction("products","readonly").objectStore("products").count();
              r.onsuccess=function(){ok(r.result);};r.onerror=function(){ok(0);};
            });
          });
        }
        return new Promise(function(ok){
          var r=d.transaction("products","readonly").objectStore("products").count();
          r.onsuccess=function(){ok(r.result);};r.onerror=function(){ok(0);};
        });
      }).then(function(count){
        if(count>0){_log("IndexedDB already has "+count+" products, skipping import");return false;}
        if(!_BACKUP_DATA){_err("No catalog data available (catalog.json missing and no inline fallback)");return false;}
        var cats=_BACKUP_DATA.categories;
        var catMap={};
        for(var ci=0;ci<cats.length;ci++)catMap[cats[ci].id]=cats[ci].name;
        var prods=_BACKUP_DATA.products;
        var promises=[];
        for(var pi=0;pi<prods.length;pi++){
          var p=prods[pi];
          var barcode=p.b||("ACIM-DB-"+pi+"-"+Math.random().toString(36).substr(2,6));
          var catName=catMap[p.c]||"Divers";
          var mapped=catName.toLowerCase();
          if(mapped==="frais")mapped="viande";
          else if(mapped==="sec")mapped="snack";
          else if(mapped==="congele")mapped="surgelé";
          else if(mapped==="alcool")mapped="vin";else if(mapped==="divers")mapped="autre";else if(mapped==="epicerie")mapped="epicerie";
          promises.push(_dbPut({barcode:barcode,name:p.n,sale_price_cents:p.p,category:mapped,stockQty:p.s,unit:p.u||"unit",purchase_price_cents:p.pp||0,source:"backup-import",last_updated:Date.now()}));
        }
        return Promise.all(promises).then(function(){
          _openMeta().then(function(d){
            if(!d)return;var tx=d.transaction("meta","readwrite");
            tx.objectStore("meta").put({key:_BACKUP_IMPORTED_KEY,value:true});
          });
          _log("Imported "+prods.length+" products from backup");
          return true;
        });
      });
    }).catch(function(e){_err("Backup import error:",e);return false;});
  }

  var _YARDEN_IMPORTED_KEY="yarden-catalog-imported-v1";
  function _importYardenCatalog(){
    return _openMeta().then(function(d){
      if(!d)return false;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_YARDEN_IMPORTED_KEY);
        r.onsuccess=function(){
          if(r.result&&r.result.value){ok(false);return;}
          _doImportYarden().then(function(count){
            if(count>0){
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:_YARDEN_IMPORTED_KEY,value:true});
            }
            ok(count);
          }).catch(function(){ok(0);});
        };
        r.onerror=function(){_doImportYarden().then(function(c){ok(c);}).catch(function(){ok(0);});};
      });
    }).catch(function(e){_err("Yarden import error:",e);return 0;});
  }
  function _doImportYarden(){
    return fetch("./assets/assets/catalog/supplier_catalog.json").then(function(resp){
      if(!resp.ok)throw new Error("Fetch failed: "+resp.status);
      return resp.json();
    }).then(function(data){
      var products=data.products||[];
      if(!Array.isArray(products)||products.length===0)return 0;
      // Normalize supplier catalog for matching
      _supplierCatalog=products.map(function(p){
        return{
          barcode:p.ean||"",name:p.name||"",code:p.code||"",
          category:p.category||"",ean:p.ean||""
        };
      });
      var catMap={"Congele":"surgelé","Frais":"viande","Sec":"snack","Divers":"epicerie"};
      // ── FRAIS keywords ──
      var volailleKw=["poulet","poule","dinde","canard","oeuf","œuf","blanc poulet","cuisse","aiguillette","filet poulet","magret","foie gras","coq","parmelet","paupiette","pilon","pilori"];
      var viandeKw=["boeuf","bœuf","veau","agneau","porc","steak","côte","cotelette","entrecôte","bavette","haché","hache","rôti","roti","saucisse","jambon","lard","merguez","chipolata","boudin","salami","viande","poitrine","andouillette","rosette","saucisson"];
      var laitierKw=["lait","fromage","yaourt","yogurt","crème","beurre","emmental","gruyère","mozzarella","ricotta","parmesan","mascarpone","reblochon","camembert","brie","roquefort","chèvre","morbier","raclette","tome","comté"];
      // ── SEC keywords (alimentaire) ──
      var boissonAlcoolKw=["vin ","vin de","champagne","cidre","rhum","whisky","whiskey","vodka","gin ","grappa","armagnac","cognac","酒","saké","porto","marsala","madeira"];
      var boissonKw=["eau ","eau minérale","eau de source","jus ","jus de","soda","bière","biere","limonade","coca","sprite","perrier","boisson","thé ","thé de","café ","café de","tisane","infusion","ice tea","oranga"];
      var condimentKw=["vinaigre","moutarde","ketchup","mayonnaise","sauce ","sauces","huile d","huile de","sel ","poivre","épice","epice","herbe","basilic","thym","romarin","curry","paprika","cumin","safran","cannelle","vanille","exhausteur","exhausteurs","assafoetida","haldi","cumin","methi"];
      var snackKw=["chips","biscuit","biscuits","gâteau","gateau","cookie","céréales","cereales","barre ","snack","nooty","nutella","amande","noisette","cacahuète","fruits secs","muesli","chocolat","bonbon","bonbons","cracker","grignotage"];
      var epicerieSecKw=["riz ","pâtes","pates","lentilles","pois ","haricots","farine","sucre ","confiture","miel","café","the ","cacao","céréales","conserve","soupe","bouillon","nutella","pâte ","pâtes "];
      // ── DIVERS keywords ──
      var menagerKw=["lessive","détergent","detergent","nettoyant","savon","shampooing","dentifrice","papier toilette","mouchoir","couche","hygiène","menager","éponge","assouplissant","adoucissant","lingette","détachant","detachant","séche-linge","bougie","candle"];
      var menagerKw2=["éponges","eponges","papier sulfurisé","sacs cuisson","barquette","assiette","gobelet","nappe","ciseaux","couteau","spatule","cuillère","louche","roulette","tablier","éplucheur","planche"];
      var cuisineKw=["ciseaux","couteau","spatule","cuillère","louche","roulette","tablier","éplucheur","planche","manchon","gant","torchon","râpe","mixeur","balance","thermomètre"];
      // ── ALCOOL: vin category ──
      var vinKw=["vin ","vin de","champagne","cava","prosecc","crémant","sparkling","brut ","demi-sec","doux","rosé","rouge ","blanc ","mousseux","grappa","armagnac","cognac","porto","saké"];

      function _betterYardenCat(yardenCat,name){
        var n=(name||"").toLowerCase();
        // ── FRAIS ──
        if(yardenCat==="Frais"){
          for(var i=0;i<volailleKw.length;i++){if(n.indexOf(volailleKw[i])!==-1)return"volaille";}
          for(var i=0;i<viandeKw.length;i++){if(n.indexOf(viandeKw[i])!==-1)return"viande";}
          for(var i=0;i<laitierKw.length;i++){if(n.indexOf(laitierKw[i])!==-1)return"laitier";}
          if(n.indexOf("choucroute")!==-1||n.indexOf("cuisiné")!==-1||n.indexOf("plat ")!==-1)return"epicerie";
          return"viande";
        }
        // ── CONGELE ──
        if(yardenCat==="Congele")return"surgelé";
        // ── SEC (dry goods — needs thorough sub-categorization) ──
        if(yardenCat==="Sec"){
          // Vin/alcool d'abord (avant boisson non-alcool)
          for(var i=0;i<vinKw.length;i++){if(n.indexOf(vinKw[i])!==-1)return"vin";}
          for(var i=0;i<boissonAlcoolKw.length;i++){if(n.indexOf(boissonAlcoolKw[i])!==-1)return"vin";}
          // Boisson non-alcool
          for(var i=0;i<boissonKw.length;i++){if(n.indexOf(boissonKw[i])!==-1)return"boisson";}
          // Condiment
          for(var i=0;i<condimentKw.length;i++){if(n.indexOf(condimentKw[i])!==-1)return"condiment";}
          // Snack
          for(var i=0;i<snackKw.length;i++){if(n.indexOf(snackKw[i])!==-1)return"snack";}
          // Epicerie
          for(var i=0;i<epicerieSecKw.length;i++){if(n.indexOf(epicerieSecKw[i])!==-1)return"epicerie";}
          // Cornichon, olives, conserves
          if(n.indexOf("cornichon")!==-1||n.indexOf("olive")!==-1||n.indexOf("conserve")!==-1||n.indexOf("sauce")!==-1)return"epicerie";
          return"epicerie";
        }
        // ── DIVERS (cleaning, utensils, candles) ──
        if(yardenCat==="Divers"){
          for(var i=0;i<menagerKw.length;i++){if(n.indexOf(menagerKw[i])!==-1)return"menager";}
          for(var i=0;i<menagerKw2.length;i++){if(n.indexOf(menagerKw2[i])!==-1)return"menager";}
          for(var i=0;i<cuisineKw.length;i++){if(n.indexOf(cuisineKw[i])!==-1)return"menager"};
          if(n.indexOf("bougie")!==-1||n.indexOf("chabbat")!==-1||n.indexOf("hanouka")!==-1||n.indexOf("pessah")!==-1||n.indexOf("hametz")!==-1||n.indexOf("sticker")!==-1)return"menager";
          if(n.indexOf("assiette")!==-1||n.indexOf("gobelet")!==-1||n.indexOf("nappe")!==-1||n.indexOf("sac ")!==-1||n.indexOf("aluminium")!==-1)return"menager";
          return"epicerie";
        }
        return catMap[yardenCat]||"epicerie";
      }
      var chain=Promise.resolve();
      var count=0;
      for(var i=0;i<_supplierCatalog.length;i++){
        (function(p){
          chain=chain.then(function(){
            var bc=p.ean||"";
            var name=p.name||"";
            var cat=_betterYardenCat(p.category||p.cat||"",name);
            if(!bc||!name)return;
            return _dbPut({barcode:bc,name:name,sale_price_cents:0,category:cat,stockQty:0,low_stock_threshold:5,source:"yarden-catalog",last_updated:Date.now()}).then(function(){count++;});
          });
        })(_supplierCatalog[i]);
      }
      return chain.then(function(){
        // Save normalized catalog to meta for reload on startup
        _openMeta().then(function(d){
          if(!d)return;
          var tx=d.transaction("meta","readwrite");
          tx.objectStore("meta").put({key:"supplier-catalog",value:_supplierCatalog});
        });
        return count;
      });
    });
  }

  var _SUPCAT_META_KEY="supplier-catalog";
  var _PDFCAT_META_KEY="catalog-from-pdf";
  function _importSupplierCatalogFromMeta(){
    return _openMeta().then(function(d){
      if(!d)return 0;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_SUPCAT_META_KEY);
        r.onsuccess=function(){
          var cat=r.result&&r.result.value;
          // Also check for catalog-from-pdf
          var r2=d.transaction("meta","readonly").objectStore("meta").get(_PDFCAT_META_KEY);
          r2.onsuccess=function(){
            var pdfCat=r2.result&&r2.result.value;
            // Merge both catalogs, preferring supplier catalog
            var merged=cat||[];
            if(pdfCat&&Array.isArray(pdfCat)){
              var existingBcs={};
              for(var mi=0;mi<merged.length;mi++){if(merged[mi].barcode)existingBcs[merged[mi].barcode]=true;}
              for(var pj=0;pj<pdfCat.length;pj++){
                if(pdfCat[pj].barcode&&!existingBcs[pdfCat[pj].barcode]){merged.push(pdfCat[pj]);existingBcs[pdfCat[pj].barcode]=true;}
              }
            }
            if(!Array.isArray(merged)||merged.length===0){ok(0);return;}
            _supplierCatalog=merged;
            _openDB().then(function(d){
              if(!d){ok(0);return;}
              var tx=d.transaction("products","readonly");
              var store=tx.objectStore("products");
              var countReq=store.count();
              countReq.onsuccess=function(){
                if(countReq.result>0){ok(0);return;}
                var promises=[];
                for(var i=0;i<merged.length;i++){
                  var p=merged[i];
                  if(!p.barcode)continue;
                  // sale_price (supplier cat, in cents if >100) OR unitPrice (PDF import, in euros)
                  var salePrice=0;
                  if(p.sale_price>0)salePrice=p.sale_price>100?p.sale_price:Math.round(p.sale_price*100);
                  else if(p.unitPrice>0)salePrice=Math.round(p.unitPrice*100);
                  else if(p.sale_price_cents>0)salePrice=p.sale_price_cents;
                  var purchasePrice=p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100);
                  var catName=_guessCategory(p.name)||"epicerie";
                  promises.push(_dbPut({
                    barcode:p.barcode,name:p.name,
                    sale_price_cents:salePrice,
                    purchase_price_cents:purchasePrice,
                    category:catName,stockQty:p.qty||p.stockQty||0,low_stock_threshold:5,
                    source:"supplier-catalog",last_updated:Date.now()
                  }));
                }
                Promise.all(promises).then(function(){ok(promises.length);});
              };
              countReq.onerror=function(){ok(0);};
            });
          };
          r2.onerror=function(){
            if(!Array.isArray(cat)||cat.length===0){ok(0);return;}
            _supplierCatalog=cat;
            _openDB().then(function(d){
              if(!d){ok(0);return;}
              var tx=d.transaction("products","readonly");
              var store=tx.objectStore("products");
              var countReq=store.count();
              countReq.onsuccess=function(){
                if(countReq.result>0){ok(0);return;}
                var promises=[];
                for(var i=0;i<cat.length;i++){
                  var p=cat[i];
                  if(!p.barcode)continue;
                  var salePrice=p.sale_price>100?p.sale_price:Math.round((p.sale_price||0)*100);
                  var purchasePrice=p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100);
                  var catName=_guessCategory(p.name)||"epicerie";
                  promises.push(_dbPut({
                    barcode:p.barcode,name:p.name,
                    sale_price_cents:salePrice>0?salePrice:0,
                    purchase_price_cents:purchasePrice,
                    category:catName,stockQty:0,low_stock_threshold:5,
                    source:"supplier-catalog",last_updated:Date.now()
                  }));
                }
                Promise.all(promises).then(function(){ok(promises.length);});
              };
              countReq.onerror=function(){ok(0);};
            });
          };
        };
        r.onerror=function(){ok(0);};
      });
    }).catch(function(e){_err("Supplier catalog import error:",e);return 0;});
  }

  // ─── CART ────────────────────────────────────────────
  var _myCart=[];
  var _realBcMap={};
  var _cartDiscountCents=0;

  function _addToCart(name,priceCents,barcode,categoryId,weight,unitType,pricePerUnit){
    if(!name){_toast("Nom manquant");return false;}
    var myId="M"+Date.now()+Math.floor(Math.random()*9999);
    _myCart.push({myId:myId,name:name,priceCents:priceCents||0,bc:barcode||"",cat:categoryId||"autre",
      weight:weight||null,unitType:unitType||null,pricePerUnit:pricePerUnit||null,
      discountCents:0,qty:1});
    _realBcMap[myId]=barcode||"";
    try{document.dispatchEvent(new CustomEvent("acim:add",{detail:{name:name,price:priceCents,barcode:barcode,cat:categoryId,weight:weight,unitType:unitType,pricePerUnit:pricePerUnit}}));}catch(e){}
    _renderPOS();return true;
  }
  function _cartInfo(){
    var info=[];
    for(var i=0;i<_myCart.length;i++){var e=_myCart[i];
      info.push({idx:i,myId:e.myId,name:e.name,price:e.priceCents,bc:_realBcMap[e.myId]||e.bc,cat:e.cat,
        weight:e.weight,unitType:e.unitType,pricePerUnit:e.pricePerUnit,discountCents:e.discountCents||0,qty:e.qty||1});
    }return info;
  }
  function _removeFromCart(idx){_myCart.splice(idx,1);_renderPOS();}
  function _cartSubtotal(){
    var t=0;for(var i=0;i<_myCart.length;i++)t+=_myCart[i].priceCents;return t;
  }
  function _cartTotal(){return Math.max(0,_cartSubtotal()-_cartDiscountCents);}

  // ─── WEIGHT HELPERS ──────────────────────────────────
  function _isWeightProduct(item){return item.weight!=null&&item.unitType!=null&&item.pricePerUnit!=null;}
  function _formatWeight(w,unit){
    if(w==null||!unit)return "";
    if(unit==="kg")return w.toFixed(3)+" kg";
    if(unit==="g")return w.toFixed(0)+" g";
    if(unit==="L")return w.toFixed(2)+" L";
    if(unit==="pc")return w.toFixed(0)+" pc";
    return w+" "+unit;
  }
  function _formatPricePerUnit(ppu,unit){
    if(!ppu||!unit)return "";
    var p=(ppu/100).toFixed(2);
    if(unit==="kg")return p+"€/kg";
    if(unit==="g")return p+"€/kg";
    if(unit==="L")return p+"€/L";
    if(unit==="pc")return p+"€/pc";
    return p+"€/u";
  }
  function _calcWeightPrice(weight,unit,ppu){
    if(!weight||!unit||!ppu)return 0;
    if(unit==="g")return Math.round(ppu*(weight/1000));
    return Math.round(ppu*weight);
  }

  // ─── BROADCAST (écran client) ────────────────────────
  var _custBc=null;
  try{_custBc=new BroadcastChannel("acim-customer-display");}catch(e){}
  function _broadcastCart(){
    if(!_custBc)return;var info=_cartInfo();var total=0;
    for(var i=0;i<info.length;i++)total+=info[i].price;
    _custBc.postMessage({type:"cart-update",lines:info,total:total,discount:_cartDiscountCents});}
  function _broadcastClear(){
    if(!_custBc)return;_custBc.postMessage({type:"cart-clear"});}

  // ─────────────────────────────────────────────────────
  //  POS UI
  // ─────────────────────────────────────────────────────
  var _pos=null,_posSearch=null,_posCats=null,_posGrid=null,_posCart=null,_posTotal=null,_posItems=null,_posCheckout=null;
  var _allProducts=[],_filteredProducts=[],_activeCat="";

  // ─── TOGGLE POS / FLUTTER ──────────────────────────────
  var _reopenBtn=null;
  function _togglePOS(show){
    if(!_pos)_createPOS();
    if(show){
      _pos.style.display="flex";
      if(_reopenBtn)_reopenBtn.style.display="none";
      document.documentElement.style.setProperty("--acim-flutter-opacity","0");
      document.documentElement.style.setProperty("--acim-flutter-pointer","none");
      setTimeout(function(){_posSearch.focus();},100);
    }else{
      _pos.style.display="none";
      if(!_reopenBtn){
        _reopenBtn=document.createElement("div");_reopenBtn.id="acim-reopen-btn";
        _reopenBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#e65100;color:#fff;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;z-index:999998;box-shadow:0 4px 16px rgba(230,81,0,0.4);font-family:Segoe UI,Arial,sans-serif;";
        _reopenBtn.textContent="🛒 Ouvrir la caisse";
        _reopenBtn.onclick=function(){_togglePOS(true);};
        document.body.appendChild(_reopenBtn);
      }
      _reopenBtn.style.display="flex";
      document.documentElement.style.setProperty("--acim-flutter-opacity","1");
      document.documentElement.style.setProperty("--acim-flutter-pointer","auto");
    }
  }

  function _createPOS(){
    if(_pos)return;
    _pos=document.createElement("div");_pos.id="acim-pos";

    // ── GREEN HEADER ──
    var header=document.createElement("div");
    header.className="acim-header";

    var headerTop=document.createElement("div");
    headerTop.className="acim-header-top";

    var headerTitle=document.createElement("div");
    headerTitle.className="acim-header-title";
    headerTitle.textContent="\uD83C\uDFEA "+(_settings.storeName||"AcimCaisse");
    headerTitle.onclick=function(){_showMainMenu();};
    headerTitle.style.cursor="pointer";
    headerTop.appendChild(headerTitle);

    var headerActions=document.createElement("div");
    headerActions.className="acim-header-actions";

    var newBtn=document.createElement("button");
    newBtn.className="acim-header-btn";
    newBtn.innerHTML="+";
    newBtn.title="Nouveau produit (Ctrl+N)";
    newBtn.onclick=function(){_quickCreate("",0);};
    headerActions.appendChild(newBtn);

    var closeBtn=document.createElement("button");
    closeBtn.className="acim-header-btn";
    closeBtn.innerHTML="\u2715";
    closeBtn.title="Fermer la caisse";
    closeBtn.onclick=function(){_togglePOS(false);};
    headerActions.appendChild(closeBtn);

    headerTop.appendChild(headerActions);
    header.appendChild(headerTop);

    // Search bar
    var searchWrap=document.createElement("div");
    searchWrap.className="acim-search";

    var searchIcon=document.createElement("span");
    searchIcon.className="acim-search-icon";
    searchIcon.innerHTML="\uD83D\uDD0D";
    searchWrap.appendChild(searchIcon);

    _posSearch=document.createElement("input");
    _posSearch.id="acim-pos-search";
    _posSearch.className="acim-search-input";
    _posSearch.type="text";
    _posSearch.placeholder="Rechercher un produit ou scanner un code-barres...";
    _posSearch.addEventListener("input",function(){
      if(_allProducts.length===0){_refreshAndFilter();return;}
      _filterProducts();
    });
    _posSearch.addEventListener("keydown",function(e){
      if(e.key==="Enter"){var v=this.value.trim();if(v.length>=2){_processBarcode(v);this.value="";this.focus();}}
      if(e.key==="Escape"){this.value="";_filterProducts();this.blur();}
    });
    searchWrap.appendChild(_posSearch);

    // Actor badge (PR C) — inline in search bar
    var actorBadge=document.createElement("div");
    actorBadge.id="acim-actor-badge";
    searchWrap.appendChild(actorBadge);

    header.appendChild(searchWrap);

    _pos.appendChild(header);

    // ── CATEGORIES (horizontal scroll icons) ──
    var catsWrap=document.createElement("div");
    catsWrap.className="acim-categories";

    var catsScroll=document.createElement("div");
    catsScroll.className="acim-categories-scroll";
    catsScroll.id="acim-pos-cats";
    catsWrap.appendChild(catsScroll);
    _posCats=catsScroll;

    _pos.appendChild(catsWrap);

    // ── PRODUCTS GRID ──
    var productsWrap=document.createElement("div");
    productsWrap.className="acim-products";

    _posGrid=document.createElement("div");
    _posGrid.id="acim-pos-grid";
    _posGrid.className="acim-products-grid";
    productsWrap.appendChild(_posGrid);
    _pos.appendChild(productsWrap);

    // ── BOTTOM NAV ──
    var nav=document.createElement("div");
    nav.className="acim-bottom-nav";

    var navItems=[
      {icon:"\uD83C\uDFE0",label:"Accueil",active:true},
      {icon:"\uD83D\uDED2",label:"Panier 200\u20AC",cart:true,fn:function(){_showIdealCart();}},
      {icon:"\uD83D\uDCCB",label:"Historique",fn:function(){_showHistory();}},
      {icon:"\u2699\uFE0F",label:"Menu",fn:function(){_showMainMenu();}}
    ];
    navItems.forEach(function(item){
      var btn=document.createElement("button");
      btn.className="acim-nav-item"+(item.active?" active":"")+(item.cart?" acim-nav-cart":"");
      btn.innerHTML='<span class="acim-nav-icon">'+item.icon+'</span><span class="acim-nav-label">'+item.label+'</span>';
      if(item.fn)btn.onclick=item.fn;
      nav.appendChild(btn);
    });
    _pos.appendChild(nav);

    // ── CART FAB (mobile) ──
    var fab=document.createElement("button");
    fab.className="acim-cart-fab hidden";
    fab.id="acim-cart-fab";
    fab.innerHTML='<span id="acim-cart-fab-count">0</span> article(s) \u2014 <span id="acim-cart-fab-total">0,00 \u20AC</span>';
    fab.onclick=function(){_openCartSheet();};
    _pos.appendChild(fab);

    // ── CART BOTTOM SHEET ──
    var sheetOverlay=document.createElement("div");
    sheetOverlay.className="acim-sheet-overlay";
    sheetOverlay.id="acim-sheet-overlay";
    sheetOverlay.onclick=function(){_closeCartSheet();};
    _pos.appendChild(sheetOverlay);

    var sheet=document.createElement("div");
    sheet.className="acim-sheet";
    sheet.id="acim-sheet";

    var sheetHandle=document.createElement("div");
    sheetHandle.className="acim-sheet-handle";
    sheet.appendChild(sheetHandle);

    var sheetHeader=document.createElement("div");
    sheetHeader.className="acim-sheet-header";
    sheetHeader.innerHTML='<div class="acim-sheet-title">Panier<button class="acim-sheet-close" onclick="_closeCartSheet()">\u2715</button></div>';
    sheet.appendChild(sheetHeader);

    _posItems=document.createElement("div");
    _posItems.className="acim-sheet-items";
    _posItems.id="acim-pos-items";
    sheet.appendChild(_posItems);

    var sheetFooter=document.createElement("div");
    sheetFooter.className="acim-sheet-footer";

    // Subtotal
    var subRow=document.createElement("div");
    subRow.className="acim-sheet-row";
    subRow.innerHTML='<span class="acim-sheet-row-label">Sous-total</span>';
    _posSubtotal=document.createElement("span");
    _posSubtotal.className="acim-sheet-row-value";
    _posSubtotal.textContent="0,00 \u20AC";
    subRow.appendChild(_posSubtotal);
    sheetFooter.appendChild(subRow);

    // Discount (hidden by default)
    var discRow=document.createElement("div");
    discRow.className="acim-sheet-row discount";
    discRow.id="acim-disc-row";
    discRow.style.display="none";
    discRow.innerHTML='<span class="acim-sheet-row-label">Remise</span>';
    _posDiscount=document.createElement("span");
    _posDiscount.className="acim-sheet-row-value";
    _posDiscount.textContent="-0,00 \u20AC";
    discRow.appendChild(_posDiscount);
    sheetFooter.appendChild(discRow);

    // Discount button
    var discBtnRow=document.createElement("div");
    discBtnRow.style.cssText="text-align:right;margin-bottom:8px;";
    var discBtn=document.createElement("button");
    discBtn.textContent="Appliquer une remise";
    discBtn.style.cssText="padding:6px 12px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:13px;cursor:pointer;";
    discBtn.onclick=function(){_applyTicketDiscount();};
    discBtnRow.appendChild(discBtn);
    sheetFooter.appendChild(discBtnRow);

    // Total
    var totalRow=document.createElement("div");
    totalRow.className="acim-sheet-total";
    var finalLabel=document.createElement("span");
    finalLabel.className="acim-sheet-total-label";
    finalLabel.textContent="TOTAL";
    _posTotal=document.createElement("span");
    _posTotal.id="acim-pos-total";
    _posTotal.className="acim-sheet-total-value";
    _posTotal.textContent="0,00 €";
    totalRow.appendChild(finalLabel);
    totalRow.appendChild(_posTotal);
    sheetFooter.appendChild(totalRow);

    // Checkout
    _posCheckout=document.createElement("button");
    _posCheckout.className="acim-sheet-checkout";
    _posCheckout.id="acim-pos-checkout";
    _posCheckout.textContent="\uD83D\uDCB0 Encaisser";
    _posCheckout.onclick=function(){_startPayment();};
    sheetFooter.appendChild(_posCheckout);

    sheet.appendChild(sheetFooter);
    _pos.appendChild(sheet);

    // ── DESKTOP CART PANEL (hidden on mobile via CSS) ──
    var desktopCart=document.createElement("div");
    desktopCart.className="acim-desktop-cart";
    desktopCart.id="acim-desktop-cart";

    var dcHeader=document.createElement("div");
    dcHeader.className="acim-desktop-cart-header";
    dcHeader.innerHTML='<span>\uD83D\uDED2 Ticket</span><span id="acim-pos-count">0 article</span>';
    desktopCart.appendChild(dcHeader);

    var dcItems=document.createElement("div");
    dcItems.className="acim-desktop-cart-items";
    dcItems.id="acim-desktop-cart-items";
    desktopCart.appendChild(dcItems);

    var dcFooter=document.createElement("div");
    dcFooter.className="acim-desktop-cart-footer";
    dcFooter.id="acim-desktop-cart-footer";
    desktopCart.appendChild(dcFooter);

    // Wrap products + desktop cart in a flex row, insert before bottom nav
    var bodyRow=document.createElement("div");
    bodyRow.style.cssText="flex:1;display:flex;overflow:hidden;";
    bodyRow.appendChild(productsWrap);
    bodyRow.appendChild(desktopCart);
    _pos.insertBefore(bodyRow,_pos.querySelector(".acim-bottom-nav"));

    _buildCategories();
    document.body.appendChild(_pos);
  }

  var _posSubtotal,_posDiscount;

  function _buildCategories(){
    _posCats.innerHTML="";
    // "Tous" category
    var allItem=document.createElement("div");
    allItem.className="acim-category-item"+(_activeCat?"":" active");
    allItem.innerHTML='<div class="acim-category-icon">\uD83D\uDCE6</div><div class="acim-category-label">Tous</div>';
    allItem.onclick=function(){_activeCat="";_refreshCategories();_filterProducts();};
    _posCats.appendChild(allItem);
    // Other categories
    CATS.forEach(function(cat){
      var item=document.createElement("div");
      item.className="acim-category-item"+(_activeCat===cat.id?" active":"");
      item.innerHTML='<div class="acim-category-icon">'+cat.ic+'</div><div class="acim-category-label">'+cat.id+'</div>';
      item.onclick=function(){_activeCat=(_activeCat===cat.id)?"":cat.id;_refreshCategories();_filterProducts();};
      _posCats.appendChild(item);
    });
  }
  function _refreshCategories(){
    var items=_posCats.querySelectorAll(".acim-category-item");
    items.forEach(function(item,i){
      var catId=i===0?"":CATS[i-1].id;
      item.className="acim-category-item"+(_activeCat===catId?" active":"");
    });
  }

  // ── CART BOTTOM SHEET (mobile) ──
  function _openCartSheet(){
    var overlay=document.getElementById("acim-sheet-overlay");
    var sheet=document.getElementById("acim-sheet");
    if(overlay)overlay.classList.add("open");
    if(sheet){
      sheet.classList.add("open");
      sheet.onclick=function(e){
        if(e.target===sheet||e.target.classList.contains("acim-sheet-handle")){
          _closeCartSheet();
        }
      };
    }
    _renderCart();
  }
  function _closeCartSheet(){
    var overlay=document.getElementById("acim-sheet-overlay");
    var sheet=document.getElementById("acim-sheet");
    if(overlay)overlay.classList.remove("open");
    if(sheet)sheet.classList.remove("open");
  }

  // ── UPDATE CART FAB (mobile) ──
  function _updateCartFAB(){
    var fab=document.getElementById("acim-cart-fab");
    if(!fab)return;
    var count=_myCart.length;
    var total=_cartTotal();
    if(count>0){
      fab.classList.remove("hidden");
      document.getElementById("acim-cart-fab-count").textContent=count;
      document.getElementById("acim-cart-fab-total").textContent=(total/100).toFixed(2).replace(".",",")+" \u20AC";
    }else{
      fab.classList.add("hidden");
    }
  }

  function _filterProducts(){
    var q=(_posSearch.value||"").toLowerCase();
    _filteredProducts=_allProducts.filter(function(p){
      if(_activeCat&&(p.category||"")!==_activeCat)return false;
      if(q){var s=((p.name||"")+" "+(p.barcode||"")).toLowerCase();if(s.indexOf(q)<0)return false;}
      return true;
    });
    _filteredProducts.sort(function(a,b){
      var aPriced=(a.sale_price_cents||0)>0?1:0;
      var bPriced=(b.sale_price_cents||0)>0?1:0;
      if(aPriced!==bPriced)return bPriced-aPriced;
      var aSold=(a.last_updated||0);
      var bSold=(b.last_updated||0);
      if(aSold!==bSold)return bSold-aSold;
      return(a.name||"").localeCompare(b.name||"");
    });
    _renderGrid();
  }
  function _refreshAndFilter(){
    _dbGetAll().then(function(all){_allProducts=all||[];_filterProducts();});
  }

  function _renderGrid(){
    _posGrid.innerHTML="";
    if(_filteredProducts.length===0){
      _posGrid.innerHTML='<div class="acim-empty"><div class="acim-empty-icon">\uD83D\uDD0D</div><div class="acim-empty-text">Aucun produit trouv\u00E9</div></div>';
      return;
    }
    _filteredProducts.forEach(function(p){
      var card=document.createElement("div");
      card.className="acim-product-card";
      var hasPrice=p.sale_price_cents>0;
      var isWeighable=p.pricePerUnit>0&&p.unitType;
      var _cardP=p,_cardHP=hasPrice,_cardW=isWeighable;

      // Delete button
      var delBtn=document.createElement("button");
      delBtn.className="acim-product-delete";
      delBtn.innerHTML="\u2715";
      delBtn.title="Supprimer ce produit";
      delBtn.onclick=function(e){e.stopPropagation();_confirmDeleteProduct(_cardP);};
      card.appendChild(delBtn);

      // Product image or placeholder
      var cat=(p.category||"autre").toLowerCase();
      var bg=_catBg[cat]||"#f5f5f5";
      var icImg=document.createElement("img");
      icImg.className="acim-product-image";
      icImg.style.display="none";
      icImg.style.background=bg;

      var icPh=document.createElement("div");
      icPh.className="acim-product-placeholder";
      icPh.style.background="linear-gradient(135deg,"+bg+" 0%,#e8e8e8 100%)";
      // Generate SVG product image
      var svgUrl=_generateProductSVG(p.name,cat,p.sale_price_cents);
      icPh.innerHTML='<img src="'+svgUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px 12px 0 0">';
      card.appendChild(icPh);

      // Camera button for adding/changing photo
      var camBtn=document.createElement("button");
      camBtn.className="acim-product-camera";
      camBtn.innerHTML="\uD83D\uDCF7";
      camBtn.title="Ajouter / changer la photo";
      camBtn.onclick=function(e){
        e.stopPropagation();
        var inp=document.createElement("input");inp.type="file";inp.accept="image/*";
        inp.onchange=function(ev){
          var f=ev.target.files[0];if(!f)return;
          var rd=new FileReader();
          rd.onload=function(ev2){
            var du=ev2.target.result;
            _cacheImage(p.barcode,du);
            icImg.src=du;icImg.style.display="block";icPh.style.display="none";
          };
          rd.readAsDataURL(f);
        };
        inp.click();
      };
      card.appendChild(camBtn);

      // Load cached image
      (function(bc,img,ph,pname){
        _getCachedImage(bc).then(function(url){
          if(url){img.src=url;img.style.display="block";ph.style.display="none";}
          else _enqueueImage(bc,function(url){if(url){img.src=url;img.style.display="block";ph.style.display="none";}},pname);
        });
      })(p.barcode,icImg,icPh,p.name);
      card.appendChild(icImg);

      // Product info
      var infoDiv=document.createElement("div");
      infoDiv.className="acim-product-info";

      var nm=document.createElement("div");
      nm.className="acim-product-name";
      nm.textContent=p.name||"?";
      infoDiv.appendChild(nm);

      if(isWeighable){
        var badge=document.createElement("div");
        badge.style.cssText="display:inline-block;font-size:12px;color:#fff;background:#2196f3;border-radius:6px;padding:2px 8px;margin-top:6px;font-weight:600;";
        badge.textContent="\u2696\uFE0F Au poids";
        infoDiv.appendChild(badge);
        var ppu=document.createElement("div");
        ppu.className="acim-product-price";
        ppu.textContent=_formatPricePerUnit(p.pricePerUnit,p.unitType);
        infoDiv.appendChild(ppu);
      }else if(hasPrice){
        var pr=document.createElement("div");
        pr.className="acim-product-price";
        pr.textContent=(p.sale_price_cents/100).toFixed(2)+"\u20AC";
        infoDiv.appendChild(pr);
      }else{
        var noPr=document.createElement("div");
        noPr.style.cssText="font-size:14px;color:var(--acim-orange);margin-top:6px;font-weight:600;";
        noPr.textContent="\u270F\uFE0F Sans prix";
        infoDiv.appendChild(noPr);
      }

      // Stock badge
      if(p.stockQty!=null&&p.stockQty!==0){
        var threshold=p.low_stock_threshold||5;
        var isLow=p.stockQty<=threshold;
        var isExpired=p.expiry_date&&new Date(p.expiry_date)<new Date();
        var stBadge=document.createElement("div");
        stBadge.className="acim-product-stock"+(isExpired?" expired":isLow?" low":"");
        stBadge.textContent=(isExpired?"\u26A0\uFE0F P\u00E9rim\u00E9 !":isLow?"\u26A0\uFE0F Stock bas !":"Stock: ")+p.stockQty;
        if(isExpired&&p.expiry_date)stBadge.textContent+=" (DLC: "+p.expiry_date+")";
        infoDiv.appendChild(stBadge);
      }

      card.appendChild(infoDiv);

      card.onclick=function(){
        if(isWeighable){_weighProduct(p);}
        else if(hasPrice){_addToCart(p.name,p.sale_price_cents,p.barcode,p.category);_toast("\u2705 "+p.name);}
        else{_addToCart(p.name,0,p.barcode,p.category);_toast("\u270F\uFE0F "+p.name+" \u2014 cliquez dans le ticket pour le prix");}
      };
      _posGrid.appendChild(card);
    });
  }

  function _renderCart(){
    var info=_cartInfo();var subtotal=_cartSubtotal();var total=_cartTotal();
    // Update count in both mobile and desktop
    var countEl=document.getElementById("acim-pos-count");
    if(countEl)countEl.textContent=info.length+" article"+(info.length!==1?"s":"");
    _posSubtotal.textContent=(subtotal/100).toFixed(2).replace(".",",")+" \u20AC";
    _posTotal.textContent=(total/100).toFixed(2).replace(".",",")+" \u20AC";
    var discRow=document.getElementById("acim-disc-row");
    if(_cartDiscountCents>0){
      discRow.style.display="flex";
      _posDiscount.textContent="-"+(_cartDiscountCents/100).toFixed(2).replace(".",",")+" \u20AC";
    }else{discRow.style.display="none";}

    // Update cart FAB (mobile)
    _updateCartFAB();

    // Render into mobile sheet
    _posItems.innerHTML="";
    if(info.length===0){
      _posItems.innerHTML='<div class="acim-sheet-empty">\uD83D\uDED2 Panier vide</div>';
      _posCheckout.textContent="\uD83D\uDCB0 Encaisser (0,00 \u20AC)";
      _posCheckout.style.opacity="0.5";
    }else{
      _posCheckout.textContent="\uD83D\uDCB0 Encaisser "+(total/100).toFixed(2).replace(".",",")+" \u20AC";
      _posCheckout.style.opacity="1";
    }

    // Render into desktop cart
    var dcItems=document.getElementById("acim-desktop-cart-items");
    var dcFooter=document.getElementById("acim-desktop-cart-footer");
    if(dcItems){
      dcItems.innerHTML="";
      if(info.length===0){
        dcItems.innerHTML='<div class="acim-sheet-empty">\uD83D\uDED2 Panier vide</div>';
      }
    }

    info.forEach(function(item){
      // Create a helper to build cart item row
      function buildRow(it){
        var row=document.createElement("div");
        var isZero=it.price===0;
        var isWeighed=_isWeightProduct(it);
        row.className="acim-sheet-item";
        row.onclick=function(){_inlineEdit(it.idx,50,50);};

        var icon=document.createElement("div");
        icon.className="acim-sheet-item-icon";
        icon.style.cssText="width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:"+( _catBg[it.cat||"autre"]||"#f5f5f5");
        // Try to show product image from cache or generate SVG
        var imgEl=document.createElement("img");
        imgEl.style.cssText="width:100%;height:100%;object-fit:cover;";
        var svgUrl=_generateProductSVG(it.name,it.cat,it.price);
        imgEl.src=svgUrl;
        icon.appendChild(imgEl);
        // Try to load real image from cache or fetch by name
        if(it.bc){
          _getCachedImage(it.bc).then(function(url){
            if(url){imgEl.src=url;}
            else{
              _enqueueImage(it.bc,function(url2){
                if(url2)imgEl.src=url2;
              },it.name);
            }
          });
        }
        row.appendChild(icon);

        var infoDiv=document.createElement("div");
        infoDiv.className="acim-sheet-item-info";
        var nm=document.createElement("div");
        nm.className="acim-sheet-item-name";
        nm.style.color=isZero?"var(--acim-orange)":"";
        nm.textContent=isZero?"\u270F\uFE0F "+it.name:it.name;
        infoDiv.appendChild(nm);

        if(isWeighed&&it.weight!=null){
          var wLine=document.createElement("div");
          wLine.className="acim-sheet-item-weight";
          wLine.textContent=_formatWeight(it.weight,it.unitType)+" \u00D7 "+_formatPricePerUnit(it.pricePerUnit,it.unitType);
          infoDiv.appendChild(wLine);
        }

        if(it.price>0){
          var pr=document.createElement("div");
          pr.className="acim-sheet-item-price";
          pr.textContent=(it.price/100).toFixed(2).replace(".",",")+" \u20AC";
          infoDiv.appendChild(pr);
        }
        row.appendChild(infoDiv);

        var actions=document.createElement("div");
        actions.className="acim-sheet-item-actions";

        var dupBtn=document.createElement("button");
        dupBtn.className="acim-sheet-item-btn";
        dupBtn.innerHTML="\u27F3";
        dupBtn.title="Ajouter encore";
        dupBtn.onclick=function(e){e.stopPropagation();_addToCart(it.name,it.price,it.bc,it.cat,it.weight,it.unitType,it.pricePerUnit);};
        actions.appendChild(dupBtn);

        var delBtn=document.createElement("button");
        delBtn.className="acim-sheet-item-btn danger";
        delBtn.innerHTML="\u2715";
        delBtn.title="Supprimer";
        delBtn.onclick=function(e){e.stopPropagation();_removeFromCart(it.idx);_toast("Supprim\u00E9");};
        actions.appendChild(delBtn);

        row.appendChild(actions);
        return row;
      }

      // Append to mobile sheet
      _posItems.appendChild(buildRow(item));
      // Append to desktop cart
      if(dcItems){
        dcItems.appendChild(buildRow(item));
      }
    });

    // Render desktop footer
    if(dcFooter){
      dcFooter.innerHTML='';
      var subR=document.createElement("div");
      subR.className="acim-sheet-row";
      subR.innerHTML='<span class="acim-sheet-row-label">Sous-total</span><span class="acim-sheet-row-value">'+(subtotal/100).toFixed(2).replace(".",",")+" \u20AC</span>";
      dcFooter.appendChild(subR);
      if(_cartDiscountCents>0){
        var discR=document.createElement("div");
        discR.className="acim-sheet-row discount";
        discR.innerHTML='<span class="acim-sheet-row-label">Remise</span><span class="acim-sheet-row-value">-'+(_cartDiscountCents/100).toFixed(2).replace(".",",")+" \u20AC</span>";
        dcFooter.appendChild(discR);
      }
      var totR=document.createElement("div");
      totR.className="acim-sheet-total";
      totR.innerHTML='<span class="acim-sheet-total-label">TOTAL</span><span class="acim-sheet-total-value">'+(total/100).toFixed(2).replace(".",",")+" \u20AC</span>";
      dcFooter.appendChild(totR);
      var dcCheckout=document.createElement("button");
      dcCheckout.className="acim-sheet-checkout";
      dcCheckout.textContent="\uD83D\uDCB0 Encaisser "+(total/100).toFixed(2).replace(".",",")+" \u20AC";
      dcCheckout.onclick=function(){_startPayment();};
      dcFooter.appendChild(dcCheckout);
    }
  }

  function _renderPOS(){
    if(!_pos)return;
    _filterProducts();
    _renderCart();
    _broadcastCart();
  }

  // ─── SCANNER BUFFER ──────────────────────────────────
  // Distinguishes USB/BT scanner (rapid keystrokes + Enter) from manual typing
  // by tracking inter-key delay. Scanners typically fire <30ms between keys,
  // manual typing is >80ms.
  var _scanBuf="",_scanTimer=null,_scanning=false,_lastScanKeyTime=0,_SCAN_SPEED_MS=50;
  function _scanCommit(){
    if(_scanTimer){clearTimeout(_scanTimer);_scanTimer=null;}
    var bc=_scanBuf;
    if(!bc)return;
    _scanning=false;
    if(bc.length>=4){
      if(_pos&&_pos.style.display!=="none"&&_posSearch)_posSearch.value="";
      if(_processBarcode)_processBarcode(bc);
      if(!_pos||_pos.style.display==="none")_togglePOS(true);
    }else{
      if(_pos&&_pos.style.display!=="none"&&_posSearch)_posSearch.value="";
    }
    _scanBuf="";
  }
  document.addEventListener("keydown",function(e){
    // Scan toujours prioritaire, quel que soit le focus
    if(/^[0-9]$/.test(e.key)){
      var now=Date.now();
      var isScanner=_scanning || (now-_lastScanKeyTime<_SCAN_SPEED_MS);
      _lastScanKeyTime=now;
      // If search bar is focused AND manual typing (slow), let browser handle
      if(document.activeElement===_posSearch && !isScanner && !_scanning){
        return; // manual typing in search bar — browser adds digit normally
      }
      _scanning=true;
      _scanBuf+=e.key;
      // Only write to search bar if it's NOT focused (avoid double-append when focused)
      if(_pos&&_pos.style.display!=="none"&&_posSearch && document.activeElement!==_posSearch){
        _posSearch.value=_scanBuf;
        _filterProducts();
      }
      // Enter-terminator scanners commit immediately; else 80ms timeout.
      clearTimeout(_scanTimer);_scanTimer=setTimeout(_scanCommit,80);
      return;
    }
    // Enter commits the scan buffer immediately (most USB/BT scanners send Enter after digits).
    if(e.key==="Enter"&&_scanning&&_scanBuf.length>=4){
      e.preventDefault();
      _scanCommit();
      return;
    }
    if(/^[a-zA-ZÀ-ÿ]$/.test(e.key)){
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      // Only append if search bar is NOT already focused (avoids letter duplication)
      if(document.activeElement!==_posSearch){
        if(!_pos||_pos.style.display==="none")_togglePOS(true);
        if(_posSearch){
          _posSearch.value+=e.key;
          _posSearch.focus();
          _filterProducts();
        }
      }
    }
    if(e.key==="Backspace"&&_posSearch&&_posSearch.value.length>0){
      var tag2=document.activeElement?document.activeElement.tagName:"";
      if(tag2!=="INPUT"&&tag2!=="TEXTAREA"){
        _posSearch.value=_posSearch.value.slice(0,-1);
        _filterProducts();
        e.preventDefault();
      }
    }
    if(e.key==="Escape"&&_posSearch){
      _posSearch.value="";_filterProducts();_posSearch.blur();
    }
  },true);

  // ─── PROCESS BARCODE ─────────────────────────────────
  // ── 3-choice price modal (Sprint 3) — for products scanned without a price
  function _chooseProductPrice(product,barcode){
    var old=document.getElementById("acim-price-choice");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-price-choice";
    ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000005;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:16px;padding:24px;width:560px;max-width:95vw;box-shadow:0 12px 36px rgba(0,0,0,0.4);font-family:Segoe UI,Arial,sans-serif;text-align:center;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;color:#1a1a2e;margin-bottom:8px;";
    ti.textContent="💸 "+product.name||"Produit";
    card.appendChild(ti);
    var sub=document.createElement("div");sub.style.cssText="font-size:14px;color:#666;margin-bottom:18px;";
    sub.innerHTML="Code barre: "+esc(barcode)+"<br>Choisissez le mode de tarification:";
    card.appendChild(sub);
    var bc=document.createElement("div");bc.style.cssText="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;";
    function mkBtn(label,sub,color,fn){
      var b=document.createElement("button");
      b.style.cssText="flex:1;min-width:160px;padding:18px 12px;border:none;border-radius:12px;background:"+color+";color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:transform .1s,box-shadow .15s;box-shadow:0 4px 12px "+color+"99;";
      b.innerHTML=label+(sub?'<div style="font-size:12px;font-weight:400;opacity:0.85;margin-top:4px;">'+sub+"</div>":"");
      b.onmouseenter=function(){this.style.transform="translateY(-2px)";};
      b.onmouseleave=function(){this.style.transform="translateY(0)";};
      b.onclick=function(){ov.remove();fn();};
      return b;
    }
    bc.appendChild(mkBtn("🏷️ Prix fixe","Saisir le prix unitaire","#e65100",function(){
      // Inline edit flow (re-input price)
      _addToCart(product.name,0,barcode,product.category);
      // open inline edit on the freshly-added row
      setTimeout(function(){
        var idx=_myCart.length-1;
        _inlineEdit(idx,50,50);
      },100);
    }));
    bc.appendChild(mkBtn("⚖️ Produit pesé","Prix au kg + poids","#1976d2",function(){
      // Open weigh modal pre-filled with product info (no pricePerUnit in DB yet)
      var fake={name:product.name,barcode:barcode,category:product.category,pricePerUnit:0,unitType:"kg"};
      _weighProduct(fake);
    }));
    bc.appendChild(mkBtn("✕ Annuler","Ne pas ajouter","#9e9e9e",function(){ /* no-op */ }));
    card.appendChild(bc);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _processBarcode(bc){
    _log("Scanner: "+bc);
    try{document.dispatchEvent(new CustomEvent("acim:scan",{detail:{barcode:bc}}));}catch(e){}
    _dbGet(bc).then(function(local){
      if(local&&local.pricePerUnit>0&&local.unitType){
        _weighProduct({name:local.name,barcode:bc,category:local.category,pricePerUnit:local.pricePerUnit,unitType:local.unitType,sale_price_cents:local.sale_price_cents});
        return;
      }
      if(local&&local.sale_price_cents>0){
        _addToCart(local.name,local.sale_price_cents,bc,local.category);
        _toast("✅ "+local.name+" "+(local.sale_price_cents/100).toFixed(2)+"€");return;
      }
      if(local&&local.name){
        _chooseProductPrice(local,bc);return;
      }
      _quickCreate("",0,bc,"");
      _toast("🆕 Nouveau produit — code: "+bc);
    });
  }

  // ─────────────────────────────────────────────────────
  //  PAIEMENT — flux complet Espèces / CB / Mixte
  // ─────────────────────────────────────────────────────
  function _startPayment(){
    if(_myCart.length===0){_toast("Panier vide");return;}
    var subtotal=_cartSubtotal();
    var total=_cartTotal();
    if(total<=0){_toast("Total à 0€");return;}
    var old=document.getElementById("acim-payment");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-payment";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";

    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;text-align:center;";
    ti.textContent="💰 Paiement";card.appendChild(ti);
    var totalLine=document.createElement("div");
    totalLine.style.cssText="font-size:36px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;";
    totalLine.textContent=(total/100).toFixed(2).replace(".",",")+" €";card.appendChild(totalLine);

    // Mode selector
    var modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:6px;margin-bottom:16px;";
    var modes=[{id:"especes",label:"💵 Espèces"},{id:"cb",label:"💳 CB"},{id:"mixte",label:"🔀 Mixte"}];
    var selectedMode="especes";
    var modeBtns=[];
    modes.forEach(function(m){
      var b=document.createElement("button");b.textContent=m.label;
      b.style.cssText="flex:1;padding:12px;border:2px solid "+(m.id==="especes"?"#e65100":"#e0e0e0")+";border-radius:8px;background:"+(m.id==="especes"?"#fff3e0":"#fff")+";font-size:16px;cursor:pointer;font-weight:"+(m.id==="especes"?"700":"normal")+";";
      b.onclick=function(){
        selectedMode=m.id;
        modeBtns.forEach(function(x,i){x.style.borderColor=modes[i].id===m.id?"#e65100":"#e0e0e0";x.style.background=modes[i].id===m.id?"#fff3e0":"#fff";x.style.fontWeight=modes[i].id===m.id?"700":"normal";});
        _updatePaymentFields();
      };
      modeBtns.push(b);modeRow.appendChild(b);
    });
    card.appendChild(modeRow);

    // Cash section
    var cashSection=document.createElement("div");cashSection.id="acim-cash-section";
    var cashLabel=document.createElement("div");cashLabel.style.cssText="font-size:15px;color:#666;margin-bottom:4px;";
    cashLabel.textContent="Montant reçu:";cashSection.appendChild(cashLabel);
    var cashInput=document.createElement("input");cashInput.type="number";cashInput.step="0.01";cashInput.min="0";
    cashInput.placeholder="0,00";cashInput.style.cssText="width:100%;font-size:28px;font-weight:700;padding:12px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;box-sizing:border-box;";
    cashInput.onfocus=function(){this.select();};
    cashSection.appendChild(cashInput);

    // Quick buttons
    var quickRow=document.createElement("div");quickRow.style.cssText="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;";
    var quickAmounts=[{label:"Exact",val:total},{label:"5€",val:500},{label:"10€",val:1000},{label:"20€",val:2000},{label:"50€",val:5000},{label:"100€",val:10000}];
    quickAmounts.forEach(function(qa){
      var qb=document.createElement("button");qb.textContent=qa.label;
      qb.style.cssText="padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:15px;cursor:pointer;";
      qb.onclick=function(){cashInput.value=(qa.val/100).toFixed(2);_updateChange();};
      quickRow.appendChild(qb);
    });
    cashSection.appendChild(quickRow);
    card.appendChild(cashSection);

    // Change display
    var changeLine=document.createElement("div");changeLine.style.cssText="font-size:20px;font-weight:700;color:#2e7d32;text-align:center;margin:12px 0;min-height:24px;";
    changeLine.id="acim-change-line";card.appendChild(changeLine);

    // Split section (hidden by default)
    var splitSection=document.createElement("div");splitSection.id="acim-split-section";splitSection.style.cssText="display:none;";
    var splitLabel=document.createElement("div");splitLabel.style.cssText="font-size:15px;color:#666;margin-bottom:4px;";
    splitLabel.textContent="Part espèces:";splitSection.appendChild(splitLabel);
    var splitInput=document.createElement("input");splitInput.type="number";splitInput.step="0.01";splitInput.min="0";
    splitInput.placeholder="0,00";splitInput.style.cssText="width:100%;font-size:22px;font-weight:700;padding:10px;border:3px solid #e0e0e0;border-radius:8px;outline:none;text-align:center;box-sizing:border-box;";
    splitSection.appendChild(splitInput);
    var splitRemainder=document.createElement("div");splitRemainder.style.cssText="font-size:17px;color:#1565c0;text-align:center;margin-top:6px;min-height:20px;";
    splitSection.appendChild(splitRemainder);
    card.appendChild(splitSection);

    // Error line
    var errorLine=document.createElement("div");errorLine.style.cssText="font-size:16px;color:#c62828;text-align:center;min-height:20px;margin-bottom:8px;";
    card.appendChild(errorLine);

    function _updatePaymentFields(){
      cashSection.style.display=selectedMode==="especes"?"block":"none";
      splitSection.style.display=selectedMode==="mixte"?"block":"none";
      changeLine.textContent="";
      errorLine.textContent="";
      if(selectedMode==="especes"){cashInput.focus();}
      else if(selectedMode==="cb"){cashInput.value="";}
      else if(selectedMode==="mixte"){splitInput.focus();}
    }
    function _updateChange(){
      if(selectedMode!=="especes")return;
      var received=parseFloat(cashInput.value)||0;
      var receivedCents=Math.round(received*100);
      var change=receivedCents-total;
      if(receivedCents>=total){
        changeLine.style.color="#2e7d32";
        changeLine.textContent="Monnaie: "+(change/100).toFixed(2).replace(".",",")+" €";
      }else{
        changeLine.style.color="#c62828";
        changeLine.textContent="Manque: "+((total-receivedCents)/100).toFixed(2).replace(".",",")+" €";
      }
    }
    cashInput.addEventListener("input",_updateChange);
    splitInput.addEventListener("input",function(){
      var partCash=parseFloat(splitInput.value)||0;
      var partCashCents=Math.round(partCash*100);
      var remainder=total-partCashCents;
      if(remainder>=0){
        splitRemainder.textContent="Reste CB: "+(remainder/100).toFixed(2).replace(".",",")+" €";
        splitRemainder.style.color="#1565c0";
      }else{
        splitRemainder.textContent="Trop!";
        splitRemainder.style.color="#c62828";
      }
    });

    // Buttons
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Valider le paiement";
    bOk.style.cssText="flex:2;padding:12px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var payments=[];
      if(selectedMode==="especes"){
        var received=parseFloat(cashInput.value)||0;
        var receivedCents=Math.round(received*100);
        if(receivedCents<total){errorLine.textContent="Montant reçu insuffisant!";return;}
        payments.push({method:"especes",amountCents:total,tenderedCents:receivedCents,changeCents:receivedCents-total});
      }else if(selectedMode==="cb"){
        payments.push({method:"cb",amountCents:total,tenderedCents:total,changeCents:0});
      }else if(selectedMode==="mixte"){
        var partCash=parseFloat(splitInput.value)||0;
        var partCashCents=Math.round(partCash*100);
        var remainder=total-partCashCents;
        if(partCashCents<0||remainder<0){errorLine.textContent="Montant invalide!";return;}
        if(partCashCents>0)payments.push({method:"especes",amountCents:partCashCents,tenderedCents:partCashCents,changeCents:0});
        if(remainder>0)payments.push({method:"cb",amountCents:remainder,tenderedCents:remainder,changeCents:0});
      }
      ov.remove();
      _finalizeSale(payments);
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){if(selectedMode==="especes")cashInput.focus();},100);
  }

  function _finalizeSale(payments){
    // Sprint 4.1 PR B — single unified IDB transaction (sales + products + meta + audit_events).
    // Atomicity: if any step fails (incl. audit append), the entire TX aborts →
    // no sale persisted, no stock mutated, no audit event emitted.
    var total=_cartTotal();
    var ticketNum=_nextTicket();          // optimistically increments in-memory; we persist in-TX
    var saleItems=_myCart.slice();
    var discountCents=_cartDiscountCents;
    var salePayload={
      ticketNumber:ticketNum,
      timestamp:Date.now(),
      isoTime:new Date().toISOString(),
      items:saleItems.map(function(it){return{
        name:it.name,price:it.priceCents,barcode:it.bc||"",cat:it.cat,
        weight:it.weight||null,unitType:it.unitType||null,pricePerUnit:it.pricePerUnit||null,
        discountCents:it.discountCents||0,qty:it.qty||1
      };}),
      totalCents:total,
      discountCents:discountCents||0,
      payments:payments||[],
      itemCount:saleItems.length,
      status:"COMPLETED"
    };
    var paymentMethods=(payments||[]).map(function(p){return p.method;});
    _openUnifiedDB().then(function(db){
      if(!db){_toast("❌ Base inaccessible");return;}
      var tx;
      try{
        tx=db.transaction(["sales","products","meta","audit_events"],"readwrite");
      }catch(e){_toast("❌ TX ouverture impossible");return;}
      var sSales=tx.objectStore("sales");
      var sProd=tx.objectStore("products");
      var sMeta=tx.objectStore("meta");
      // 1) Persist ticket sequence (instead of separate _saveTicketSeq() call).
      try{ sMeta.put({key:_ticketSeqKey,value:_ticketSeq}); }catch(e){}
      // 2) Insert sale.
      var salePutReq=sSales.put(salePayload);
      // 3) For each item: decrement stock + emit STOCK_DECREMENT audit event.
      //    All synchronous within the IDB transaction — uses request callbacks but
      //    does not yield to the microtask queue between ops (cursor/await would
      //    risk invalidating the transaction context on some browsers).
      var decProbes=[];
      var i=0;
      function processItem(){
        if(i>=saleItems.length){ afterItems(); return; }
        var it=saleItems[i++];
        if(!it.bc){ processItem(); return; }
        var amount=(_isWeightProduct(it)&&it.weight!=null)?it.weight:(it.qty||1);
        var req=sProd.get(it.bc);
        req.onsuccess=function(){
          var p=req.result;
          if(!p){
            // mark failure — abort the TX
            try{tx.abort();}catch(_){}
            _toast("⚠️ Produit introuvable: "+it.name);
            return;
          }
          var cur=(p.stockQty||0);
          var next=cur-amount;
          // Allow sale if stock is 0 (unmanaged/demo) — only block if stock > 0 and insufficient
          if(cur>0 && next<0){
            var unit=(p.unitType||"unit");
            var isKg=(unit==="kg"||unit==="g"||unit==="L");
            try{tx.abort();}catch(_){}
            _toast("⚠️ Stock insuffisant: "+it.name+" (reste "+cur+", demandé "+amount+")");
            return;
          }
          // If stock is 0, don't decrement (treat as unmanaged stock — sale allowed)
          if(cur>0){
            p.stockQty=next;
            p.last_updated=Date.now();
            sProd.put(p);
          }
          // Audit STOCK_DECREMENT within the same TX.
          try{
            window._acimAudit.logInTx(tx,{
              type:window._acimAudit.TYPE.STOCK_DECREMENT,
              entityType:"stock",
              entityId:it.bc,
              action:"decrement",
              payload:{barcode:it.bc,amount:amount,reason:"sale"},
              previousState:{stockQty:cur},
              newState:{stockQty:next}
            });
          }catch(e){
            _err("Audit STOCK_DECREMENT append failed — aborting TX:",e);
            try{tx.abort();}catch(_){}
          }
          processItem();
        };
        req.onerror=function(){ try{tx.abort();}catch(_){} _toast("❌ Lecture stock échouée"); };
      }
      function afterItems(){
        // 4) Emit SALE_COMPLETED audit event for the sale as a whole.
        try{
          window._acimAudit.logInTx(tx,{
            type:window._acimAudit.TYPE.SALE_COMPLETED,
            entityType:"sale",
            entityId:String(ticketNum),
            action:"complete",
            payload:{
              ticket:ticketNum,
              itemCount:saleItems.length,
              totalCents:total,
              discountCents:discountCents||0,
              paymentMethods:paymentMethods
            },
            previousState:null,
            newState:null
          });
        }catch(e){
          _err("Audit SALE_COMPLETED append failed — aborting TX:",e);
          try{tx.abort();}catch(_){}
          return;
        }
        // 5) Wait for commit. tx.oncomplete fires → receipt + cleanup.
      }
      tx.oncomplete=function(){
        _showReceipt(ticketNum,saleItems,total,discountCents,payments);
        _broadcastClear();
        _myCart=[];_realBcMap={};_cartDiscountCents=0;
        _renderPOS();
      };
      tx.onabort=function(){
        // Roll back the in-memory ticket sequence since the sale failed.
        _ticketSeq--;
        try{ sMeta.put({key:_ticketSeqKey,value:_ticketSeq}); }catch(_){}  // best-effort; will be re-synced next boot
      };
      tx.onerror=function(){ _toast("❌ Erreur transaction vente"); };
      // Kick off the chain after setup so oncomplete/onabort are wired first.
      processItem();
    }).catch(function(e){
      _err("Finalize sale error:",e);
      _toast("❌ Vente échouée: "+(e&&e.message||"erreur"));
    });
  }

  // ─── PR C — MANUAL STOCK ADJUSTMENT + OPERATOR IDENTITY ───────────
  // Stock adjust reasons: shared constants for UI métier + tests + audit.
  // Construit comme frozen object pour empêcher la dérive runtime.
  var STOCK_ADJUST_REASON = Object.freeze({
    RESTOCK:    "restock",     // réception marchandise
    INVENTORY:  "inventory",   // ajustement d'inventaire
    LOSS:       "loss",        // casse / perte
    CORRECTION: "correction",  // correction d'erreur de saisie
    MANUAL:     "manual"       // autre raison manuelle
  });
  var _VALID_REASONS = Object.keys(STOCK_ADJUST_REASON).map(function(k){return STOCK_ADJUST_REASON[k];});
  var _USER_META_KEY = "acim-current-actor-id";
  var _PIN_REGEX = /^\d{4,8}$/;

  // Convertit un Uint8Array (taille arbitraire) en base64 — robuste pour tout
  // buffer, sans risque de stack overflow sur apply() pour longs tableaux.
  function _bytesToBase64(bytes){
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // Hash un PIN salé via SHA-256 (crypto.subtle). Retourne Promise<{salt, pinHash}> en base64.
  function _hashPin(pin, saltBytes){
    return new Promise(function(resolve, reject){
      try {
        var salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
        var pinBytes = new TextEncoder().encode(String(pin));
        var buf = new Uint8Array(salt.length + pinBytes.length);
        buf.set(salt, 0);
        buf.set(pinBytes, salt.length);
        crypto.subtle.digest("SHA-256", buf).then(function(hashBuf){
          resolve({
            salt: _bytesToBase64(salt),
            pinHash: _bytesToBase64(new Uint8Array(hashBuf))
          });
        }).catch(reject);
      } catch(e){ reject(e); }
    });
  }

  // Vérifie un PIN candidat contre {salt, pinHash} stockés. Resolve true/false.
  function _verifyPin(pin, saltB64, pinHashB64){
    return new Promise(function(resolve){
      try {
        var saltStr = atob(saltB64);
        var saltBytes = new Uint8Array(saltStr.length);
        for (var i = 0; i < saltStr.length; i++) saltBytes[i] = saltStr.charCodeAt(i);
        _hashPin(pin, saltBytes).then(function(h){
          resolve(h.pinHash === pinHashB64);
        }).catch(function(){ resolve(false); });
      } catch(e){ resolve(false); }
    });
  }

  // Crée un employé. id immuable, name modifiable, PIN salé.
  // Retourne Promise<{ok, userId?, error?}>.
  function _createUser(userId, pin, name, role){
    if(!userId) return Promise.resolve({ok:false, error:"missing-id"});
    if(!_PIN_REGEX.test(String(pin||""))) return Promise.resolve({ok:false, error:"pin-invalid"});
    if(!name) return Promise.resolve({ok:false, error:"missing-name"});
    if(role !== "cashier" && role !== "manager") role = "cashier";
    return _hashPin(pin).then(function(h){
      return _openUnifiedDB().then(function(db){
        if(!db) return {ok:false, error:"no-db"};
        return new Promise(function(resolve){
          var tx = db.transaction("users", "readwrite");
          var s = tx.objectStore("users");
          // Resolution policy: ONE resolve() per Promise, always. Either
          //   - oncomplete → {ok:true, userId}, OR
          //   - onabort / onerror → {ok:false, error: …}
          // We never resolve() then abort() then resolve() again. The first
          // event that fires wins; the others are no-ops (Promise semantics).
          // PR C invariant: install tx-level handlers BEFORE issuing any request
          // that may abort the tx — otherwise the abort event fires with no
          // listener and the Promise never resolves (Playwright timeout +
          // garbage collection). This is what_caused_ the_duplicate_id bug.
          var done = false;
          var abortReason = "tx-aborted";
          function settle(value){ if(!done){ done = true; resolve(value); } }
          tx.oncomplete = function(){ settle({ok:true, userId:userId}); };
          tx.onerror   = function(e){ settle({ok:false, error:"tx-error", detail:String(e&&e.target&&e.target.error&&e.target.error.name||"unknown")}); };
          tx.onabort   = function(e){ settle({ok:false, error:abortReason, detail:String(e&&e.target&&e.target.error&&e.target.error.name||"aborted")}); };
          var getReq = s.get(userId);
          getReq.onsuccess = function(){
            if(getReq.result){
              abortReason = "id-exists";
              try{ tx.abort(); }catch(_){ settle({ok:false, error:abortReason}); }
              return;
            }
            s.put({id:userId, salt:h.salt, pinHash:h.pinHash, name:String(name), role:role, active:true, createdAt:Date.now()});
          };
          getReq.onerror = function(){ settle({ok:false, error:"get-error"}); };
        });
      });
    }).catch(function(e){ return {ok:false, error:"hash-error", detail:String(e&&e.message||e)}; });
  }

  function _listUsers(){
    return _openUnifiedDB().then(function(db){
      if(!db) return [];
      return new Promise(function(resolve){
        var tx = db.transaction("users", "readonly");
        var req = tx.objectStore("users").getAll();
        req.onsuccess = function(){ resolve((req.result||[]).map(function(u){return {id:u.id, name:u.name, role:u.role, active:u.active, createdAt:u.createdAt};})); };
        req.onerror   = function(){ resolve([]); };
      });
    });
  }

  function _seedDefaultUser(){
    _log("Checking for default user...");
    return _openUnifiedDB().then(function(db){
      if(!db){ _err("No DB for seed user"); return; }
      return _hashPin("1234").then(function(h){
        return new Promise(function(resolve){
          var tx = db.transaction("users", "readwrite");
          var s = tx.objectStore("users");
          var getReq = s.get("u-admin");
          getReq.onsuccess = function(){
            if(getReq.result){
              // Update existing admin with PIN 1234 (in case it was created with different PIN)
              s.put({id:"u-admin", salt:h.salt, pinHash:h.pinHash, name:"Administrateur", role:"manager", active:true, createdAt:getReq.result.createdAt||Date.now()});
              _log("✅ Utilisateur admin mis à jour (PIN: 1234)");
            } else {
              // Check if any users exist
              var allReq = s.getAll();
              allReq.onsuccess = function(){
                if(allReq.result && allReq.result.length > 0){
                  _log("Users exist but no u-admin, skipping seed");
                  resolve();
                  return;
                }
                s.put({id:"u-admin", salt:h.salt, pinHash:h.pinHash, name:"Administrateur", role:"manager", active:true, createdAt:Date.now()});
                _log("✅ Utilisateur admin par défaut créé (PIN: 1234)");
              };
            }
          };
          tx.oncomplete = function(){ resolve(); };
          tx.onerror = function(){ _err("Seed user tx error"); resolve(); };
          tx.onabort = function(){ _err("Seed user tx aborted"); resolve(); };
        });
      }).catch(function(e){ _err("Seed user hash error:", e); });
    }).catch(function(e){ _err("Seed user DB error:", e); });
  }

  // Login via PIN. Resolve {ok, actor?} où actor = {id, name, role}.
  function _loginWithPin(pin){
    if(!_PIN_REGEX.test(String(pin||""))) return Promise.resolve({ok:false, error:"pin-invalid"});
    return _openUnifiedDB().then(function(db){
      if(!db) return {ok:false, error:"no-db"};
      return new Promise(function(resolve){
        var readTx = db.transaction("users", "readonly");
        var req = readTx.objectStore("users").getAll();
        req.onsuccess = function(){
          var users = req.result || [];
          // Probe each active user sequentially — salt pinned, async digest.
          // Note: readTx auto-commits once we let the event loop return; we do
          // NOT open any new tx on the same db *during* this readonly tx.
          var i = 0;
          function tryNext(){
            if(i >= users.length){ resolve({ok:false, error:"no-match"}); return; }
            var u = users[i++];
            if(!u.active){ tryNext(); return; }
            _verifyPin(pin, u.salt, u.pinHash).then(function(match){
              if(match){
                // Populate audit actorId immediately (in-memory only).
                if(window._acimAudit) window._acimAudit.setActor(u.id);
                // Persist session — fresh tx after read-only auto-closed.
                var wtx = db.transaction("meta", "readwrite");
                wtx.objectStore("meta").put({key:_USER_META_KEY, value:u.id, loginAt:Date.now()});
                wtx.oncomplete = function(){ resolve({ok:true, actor:{id:u.id, name:u.name, role:u.role}}); };
                wtx.onerror   = function(){ resolve({ok:true, actor:{id:u.id, name:u.name, role:u.role}}); };
              } else { tryNext(); }
            });
          }
          // Use setTimeout(0) to ensure readTx has released before opening the
          // next tx if the digest resolves synchronously (it doesn't, but be safe).
          tryNext();
        };
        req.onerror = function(){ resolve({ok:false, error:"db-error"}); };
      });
    });
  }

  function _logout(){
    if(window._acimAudit) window._acimAudit.setActor(null);
    return _openUnifiedDB().then(function(db){
      if(!db) return;
      return new Promise(function(resolve){
        var tx = db.transaction("meta", "readwrite");
        tx.objectStore("meta").delete(_USER_META_KEY);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror   = function(){ resolve(); };
      });
    });
  }

  function _getCurrentActor(){
    var actorId = window._acimAudit ? window._acimAudit.getActorId() : null;
    if(!actorId) return null;
    // Sync fetch (cached map if any) — but we need the name. Lightweight read.
    // For UI display: return cached actor name when possible.
    // Since this is sync, we hit the cache only; full info via _getCurrentActorAsync.
    return {id: actorId};
  }

  function _getCurrentActorAsync(){
    var actorId = window._acimAudit ? window._acimAudit.getActorId() : null;
    if(!actorId) return Promise.resolve(null);
    return _openUnifiedDB().then(function(db){
      if(!db) return null;
      return new Promise(function(resolve){
        var tx = db.transaction("users", "readonly");
        var req = tx.objectStore("users").get(actorId);
        req.onsuccess = function(){ if(req.result && req.result.active) resolve({id:req.result.id, name:req.result.name, role:req.result.role}); else resolve(null); };
        req.onerror   = function(){ resolve(null); };
      });
    });
  }

  // Restore session from meta on boot — called by init(). Best-effort, never blocks the app.
  function _restoreSessionIfAny(){
    return _openUnifiedDB().then(function(db){
      if(!db) return null;
      return new Promise(function(resolve){
        var tx = db.transaction("meta", "readonly");
        var req = tx.objectStore("meta").get(_USER_META_KEY);
        req.onsuccess = function(){
          if(req.result && req.result.value){
            // Validate that the user still exists and is active.
            var uTx = db.transaction("users", "readonly");
            var uReq = uTx.objectStore("users").get(req.result.value);
            uReq.onsuccess = function(){
              if(uReq.result && uReq.result.active && window._acimAudit){
                window._acimAudit.setActor(uReq.result.id);
                resolve({id:uReq.result.id, name:uReq.result.name, role:uReq.result.role});
              } else {
                if(window._acimAudit) window._acimAudit.setActor(null);
                resolve(null);
              }
            };
            uReq.onerror = function(){ resolve(null); };
          } else { resolve(null); }
        };
        req.onerror = function(){ resolve(null); };
      });
    });
  }

  // _adjustStock — point d'entrée unique pour ajustement manuel de stock.
  // TX atomique sur [products, audit_events]. Si logInTx throw → tx.abort.
  // Retourne Promise<{ok, newStock?, reason?}>.
  function _adjustStock(barcode, delta, reason){
    if(!barcode) return Promise.resolve({ok:false, reason:"no-barcode"});
    if(typeof delta !== "number" || isNaN(delta) || !isFinite(delta)) return Promise.resolve({ok:false, reason:"delta-invalid"});
    if(_VALID_REASONS.indexOf(reason) < 0) return Promise.resolve({ok:false, reason:"reason-invalid"});
    return _openUnifiedDB().then(function(db){
      if(!db) return {ok:false, reason:"no-db"};
      return new Promise(function(resolve){
        var tx;
        try {
          tx = db.transaction(["products","audit_events"], "readwrite");
        } catch(e){ resolve({ok:false, reason:"tx-open-error"}); return; }
        var sProd = tx.objectStore("products");
        var req = sProd.get(barcode);
        req.onsuccess = function(){
          var p = req.result;
          if(!p){ try{tx.abort();}catch(_){} resolve({ok:false, reason:"not-found"}); return; }
          var cur = (typeof p.stockQty === "number") ? p.stockQty : 0;
          var nextv = cur + delta;
          if(nextv < 0){
            try{tx.abort();}catch(_){}
            var unit = (p.unitType || "unit");
            var isKg = (unit === "kg" || unit === "g" || unit === "L");
            resolve({ok:false, reason: isKg ? "stock-kg:"+cur : "stock:"+cur, currentStock:cur, requested:delta});
            return;
          }
          p.stockQty = nextv;
          p.last_updated = Date.now();
          sProd.put(p);
          try {
            window._acimAudit.logInTx(tx, {
              type: window._acimAudit.TYPE.STOCK_ADJUSTED,
              entityType: "stock",
              entityId: barcode,
              action: "adjust",
              payload: {barcode:barcode, delta:delta, reason:reason},
              previousState: {stockQty: cur},
              newState: {stockQty: nextv}
            });
          } catch(e){
            _err("Audit STOCK_ADJUSTED append failed — aborting TX:", e);
            try{tx.abort();}catch(_){}
            resolve({ok:false, reason:"audit-error"});
            return;
          }
          tx.oncomplete = function(){ resolve({ok:true, newStock:nextv, reason:"ok"}); };
          tx.onabort   = function(){ resolve({ok:false, reason:"tx-aborted"}); };
          tx.onerror   = function(){ resolve({ok:false, reason:"tx-error"}); };
        };
        req.onerror = function(){ try{tx.abort();}catch(_){} resolve({ok:false, reason:"get-error"}); };
      });
    });
  }

  // ─── PR C — UI minimale (login + badge opérateur) ─────────────────
  function _showLogin(){
    var old=document.getElementById("acim-login"); if(old) old.remove();
    var ov=document.createElement("div"); ov.id="acim-login";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000005;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div"); ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="👤 Connexion opérateur"; card.appendChild(ti);
    var err=document.createElement("div"); err.style.cssText="font-size:13px;color:#c62828;min-height:18px;margin-bottom:6px;text-align:center;"; card.appendChild(err);
    var inp=document.createElement("input"); inp.type="password"; inp.inputMode="numeric"; inp.pattern="[0-9]*";
    inp.placeholder="PIN"; inp.style.cssText="width:100%;font-size:22px;font-weight:700;padding:10px;border:3px solid #e0e0e0;border-radius:8px;outline:none;text-align:center;letter-spacing:8px;box-sizing:border-box;";
    card.appendChild(inp);
    var br=document.createElement("div"); br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bCancel=document.createElement("button"); bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:15px;cursor:pointer;";
    bCancel.onclick=function(){ ov.remove(); };
    var bOk=document.createElement("button"); bOk.textContent="✅ Connexion";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:15px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var pin = inp.value.trim();
      if(!_PIN_REGEX.test(pin)){ err.textContent="PIN invalide (4-8 chiffres)"; return; }
      bOk.disabled = true; bOk.textContent = "…";
      _loginWithPin(pin).then(function(r){
        bOk.disabled = false; bOk.textContent = "✅ Connexion";
        if(r.ok){ ov.remove(); _toast("👤 Bonjour "+r.actor.name); _refreshActorBadge(); }
        else { err.textContent = "PIN incorrect"; inp.value=""; inp.focus(); }
      });
    };
    br.appendChild(bCancel); br.appendChild(bOk); card.appendChild(br);
    ov.appendChild(card); ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    document.body.appendChild(ov);
    setTimeout(function(){ inp.focus(); }, 100);
  }

  function _refreshActorBadge(){
    var badge = document.getElementById("acim-actor-badge");
    if(!badge) return;
    _getCurrentActorAsync().then(function(actor){
      badge.innerHTML = "";  // always wipe first — avoid button accumulation across refreshes
      if(!actor){
        var span=document.createElement("span");
        span.style.cssText="color:#888;font-weight:500;";
        span.textContent="👤 ops?";
        badge.appendChild(span);
        var b=document.createElement("button"); b.textContent="Connexion";
        b.style.cssText="margin-left:8px;padding:4px 10px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:13px;cursor:pointer;";
        b.onclick=function(){ _showLogin(); };
        badge.appendChild(b);
      } else {
        var btnLogin=document.createElement("button");
        btnLogin.innerHTML='👤 <b>'+esc(actor.name)+'</b> <span style="font-size:11px;color:#888;">('+esc(actor.role)+')</span> <span style="color:#c62828;">⏻</span>';
        btnLogin.style.cssText="padding:4px 10px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:13px;cursor:pointer;";
        btnLogin.onclick=function(){ if(confirm("Déconnexion opérateur ?")){ _logout().then(function(){ _toast("Déconnecté"); _refreshActorBadge(); }); } };
        badge.appendChild(btnLogin);
      }
    });
  }

  // ─── ROLE-BASED ACCESS ──────────────────────────────
  function _isManager(){
    var actor = _getCurrentActor();
    return actor && actor.role === "manager";
  }

  // ─── END PR C ─────────────────────────────────────────

  // ─── RECEIPT ─────────────────────────────────────────
  function _showReceipt(ticketNum,items,total,discountCents,payments){
    var old=document.getElementById("acim-receipt");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-receipt";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var receipt=document.createElement("div");
    receipt.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:'Courier New',monospace;font-size:13px;";
    var html=[];
    html.push('<div class="r-header">'+esc(_settings.storeName||'Magasin')+'</div>');
    html.push('<div class="r-sub">Ticket n°'+esc(ticketNum)+' &nbsp;|&nbsp; '+new Date().toLocaleDateString("fr-FR")+' '+new Date().toLocaleTimeString("fr-FR",{hour:'2-digit',minute:'2-digit'})+'</div>');
    html.push('<div class="r-div"></div>');
    items.forEach(function(it){
      var line=it.name||"?";
      if(it.qty&&it.qty>1)line=it.qty+"× "+line;
      html.push('<div class="r-line"><span>'+esc(line)+'</span><span class="r-price">'+((it.priceCents||it.price||0)/100).toFixed(2).replace(".",",")+'</span></div>');
    });
    html.push('<div class="r-div"></div>');
    if(discountCents>0){
      html.push('<div class="r-line" style="color:#2e7d32;"><span>Remise</span><span class="r-price">-'+(discountCents/100).toFixed(2).replace(".",",")+'</span></div>');
    }
    html.push('<div class="r-total"><span>TOTAL</span><span class="r-price">'+(total/100).toFixed(2).replace(".",",")+'</span></div>');
    if(payments&&payments.length>0){
      html.push('<div class="r-div"></div>');
      payments.forEach(function(pay){
        var label=pay.method==="especes"?"Espèces":pay.method==="cb"?"Carte":"Mixte";
        html.push('<div class="r-line"><span>'+label+'</span><span class="r-price">'+(pay.amountCents/100).toFixed(2).replace(".",",")+'</span></div>');
        if(pay.changeCents>0){
          html.push('<div class="r-line" style="color:#2e7d32;"><span>Rendu</span><span class="r-price">'+(pay.changeCents/100).toFixed(2).replace(".",",")+'</span></div>');
        }
      });
    }
    html.push('<div class="r-div"></div>');
    html.push('<div class="r-footer">'+(_settings.footer||'')+'</div>');
    receipt.innerHTML=html.join("");
    var btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bPrint=document.createElement("button");bPrint.textContent="🖨️ Imprimer";
    bPrint.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#1a1a2e;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bPrint.onclick=function(){
      // Store receipt HTML for print
      var pr=document.getElementById("acim-print-receipt");
      if(!pr){
        pr=document.createElement("div");pr.id="acim-print-receipt";
        document.body.appendChild(pr);
      }
      pr.innerHTML=_buildPrintReceipt(ticketNum,items,total,discountCents,payments);
      window.print();
    };
    btnRow.appendChild(bClose);btnRow.appendChild(bPrint);
    receipt.appendChild(btnRow);
    ov.appendChild(receipt);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  function _buildPrintReceipt(ticketNum,items,total,discountCents,payments){
    var store=_settings.storeName||"Magasin";
    var footer=_settings.footer||"";
    var lines=[];
    lines.push('<div class="r-header">'+store+'</div>');
    lines.push('<div class="r-sub">Ticket n°'+ticketNum+' &nbsp;|&nbsp; '+new Date().toLocaleDateString("fr-FR")+' '+new Date().toLocaleTimeString("fr-FR",{hour:'2-digit',minute:'2-digit'})+'</div>');
    lines.push('<div class="r-div"></div>');
    items.forEach(function(it){
      var line=it.name||"?";
      if(it.qty&&it.qty>1)line=it.qty+"× "+line;
      lines.push('<div class="r-line"><span>'+line+'</span><span class="r-price">'+((it.priceCents||it.price||0)/100).toFixed(2).replace(".",",")+'</span></div>');
    });
    lines.push('<div class="r-div"></div>');
    if(discountCents>0){
      lines.push('<div class="r-line" style="color:#2e7d32;"><span>Remise</span><span class="r-price">-'+(discountCents/100).toFixed(2).replace(".",",")+'</span></div>');
    }
    lines.push('<div class="r-total"><span>TOTAL</span><span class="r-price">'+(total/100).toFixed(2).replace(".",",")+'</span></div>');
    if(payments&&payments.length>0){
      lines.push('<div class="r-div"></div>');
      payments.forEach(function(pay){
        var label=pay.method==="especes"?"Espèces":pay.method==="cb"?"Carte":"Mixte";
        lines.push('<div class="r-line"><span>'+label+'</span><span class="r-price">'+(pay.amountCents/100).toFixed(2).replace(".",",")+'</span></div>');
        if(pay.changeCents>0){
          lines.push('<div class="r-line" style="color:#2e7d32;"><span>Rendu</span><span class="r-price">'+(pay.changeCents/100).toFixed(2).replace(".",",")+'</span></div>');
        }
      });
    }
    lines.push('<div class="r-div"></div>');
    lines.push('<div class="r-footer">'+footer+'</div>');
    return lines.join("")+_getPrintStyles();
  }
  function _getPrintStyles(){
    return '<style>'
      +'@page{size:80mm auto;margin:0;}'
      +'@media print{'
      +'body *{visibility:hidden;}'
      +'#acim-print-receipt,#acim-print-receipt *{visibility:visible;}'
      +'#acim-print-receipt{position:fixed;top:0;left:0;width:80mm;padding:2mm 3mm;font-family:"Courier New",monospace;font-size:3.2mm;color:#000;background:#fff;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
      +'.r-header{font-size:4mm;font-weight:700;text-align:center;margin-bottom:2mm;}'
      +'.r-sub{font-size:2.8mm;text-align:center;color:#333;margin-bottom:2mm;}'
      +'.r-div{border-top:0.3mm dashed #000;margin:1.5mm 0;}'
      +'.r-line{display:flex;justify-content:space-between;font-size:3mm;margin:0.5mm 0;}'
      +'.r-price{font-weight:700;white-space:nowrap;}'
      +'.r-total{display:flex;justify-content:space-between;font-weight:700;font-size:4mm;margin-top:1.5mm;}'
      +'.r-footer{text-align:center;font-size:2.5mm;color:#555;margin-top:2mm;}'
      +'}</style>';
  }

  // ─── WEIGH PRODUCT MODAL ─────────────────────────────
  function _weighProduct(product){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-weigh";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="⚖️ Peser — "+product.name;card.appendChild(ti);
    var unitLabel=document.createElement("div");
    unitLabel.style.cssText="font-size:16px;color:#666;margin-bottom:12px;";
    unitLabel.textContent="Prix unitaire: "+_formatPricePerUnit(product.pricePerUnit,product.unitType);
    card.appendChild(unitLabel);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:12px;";
    var wi=document.createElement("input");wi.type="number";wi.step="0.001";wi.min="0";
    wi.placeholder="Poids";wi.style.cssText="flex:1;font-size:28px;font-weight:700;padding:12px 14px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;";
    wi.onfocus=function(){this.select();};
    var unitSpan=document.createElement("span");
    unitSpan.style.cssText="font-size:22px;font-weight:700;color:#e65100;min-width:40px;";
    unitSpan.textContent=product.unitType||"kg";
    row.appendChild(wi);row.appendChild(unitSpan);card.appendChild(row);

    var pricePreview=document.createElement("div");
    pricePreview.style.cssText="font-size:36px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;min-height:40px;";
    pricePreview.textContent="0,00 €";
    card.appendChild(pricePreview);

    wi.addEventListener("input",function(){
      var w=parseFloat(wi.value);
      if(isNaN(w)||w<=0){pricePreview.textContent="0,00 €";return;}
      var total=_calcWeightPrice(w,product.unitType,product.pricePerUnit);
      pricePreview.textContent=(total/100).toFixed(2).replace(".",",")+" €";
    });

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Ajouter au ticket";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var w=parseFloat(wi.value);
      if(isNaN(w)||w<=0){wi.style.borderColor="#c62828";wi.focus();return;}
      var total=_calcWeightPrice(w,product.unitType,product.pricePerUnit);
      var displayName=product.name+" "+_formatWeight(w,product.unitType);
      _addToCart(displayName,total,product.barcode,product.category,w,product.unitType,product.pricePerUnit);
      ov.remove();_toast("✅ "+displayName+" = "+(total/100).toFixed(2)+"€");
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){wi.focus();},100);
  }

  // ─── TICKET DISCOUNT ─────────────────────────────────
  function _applyTicketDiscount(){
    if(_myCart.length===0){_toast("Panier vide");return;}
    var old=document.getElementById("acim-disc-dialog");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-disc-dialog";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:300px;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="🏷️ Remise sur ticket";card.appendChild(ti);
    var subtotal=_cartSubtotal();
    var info=document.createElement("div");info.style.cssText="font-size:12px;color:#666;margin-bottom:8px;";
    info.textContent="Sous-total: "+(subtotal/100).toFixed(2).replace(".",",")+" €";card.appendChild(info);

    // % or € toggle
    var modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:6px;margin-bottom:8px;";
    var pctBtn=document.createElement("button");pctBtn.textContent="%";
    pctBtn.style.cssText="flex:1;padding:6px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-weight:700;cursor:pointer;";
    var eurBtn=document.createElement("button");eurBtn.textContent="€";
    eurBtn.style.cssText="flex:1;padding:6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;cursor:pointer;";
    var modeIsPct=true;
    pctBtn.onclick=function(){modeIsPct=true;pctBtn.style.borderColor="#e65100";pctBtn.style.background="#fff3e0";pctBtn.style.fontWeight="700";eurBtn.style.borderColor="#e0e0e0";eurBtn.style.background="#fff";eurBtn.style.fontWeight="normal";};
    eurBtn.onclick=function(){modeIsPct=false;eurBtn.style.borderColor="#e65100";eurBtn.style.background="#fff3e0";eurBtn.style.fontWeight="700";pctBtn.style.borderColor="#e0e0e0";pctBtn.style.background="#fff";pctBtn.style.fontWeight="normal";};
    modeRow.appendChild(pctBtn);modeRow.appendChild(eurBtn);card.appendChild(modeRow);

    var valInput=document.createElement("input");valInput.type="number";valInput.step="0.01";valInput.min="0";
    valInput.placeholder="Montant";valInput.style.cssText="width:100%;font-size:18px;font-weight:700;padding:10px;border:3px solid #e65100;border-radius:8px;outline:none;text-align:center;box-sizing:border-box;margin-bottom:8px;";
    card.appendChild(valInput);
    var preview=document.createElement("div");preview.style.cssText="font-size:13px;color:#2e7d32;text-align:center;min-height:20px;margin-bottom:8px;";
    card.appendChild(preview);
    valInput.addEventListener("input",function(){
      var v=parseFloat(valInput.value)||0;
      if(modeIsPct){
        var disc=Math.round(subtotal*v/100);
        preview.textContent="Remise: -"+(disc/100).toFixed(2).replace(".",",")+" €";
      }else{
        var disc=Math.round(v*100);
        if(disc>subtotal)disc=subtotal;
        preview.textContent="Remise: -"+(disc/100).toFixed(2).replace(".",",")+" €";
      }
    });
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:8px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓ Appliquer";
    bOk.style.cssText="flex:1;padding:8px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var v=parseFloat(valInput.value)||0;
      if(v<=0){valInput.style.borderColor="#c62828";return;}
      if(modeIsPct){_cartDiscountCents=Math.round(subtotal*v/100);}
      else{_cartDiscountCents=Math.round(v*100);if(_cartDiscountCents>subtotal)_cartDiscountCents=subtotal;}
      ov.remove();_renderPOS();
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){valInput.focus();},100);
  }

  // ─── IDEAL CART (200€ preset) ──
  // Real verified EAN barcodes from Open Food Facts; fresh produce uses name search
  function _showIdealCart(){
    var idealItems=[
      {name:"Poulet entier",price:8.50,qty:2,cat:"viande"},
      {name:"Bavette de boeuf 500g",price:9.90,qty:2,cat:"viande"},
      {name:"Cotelettes de porc 4pce",price:7.50,qty:1,cat:"viande"},
      {name:"Saumon frais 200g",price:6.90,qty:2,cat:"poisson"},
      {name:"Riz basmati 1kg",price:2.80,qty:2,cat:"epicerie"},
      {name:"Pates spaghetti 500g",price:1.50,qty:3,cat:"epicerie",bc:"8076800195057"},
      {name:"Huile d'olive 75cl",price:6.90,qty:1,cat:"epicerie",bc:"3178050000749"},
      {name:"Sauce tomate 680g",price:2.20,qty:2,cat:"epicerie"},
      {name:"Conserve thon 185g",price:2.50,qty:3,cat:"epicerie",bc:"3019081239138"},
      {name:"Lait entier 1L",price:1.45,qty:4,cat:"laitier",bc:"3533631781002"},
      {name:"Beurre doux 250g",price:2.10,qty:2,cat:"laitier",bc:"3155251205500"},
      {name:"Fromage rape 200g",price:3.50,qty:1,cat:"laitier",bc:"3073781102093"},
      {name:"Oeufs plein air 12pce",price:3.80,qty:1,cat:"laitier"},
      {name:"Yaourts nature 12pce",price:3.20,qty:1,cat:"laitier",bc:"6111032002925"},
      {name:"Pommes variées 1kg",price:3.50,qty:2,cat:"fruits"},
      {name:"Bananes 1kg",price:2.20,qty:2,cat:"fruits"},
      {name:"Tomates grappe 1kg",price:4.50,qty:1,cat:"legumes"},
      {name:"Courgettes 1kg",price:3.80,qty:1,cat:"legumes"},
      {name:"Salade verte 200g",price:1.80,qty:2,cat:"legumes"},
      {name:"Carottes 1kg",price:2.50,qty:1,cat:"legumes"},
      {name:"Oignons 1kg",price:1.90,qty:1,cat:"legumes"},
      {name:"Pommes de terre 2kg",price:3.20,qty:1,cat:"legumes"},
      {name:"Eau minerale 6x1.5L",price:3.50,qty:2,cat:"boisson",bc:"3700123300014"},
      {name:"Jus d'orange 1L",price:2.80,qty:2,cat:"boisson"},
      {name:"Cafe moulu 250g",price:4.50,qty:1,cat:"epicerie",bc:"3187570015447"},
      {name:"Sucre en poudre 1kg",price:1.90,qty:1,cat:"epicerie",bc:"3165430810005"},
      {name:"Farine de ble 1kg",price:1.50,qty:1,cat:"epicerie",bc:"3068110702235"},
      {name:"Moutarde Dijon 200g",price:1.80,qty:1,cat:"epicerie",bc:"8720182460721"},
      {name:"Poivre noir moulin",price:3.50,qty:1,cat:"epicerie"},
      {name:"Sel fin 500g",price:0.90,qty:1,cat:"epicerie"},
      {name:"Herbes de Provence 20g",price:1.80,qty:1,cat:"epicerie"},
      {name:"Champignons de Paris 250g",price:2.20,qty:1,cat:"legumes"},
      {name:"Ail frais 3 pce",price:1.20,qty:1,cat:"legumes"},
      {name:"Citrons 500g",price:2.50,qty:1,cat:"fruits"},
      {name:"Mangue 1 pce",price:2.80,qty:1,cat:"fruits"},
      {name:"Lait de coco 400ml",price:2.20,qty:1,cat:"epicerie",bc:"5021047105317"},
      {name:"The vert 20 sachets",price:2.80,qty:1,cat:"epicerie"},
      {name:"Cornichons 330g",price:2.20,qty:1,cat:"epicerie"},
      {name:"Olives vertes 200g",price:2.50,qty:1,cat:"epicerie"},
      {name:"Pain de mie 500g",price:2.20,qty:1,cat:"boulangerie",bc:"3242271990056"},
      {name:"Baguette tradition",price:1.10,qty:2,cat:"boulangerie",bc:"3276551080656"},
      {name:"Croissants 4 pce",price:3.80,qty:1,cat:"boulangerie"},
      {name:"Legumes surgelés mix 750g",price:3.20,qty:1,cat:"surgelé",bc:"8410092173278"},
      {name:"Miel de fleur 250g",price:5.50,qty:1,cat:"epicerie"}
    ];

    // Clear cart first
    _myCart=[];

    // Add items and register in product catalog
    var total=0;
    idealItems.forEach(function(item){
      var bc=item.bc||("IDEAL-"+Date.now()+"-"+Math.random().toString(36).substr(2,4));
      var priceCents=Math.round(item.price*100);
      
      // Add to cart directly
      var myId="M"+Date.now()+Math.floor(Math.random()*9999);
      _myCart.push({myId:myId,name:item.name,priceCents:priceCents,bc:bc,cat:item.cat,
        weight:null,unitType:null,pricePerUnit:null,discountCents:0,qty:item.qty||1});
      _realBcMap[myId]=bc;
      
      total+=priceCents*(item.qty||1);
      
      // Register in product catalog if not exists
      if(!_allProducts.find(function(p){return p.barcode===bc;})){
        var prodObj={id:bc,name:item.name,priceCents:priceCents,sale_price_cents:priceCents,category:item.cat,image:null,barcode:bc,last_updated:new Date().toISOString()};
        _allProducts.push(prodObj);
        // Persist to IndexedDB so voice search can find it
        _dbPut(prodObj);
      }
    });

    // Update categories
    _buildCategories();
    _renderPOS();
    _updateCartFAB();

    // Open cart sheet on mobile
    if(window.innerWidth<=768){
      setTimeout(function(){_openCartSheet();},300);
    }

    // Show success message
    _toast("\u2705 Panier id\u00e9al charg\u00e9 \u2014 "+(total/100).toFixed(2).replace(".",",")+" \u20AC");
  }

  // Seed ideal cart products to IndexedDB on boot (so search/voice can find them)
  function _seedIdealProducts(allProducts){
    var idealItems=[
      {name:"Poulet entier",price:8.50,bc:"IDEAL-POULET-ENTIER",cat:"viande"},
      {name:"Bavette de boeuf 500g",price:9.90,bc:"IDEAL-BAVETTE",cat:"viande"},
      {name:"Cotelettes de porc 4pce",price:7.50,bc:"IDEAL-COTEL.PORC",cat:"viande"},
      {name:"Saumon frais 200g",price:6.90,bc:"IDEAL-SAUMON",cat:"poisson"},
      {name:"Riz basmati 1kg",price:2.80,bc:"IDEAL-RIZ-BASMATI",cat:"epicerie"},
      {name:"Pates spaghetti 500g",price:1.50,bc:"8076800195057",cat:"epicerie"},
      {name:"Huile d'olive 75cl",price:6.90,bc:"3178050000749",cat:"epicerie"},
      {name:"Sauce tomate 680g",price:2.20,bc:"IDEAL-SAUCE-TOMATE",cat:"epicerie"},
      {name:"Conserve thon 185g",price:2.50,bc:"3019081239138",cat:"epicerie"},
      {name:"Lait entier 1L",price:1.45,bc:"3533631781002",cat:"laitier"},
      {name:"Beurre doux 250g",price:2.10,bc:"3155251205500",cat:"laitier"},
      {name:"Fromage rape 200g",price:3.50,bc:"3073781102093",cat:"laitier"},
      {name:"Oeufs plein air 12pce",price:3.80,bc:"IDEAL-OEUFS",cat:"laitier"},
      {name:"Yaourts nature 12pce",price:3.20,bc:"6111032002925",cat:"laitier"},
      {name:"Pommes variées 1kg",price:3.50,bc:"IDEAL-POMMES",cat:"fruits"},
      {name:"Bananes 1kg",price:2.20,bc:"IDEAL-BANANES",cat:"fruits"},
      {name:"Tomates grappe 1kg",price:4.50,bc:"IDEAL-TOMATES-GRAPPE",cat:"legumes"},
      {name:"Courgettes 1kg",price:3.80,bc:"IDEAL-COURGETTES",cat:"legumes"},
      {name:"Salade verte 200g",price:1.80,bc:"IDEAL-SALADE-VERTE",cat:"legumes"},
      {name:"Carottes 1kg",price:2.50,bc:"IDEAL-CAROTTES",cat:"legumes"},
      {name:"Oignons 1kg",price:1.90,bc:"IDEAL-OIGNONS",cat:"legumes"},
      {name:"Pommes de terre 2kg",price:3.20,bc:"IDEAL-PDT",cat:"legumes"},
      {name:"Eau minerale 6x1.5L",price:3.50,bc:"3700123300014",cat:"boisson"},
      {name:"Jus d'orange 1L",price:2.80,bc:"IDEAL-JUS-ORANGE",cat:"boisson"},
      {name:"Cafe moulu 250g",price:4.50,bc:"3187570015447",cat:"epicerie"},
      {name:"Sucre en poudre 1kg",price:1.90,bc:"3165430810005",cat:"epicerie"},
      {name:"Farine de ble 1kg",price:1.50,bc:"3068110702235",cat:"epicerie"},
      {name:"Moutarde Dijon 200g",price:1.80,bc:"8720182460721",cat:"epicerie"},
      {name:"Poivre noir moulin",price:3.50,bc:"IDEAL-POIVRE",cat:"epicerie"},
      {name:"Sel fin 500g",price:0.90,bc:"IDEAL-SEL",cat:"epicerie"},
      {name:"Herbes de Provence 20g",price:1.80,bc:"IDEAL-HERBES",cat:"epicerie"},
      {name:"Champignons de Paris 250g",price:2.20,bc:"IDEAL-CHAMPIGNONS",cat:"legumes"},
      {name:"Ail frais 3 pce",price:1.20,bc:"IDEAL-AIL",cat:"legumes"},
      {name:"Citrons 500g",price:2.50,bc:"IDEAL-CITRONS",cat:"fruits"},
      {name:"Mangue 1 pce",price:2.80,bc:"IDEAL-MANGUE",cat:"fruits"},
      {name:"Lait de coco 400ml",price:2.20,bc:"5021047105317",cat:"epicerie"},
      {name:"The vert 20 sachets",price:2.80,bc:"IDEAL-THE-VERT",cat:"epicerie"},
      {name:"Cornichons 330g",price:2.20,bc:"IDEAL-CORNICHONS",cat:"epicerie"},
      {name:"Olives vertes 200g",price:2.50,bc:"IDEAL-OLIVES-VERTES",cat:"epicerie"},
      {name:"Pain de mie 500g",price:2.20,bc:"3242271990056",cat:"boulangerie"},
      {name:"Baguette tradition",price:1.10,bc:"3276551080656",cat:"boulangerie"},
      {name:"Croissants 4 pce",price:3.80,bc:"IDEAL-CROISSANTS",cat:"boulangerie"},
      {name:"Legumes surgelés mix 750g",price:3.20,bc:"8410092173278",cat:"surgelé"},
      {name:"Miel de fleur 250g",price:5.50,bc:"IDEAL-MIEL",cat:"epicerie"}
    ];
    var existingBcs={};
    allProducts.forEach(function(p){existingBcs[p.barcode]=true;});
    var toAdd=[];
    idealItems.forEach(function(item){
      if(!existingBcs[item.bc]){
        toAdd.push({id:item.bc,name:item.name,priceCents:Math.round(item.price*100),sale_price_cents:Math.round(item.price*100),category:item.cat,image:null,barcode:item.bc,last_updated:new Date().toISOString(),stockQty:0,low_stock_threshold:0,source:"ideal-cart-seed"});
      }
    });
    if(toAdd.length===0)return Promise.resolve(0);
    return Promise.all(toAdd.map(function(p){return _dbPut(p);})).then(function(){
      _log("Seeded "+toAdd.length+" ideal products to IndexedDB");
      return toAdd.length;
    });
  }
  // ─── MAIN MENU (history, settings, invoices, barcodes) ──
  function _showMainMenu(){
    var old=document.getElementById("acim-menu");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-menu";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:16px;color:#1a1a2e;text-align:center;";
    ti.textContent="🏪 Menu";card.appendChild(ti);

    var btns=[
      {label:"📋 Historique des ventes",fn:function(){ov.remove();_showHistory();}},
      {label:"📊 Rapport de fin de journée",fn:function(){ov.remove();_showDayReport();}},
      {label:"↩️ Annuler la dernière vente",fn:function(){ov.remove();_undoLastSale();}},
      {label:"🔍 Vérifier / Nettoyer le catalogue",fn:function(){ov.remove();_showProductAudit();},managerOnly:true},
      {label:"📄 Importer facture fournisseur",fn:function(){ov.remove();_showInvoiceImport();},managerOnly:true},
      {label:"📒 Catalogue fournisseur",fn:function(){ov.remove();_showSupplierCatalog();}},
      {label:"🏷️ Imprimer codes-barres",fn:function(){window.open("barcode.html","_blank");}},
      {label:"📤 Exporter mes données",fn:function(){ov.remove();_showExportDialog();},managerOnly:true},
      {label:"📦 Réinitialiser depuis un JSON maître",fn:function(){ov.remove();_showResetFromJson();},managerOnly:true},
      {label:"📥 Importer des données (JSON)",fn:function(){ov.remove();_showImportDialog();},managerOnly:true},
      {label:"🖥️ Écran client (2e écran)",fn:function(){window.open("customer-display.html","_blank");}},
      {label:"⬇️ Télécharger la version bureau (.exe)",fn:function(){window.open("https://github.com/aveca/AcimCaisse/releases/latest","_blank");}},
      {label:"🔄 Migrer depuis l'ancienne version",fn:function(){window.open("migration.html","_blank");}},
      {label:"⚙️ Paramètres",fn:function(){ov.remove();_showSettings();},managerOnly:true},
    ];
    var isMgr=_isManager();
    btns.forEach(function(b){
      if(b.managerOnly && !isMgr)return; // skip manager-only items for cashiers
      var btn=document.createElement("button");btn.textContent=b.label;
      btn.style.cssText="width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;text-align:left;margin-bottom:8px;";
      btn.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
      btn.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
      btn.onclick=b.fn;card.appendChild(btn);
    });
    var bClose=document.createElement("button");bClose.textContent="✕ Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:none;border-radius:8px;background:#f5f5f5;font-size:16px;cursor:pointer;margin-top:4px;";
    bClose.onclick=function(){ov.remove();};card.appendChild(bClose);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── HISTORY ─────────────────────────────────────────
  function _showHistory(){
    var old=document.getElementById("acim-history");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-history";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:500px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📋 Historique des ventes";card.appendChild(ti);

    var listDiv=document.createElement("div");listDiv.style.cssText="max-height:50vh;overflow-y:auto;";
    listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Chargement...</div>';
    card.appendChild(listDiv);

    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};card.appendChild(bClose);

    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    _getSalesHistory().then(function(sales){
      listDiv.innerHTML="";
      if(sales.length===0){listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Aucune vente enregistrée</div>';return;}
      sales.sort(function(a,b){return(b.timestamp||0)-(a.timestamp||0);});
      sales.forEach(function(s){
        var row=document.createElement("div");
        row.style.cssText="padding:8px;border-bottom:1px solid #f0f0f0;cursor:pointer;";
        row.onmouseenter=function(){this.style.background="#fafafa";};
        row.onmouseleave=function(){this.style.background="transparent";};
        var date=new Date(s.timestamp);
        row.innerHTML='<div style="display:flex;justify-content:space-between;"><span style="font-weight:700;">Ticket #'+esc(s.ticketNumber||"?")+'</span><span style="font-weight:700;color:#e65100;">'+esc((s.totalCents/100).toFixed(2).replace(".",","))+' €</span></div>'
          +'<div style="font-size:11px;color:#666;">'+esc(date.toLocaleDateString("fr-FR")+" "+date.toLocaleTimeString("fr-FR"))+' — '+(s.itemCount||0)+' article(s)</div>';
        if(s.discountCents>0)row.innerHTML+='<div style="font-size:11px;color:#2e7d32;">Remise: -'+(s.discountCents/100).toFixed(2).replace(".",",")+' €</div>';
        if(s.payments&&s.payments.length>0){
          var payLines=s.payments.map(function(p){return(p.method==="especes"?"💵":"💳")+" "+(p.amountCents/100).toFixed(2).replace(".",",")+"€";}).join(" + ");
          row.innerHTML+='<div style="font-size:11px;color:#666;">'+esc(payLines)+'</div>';
        }
        row.onclick=function(){_showReceipt(s.ticketNumber||0,s.items||[],s.totalCents||0,s.discountCents||0,s.payments||[]);};
        listDiv.appendChild(row);
      });
      // Show total
      var totalSales=sales.reduce(function(sum,s){return sum+(s.totalCents||0);},0);
      var totalDiv=document.createElement("div");
      totalDiv.style.cssText="padding:10px;border-top:2px solid #e65100;font-weight:700;font-size:14px;display:flex;justify-content:space-between;";
      totalDiv.innerHTML='<span>Total général ('+sales.length+' ventes)</span><span style="color:#e65100;">'+(totalSales/100).toFixed(2).replace(".",",")+' €</span>';
      listDiv.appendChild(totalDiv);
    });
  }

  // ─── INVOICE IMPORT ──────────────────────────────────
  function _showInvoiceImport(){
    var old=document.getElementById("acim-invoice");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-invoice";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📄 Importer une facture fournisseur";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:12px;";
    desc.textContent="Sélectionnez un fichier PDF de facture fournisseur. Le texte sera extrait (OCR si nécessaire) puis vérifiable avant import.";
    card.appendChild(desc);

    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".pdf,.json";fileInput.multiple=true;
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);

    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);

    // Preview area for extracted text
    var previewArea=document.createElement("div");previewArea.style.cssText="display:none;margin-bottom:12px;";
    var previewLabel=document.createElement("div");previewLabel.style.cssText="font-size:11px;color:#888;margin-bottom:4px;";
    previewLabel.textContent="Texte extrait (vérifiable) :";previewArea.appendChild(previewLabel);
    var previewTA=document.createElement("textarea");previewTA.rows=6;
    previewTA.style.cssText="width:100%;font-size:11px;font-family:monospace;padding:8px;border:1px solid #e0e0e0;border-radius:6px;resize:vertical;box-sizing:border-box;";
    previewArea.appendChild(previewTA);
    card.appendChild(previewArea);

    // Product count preview
    var countDiv=document.createElement("div");countDiv.style.cssText="font-size:13px;font-weight:700;color:#e65100;min-height:20px;margin-bottom:8px;";
    card.appendChild(countDiv);

    var allParsedProducts=[];
    var totalFiles=0;

    fileInput.onchange=function(e){
      var files=e.target.files;
      if(!files||files.length===0)return;
      allParsedProducts=[];
      totalFiles=files.length;
      statusDiv.textContent="⏳ Traitement de "+files.length+" fichier(s)...";
      previewArea.style.display="none";
      countDiv.textContent="";
      var fileChain=Promise.resolve();
      for(var fi=0;fi<files.length;fi++){
        (function(file){
          fileChain=fileChain.then(function(){return _processInvoiceFile(file,statusDiv,previewTA,previewArea).then(function(prods){
            if(prods&&prods.length>0){
              // Before adding, try to find real EAN from supplier catalog
              var enriched=[];
              for(var pi=0;pi<prods.length;pi++){
                var pp=prods[pi];
                // If no real barcode (made-up INV-...), try to find in supplier catalog
                if(!pp.barcode||pp.barcode.indexOf("INV-")===0){
                  var found=_findInSupplierCatalog(pp.name,pp.barcode);
                  if(found&&found.ean){
                    pp.barcode=found.ean;
                  }
                }
                enriched.push(pp);
              }
              allParsedProducts=allParsedProducts.concat(enriched);
            }
          });});
        })(files[fi]);
      }
      fileChain.then(function(){
        if(allParsedProducts.length>0){
          statusDiv.textContent="✅ "+totalFiles+" fichier(s) traités: "+allParsedProducts.length+" produit(s) extraits";
          countDiv.textContent=allParsedProducts.length+" produit(s) détecté(s)";
          window._acimParsedProducts=allParsedProducts;
        }else{
          statusDiv.textContent="❌ Aucun produit extrait des fichiers sélectionnés.";
        }
      });
    };

    function _findInSupplierCatalog(name,barcode){
      if(!_supplierCatalog||!_supplierCatalog.length)return null;
      // First try exact barcode match
      if(barcode){
        for(var si=0;si<_supplierCatalog.length;si++){
          if(_supplierCatalog[si].ean===barcode||_supplierCatalog[si].code===barcode)return _supplierCatalog[si];
        }
      }
      // Then try name match
      if(name){
        var best=null,bestScore=0;
        var nLower=name.toLowerCase();
        for(var si2=0;si2<_supplierCatalog.length;si2++){
          var cn=(_supplierCatalog[si2].name||"").toLowerCase();
          var score=_fuzzyNameScore(nLower,cn);
          if(score>bestScore&&score>=60){bestScore=score;best=_supplierCatalog[si2];}
        }
        if(best)return best;
      }
      return null;
    }
    function _fuzzyNameScore(a,b){
      if(a===b)return 100;
      // Word overlap
      var wa=a.split(/\s+/),wb=b.split(/\s+/);
      var common=0;
      for(var i=0;i<wa.length;i++){
        for(var j=0;j<wb.length;j++){
          if(wa[i].length>2&&wa[i]===wb[j]){common++;break;}
        }
      }
      var maxLen=Math.max(wa.length,wb.length);
      var wordScore=maxLen>0?Math.round(common/maxLen*100):0;
      // Levenshtein
      var lev=_levenshtein(a,b);
      var max=Math.max(a.length,b.length);
      var levScore=max>0?Math.round((1-lev/max)*100):0;
      return Math.max(wordScore,levScore);
    }
    function _levenshtein(a,b){
      if(a.length===0)return b.length;if(b.length===0)return a.length;
      var m=[];for(var i=0;i<=b.length;i++)m[i]=[i];for(var j=0;j<=a.length;j++)m[0][j]=j;
      for(i=1;i<=b.length;i++){for(j=1;j<=a.length;j++){m[i][j]=a[j-1]===b[i-1]?m[i-1][j-1]:Math.min(m[i-1][j-1],m[i-1][j],m[i][j-1])+1;}}
      return m[b.length][a.length];
    }
    function _processInvoiceFile(file,statusDiv,previewTA,previewArea){
      return new Promise(function(resolve){
        var lowerName=file.name.toLowerCase();
        if(lowerName.endsWith(".json")){
          var reader=new FileReader();
          reader.onload=function(ev){
            try{
              var data=JSON.parse(ev.target.result);
              var products=data.products||data;
              if(!Array.isArray(products)){resolve([]);return;}
              var result=[];
              products.forEach(function(p){
                var name=p.name||p.n||p.designation||"";
                var price=p.sale_price_cents||p.p||p.price_cents||0;
                var barcode=p.barcode||p.bc||"INV-"+Date.now()+"-"+Math.floor(Math.random()*9999);
                var qty=p.qty||p.quantity||1;
                var stock=p.stockQty||p.s||0;
                result.push({barcode:barcode,name:name,unitPrice:price/100,qty:qty,stockQty:stock,totalCents:Math.round(price*qty)});
              });
              resolve(result);
            }catch(ex){resolve([]);}
          };
          reader.readAsText(file);
        }else if(lowerName.endsWith(".pdf")){
          if(!window.acimExtractPdfText){statusDiv.textContent="❌ Module PDF non chargé.";resolve([]);return;}
          var reader2=new FileReader();
          reader2.onload=function(ev){
            statusDiv.textContent="⏳ Extraction PDF: "+file.name+"...";
            var bytes=new Uint8Array(ev.target.result);
            window.acimExtractPdfText(bytes).then(function(rawText){
              if(!rawText||!rawText.trim()){resolve([]);return;}
              previewArea.style.display="block";
              previewTA.value+=rawText+"\n\n--- "+file.name+" ---\n\n";
              var products=_parseInvoiceText(rawText);
              resolve(products);
            }).catch(function(){resolve([]);});
          };
          reader2.readAsArrayBuffer(file);
        }else{
          resolve([]);
        }
      });
    }

    // Parse invoice text into products (flexible parser)
    function _parseInvoiceText(text){
      var lines=text.split("\n");
      var products=[];
      var seen={};
      for(var i=0;i<lines.length;i++){
        var line=lines[i].trim();
        if(!line||line.length<5)continue;
        var lower=line.toLowerCase();
        // Skip obvious headers/footers
        if(/^(total|tva|facture|conditions|escompte|acompte|net a payer|port ht|montant ht|base ht|designation|adresse|tel|fax|email|code client|numero|date|ref|bon de|livraison|avoir)/.test(lower))continue;
        if(/(total\s*:?\s*\d|tva\s*:?\s*\d|merci|bonne|journee|caissier|vendeur)/i.test(line))continue;

        // Strategy 1: strict pattern "NNN CODE NAME QTY PRICE TOTAL"
        var m=line.match(/^(\d{3})\s+(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/);
        if(m){
          var barcode=m[2].replace(/[|\\\/]/g,"");
          var name=m[3].trim();
          var qty=parseFloat(m[4].replace(",","."))||1;
          var unitPrice=parseFloat(m[5].replace(",","."))||0;
          var total=parseFloat(m[6].replace(",","."))||0;
          if(name&&total>0&&!seen[barcode]){
            products.push({barcode:barcode,name:name,qty:qty,unitPrice:unitPrice,totalCents:Math.round(total*100)});
            seen[barcode]=true;
          }
          continue;
        }

        // Strategy 2: line with barcode pattern (EAN13, EAN8, or alphanumeric code)
        var bcMatch=line.match(/\b(\d{8,14}|[A-Z]{2,5}[-.]?\d{4,10})\b/);
        // Strategy 3: find ALL numbers in the line
        var allNums=[];
        var numRegex=/(\d+[.,]\d{1,2})\b/g;
        var nm;
        while((nm=numRegex.exec(line))!==null){
          var v=parseFloat(nm[1].replace(",","."));
          if(!isNaN(v)&&v>0) allNums.push({val:v,idx:nm.index,end:nm.index+nm[0].length});
        }
        // Also find integers that could be quantities
        var intRegex=/\b(\d{1,5})\b/g;
        while((nm=intRegex.exec(line))!==null){
          var iv=parseInt(nm[1]);
          if(iv>0&&iv<100000){
            var already=false;
            for(var ai=0;ai<allNums.length;ai++){if(Math.abs(allNums[ai].idx-nm.index)<3)already=true;}
            if(!already) allNums.push({val:iv,idx:nm.index,end:nm.index+nm[0].length,intOnly:true});
          }
        }
        allNums.sort(function(a,b){return a.idx-b.idx;});

        if(allNums.length<2)continue;

        // The last meaningful number is usually the line total
        var totalVal=allNums[allNums.length-1].val;
        if(totalVal<=0||totalVal>50000)continue;

        // Extract name: everything that's not a number
        var namePart=line.replace(/\d+[.,]\d{1,2}\b/g," ").replace(/\b\d{1,5}\b/g," ").replace(/\s+/g," ").trim();
        // Remove common non-product tokens
        namePart=namePart.replace(/^[\s\-–—:;/#,.*]+/,"").replace(/[\s\-–—:;/#,.*]+$/,"");
        if(namePart.length<2)continue;

        // Try to find barcode from the line
        var barcode="";
        if(bcMatch) barcode=bcMatch[1];
        else barcode="INV-"+Date.now()+"-"+i;

        // Deduce unit price: second-to-last number, or total if only 2 numbers
        var unitPrice=totalVal;
        var qty=1;
        if(allNums.length>=3){
          // Could be: qty price total
          var candidate=allNums[allNums.length-2];
          if(!candidate.intOnly&&candidate.val>0&&candidate.val<=5000){
            unitPrice=candidate.val;
            qty=Math.round(totalVal/unitPrice);
            if(qty<=0||qty>10000){qty=1;unitPrice=totalVal;}
          }else{
            // Second-to-last is integer => likely qty
            qty=candidate.val;
            unitPrice=Math.round((totalVal/qty)*100)/100;
          }
        }else if(allNums.length===2){
          // Two numbers: could be price total or qty total
          var n1=allNums[0].val;
          var n2=allNums[1].val;
          if(n1<n2&&n1<=5000){
            unitPrice=n1;
            qty=Math.round(n2/n1);
            if(qty<=0||qty>10000){qty=1;unitPrice=n2;}
          }
        }

        if(!seen[barcode]&&namePart.length>=2){
          products.push({barcode:barcode,name:namePart,qty:qty,unitPrice:unitPrice,totalCents:Math.round(totalVal*100)});
          seen[barcode]=true;
        }
      }
      return products;
    }

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bImport=document.createElement("button");bImport.textContent="📥 Importer dans le catalogue";
    bImport.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bImport.onclick=function(){
      var products=window._acimParsedProducts;
      if(!products||products.length===0){statusDiv.textContent="❌ Aucun produit à importer.";return;}
      // Load all existing products for fuzzy matching
      _dbGetAll().then(function(existingProducts){
        var matched=0,created=0,details=[];
        var chain=Promise.resolve();
        products.forEach(function(p){
          chain=chain.then(function(){
            // 1. Try exact barcode match
            return _dbGet(p.barcode).then(function(existing){
              if(existing){
                existing.stockQty=(existing.stockQty||0)+(p.qty||0);
                existing.last_updated=Date.now();
                return _dbPut(existing).then(function(){matched++;details.push({name:p.name,status:"⬆️ stock mis à jour (+"+p.qty+")",match:true});});
              }
              // 2. Try fuzzy name match against existing catalog
              var best=_findBestMatch(p.name,existingProducts,65);
              if(best){
                var ep=best.product;
                ep.stockQty=(ep.stockQty||0)+(p.qty||0);
                // Update price if the invoice price is valid and different
                var newPrice=Math.round(p.unitPrice*100);
                if(newPrice>0&&newPrice!==ep.sale_price_cents){
                  ep.sale_price_cents=newPrice;
                }
                ep.last_updated=Date.now();
                return _dbPut(ep).then(function(){matched++;details.push({name:p.name,status:"🔗 fusionné → \""+ep.name+"\" ("+best.score+"%) +stock",match:true});});
              }
              // 3. No match → create new with auto-category
              var cat=_guessCategory(p.name)||"epicerie";
              return _dbPut({barcode:p.barcode,name:p.name,sale_price_cents:Math.round(p.unitPrice*100)||0,category:cat,stockQty:p.qty||0,source:"invoice-import",last_updated:Date.now()}).then(function(){
                created++;
                details.push({name:p.name,status:"🆕 créé ("+_catIcon(cat)+" "+cat+")",match:false});
              });
            });
          });
        });
        chain.then(function(){
          var summary="✅ Import terminé: "+matched+" fusionné(s), "+created+" nouveau(x)";
          if(matched>0||created>0){
            summary+="\n\n";
            details.forEach(function(d){summary+=d.status+" "+d.name+"\n";});
            // Save imported products to meta for auto-restore on startup
            _openMeta().then(function(d){
              if(!d)return;
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:"catalog-from-pdf",value:products});
            });
          }
          statusDiv.textContent=summary;
          statusDiv.style.whiteSpace="pre-wrap";
          window._acimParsedProducts=null;
          _refreshAndFilter();
        });
      });
    };
    br.appendChild(bClose);br.appendChild(bImport);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── DELETE PRODUCT CONFIRM ────────────────────────────
  function _confirmDeleteProduct(product){
    var old=document.getElementById("acim-del-confirm");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-del-confirm";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000003;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#c62828;";
    ti.textContent="🗑️ Supprimer ce produit ?";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:13px;color:#666;margin-bottom:16px;";
    info.innerHTML="<strong>"+esc(product.name)+"</strong><br>Code: "+esc(product.barcode)+"<br>Stock: "+(product.stockQty||0);
    card.appendChild(info);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bDel=document.createElement("button");bDel.textContent="🗑️ Supprimer";
    bDel.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bDel.onclick=function(){
      _dbDelete(product.barcode).then(function(){
        ov.remove();_toast("🗑️ "+product.name+" supprimé");
        _refreshAndFilter();
      });
    };
    br.appendChild(bCancel);br.appendChild(bDel);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _confirmDeleteAll(){
    var old=document.getElementById("acim-delall");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-delall";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000003;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#c62828;";
    ti.textContent="🗑️ Supprimer TOUS les produits ?";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:13px;color:#666;margin-bottom:16px;";
    info.textContent="Cette action est irréversible. Tous les produits du catalogue seront supprimés.";
    card.appendChild(info);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bDel=document.createElement("button");bDel.textContent="🗑️ Tout supprimer";
    bDel.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bDel.onclick=function(){
      _dbDeleteAll().then(function(){
        ov.remove();_toast("🗑️ Tous les produits supprimés");
        _allProducts=[];_filterProducts();
      });
    };
    br.appendChild(bCancel);br.appendChild(bDel);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  // ─── SETTINGS ────────────────────────────────────────
  function _showSettings(){
    var old=document.getElementById("acim-settings");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-settings";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="⚙️ Paramètres";card.appendChild(ti);

    var nameInput=document.createElement("input");nameInput.type="text";nameInput.value=_settings.storeName;
    nameInput.placeholder="Nom du magasin";nameInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    card.appendChild(nameInput);
    var footerInput=document.createElement("input");footerInput.type="text";footerInput.value=_settings.footer;
    footerInput.placeholder="Footer ticket";footerInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:12px;";
    card.appendChild(footerInput);

    var dangerBtn=document.createElement("button");dangerBtn.textContent="🗑️ Supprimer tous les produits";
    dangerBtn.style.cssText="width:100%;padding:10px;border:2px solid #ffcdd2;border-radius:8px;background:#fff;color:#c62828;font-size:13px;cursor:pointer;margin-bottom:12px;font-weight:600;";
    dangerBtn.onclick=function(){ov.remove();_confirmDeleteAll();};
    card.appendChild(dangerBtn);

    var downloadLink=document.createElement("a");
    downloadLink.href="https://github.com/aveca/AcimCaisse/releases/download/v1.0/AcimCaisse-win32-lowspec.zip";
    downloadLink.textContent="📥 Télécharger la version Win32 (low spec)";
    downloadLink.style.cssText="display:block;width:100%;padding:10px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:13px;cursor:pointer;margin-bottom:12px;font-weight:600;text-align:center;text-decoration:none;";
    card.appendChild(downloadLink);

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="Enregistrer";
    bOk.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      _settings.storeName=nameInput.value.trim()||"AcimCaisse";
      _settings.footer=footerInput.value.trim()||"Merci de votre visite !";
      _saveSettings();ov.remove();_toast("✅ Paramètres enregistrés");
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── INLINE EDIT ─────────────────────────────────────
  function _inlineEdit(idx,clickX,clickY){
    if(!_myCart[idx])return;
    var item=_myCart[idx];
    var oldCard=document.getElementById("acim-inline-edit");if(oldCard)oldCard.remove();
    var card=document.createElement("div");card.id="acim-inline-edit";
    var left=Math.max(10,(window.innerWidth-320)/2);
    var top=Math.max(10,(window.innerHeight-500)/2);
    card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:320px;max-height:80vh;overflow-y:auto;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000003;font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a2e;";ti.textContent=_catIcon(item.cat||"autre")+" Modifier";card.appendChild(ti);
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:17px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.priceCents>0?(item.priceCents/100).toFixed(2):"";pi.placeholder="Prix fixe";
    pi.style.cssText="flex:1;font-size:20px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:20px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);

    // Weight section - more prominent
    var poidsLabel=document.createElement("div");
    poidsLabel.style.cssText="font-size:14px;font-weight:700;color:#e65100;margin:10px 0 6px 0;";
    poidsLabel.textContent="⚖️ Poids (kg)";
    card.appendChild(poidsLabel);

    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=item.weight!=null?item.weight:"";poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:24px;padding:10px 12px;border:3px solid #e65100;border-radius:8px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";this.select();};poidsIn.onblur=function(){this.style.borderColor="#e65100";};
    var unitSel=document.createElement("select");    unitSel.style.cssText="font-size:16px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    unitSel.innerHTML="";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(item.unitType&&u[0]===item.unitType)o.selected=true;
      unitSel.appendChild(o);
    });

    var ppuRow=document.createElement("div");ppuRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var ppuIn=document.createElement("input");ppuIn.type="number";ppuIn.step="0.01";ppuIn.min="0";
    ppuIn.value=item.pricePerUnit!=null?(item.pricePerUnit/100).toFixed(2):"";ppuIn.placeholder="Prix unitaire (€/kg)";
    ppuIn.style.cssText="flex:1;font-size:16px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    ppuIn.onfocus=function(){this.style.borderColor="#e65100";};ppuIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var ppuUnit=document.createElement("span");ppuUnit.style.cssText="font-size:11px;color:#666;min-width:40px;";
    ppuUnit.textContent="/"+(item.unitType||"kg");
    ppuRow.appendChild(ppuIn);ppuRow.appendChild(ppuUnit);card.appendChild(ppuRow);

    unitSel.onchange=function(){ppuUnit.textContent="/"+unitSel.value;};
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);

    var preview=document.createElement("div");preview.style.cssText="font-size:20px;font-weight:700;color:#fff;background:#e65100;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px;min-height:28px;display:none;";
    card.appendChild(preview);

    function _updatePreview(){
      var w=parseFloat(poidsIn.value);
      var ppu=parseFloat(ppuIn.value);
      var u=unitSel.value;
      if(!isNaN(w)&&w>0&&!isNaN(ppu)&&ppu>0){
        var ppuCents=Math.round(ppu*100);
        var total=_calcWeightPrice(w,u,ppuCents);
        preview.textContent="⚖️ "+_formatWeight(w,u)+" × "+_formatPricePerUnit(ppuCents,u)+" = "+(total/100).toFixed(2)+"€";
        preview.style.display="block";
        pi.value=(total/100).toFixed(2);
      }else{preview.textContent="";preview.style.display="none";}
    }
    poidsIn.addEventListener("input",_updatePreview);
    ppuIn.addEventListener("input",_updatePreview);
    unitSel.addEventListener("change",_updatePreview);

    // Category
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:18px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);

    // Barcode + print button
    if(item.bc){
      var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:11px;color:#888;";
      bcRow.textContent="📊 "+item.bc;
      var printBtn=document.createElement("button");printBtn.textContent="🖨️ Étiquette";
      printBtn.style.cssText="margin-left:auto;padding:2px 6px;border:1px solid #e0e0e0;border-radius:4px;background:#fff;font-size:10px;cursor:pointer;";
      printBtn.onclick=function(){window.open("barcode.html?nom="+encodeURIComponent(item.name)+"&code="+encodeURIComponent(item.bc),"_blank");};
      bcRow.appendChild(printBtn);card.appendChild(bcRow);
    }

    var br=document.createElement("div");br.style.cssText="display:flex;gap:6px;";
    var bDel=document.createElement("button");bDel.textContent="🗑️";
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:16px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){card.remove();_removeFromCart(idx);};
    var bCancel=document.createElement("button");bCancel.textContent="×";
    bCancel.style.cssText="padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;background:#f5f5f5;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){card.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓";
    bOk.style.cssText="flex:1;padding:6px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      var ppu=parseFloat(ppuIn.value);
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?_myCart[idx].priceCents:Math.round(np*100);
      var weight=null,unitType=null,pricePerUnit=null;
      if(!isNaN(pv)&&pv>0&&u){
        weight=pv;unitType=u;
        if(!isNaN(ppu)&&ppu>0)pricePerUnit=Math.round(ppu*100);
        if(!pricePerUnit&&item.pricePerUnit)pricePerUnit=item.pricePerUnit;
        if(weight&&unitType&&pricePerUnit){
          pc=_calcWeightPrice(weight,unitType,pricePerUnit);
          nn=ni.value.trim()+" "+_formatWeight(weight,unitType);
        }
      }
      card.remove();
      _myCart[idx].name=nn;_myCart[idx].priceCents=pc;_myCart[idx].cat=selCat;
      _myCart[idx].weight=weight;_myCart[idx].unitType=unitType;_myCart[idx].pricePerUnit=pricePerUnit;
      if(item.bc){
        _dbGet(item.bc).then(function(existing){
          if(existing){
            existing.name=nn;
            if(pc>0)existing.sale_price_cents=pc;
            existing.category=selCat;
            if(weight!=null)existing.pricePerUnit=pricePerUnit;
            if(unitType)existing.unitType=unitType;
            existing.last_updated=Date.now();
            _dbPut(existing).then(function(){_refreshAndFilter();});
          }
        });
      }
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      _renderPOS();
    };
    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);

    // Auto-fill pricePerUnit from IndexedDB if product has barcode
    if(item.bc){
      _dbGet(item.bc).then(function(existing){
        if(existing && existing.pricePerUnit && !item.pricePerUnit){
          ppuIn.value=(existing.pricePerUnit/100).toFixed(2);
          if(existing.unitType){
            unitSel.value=existing.unitType;
            ppuUnit.textContent="/"+existing.unitType;
          }
          // Trigger preview update
          if(poidsIn.value)_updatePreview();
        }
      });
    }

    // Auto-focus on weight input
    setTimeout(function(){poidsIn.focus();poidsIn.select();},100);
  }

  // ─── QUICK CREATE ────────────────────────────────────
  function _quickCreate(name,priceCents,barcode,category){
    if(_dialogOpen())return;
    var providedBc=barcode||"";
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent=providedBc?"➕ Nouveau produit (scanné)":"➕ Nouveau produit";card.appendChild(ti);

    if(providedBc){
      var bcBadge=document.createElement("div");
      bcBadge.style.cssText="background:#e3f2fd;color:#1565c0;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;margin-bottom:8px;font-family:monospace;";
      bcBadge.textContent="📊 Code-barres: "+providedBc;
      card.appendChild(bcBadge);
    }
    var ni=document.createElement("input");ni.type="text";ni.placeholder="Nom du produit";ni.value=name||"";
    ni.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);

    var toggleRow=document.createElement("div");toggleRow.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px;";
    var toggleLabel=document.createElement("label");toggleLabel.style.cssText="font-size:13px;color:#1a1a2e;cursor:pointer;display:flex;align-items:center;gap:6px;";
    var toggle=document.createElement("input");toggle.type="checkbox";
    toggle.style.cssText="width:18px;height:18px;accent-color:#e65100;cursor:pointer;";
    toggleLabel.appendChild(toggle);toggleLabel.appendChild(document.createTextNode("⚖️ Produit au poids"));toggleRow.appendChild(toggleLabel);
    card.appendChild(toggleRow);

    var fixedRow=document.createElement("div");fixedRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";pi.value=priceCents>0?(priceCents/100).toFixed(2):"";
    pi.placeholder="Prix de vente";pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    fixedRow.appendChild(pi);fixedRow.appendChild(eu);card.appendChild(fixedRow);

    var weighSection=document.createElement("div");weighSection.style.cssText="display:none;";
    var ppuRow=document.createElement("div");ppuRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var ppuIn=document.createElement("input");ppuIn.type="number";ppuIn.step="0.01";ppuIn.min="0";
    ppuIn.placeholder="Prix unitaire (ex: 25,00€/kg)";ppuIn.style.cssText="flex:1;font-size:16px;font-weight:700;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;";
    ppuIn.onfocus=function(){this.style.borderColor="#e65100";};ppuIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var ppuUnitSel=document.createElement("select");ppuUnitSel.style.cssText="font-size:14px;padding:8px;border:3px solid #e0e0e0;border-radius:10px;outline:none;background:#fff;";
    [["kg","€/kg"],["g","€/kg (g)"],["L","€/L"],["pc","€/pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];ppuUnitSel.appendChild(o);});
    ppuRow.appendChild(ppuIn);ppuRow.appendChild(ppuUnitSel);weighSection.appendChild(ppuRow);
    card.appendChild(weighSection);

    toggle.onchange=function(){
      if(toggle.checked){fixedRow.style.display="none";weighSection.style.display="block";ppuIn.focus();}
      else{fixedRow.style.display="flex";weighSection.style.display="none";pi.focus();}
    };

    // Stock input
    var stockRow=document.createElement("div");stockRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var stockLabel=document.createElement("span");stockLabel.style.cssText="font-size:12px;color:#666;";stockLabel.textContent="Stock:";
    var stockIn=document.createElement("input");stockIn.type="number";stockIn.step="1";stockIn.min="0";stockIn.value="0";
    stockIn.style.cssText="flex:1;font-size:14px;padding:8px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    stockRow.appendChild(stockLabel);stockRow.appendChild(stockIn);card.appendChild(stockRow);

    // Purchase price + threshold row
    var ppRow=document.createElement("div");ppRow.style.cssText="display:flex;gap:4px;margin-bottom:8px;";
    var ppIn=document.createElement("input");ppIn.type="number";ppIn.step="0.01";ppIn.min="0";
    ppIn.placeholder="Prix d'achat";ppIn.style.cssText="flex:1;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    var thIn=document.createElement("input");thIn.type="number";thIn.step="1";thIn.min="0";thIn.value="5";
    thIn.placeholder="Seuil stock";thIn.style.cssText="width:70px;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    ppRow.appendChild(ppIn);ppRow.appendChild(thIn);card.appendChild(ppRow);

    // Expiry date
    var expRow=document.createElement("div");expRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var expLabel=document.createElement("span");expLabel.style.cssText="font-size:12px;color:#666;";expLabel.textContent="DLC:";
    var expIn=document.createElement("input");expIn.type="date";
    expIn.style.cssText="flex:1;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    expRow.appendChild(expLabel);expRow.appendChild(expIn);card.appendChild(expRow);

    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;";
    var selCat=category||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic+" "+cat.id;
      b.style.cssText="padding:5px 10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:12px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="Ajouter au ticket";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim();
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var useBc=providedBc||_nextBarcode();
      var stockQty=parseInt(stockIn.value)||0;
      if(toggle.checked){
        var ppu=parseFloat(ppuIn.value);
        var unitType=ppuUnitSel.value;
        if(isNaN(ppu)||ppu<=0){ppuIn.style.borderColor="#c62828";ppuIn.focus();return;}
        var ppuCents=Math.round(ppu*100);
        _addToCart(nn,0,useBc,selCat,null,unitType,ppuCents);
        _dbPut({barcode:useBc,name:nn,sale_price_cents:0,category:selCat,stockQty:stockQty,pricePerUnit:ppuCents,unitType:unitType,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual-weight",last_updated:Date.now()}).then(function(){ov.remove();_refreshAndFilter();_toast("⚖️ "+nn+" — "+_formatPricePerUnit(ppuCents,unitType));});
      }else{
        var np=parseFloat(pi.value);
        var pc=isNaN(np)?0:Math.round(np*100);
        _addToCart(nn,pc,useBc,selCat);
        _dbPut({barcode:useBc,name:nn,sale_price_cents:pc,category:selCat,stockQty:stockQty,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual",last_updated:Date.now()}).then(function(){ov.remove();_refreshAndFilter();_toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));});
      }
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){ni.focus();},100);
  }

  function _dialogOpen(){return!!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick")||!!document.getElementById("acim-weigh")||!!document.getElementById("acim-payment")||!!document.getElementById("acim-receipt")||!!document.getElementById("acim-history")||!!document.getElementById("acim-menu")||!!document.getElementById("acim-settings")||!!document.getElementById("acim-invoice")||!!document.getElementById("acim-disc-dialog");}

  // ─── EXPORT / IMPORT JSON ─────────────────────────────
  function _exportAllData(){
    return Promise.all([_dbGetAll(),_getSalesHistory(),_openMeta().then(function(d){
      if(!d)return{};return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").getAll();
        r.onsuccess=function(){var obj={};(r.result||[]).forEach(function(e){obj[e.key]=e.value;});ok(obj);};
        r.onerror=function(){ok({});};
      });
    }).catch(function(){return{};})]).then(function(results){
      return{
        version:1,
        exportDate:new Date().toISOString(),
        source:"acim-caisse-v1.3.0",
        products:results[0]||[],
        sales:results[1]||[],
        meta:results[2]||{}
      };
    });
  }
  function _downloadJSON(data,filename){
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function _exportDartFormat(){
    return _dbGetAll().then(function(products){
      var catMap={"frais":"Frais","epicerie":"Sec","surgele":"Congele","autre":"Divers","vin":"Vin","alcool":"Alcool"};
      var catIds={};var cats=[];
      ["frais","epicerie","surgele","autre","vin","alcool"].forEach(function(c){
        var id="cat-"+c;catIds[c]=id;
        cats.push({id:id,createdAt:Date.now(),updatedAt:Date.now(),deletedAt:null,isDirty:true,syncVersion:0,name:catMap[c]||"Divers",color:null});
      });
      var dartProducts=(products||[]).map(function(p){
        return {
          id:"p-"+(p.barcode||"").replace(/[^a-zA-Z0-9]/g,""),
          createdAt:p.last_updated||Date.now(),updatedAt:p.last_updated||Date.now(),
          deletedAt:null,isDirty:true,syncVersion:0,
          barcode:p.barcode||null,name:p.name||"Sans nom",
          categoryId:catIds[p.category]||catIds["autre"],
          purchasePriceCents:p.purchase_price_cents||0,
          salePriceCents:p.sale_price_cents||0,
          stockQty:p.stockQty||0,unit:p.unitType||"pc",
          lowStockThreshold:p.low_stock_threshold||5,
          expiryDate:p.expiry_date||null,vatRateBp:2000,lastSoldAt:null
        };
      });
      return {
        format:1,schemaVersion:3,exportedAt:new Date().toISOString(),
        categories:cats,products:dartProducts,sales:[],saleItems:[],
        payments:[],stockMovements:[],
        users:[{id:"u-admin",createdAt:Date.now(),updatedAt:Date.now(),deletedAt:null,isDirty:true,syncVersion:0,name:"Administrateur",role:"admin",pinHash:null,pinSalt:null}],
        settings:[{id:"default",storeName:"Mon magasin",address:null,phone:null,logoPath:null,currency:"EUR",defaultVatRateBp:2000,ticketHeader:null,ticketFooter:null,registerId:""+Date.now(),nextTicketNumber:1,updatedAt:Date.now()}],
        orders:[]
      };
    });
  }
  function _showExportDialog(){
    var old=document.getElementById("acim-export");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-export";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="📤 Exporter mes données";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:16px;text-align:center;";
    desc.textContent="Télécharge un fichier JSON contenant tous vos produits, ventes et paramètres.";
    card.appendChild(desc);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:13px;color:#666;min-height:20px;margin-bottom:12px;text-align:center;";
    card.appendChild(statusDiv);

    var bExportJS=document.createElement("button");bExportJS.textContent="📤 Format JS (caisse)";
    bExportJS.style.cssText="width:100%;padding:10px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bExportJS.onclick=function(){
      statusDiv.textContent="⏳ Préparation de l'export JS...";
      bExportJS.disabled=true;bExportJS.style.opacity="0.5";
      _exportAllData().then(function(data){
        var dateStr=new Date().toISOString().slice(0,10);
        var filename="acimcaisse-backup-js-"+dateStr+".json";
        _downloadJSON(data,filename);
        statusDiv.textContent="✅ Fichier téléchargé: "+filename;
        statusDiv.style.color="#2e7d32";
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
      }).then(function(){bExportJS.disabled=false;bExportJS.style.opacity="1";});
    };
    card.appendChild(bExportJS);

    var bExportDart=document.createElement("button");bExportDart.textContent="📤 Format Flutter (version B)";
    bExportDart.style.cssText="width:100%;padding:10px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bExportDart.onclick=function(){
      statusDiv.textContent="⏳ Préparation de l'export Flutter...";
      bExportDart.disabled=true;bExportDart.style.opacity="0.5";
      _exportDartFormat().then(function(data){
        var dateStr=new Date().toISOString().slice(0,10);
        var filename="acimcaisse-backup-flutter-"+dateStr+".json";
        _downloadJSON(data,filename);
        statusDiv.textContent="✅ Fichier téléchargé: "+filename;
        statusDiv.style.color="#2e7d32";
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
      }).then(function(){bExportDart.disabled=false;bExportDart.style.opacity="1";});
    };
    card.appendChild(bExportDart);

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    br.appendChild(bClose);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _showImportDialog(){
    var old=document.getElementById("acim-import");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-import";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="📥 Importer des données";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:12px;text-align:center;";
    desc.textContent="Importe un fichier JSON exporté depuis AcimCaisse. Les doublons (même code-barres) sont écrasés.";
    card.appendChild(desc);
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);
    var previewDiv=document.createElement("div");previewDiv.style.cssText="display:none;margin-bottom:12px;";
    card.appendChild(previewDiv);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bImport=document.createElement("button");bImport.textContent="📥 Importer";
    bImport.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px;cursor:pointer;font-weight:700;display:none;";
    card.appendChild(br);card.appendChild(bImport);
    var parsedData=null;
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Lecture de "+file.name+"...";
      previewDiv.style.display="none";bImport.style.display="none";parsedData=null;
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          parsedData=JSON.parse(ev.target.result);
          var prodCount=(parsedData.products||[]).length;
          var salesCount=(parsedData.sales||[]).length;
          var hasMeta=!!parsedData.meta&&Object.keys(parsedData.meta).length>0;
          previewDiv.style.display="block";
          previewDiv.innerHTML='<div style="background:#f5f5f5;border-radius:8px;padding:12px;font-size:13px;">'
            +'<div style="font-weight:700;margin-bottom:6px;">📊 Aperçu:</div>'
            +'<div>📦 '+prodCount+' produit(s)</div>'
            +'<div>💰 '+salesCount+' vente(s)</div>'
            +'<div>⚙️ Paramètres: '+(hasMeta?"Oui":"Non")+'</div>'
            +(parsedData.exportDate?'<div style="color:#888;font-size:11px;margin-top:4px;">Exporté le: '+new Date(parsedData.exportDate).toLocaleString("fr-FR")+'</div>':"")
            +(parsedData.source?'<div style="color:#888;font-size:11px;">Source: '+parsedData.source+'</div>':"")
            +'</div>';
          statusDiv.textContent="✅ Fichier valide! Cliquez sur Importer.";
          statusDiv.style.color="#2e7d32";
          bImport.style.display="block";
        }catch(ex){
          statusDiv.textContent="❌ Fichier invalide: "+ex.message;
          statusDiv.style.color="#c62828";
        }
      };
      reader.readAsText(file);
    };
    bImport.onclick=function(){
      if(!parsedData)return;
      bImport.disabled=true;bImport.style.opacity="0.5";
      statusDiv.textContent="⏳ Importation en cours...";

      // Converter: Flutter format → JS format
      if(parsedData.schemaVersion&&parsedData.format){
        var catMap={};
        (parsedData.categories||[]).forEach(function(c){
          var catName=(c.name||"divers").toLowerCase().replace(/[^a-z]/g,"");
          var mapped="autre";
          if(catName.indexOf("frais")>=0)mapped="frais";
          else if(catName.indexOf("sec")>=0)mapped="epicerie";
          else if(catName.indexOf("congel")>=0)mapped="surgele";
          else if(catName.indexOf("vin")>=0)mapped="vin";
          else if(catName.indexOf("alcool")>=0)mapped="alcool";
          else if(catName.indexOf("divers")>=0)mapped="autre";
          catMap[c.id]=mapped;
        });
        (parsedData.products||[]).forEach(function(p){
          if(!p.barcode&&p.barcode!==0)return;
          p.category=catMap[p.categoryId]||p.category||"autre";
          if(p.salePriceCents!==undefined)p.sale_price_cents=p.salePriceCents;
          if(p.purchasePriceCents!==undefined)p.purchase_price_cents=p.purchasePriceCents;
          if(p.stockQty!==undefined)p.stockQty=p.stockQty;
          if(p.lowStockThreshold!==undefined)p.low_stock_threshold=p.lowStockThreshold;
        });
      }

      var products=parsedData.products||[];
      var sales=parsedData.sales||[];
      var meta=parsedData.meta||{};
      var prodPromises=[];
      var prodCount=0;
      var salesCount=0;
      products.forEach(function(p){
        if(!p.barcode)return;
        prodPromises.push(_dbGet(p.barcode).then(function(existing){
          _dbPut({
            barcode:p.barcode,
            name:p.name||"Sans nom",
            sale_price_cents:p.sale_price_cents||0,
            category:p.category||"autre",
            stockQty:p.stockQty||0,
            pricePerUnit:p.pricePerUnit||null,
            unitType:p.unitType||null,
            source:p.source||"json-import",
            last_updated:p.last_updated||Date.now()
          });
          prodCount++;
        }));
      });
      Promise.all(prodPromises).then(function(){
        var salesPromises=[];
        return _openSalesDB().then(function(d){
          if(!d||sales.length===0)return;
          return new Promise(function(ok){
            var tx=d.transaction("sales","readwrite");
            var store=tx.objectStore("sales");
            sales.forEach(function(s){
              if(!s)return;
              store.put({
                ticketNumber:s.ticketNumber||0,
                timestamp:s.timestamp||Date.now(),
                isoTime:s.isoTime||new Date(s.timestamp||Date.now()).toISOString(),
                items:s.items||[],
                totalCents:s.totalCents||0,
                discountCents:s.discountCents||0,
                payments:s.payments||[],
                itemCount:s.itemCount||(s.items?s.items.length:0)
              });
              salesCount++;
            });
            tx.oncomplete=function(){ok();};tx.onerror=function(){ok();};
          });
        });
      }).then(function(){
        return _openMeta().then(function(d){
          if(!d)return;
          return new Promise(function(ok){
            var tx=d.transaction("meta","readwrite");
            var store=tx.objectStore("meta");
            Object.keys(meta).forEach(function(k){
              store.put({key:k,value:meta[k]});
            });
            tx.oncomplete=function(){ok();};tx.onerror=function(){ok();};
          });
        });
      }).then(function(){
        statusDiv.textContent="✅ Import terminé: "+prodCount+" produits, "+salesCount+" ventes importés!";
        statusDiv.style.color="#2e7d32";
        _refreshAndFilter();
        _loadTicketSeq();
        _loadSettings();
        _loadBcSeq();
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur import: "+err.message;
        statusDiv.style.color="#c62828";
        bImport.disabled=false;bImport.style.opacity="1";
      });
    };
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── RESET FROM MASTER JSON ───────────────────────────
  function _showResetFromJson(){
    var old=document.getElementById("acim-reset-json");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-reset-json";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#c62828;text-align:center;";
    ti.textContent="⚠️ Réinitialisation totale";card.appendChild(ti);
    var warning=document.createElement("div");
    warning.style.cssText="background:#fff3e0;border-left:4px solid #e65100;padding:12px;font-size:13px;color:#333;margin-bottom:16px;border-radius:4px;line-height:1.5;";
    warning.innerHTML='<strong>Cette opération va TOUT effacer :</strong><br>🗑️ Tous les produits<br>🗑️ Tout l\'historique des ventes<br>🗑️ Tous les paramètres (nom magasin, séquences)<br><br>Ensuite, vous importez un fichier JSON <strong>maître</strong> contenant uniquement vos vrais produits (bons EAN, prix, stocks, catégories).<br><br><span style="color:#e65100;">💡 Astuce : exportez d\'abord vos données actuelles via le menu si vous voulez les conserver.</span>';
    card.appendChild(warning);
    var step1=document.createElement("div");step1.style.cssText="margin-bottom:12px;";
    var bTemplate=document.createElement("button");bTemplate.textContent="📄 Télécharger un template JSON vierge";
    bTemplate.style.cssText="width:100%;padding:12px;border:2px solid #1565c0;border-radius:8px;background:#e3f2fd;color:#1565c0;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bTemplate.onclick=function(){
      var template={
        version:1,exportDate:new Date().toISOString(),source:"acim-caisse-template",
        products:[
          {barcode:"3017620422003",name:"Nutella 750g",sale_price_cents:499,category:"epicerie",stockQty:10,low_stock_threshold:3,source:"master",last_updated:Date.now()},
          {barcode:"3274080005003",name:"Cristaline 50cl",sale_price_cents:50,category:"boisson",stockQty:48,low_stock_threshold:12,source:"master",last_updated:Date.now()},
          {barcode:"ACIM-001",name:"Poulet fermier 1kg",sale_price_cents:1290,category:"volaille",stockQty:6,low_stock_threshold:2,source:"master",last_updated:Date.now()},
          {barcode:"ACIM-002",name:"Steak haché 250g",sale_price_cents:450,category:"viande",stockQty:20,low_stock_threshold:5,source:"master",last_updated:Date.now()}
        ],
        sales:[],meta:{}
      };
      _downloadJSON(template,"acimcaisse-template.json");
      _toast("✅ Template JSON téléchargé — éditez-le dans un tableur");
    };
    step1.appendChild(bTemplate);
    var descTemplate=document.createElement("div");descTemplate.style.cssText="font-size:11px;color:#888;margin-bottom:12px;text-align:center;";
    descTemplate.textContent="Ouvrez le fichier dans Excel/LibreOffice, modifiez les lignes, puis importez-le ci-dessous.";
    step1.appendChild(descTemplate);
    card.appendChild(step1);
    var fileLabel=document.createElement("div");fileLabel.style.cssText="font-size:14px;font-weight:700;margin-bottom:6px;color:#1a1a2e;";
    fileLabel.textContent="2. Sélectionnez votre fichier JSON maître :";
    card.appendChild(fileLabel);
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;box-sizing:border-box;";
    card.appendChild(fileInput);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bReset=document.createElement("button");bReset.textContent="⚠️ TOUT EFFACER & IMPORTER";
    bReset.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;display:none;";
    bReset.onclick=function(){
      bReset.disabled=true;bReset.style.opacity="0.5";
      statusDiv.textContent="⏳ Effacement de toutes les données...";
      _clearAllStores().then(function(){
        statusDiv.textContent="⏳ Importation des produits...";
        return _importMasterJson(parsedData);
      }).then(function(result){
        statusDiv.textContent="✅ Terminé! "+result.prods+" produits importés.";
        statusDiv.style.color="#2e7d32";
        _toast("✅ Réinitialisation terminée — "+result.prods+" produits chargés");
        setTimeout(function(){ov.remove();},1500);
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
        bReset.disabled=false;bReset.style.opacity="1";
      });
    };
    var parsedData=null;
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Lecture de "+file.name+"...";
      bReset.style.display="none";parsedData=null;
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          parsedData=JSON.parse(ev.target.result);
          var prods=(parsedData.products||[]);
          if(!Array.isArray(prods)||prods.length===0){statusDiv.textContent="❌ Le fichier ne contient aucun produit valide.";statusDiv.style.color="#c62828";return;}
          var valid=prods.filter(function(p){return p.barcode&&p.name;}).length;
          if(valid===0){statusDiv.textContent="❌ Aucun produit avec code-barres ET nom trouvé.";statusDiv.style.color="#c62828";return;}
          statusDiv.innerHTML="✅ Fichier valide: <strong>"+prods.length+"</strong> produit(s) trouvés (dont "+valid+" valides)<br>💰 "+(parsedData.sales||[]).length+" vente(s) dans le fichier (ignorées)";
          statusDiv.style.color="#2e7d32";
          bReset.style.display="block";
        }catch(ex){
          statusDiv.textContent="❌ Fichier invalide: "+ex.message;
          statusDiv.style.color="#c62828";
        }
      };
      reader.readAsText(file);
    };
    br.appendChild(bCancel);br.appendChild(bReset);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  function _clearAllStores(){
    return Promise.all([
      _dbDeleteAll(),
      _openSalesDB().then(function(d){if(!d)return;return new Promise(function(ok){var tx=d.transaction("sales","readwrite");tx.objectStore("sales").clear();tx.oncomplete=ok;tx.onerror=ok;});}),
      _openMeta().then(function(d){if(!d)return;return new Promise(function(ok){var tx=d.transaction("meta","readwrite");tx.objectStore("meta").clear();tx.oncomplete=ok;tx.onerror=ok;});})
    ]);
  }
  function _importMasterJson(data){
    var prods=data.products||[];
    var count=0;
    var chain=Promise.resolve();
    prods.forEach(function(p){
      if(!p.barcode||!p.name)return;
      chain=chain.then(function(){
        return _dbPut({
          barcode:p.barcode,
          name:p.name,
          sale_price_cents:p.sale_price_cents||0,
          category:p.category||"epicerie",
          stockQty:typeof p.stockQty==="number"?p.stockQty:0,
          low_stock_threshold:typeof p.low_stock_threshold==="number"?p.low_stock_threshold:5,
          source:"master",
          last_updated:Date.now()
        }).then(function(){count++;});
      });
    });
    return chain.then(function(){
      // Reset critical meta so startup chain re-runs properly
      return _openMeta().then(function(d){
        if(!d)return;
        return new Promise(function(ok){
          var tx=d.transaction("meta","readwrite");
          var s=tx.objectStore("meta");
          s.put({key:_BACKUP_IMPORTED_KEY,value:true});
          s.put({key:_YARDEN_IMPORTED_KEY,value:true});
          s.put({key:_INVOICE_MATCHED_KEY,value:true});
          s.put({key:_bcSeqKey,value:1000});
          s.put({key:_ticketSeqKey,value:1});
          s.put({key:_settingsKey,value:{storeName:"AcimCaisse",footer:"Merci de votre visite !"}});
          tx.oncomplete=function(){_log("Meta reset for master JSON");ok();};
          tx.onerror=function(){ok();};
        });
      }).then(function(){
        // Reload sequences and settings
        return Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]);
      }).then(function(){
        // Reload products in memory and re-render
        return _dbGetAll().then(function(all){
          _allProducts=all||[];
          _filterProducts();
          _renderCart();
          _broadcastCart();
        });
      }).then(function(){
        return{prods:count};
      });
    });
  }

  // ─── AUTO-CATEGORIZE DICTIONARY ─────────────────────
  var _CAT_RULES=[
    // VOLAILLE
    {kw:["poulet","poule","dinde","dinde","canard","oie","parmelet","paupiette","aiguillette","filet poulet","cuisse poulet","pilon","pilori","blanc poulet","magret","foie gras","chapon","coq"],cat:"volaille",name:null},
    // VIANDE
    {kw:["boeuf","bœuf","veau","agneau","porc","steak","côte","cotelette","entrecôte","bavette","hampe","paleron","rumsteck","rôti","roti","haché","hache","saucisse","saucisson","jambon","lard","poitrine","merguez","chipolata","andouillette","boudin","rosette","salami","viande"],cat:"viande",name:null},
    // LAITIER
    {kw:["lait","fromage","yaourt","yogurt","crème","beurre","emmental","gruyère","comté","reblochon","camembert","brie","roquefort","chèvre","mozzarella","ricotta","parmesan","mascarpone","morbier","raclette","tome","cheese"],cat:"laitier",name:null},
    // BOULANGERIE
    {kw:["pain","baguette","croissant","brioche","challah","pain maison","fougasse","focaccia","pizza","tarte","quiche","galette","crepe","crêpe","muffin","donut","beignet"],cat:"boulangerie",name:null},
    // EPICERIE
    {kw:["riz","pâtes","pates","lentilles","pois","haricots","huile","vinaigre","sel","poivre","sucre","farine","oeuf","œuf","conserve","sauce","soupe","bouillon","moutarde","ketchup","mayonnaise","nutella","confiture","miel","café","the","thé","cacao","céréales","biscuit","chips","chocolat","bonbon","bonbons"],cat:"epicerie",name:null},
    // BOISSON
    {kw:["eau","jus","soda","bière","biere","limonade","coca","sprite","perrier","san pellegrino","boisson","lait","café","the","thé","vin","champagne","cidre","rhum","whisky","vodka","gin","tonic"],cat:"boisson",name:null},
    // SURGELE
    {kw:["surgelé","surgelé","congelé","glace","pizza surgelé","légume surgelé","frites surgelé","poisson surgelé"],cat:"surgelé",name:null},
    // SNACK
    {kw:["chips","biscuit","gâteau","gateau","cookie","céréales","barre","snack","nooty","nutella","amande","noisette","cacahuète","fruits secs","muesli"],cat:"snack",name:null},
    // CONDIMENT
    {kw:["épice","epice","herbe","basilic","thym","romarin","curry","paprika","cumin","safran","cannelle","vanille"],cat:"condiment",name:null},
    // MENAGER
    {kw:["nettoyant","détergent","lessive","savon","shampooing","dentifrice","papier toilette","mouchoir","couche","hygiène","menager","éponge"],cat:"menager",name:null}
  ];

  function _guessCategory(name){
    var n=(name||"").toLowerCase();
    for(var i=0;i<_CAT_RULES.length;i++){
      var r=_CAT_RULES[i];
      for(var j=0;j<r.kw.length;j++){
        if(n.indexOf(r.kw[j])!==-1)return r.cat;
      }
    }
    return null;
  }

  // ─── FUZZY NAME MATCHING ─────────────────────────────
  function _normalizeText(s){
    return (s||"").toLowerCase()
      .replace(/[àâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[ïîì]/g,"i")
      .replace(/[ôöò]/g,"o").replace(/[ùûüú]/g,"u").replace(/[ÿ]/g,"y")
      .replace(/[ç]/g,"c").replace(/[^a-z0-9\s]/g,"")
      .replace(/\s+/g," ").trim();
  }

  function _fuzzyScore(a,b){
    var na=_normalizeText(a),nb=_normalizeText(b);
    if(!na||!nb)return 0;
    if(na===nb)return 100;
    // Containment check
    if(na.indexOf(nb)!==-1||nb.indexOf(na)!==-1)return 85;
    // Word overlap
    var wa=na.split(" "),wb=nb.split(" ");
    var matches=0;
    wa.forEach(function(w){if(w.length>2&&wb.indexOf(w)!==-1)matches++;});
    var score=matches/Math.max(wa.length,wb.length)*100;
    if(score>=60)return Math.round(score);
    // Levenshtein for short names
    if(na.length<20&&nb.length<20){
      var d=[];
      for(var i=0;i<=na.length;i++){d[i]=[i];for(var j=1;j<=nb.length;j++)d[i][j]=0;}
      for(var j=1;j<=nb.length;j++)d[0][j]=j;
      for(var i=1;i<=na.length;i++)for(var j=1;j<=nb.length;j++){
        var cost=na[i-1]===nb[j-1]?0:1;
        d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      }
      var maxLen=Math.max(na.length,nb.length);
      var lev=1-d[na.length][nb.length]/maxLen;
      if(lev>0.7)return Math.round(lev*100);
    }
    return score>0?Math.round(score):0;
  }

  function _findBestMatch(name,products,threshold){
    threshold=threshold||60;
    var best=null,bestScore=0;
    for(var i=0;i<products.length;i++){
      var sc=_fuzzyScore(name,products[i].name);
      if(sc>bestScore&&sc>=threshold){bestScore=sc;best=products[i];}
    }
    return best?{product:best,score:bestScore}:null;
  }

  // ─── UNDO LAST SALE ─────────────────────────────────
  // Sprint 4.1 PR B — atomic undo: stock restore + sale delete + audit events
  // all in ONE IDB transaction. The cursor + confirmation modal flow was split:
  // 1) Read last sale (read-only TX).
  // 2) Show confirmation modal (async UI, can take seconds).
  // 3) On confirm: open a fresh readwrite TX scoped on sale's id, restore stock,
  //    emit audit events, delete the sale — all atomic.
  // This avoids keeping a cursor alive across an async UI confirmation (which
  // IDB does not support reliably across browsers).
  function _undoLastSale(){
    _openUnifiedDB().then(function(db){
      if(!db){_toast("❌ Base inaccessible");return;}
      // Step 1: read-only snapshot of the last sale.
      var readTx=db.transaction("sales","readonly");
      var cursorReq=readTx.objectStore("sales").openCursor(null,"prev");
      cursorReq.onsuccess=function(e){
        var cursor=e.target.result;
        if(!cursor){_toast("❌ Aucune vente à annuler");return;}
        var sale=cursor.value; // snapshot — do not retain the cursor
        _showUndoConfirm(db, sale);
      };
      cursorReq.onerror=function(){ _toast("❌ Lecture ventes échouée"); };
    });
  }

  function _showUndoConfirm(db, sale){
    var old=document.getElementById("acim-undo");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-undo";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000004;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#c62828;text-align:center;";
    ti.textContent="↩️ Annuler cette vente ?";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:15px;color:#666;margin-bottom:12px;text-align:center;";
    var saleDate=sale.isoTime?new Date(sale.isoTime).toLocaleString("fr-FR"):(sale.timestamp?new Date(sale.timestamp).toLocaleString("fr-FR"):"?");
    info.innerHTML='<strong>Ticket n°'+esc(sale.ticketNumber||"?")+'</strong><br>'+esc(saleDate)+'<br>'+(sale.itemCount||0)+' article(s) — '+esc((sale.totalCents/100).toFixed(2).replace(".",","))+' €';
    card.appendChild(info);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Non, garder";
    bCancel.style.cssText="flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bUndo=document.createElement("button");bUndo.textContent="↩️ Oui, annuler";
    bUndo.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bUndo.onclick=function(){
      _executeUndoSaleAtomic(db, sale, function(ok){
        ov.remove();
        if(ok){
          _toast("↩️ Vente n°"+(sale.ticketNumber||"?")+" annulée");
          _refreshAndFilter();
        } else {
          _toast("❌ Annulation impossible");
        }
      });
    };
    br.appendChild(bCancel);br.appendChild(bUndo);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // Performs the actual undo in a single readwrite TX.
  // `sale` is a snapshot read previously; we re-fetch it inside the TX by id
  // to ensure consistency (the id is the autoIncrement key, captured in snapshot.saleId).
  function _executeUndoSaleAtomic(db, sale, done){
    var saleId=sale.id;
    if(saleId==null){done(false);return;}
    var tx;
    try{
      tx=db.transaction(["sales","products","audit_events"],"readwrite");
    }catch(e){done(false);return;}
    var sSales=tx.objectStore("sales");
    var sProd=tx.objectStore("products");
    // Re-fetch the sale within the TX.
    var getReq=sSales.get(saleId);
    getReq.onsuccess=function(){
      var fresh=getReq.result;
      if(!fresh){ try{tx.abort();}catch(_){} done(false); return; }
      var items=fresh.items||[];
      var idx=0;
      function restoreNext(){
        if(idx>=items.length){ emitSaleCancelled(); return; }
        var it=items[idx++];
        if(!it.barcode){ restoreNext(); return; }
        var amount=(it.unitType&&it.weight!=null&&it.pricePerUnit!=null)?it.weight:(it.qty||1);
        var r=sProd.get(it.barcode);
        r.onsuccess=function(){
          var p=r.result;
          if(!p){
            // Product disappeared from catalog — still allow undo, just skip restore
            // but DO emit a STOCK_INCREMENT event with null previousState to keep trace.
            try{
              window._acimAudit.logInTx(tx,{
                type:window._acimAudit.TYPE.STOCK_INCREMENT,
                entityType:"stock",
                entityId:it.barcode,
                action:"increment",
                payload:{barcode:it.barcode,amount:amount,reason:"undo",warning:"product-missing"},
                previousState:null,
                newState:null
              });
            }catch(e){ try{tx.abort();}catch(_){} done(false); return; }
            restoreNext();
            return;
          }
          var cur=(p.stockQty||0);
          var nextv=cur+amount;
          p.stockQty=nextv;
          p.last_updated=Date.now();
          sProd.put(p);
          try{
            window._acimAudit.logInTx(tx,{
              type:window._acimAudit.TYPE.STOCK_INCREMENT,
              entityType:"stock",
              entityId:it.barcode,
              action:"increment",
              payload:{barcode:it.barcode,amount:amount,reason:"undo"},
              previousState:{stockQty:cur},
              newState:{stockQty:nextv}
            });
          }catch(e){ try{tx.abort();}catch(_){} done(false); return; }
          restoreNext();
        };
        r.onerror=function(){ try{tx.abort();}catch(_){} done(false); };
      }
      function emitSaleCancelled(){
        try{
          window._acimAudit.logInTx(tx,{
            type:window._acimAudit.TYPE.SALE_CANCELLED,
            entityType:"sale",
            entityId:String(fresh.ticketNumber||saleId),
            action:"cancel",
            payload:{
              ticket:fresh.ticketNumber,
              itemCount:fresh.itemCount||items.length,
              totalCents:fresh.totalCents,
              reason:"undo"
            },
            previousState:null,
            newState:null
          });
        }catch(e){ try{tx.abort();}catch(_){} done(false); return; }
        // Delete the sale within the same TX.
        try{ sSales.delete(saleId); }catch(e){ try{tx.abort();}catch(_){} done(false); return; }
      }
      tx.oncomplete=function(){ done(true); };
      tx.onabort  =function(){ done(false); };
      tx.onerror =function(){ done(false); };
      restoreNext();
    };
    getReq.onerror=function(){ try{tx.abort();}catch(_){} done(false); };
  }

  // ─── SUPPLIER CATALOG ────────────────────────────────
  var _supplierCatalog=null;
  function _showSupplierCatalog(){
    var old=document.getElementById("acim-supcat");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-supcat";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:550px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="📒 Catalogue fournisseur";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:15px;color:#666;margin-bottom:12px;";
    desc.textContent="Chargez un fichier JSON du catalogue fournisseur pour rechercher par code-barres.";card.appendChild(desc);

    // File input
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);

    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:14px;color:#666;min-height:20px;margin-bottom:12px;";
    card.appendChild(statusDiv);

    // Search bar
    var searchRow=document.createElement("div");searchRow.style.cssText="display:none;margin-bottom:12px;";
    var searchIn=document.createElement("input");searchIn.type="text";searchIn.placeholder="🔍 Scanner ou taper un code-barres...";
    searchIn.style.cssText="width:100%;font-size:18px;font-weight:700;padding:12px;border:3px solid #e65100;border-radius:10px;outline:none;box-sizing:border-box;";
    searchRow.appendChild(searchIn);card.appendChild(searchRow);

    // Results
    var resultsDiv=document.createElement("div");resultsDiv.style.cssText="min-height:60px;";
    card.appendChild(resultsDiv);

    // Close
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);

    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // File load handler
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Chargement de "+file.name+"...";
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          var data=JSON.parse(ev.target.result);
          var products=data.products||data.items||data;
          if(!Array.isArray(products)){statusDiv.textContent="❌ Format JSON invalide (tableau attendu)";return;}
          // Normalize
          _supplierCatalog=products.map(function(p){
            return{
              barcode:p.barcode||p.code_barres||p.bc||"",
              name:p.name||p.nom||p.designation||"",
              purchase_price:p.purchase_price_cents||p.prix_achat||p.prixHT||0,
              sale_price:p.sale_price_cents||p.prix_vente||0,
              unit:p.unit||p.unite||"pc",
              category:p.category||p.categorie||""
            };
          }).filter(function(p){return p.barcode||p.name;});
          statusDiv.textContent="✅ "+_supplierCatalog.length+" produits chargés";
          searchRow.style.display="block";
          searchIn.focus();
          _openMeta().then(function(d){if(!d)return;var tx=d.transaction("meta","readwrite");tx.objectStore("meta").put({key:"supplier-catalog",value:_supplierCatalog});});
        }catch(ex){statusDiv.textContent="❌ Erreur JSON: "+ex.message;}
      };
      reader.readAsText(file);
    };

    // Search handler
    searchIn.addEventListener("input",function(){
      var q=(searchIn.value||"").trim().toLowerCase();
      if(q.length<2){resultsDiv.innerHTML="";return;}
      if(!_supplierCatalog){resultsDiv.innerHTML='<div style="color:#999;text-align:center;padding:10px;">Chargez d\'abord un catalogue</div>';return;}
      var matches=_supplierCatalog.filter(function(p){
        return(p.barcode&&p.barcode.toLowerCase().indexOf(q)!==-1)||(p.name&&p.name.toLowerCase().indexOf(q)!==-1);
      }).slice(0,10);

      resultsDiv.innerHTML="";
      if(matches.length===0){
        resultsDiv.innerHTML='<div style="text-align:center;padding:10px;color:#999;">Aucun résultat pour "'+q+'"</div>';
        return;
      }
      matches.forEach(function(p){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all .15s;";
        row.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
        row.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
        var nm=document.createElement("span");nm.textContent=p.name||"?";nm.style.cssText="flex:1;font-size:15px;font-weight:600;";
        var bc=document.createElement("span");bc.textContent=p.barcode||"no bc";bc.style.cssText="font-size:12px;color:#999;font-family:monospace;";
        var pr=document.createElement("span");
        var pp=p.purchase_price;
        if(pp>0){
          if(pp>100)pp=pp;
          else pp=Math.round(pp*100);
          pr.textContent="Achat: "+(pp/100).toFixed(2)+"€";
        }else{pr.textContent="";}
        pr.style.cssText="font-size:14px;color:#2e7d32;font-weight:700;white-space:nowrap;";
        row.appendChild(nm);row.appendChild(bc);row.appendChild(pr);
        // If barcode matches an existing product, show stock
        if(p.barcode){
          _dbGet(p.barcode).then(function(existing){
            if(existing){
              var st=document.createElement("span");
              st.textContent="Stock: "+(existing.stockQty||0);
              st.style.cssText="font-size:13px;color:"+(existing.stockQty<=5?"#c62828":"#666")+";font-weight:700;";
              row.appendChild(st);
            }else{
              var newBtn=document.createElement("button");newBtn.textContent="➕ Ajouter";
              newBtn.style.cssText="padding:4px 8px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-size:13px;cursor:pointer;font-weight:600;color:#e65100;white-space:nowrap;";
              newBtn.onclick=function(e){
                e.stopPropagation();
                var cat=_guessCategory(p.name)||"epicerie";
                _dbPut({
                  barcode:p.barcode,name:p.name,
                  sale_price_cents:p.sale_price>100?p.sale_price:Math.round((p.sale_price||0)*100),
                  purchase_price_cents:p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100),
                  category:cat,stockQty:0,low_stock_threshold:5,
                  source:"supplier-catalog",last_updated:Date.now()
                }).then(function(){
                  newBtn.textContent="✅ Ajouté";newBtn.disabled=true;newBtn.style.opacity="0.5";
                  _toast("➕ "+p.name+" ajouté au catalogue");
                  _refreshAndFilter();
                });
              };
              row.appendChild(newBtn);
            }
          });
        }
        resultsDiv.appendChild(row);
      });
    });
  }

  // ─── DAY REPORT ──────────────────────────────────────
  function _showDayReport(){
    var old=document.getElementById("acim-dayreport");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-dayreport";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:450px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;text-align:center;";
    ti.textContent="📊 Rapport du jour";card.appendChild(ti);
    var today=new Date().toLocaleDateString("fr-FR");
    var sub=document.createElement("div");sub.style.cssText="font-size:16px;color:#666;margin-bottom:16px;text-align:center;";
    sub.textContent=today;card.appendChild(sub);

    var content=document.createElement("div");content.style.cssText="min-height:80px;";
    content.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Chargement...</div>';
    card.appendChild(content);

    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // Load today's sales
    _openSalesDB().then(function(d){
      if(!d){content.innerHTML='<div style="text-align:center;color:#c62828;">❌ Base de ventes inaccessible</div>';return;}
      return new Promise(function(ok){
        var r=d.transaction("sales","readonly").objectStore("sales").getAll();
        r.onsuccess=function(){ok(r.result||[]);};
        r.onerror=function(){ok([]);};
      });
    }).then(function(sales){
      if(!sales){content.innerHTML='<div style="text-align:center;color:#c62828;">Aucune donnée</div>';return;}
      // Filter today's sales
      var todayStr=new Date().toISOString().slice(0,10);
      var todaySales=sales.filter(function(s){
        var iso=s.isoTime||"";if(!iso&&s.timestamp)iso=new Date(s.timestamp).toISOString();
        if(!iso)return false;
        return iso.slice(0,10)===todayStr;
      });

      if(todaySales.length===0){
        content.innerHTML='<div style="text-align:center;padding:20px;color:#999;font-size:16px;">Aucune vente aujourd\'hui</div>';
        return;
      }

      // Calculate totals
      var totalAll=0,totalCash=0,totalCb=0,totalMixte=0,totalDiscount=0;
      var totalItems=0;
      var salesCount=todaySales.length;
      var paymentCounts={especes:0,cb:0,mixte:0};

      todaySales.forEach(function(s){
        totalAll+=(s.totalCents||0);
        totalDiscount+=(s.discountCents||0);
        totalItems+=(s.itemCount||0);
        if(s.payments){
          s.payments.forEach(function(p){
            if(p.method==="especes"){totalCash+=(p.amountCents||p.amount||0);paymentCounts.especes++;}
            else if(p.method==="cb"){totalCb+=(p.amountCents||p.amount||0);paymentCounts.cb++;}
            else{totalMixte+=(p.amountCents||p.amount||0);paymentCounts.mixte++;}
          });
        }else{
          totalCash+=(s.totalCents||0);
          paymentCounts.especes++;
        }
      });

      // Top products
      var productCount={};
      todaySales.forEach(function(s){
        if(s.items){
          s.items.forEach(function(item){
            var n=item.name||"?";
            if(!productCount[n])productCount[n]={name:n,qty:0,total:0};
            productCount[n].qty+=(item.qty||1);
            productCount[n].total+=((item.priceCents||item.price||0))*(item.qty||1);
          });
        }
      });
      var topProducts=Object.keys(productCount).map(function(k){return productCount[k];});
      topProducts.sort(function(a,b){return b.total-a.total;});
      topProducts=topProducts.slice(0,5);

      // Render
      var h='';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
      h+='<div style="background:#e8f5e9;padding:14px;border-radius:10px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#2e7d32;">'+(totalAll/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:13px;color:#666;">Total ventes</div></div>';
      h+='<div style="background:#e3f2fd;padding:14px;border-radius:10px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#1565c0;">'+salesCount+'</div><div style="font-size:13px;color:#666;">Transactions</div></div>';
      h+='</div>';

      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">';
      h+='<div style="background:#fff3e0;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#e65100;">'+(totalCash/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:12px;color:#666;">💵 Espèces ('+paymentCounts.especes+')</div></div>';
      h+='<div style="background:#f3e5f5;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#7b1fa2;">'+(totalCb/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:12px;color:#666;">💳 CB ('+paymentCounts.cb+')</div></div>';
      h+='<div style="background:#e0f7fa;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#00838f;">'+totalItems+'</div><div style="font-size:12px;color:#666;">📦 Articles</div></div>';
      h+='</div>';

      if(totalDiscount>0){
        h+='<div style="padding:8px 12px;background:#fce4ec;border-radius:8px;margin-bottom:12px;font-size:14px;color:#c62828;text-align:center;"> remises accordées : -'+(totalDiscount/100).toFixed(2).replace(".",",")+' €</div>';
      }

      if(topProducts.length>0){
        h+='<div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a2e;">🏆 Top produits</div>';
        topProducts.forEach(function(p,i){
          h+='<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:4px;">';
          h+='<span style="font-size:16px;">'+(i===0?"🥇":i===1?"🥈":i===2?"🥉":"  ")+'</span>';
          h+='<span style="flex:1;font-size:14px;font-weight:600;">'+p.name+'</span>';
          h+='<span style="font-size:13px;color:#666;">x'+p.qty+'</span>';
          h+='<span style="font-size:14px;font-weight:700;color:#e65100;">'+(p.total/100).toFixed(2).replace(".",",")+' €</span>';
          h+='</div>';
        });
      }

      content.innerHTML=h;
    });
  }

  // ─── PRODUCT AUDIT ──────────────────────────────────
  function _showProductAudit(){
    var old=document.getElementById("acim-audit");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-audit";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:600px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="🔍 Vérification du catalogue";card.appendChild(ti);
    var sub=document.createElement("div");sub.style.cssText="font-size:15px;color:#666;margin-bottom:16px;";
    sub.textContent="Analyse de vos produits — doublons, erreurs, suggestions";card.appendChild(sub);

    var listDiv=document.createElement("div");listDiv.id="acim-audit-list";
    listDiv.style.cssText="min-height:60px;";listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Analyse en cours...</div>';
    card.appendChild(listDiv);

    var btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;";
    var bAutoFix=document.createElement("button");bAutoFix.textContent="🤖 Auto-corriger tout";
    bAutoFix.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bAutoFix.onclick=function(){_auditAutoFix(listDiv,bAutoFix);};
    var bAutoMerge=document.createElement("button");bAutoMerge.textContent="🔗 Auto-fusionner doublons";
    bAutoMerge.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#6a1b9a;color:#fff;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bAutoMerge.onclick=function(){_auditAutoMerge(listDiv,bAutoMerge);};
    var bSetPrices=document.createElement("button");bSetPrices.textContent="💰 Fixer tous les prix";
    bSetPrices.style.cssText="flex:1;padding:12px;border:2px solid #2e7d32;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bSetPrices.onclick=function(){_auditBulkSetPrice();};
    var bMatchInvoice=document.createElement("button");bMatchInvoice.textContent="🔗 Lier produits facture → catalogue";
    bMatchInvoice.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#00695c;color:#fff;font-size:15px;cursor:pointer;font-weight:700;min-width:160px;";
    bMatchInvoice.onclick=function(){_auditMatchInvoiceProducts(listDiv,bMatchInvoice);};
    var bFixNames=document.createElement("button");bFixNames.textContent="🏷️ Fixer tous les noms";
    bFixNames.style.cssText="flex:1;padding:12px;border:2px solid #e65100;border-radius:8px;background:#fff3e0;color:#e65100;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bFixNames.onclick=function(){_auditBulkFixNames(listDiv,bFixNames);};
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:0 0 100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:4px;";
    bClose.onclick=function(){ov.remove();};
    btnRow.appendChild(bAutoFix);btnRow.appendChild(bAutoMerge);btnRow.appendChild(bMatchInvoice);btnRow.appendChild(bSetPrices);btnRow.appendChild(bFixNames);btnRow.appendChild(bClose);card.appendChild(btnRow);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // Run audit async
    setTimeout(function(){_runAudit(listDiv);},100);
  }

  function _runAudit(container){
    _dbGetAll().then(function(products){
      var issues=[];

      // 1. Check duplicates (same name or same barcode)
      var byName={};var byBc={};
      products.forEach(function(p){
        var n=(p.name||"").toLowerCase().trim();
        var b=(p.barcode||"").trim();
        if(n){if(!byName[n])byName[n]=[];byName[n].push(p);}
        if(b){if(!byBc[b])byBc[b]=[];byBc[b].push(p);}
      });
      Object.keys(byName).forEach(function(n){
        if(byName[n].length>1){
          issues.push({type:"duplicate-name",label:'Doublon nom: "'+byName[n][0].name+'"',items:byName[n],icon:"👥"});
        }
      });
      Object.keys(byBc).forEach(function(b){
        if(byBc[b].length>1){
          issues.push({type:"duplicate-bc",label:'Doublon code-barres: '+b,items:byBc[b],icon:"👥"});
        }
      });

      // 2. No price
      products.forEach(function(p){
        if(!p.sale_price_cents||p.sale_price_cents<=0){
          issues.push({type:"no-price",label:'Sans prix: '+(p.name||p.barcode),items:[p],icon:"💰"});
        }
      });

      // 3. Wrong category (can be guessed)
      products.forEach(function(p){
        var guessed=_guessCategory(p.name);
        if(guessed&&p.category!==guessed){
          issues.push({type:"wrong-cat",label:'Mauvaise catégorie: "'+p.name+'" → '+_catIcon(guessed)+' '+guessed,items:[p],icon:"📂",suggestedCat:guessed});
        }
      });

      // 4. No category
      products.forEach(function(p){
        if(!p.category||p.category==="autre"){
          var guessed=_guessCategory(p.name);
          if(guessed){
            issues.push({type:"no-cat",label:'Catégorie suggérée: "'+p.name+'" → '+_catIcon(guessed)+' '+guessed,items:[p],icon:"📂",suggestedCat:guessed});
          }
        }
      });

      // 5. Weird names (too short, just numbers, etc.)
      products.forEach(function(p){
        var n=(p.name||"").trim();
        if(n.length<2){issues.push({type:"bad-name",label:'Nom invalide: "'+n+'" ('+p.barcode+')',items:[p],icon:"⚠️"});}
        if(/^\d+$/.test(n)){issues.push({type:"bad-name",label:'Nom numérique: "'+n+'" ('+p.barcode+')',items:[p],icon:"⚠️"});}
      });

      // 6. Zero stock with sales history? (potential issue)
      // Skip for now

      // Render
      container.innerHTML="";
      if(issues.length===0){
        container.innerHTML='<div style="text-align:center;padding:30px;color:#2e7d32;font-size:18px;">✅ Aucun problème détecté !<br><span style="font-size:14px;color:#666;">'+products.length+' produits analysés</span></div>';
        return;
      }

      var summary=document.createElement("div");
      summary.style.cssText="padding:10px;background:#fff3e0;border-radius:8px;margin-bottom:12px;font-size:15px;color:#e65100;";
      summary.textContent="⚠️ "+issues.length+" anomalie(s) trouvée(s) sur "+products.length+" produits";
      container.appendChild(summary);

      issues.forEach(function(issue,idx){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;";
        var icon=document.createElement("span");icon.textContent=issue.icon;
        icon.style.cssText="font-size:20px;flex-shrink:0;";
        var label=document.createElement("span");label.textContent=issue.label;
        label.style.cssText="flex:1;font-size:15px;color:#1a1a2e;";
        row.appendChild(icon);row.appendChild(label);

        if(issue.type==="wrong-cat"||issue.type==="no-cat"){
          var fixBtn=document.createElement("button");fixBtn.textContent="→ "+_catIcon(issue.suggestedCat)+" "+issue.suggestedCat;
          fixBtn.style.cssText="padding:6px 12px;border:2px solid #1565c0;border-radius:6px;background:#e3f2fd;font-size:14px;cursor:pointer;font-weight:600;color:#1565c0;white-space:nowrap;";
          fixBtn.onclick=function(){
            var p=issue.items[0];
            p.category=issue.suggestedCat;
            _dbPut(p).then(function(){
              row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
              fixBtn.textContent="✅ Fait";fixBtn.disabled=true;fixBtn.style.opacity="0.5";
              _toast("📂 "+p.name+" → "+issue.suggestedCat);
            });
          };
          row.appendChild(fixBtn);
        }

        if(issue.type==="duplicate-name"||issue.type==="duplicate-bc"){
          var mergeBtn=document.createElement("button");mergeBtn.textContent="🔄 Fusionner";
          mergeBtn.style.cssText="padding:6px 12px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-size:14px;cursor:pointer;font-weight:600;color:#e65100;white-space:nowrap;";
          mergeBtn.onclick=function(){
            _auditMergeDialog(issue.items);row.style.background="#e8f5e9";
            mergeBtn.textContent="✅";mergeBtn.disabled=true;mergeBtn.style.opacity="0.5";
          };
          row.appendChild(mergeBtn);

          var delBtn=document.createElement("button");delBtn.textContent="🗑️";
          delBtn.style.cssText="padding:6px 8px;border:2px solid #c62828;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;color:#c62828;";
          delBtn.onclick=function(){
            if(issue.items.length>1){
              _auditDeleteDuplicates(issue.items,row,delBtn);
            }
          };
          row.appendChild(delBtn);
        }

        if(issue.type==="no-price"){
          var editBtn=document.createElement("button");editBtn.textContent="✏️ Prix";
          editBtn.style.cssText="padding:6px 12px;border:2px solid #2e7d32;border-radius:6px;background:#e8f5e9;font-size:14px;cursor:pointer;font-weight:600;color:#2e7d32;white-space:nowrap;";
          editBtn.onclick=function(){
            _auditSetPrice(issue.items[0],row,editBtn);
          };
          row.appendChild(editBtn);
        }

        if(issue.type==="bad-name"){
          var delBtn2=document.createElement("button");delBtn2.textContent="🗑️ Supprimer";
          delBtn2.style.cssText="padding:6px 12px;border:2px solid #c62828;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;color:#c62828;font-weight:600;";
          delBtn2.onclick=function(){
            _dbDelete(issue.items[0].barcode).then(function(){
              row.style.background="#ffebee";row.style.borderColor="#c62828";
              delBtn2.textContent="✅ Supprimé";delBtn2.disabled=true;delBtn2.style.opacity="0.5";
              _toast("🗑️ Produit supprimé");
            });
          };
          row.appendChild(delBtn2);
        }

        container.appendChild(row);
      });
    });
  }

  function _auditAutoMerge(container,btn){
    btn.textContent="⏳ Fusion...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var byName={},byBc={};
      products.forEach(function(p){
        var n=(p.name||"").toLowerCase().trim();
        var b=(p.barcode||"").trim();
        if(n){if(!byName[n])byName[n]=[];byName[n].push(p);}
        if(b){if(!byBc[b])byBc[b]=[];byBc[b].push(p);}
      });
      var toDelete=[];
      // Merge duplicate names: keep the best one
      Object.keys(byName).forEach(function(n){
        var group=byName[n];
        if(group.length<2)return;
        var best=_pickBest(group);
        group.forEach(function(p){
          if(p.barcode!==best.barcode)toDelete.push(p);
        });
      });
      // Merge duplicate barcodes: keep the best one
      Object.keys(byBc).forEach(function(b){
        var group=byBc[b];
        if(group.length<2)return;
        var best=_pickBest(group);
        group.forEach(function(p){
          if(p.barcode!==best.barcode)toDelete.push(p);
        });
      });
      // Deduplicate delete list
      var seen={};
      toDelete=toDelete.filter(function(p){
        var k=p.barcode||"";
        if(seen[k])return false;
        seen[k]=true;return true;
      });
      // Delete all at once
      var chain=Promise.resolve();
      toDelete.forEach(function(p){
        chain=chain.then(function(){
          return _dbDelete(p.barcode);
        });
      });
      chain.then(function(){
        _toast("🔗 "+toDelete.length+" doublon(s) supprimé(s)");
        btn.textContent="🔗 Auto-fusionner doublons";btn.disabled=false;btn.style.opacity="1";
        _runAudit(container);
      });
    });
  }
  function _pickBest(group){
    var best=group[0];
    for(var i=1;i<group.length;i++){
      var p=group[i];
      var bestScore=(best.sale_price_cents||0)+(best.stockQty||0)*0.1;
      var pScore=(p.sale_price_cents||0)+(p.stockQty||0)*0.1;
      if(p.barcode&&!best.barcode){best=p;continue;}
      if(pScore>bestScore)best=p;
    }
    return best;
  }

  function _auditMergeDialog(products){
    var ov=document.createElement("div");ov.id="acim-merge";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000004;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:400px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="🔄 Fusionner les doublons";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:15px;color:#666;margin-bottom:12px;";
    info.textContent=products.length+" produits avec le même nom. Choisissez lequel garder :";
    card.appendChild(info);

    products.forEach(function(p){
      var row=document.createElement("div");
      row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all .15s;";
      row.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
      row.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
      var ic=document.createElement("span");ic.textContent=_catIcon(p.category);ic.style.cssText="font-size:20px;";
      var nm=document.createElement("span");nm.textContent=p.name||"?";nm.style.cssText="flex:1;font-size:15px;font-weight:600;";
      var pr=document.createElement("span");pr.textContent=(p.sale_price_cents/100).toFixed(2)+"€";
      pr.style.cssText="font-size:15px;color:#e65100;font-weight:700;";
      var bc=document.createElement("span");bc.textContent=p.barcode||"no bc";bc.style.cssText="font-size:12px;color:#999;";
      row.appendChild(ic);row.appendChild(nm);row.appendChild(pr);row.appendChild(bc);
      row.onclick=function(){
        // Keep this one, delete the rest
        var others=products.filter(function(x){return x.barcode!==p.barcode;});
        var chain=Promise.resolve();
        others.forEach(function(x){chain=chain.then(function(){return _dbDelete(x.barcode);});});
        chain.then(function(){
          ov.remove();
          _toast("✅ Gardé: "+p.name+" ("+others.length+" supprimé(s))");
          _showProductAudit();
        });
      };
      card.appendChild(row);
    });

    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;margin-top:8px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _auditDeleteDuplicates(products,row,btn){
    // Keep first, delete rest
    var keep=products[0];
    var toDelete=products.slice(1);
    var chain=Promise.resolve();
    toDelete.forEach(function(p){chain=chain.then(function(){return _dbDelete(p.barcode);});});
    chain.then(function(){
      row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
      btn.textContent="✅ "+toDelete.length+" supprimé(s)";btn.disabled=true;btn.style.opacity="0.5";
      _toast("🗑️ "+toDelete.length+" doublon(s) supprimé(s), gardé: "+keep.name);
    });
  }

  function _auditSetPrice(product,row,btn){
    var price=prompt('Prix pour "'+product.name+'" (en €, ex: 5.50):');
    if(price===null)return;
    var cents=Math.round(parseFloat(price)*100);
    if(isNaN(cents)||cents<=0){_toast("❌ Prix invalide");return;}
    product.sale_price_cents=cents;
    _dbPut(product).then(function(){
      row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
      btn.textContent="✅ "+(cents/100).toFixed(2)+"€";btn.disabled=true;btn.style.opacity="0.5";
      _toast("💰 Prix mis à jour: "+product.name+" → "+(cents/100).toFixed(2)+"€");
    });
  }

  function _auditAutoFix(container,btn){
    btn.textContent="⏳ Correction en cours...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var fixed=0;
      var chain=Promise.resolve();
      products.forEach(function(p){
        chain=chain.then(function(){
          var changed=false;
          // Auto-fix wrong category
          if(!p.category||p.category==="autre"){
            var guessed=_guessCategory(p.name);
            if(guessed){p.category=guessed;changed=true;}
          }
          // Also fix if category doesn't match anymore
          var guessed2=_guessCategory(p.name);
          if(guessed2&&p.category!==guessed2){
            // Only override "autre", don't force if user chose something specific
            if(p.category==="autre"||!p.category){p.category=guessed2;changed=true;}
          }
          // Fix bad names (too short or numeric only)
          var n=(p.name||"").trim();
          if(n.length<2||/^\d+$/.test(n)){
            p.name=p.barcode||"Produit "+Date.now();
            changed=true;
          }
          if(changed){fixed++;return _dbPut(p);}
        });
      });
      chain.then(function(){
        _toast("🤖 "+fixed+" produit(s) auto-corrigé(s)");
        _runAudit(container);
        btn.textContent="🤖 Auto-corriger tout";btn.disabled=false;btn.style.opacity="1";
      });
    });
  }

  function _auditBulkSetPrice(){
    var price=prompt("Prix par défaut pour tous les produits sans prix (en €, ex: 5.00):");
    if(price===null)return;
    var cents=Math.round(parseFloat(price)*100);
    if(isNaN(cents)||cents<=0){_toast("❌ Prix invalide");return;}
    _dbGetAll().then(function(products){
      var fixed=0,chain=Promise.resolve();
      products.forEach(function(p){
        if(!p.sale_price_cents||p.sale_price_cents<=0){
          chain=chain.then(function(){
            p.sale_price_cents=cents;p.last_updated=Date.now();
            return _dbPut(p).then(function(){fixed++;});
          });
        }
      });
      chain.then(function(){
        _toast("💰 "+fixed+" produit(s) mis à "+(cents/100).toFixed(2)+"€");
        var auditList=document.getElementById("acim-audit-list");
        if(auditList)_runAudit(auditList);
      });
    });
  }
  function _auditBulkFixNames(container,btn){
    btn.textContent="⏳ Correction...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var fixed=0,chain=Promise.resolve();
      products.forEach(function(p){
        var n=(p.name||"").trim();
        var bad=n.length<2||/^\d+$/.test(n);
        if(bad){
          chain=chain.then(function(){
            p.name=p.barcode||"Produit "+Date.now();
            p.last_updated=Date.now();
            return _dbPut(p).then(function(){fixed++;});
          });
        }
      });
      chain.then(function(){
        _toast("🏷️ "+fixed+" nom(s) corrigé(s)");
        btn.textContent="🏷️ Fixer tous les noms";btn.disabled=false;btn.style.opacity="1";
        _runAudit(container);
      });
    });
  }

  // ─── MATCH INVOICE PRODUCTS TO YARDEN ────────────────
  function _cleanInvoiceName(name){
    var n=(name||"").trim();
    // Remove encoding artifacts
    n=n.replace(/[�ǸǮǼǽǾǵ]/g,"");
    // Remove garbage suffixes from BKR/OFF/VIA format: ", , % € V00", ", , € V01"
    n=n.replace(/, ,\s*%\s*[€']\s*V\d{2}/g,"");
    n=n.replace(/, ,\s*[€']\s*V\d{2}/g,"");
    // Remove unit prefixes like "Kilogram "
    n=n.replace(/\b(Kilogram|Litres?|Portions?|Pièces?)\s+/gi,"");
    // Remove trailing units and prices: "G '€", "grs '€", "g '€", "ml '€", "kg '€"
    n=n.replace(/(?:\s+(?:g(?:rs?)?|ml|kg|L)\s*['€]+\s*['€]*)\s*$/,"");
    n=n.replace(/\s*['][€]\s*$/,"");
    n=n.replace(/\s*['][€]['][€]\s*$/,"");
    // Remove status flags
    n=n.replace(/\s*(?:PRIX\s+NET|PROMO|RUPTURE|BAISSE|PRIX\s+EN)\s*/gi,"");
    // Remove date suffixes (months)
    n=n.replace(/\s+(?:Janvier|Février|Mars|Avril|Mai|Juin|Juil(?:let)?|Août|Sept(?:embre)?|Oct(?:obre)?|Nov(?:embre)?|Déc(?:embre)?)\s*/gi,"");
    // Remove "R" prefix (product code prefix used by supplier)
    n=n.replace(/^R(?=[A-Z])/,"");
    // Remove leading codes like "BKR/S018 ", "OFF001 ", "VIA200 ", "TOMA/A/S "
    n=n.replace(/^[A-Z0-9]{2,}\/[A-Z0-9]+\s+/,"");
    n=n.replace(/^[A-Z]{2,}\d+\s+/,"");
    // Collapse multiple spaces
    n=n.replace(/\s+/g," ").trim();
    return n;
  }

  function _isGarbageName(name){
    var n=(name||"").trim().toLowerCase();
    // All numeric
    if(/^\d+$/.test(n))return true;
    // IBAN / bank
    if(/^fr\d{2}/i.test(n))return true;
    if(/iban|bic|siret|tva/i.test(n))return true;
    // Legal clauses
    if(n.indexOf("marchandises faisant l'objet")>=0)return true;
    if(n.indexOf("société au capital")>=0)return true;
    // Invoice references
    if(/^fas\d{6}/i.test(n))return true;
    if(/^n[°]?\s*bc\s*\/\s*date/i.test(n))return true;
    if(/^bc\d{4,}/i.test(n))return true;
    // Shipping/port fees
    if(/^z?port\s+.*frais/i.test(n))return true;
    // Pure garbage codes
    if(/^v\d{2}\s*['€%]\s*['€%]\s*$/.test(n))return true;
    // Tariff change headers
    if(/changement de tarif|nouveau tarif|applicable au/i.test(n))return true;
    // Company info lines
    if(/royal wine europe/i.test(n))return true;
    // Invoices numbers only
    if(/^\d{6,10}$/.test(n)&&parseInt(n)>100000)return true;
    // Partial dates
    if(/^au\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*$/i.test(n))return true;
    return false;
  }

  function _auditMatchInvoiceProducts(container,btn){
    btn.textContent="⏳ Analyse...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var invProducts=products.filter(function(p){return p.source==="invoice-import";});
      var yardenProducts=products.filter(function(p){return p.source==="yarden-catalog"||!p.source;});
      var matched=0,garbage=0,unmatched=0,transferred=0;
      var report=[];
      var chain=Promise.resolve();

      invProducts.forEach(function(p){
        chain=chain.then(function(){
          // Delete garbage entries
          if(_isGarbageName(p.name)){
            garbage++;
            report.push({action:"🗑️ Supprimé (garbage): "+p.name+" ("+p.barcode+")"});
            return _dbDelete(p.barcode);
          }
          // Clean name and try fuzzy match
          var cleanName=_cleanInvoiceName(p.name);
          if(!cleanName||cleanName.length<2){
            garbage++;
            report.push({action:"🗑️ Supprimé (nom vide): "+p.name+" ("+p.barcode+")"});
            return _dbDelete(p.barcode);
          }
          var best=null,bestScore=0;
          for(var yi=0;yi<yardenProducts.length;yi++){
            var sc=_fuzzyScore(cleanName,yardenProducts[yi].name);
            if(sc>bestScore&&sc>=60){bestScore=sc;best=yardenProducts[yi];}
          }
          if(best){
            var changed=false;
            // Transfer stock
            if(p.stockQty>0&&(!best.stockQty||best.stockQty===0)){best.stockQty=p.stockQty;changed=true;}
            // Transfer price (keep max)
            if(p.sale_price_cents>0&&(!best.sale_price_cents||best.sale_price_cents===0)){best.sale_price_cents=p.sale_price_cents;changed=true;}
            else if(p.sale_price_cents>0&&best.sale_price_cents>0&&p.sale_price_cents!==best.sale_price_cents){
              best.sale_price_cents=Math.max(p.sale_price_cents,best.sale_price_cents);changed=true;
            }
            if(changed){
              best.last_updated=Date.now();
              return _dbPut(best).then(function(){
                return _dbDelete(p.barcode).then(function(){
                  matched++;transferred++;
                  report.push({action:"✅ "+best.name+" ← stock="+p.stockQty+" prix="+(p.sale_price_cents/100).toFixed(2)+"€ (score:"+bestScore+"%)"});
                });
              });
            }else{
              return _dbDelete(p.barcode).then(function(){
                matched++;
                report.push({action:"✅ "+best.name+" (déjà à jour, doublon supprimé)"});
              });
            }
          }else{
            unmatched++;
            report.push({action:"❌ Non matché: "+p.name+" → net: "+cleanName+" ("+p.barcode+")"});
          }
        });
      });

      chain.then(function(){
        var msg="✅ "+matched+" matché(s) dont "+transferred+" transfert(s), "+garbage+" garbage supprimé(s), "+unmatched+" non matché(s)";
        _toast(msg);
        container.innerHTML="<div style='padding:10px;background:#e8f5e9;border-radius:8px;margin-bottom:12px;font-size:15px;color:#2e7d32;font-weight:700;'>"+msg+"</div>";
        var list=document.createElement("div");
        list.style.cssText="max-height:250px;overflow-y:auto;font-size:13px;";
        report.forEach(function(r){
          var row=document.createElement("div");row.style.cssText="padding:3px 6px;border-bottom:1px solid #f0f0f0;";
          row.textContent=r.action;list.appendChild(row);
        });
        container.appendChild(list);
        btn.textContent="🔗 Lier produits facture → catalogue";btn.disabled=false;btn.style.opacity="1";
      });
    });
  }

  // ─── TOAST ────────────────────────────────────────────
  function _toast(msg){
    if(!msg)return;var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";t.textContent=msg;
    t.style.cssText="position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},2500);
  }

  // ─── AUTO-MATCH INVOICE PRODUCTS ON STARTUP ────────
  var _INVOICE_MATCHED_KEY="acim-invoice-matched-v1";
  function _autoMatchInvoiceProducts(){
    _log("Checking invoice products...");
    return _openMeta().then(function(d){
      if(!d)return 0;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_INVOICE_MATCHED_KEY);
        r.onsuccess=function(){
          if(r.result&&r.result.value){ok(0);return;}
          // Run the matching silently
          _dbGetAll().then(function(products){
            var invProducts=products.filter(function(p){return p.source==="invoice-import";});
            var yardenProducts=products.filter(function(p){return p.source==="yarden-catalog"||!p.source;});
            if(invProducts.length===0){ok(0);return;}
            var matched=0,garbage=0,unmatched=0;
            var chain=Promise.resolve();
            invProducts.forEach(function(p){
              chain=chain.then(function(){
                if(_isGarbageName(p.name)){garbage++;return _dbDelete(p.barcode);}
                var cleanName=_cleanInvoiceName(p.name);
                if(!cleanName||cleanName.length<2){garbage++;return _dbDelete(p.barcode);}
                var best=null,bestScore=0;
                for(var yi=0;yi<yardenProducts.length;yi++){
                  var sc=_fuzzyScore(cleanName,yardenProducts[yi].name);
                  if(sc>bestScore&&sc>=60){bestScore=sc;best=yardenProducts[yi];}
                }
                if(best){
                  var changed=false;
                  if(p.stockQty>0&&(!best.stockQty||best.stockQty===0)){best.stockQty=p.stockQty;changed=true;}
                  if(p.sale_price_cents>0&&(!best.sale_price_cents||best.sale_price_cents===0)){best.sale_price_cents=p.sale_price_cents;changed=true;}
                  else if(p.sale_price_cents>0&&best.sale_price_cents>0&&p.sale_price_cents!==best.sale_price_cents){
                    best.sale_price_cents=Math.max(p.sale_price_cents,best.sale_price_cents);changed=true;
                  }
                  if(changed){best.last_updated=Date.now();return _dbPut(best).then(function(){return _dbDelete(p.barcode).then(function(){matched++;});});}
                  else {return _dbDelete(p.barcode).then(function(){matched++;});}
                }else{unmatched++;}
              });
            });
            chain.then(function(){
              _log("Auto-match: "+matched+" matché(s), "+garbage+" garbage, "+unmatched+" non matché(s)");
              // Mark as done
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:_INVOICE_MATCHED_KEY,value:true});
              ok(matched+garbage);
            });
          });
        };
        r.onerror=function(){ok(0);};
      });
    }).catch(function(){return 0;});
  }

  // ─── PRODUCT IMAGES (Open Food Facts) ────────────────
  var _imgCache={};
  var _imgQueue=[];
  var _imgProcessing=false;
  var _imgTotalFetched=0;

  function _getCachedImage(bc){
    if(_imgCache[bc]!==undefined)return Promise.resolve(_imgCache[bc]);
    return _openMeta().then(function(d){
      if(!d)return null;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get("img-"+bc);
        r.onsuccess=function(){var v=r.result?r.result.value:null;_imgCache[bc]=v;ok(v);};
        r.onerror=function(){ok(null);};
      });
    });
  }
  function _cacheImage(bc,url){
    _imgCache[bc]=url;
    _openMeta().then(function(d){
      if(!d)return;
      var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:"img-"+bc,value:url});
    });
  }
  function _fetchImageFromApi(bc){
    if(!/^\d{8,13}$/.test(bc))return Promise.resolve(null);
    var apis=[
      "https://world.openfoodfacts.org/api/v0/product/"+bc+".json",
      "https://world.openbeautyfacts.org/api/v0/product/"+bc+".json",
      "https://world.openpetfoodfacts.org/api/v0/product/"+bc+".json"
    ];
    function tryApi(idx){
      if(idx>=apis.length)return Promise.resolve(null);
      return fetch(apis[idx],{headers:{"User-Agent":"AcimCaisse/1.0"}}).then(function(r){
        if(!r.ok)return tryApi(idx+1);
        return r.json();
      }).then(function(d){
        if(!d||!d.product)return tryApi(idx+1);
        var u=d.product.image_front_small_url||d.product.image_front_url||d.product.image_url;
        if(!u)return tryApi(idx+1);
        return fetch(u).then(function(ir){
          if(!ir.ok)return tryApi(idx+1);
          return ir.blob();
        }).then(function(b){
          if(!b)return tryApi(idx+1);
          return new Promise(function(ok){
            var rd=new FileReader();
            rd.onload=function(){ok(rd.result);};
            rd.onerror=function(){ok(null);};
            rd.readAsDataURL(b);
          });
        });
      }).catch(function(){return tryApi(idx+1);});
    }
    return tryApi(0);
  }
  // ─── LOCAL IMAGE DATABASE (verified OFF URLs - only 200 status, no 404s) ──
  var _LOCAL_IMAGES={
    // Viande (verified working)
    "poulet entier":"https://images.openfoodfacts.org/images/products/356/470/067/7643/front_fr.8.400.jpg",
    "poulet":"https://images.openfoodfacts.org/images/products/356/470/067/7643/front_fr.8.400.jpg",
    "bavette de boeuf":"https://images.openfoodfacts.org/images/products/318/123/894/2403/front_fr.56.400.jpg",
    "bavette":"https://images.openfoodfacts.org/images/products/318/123/894/2403/front_fr.56.400.jpg",
    // Poisson (verified working)
    "thon":"https://images.openfoodfacts.org/images/products/301/908/123/9138/front_fr.4.400.jpg",
    "thon conserve":"https://images.openfoodfacts.org/images/products/301/908/123/9138/front_fr.4.400.jpg",
    "conserve thon":"https://images.openfoodfacts.org/images/products/301/908/123/9138/front_fr.4.400.jpg",
    // Épicerie (verified working)
    "pates spaghetti":"https://images.openfoodfacts.org/images/products/807/680/019/5057/front_en.3809.400.jpg",
    "spaghetti":"https://images.openfoodfacts.org/images/products/807/680/019/5057/front_en.3809.400.jpg",
    "pates":"https://images.openfoodfacts.org/images/products/807/680/019/5057/front_en.3809.400.jpg",
    "huile d'olive":"https://images.openfoodfacts.org/images/products/317/805/000/0749/front_fr.121.400.jpg",
    "huile olive":"https://images.openfoodfacts.org/images/products/317/805/000/0749/front_fr.121.400.jpg",
    "cafe moulu":"https://images.openfoodfacts.org/images/products/318/757/001/5447/front_fr.108.400.jpg",
    "café moulu":"https://images.openfoodfacts.org/images/products/318/757/001/5447/front_fr.108.400.jpg",
    "cafe":"https://images.openfoodfacts.org/images/products/318/757/001/5447/front_fr.108.400.jpg",
    "sucre":"https://images.openfoodfacts.org/images/products/316/543/081/0005/front_fr.52.400.jpg",
    "sucre en poudre":"https://images.openfoodfacts.org/images/products/316/543/081/0005/front_fr.52.400.jpg",
    "farine":"https://images.openfoodfacts.org/images/products/306/811/070/2235/front_fr.80.400.jpg",
    "farine de ble":"https://images.openfoodfacts.org/images/products/306/811/070/2235/front_fr.80.400.jpg",
    "moutarde":"https://images.openfoodfacts.org/images/products/872/018/246/0721/front_fr.115.400.jpg",
    "moutarde dijon":"https://images.openfoodfacts.org/images/products/872/018/246/0721/front_fr.115.400.jpg",
    "lait de coco":"https://images.openfoodfacts.org/images/products/502/104/710/5317/front_fr.16.400.jpg",
    "coco":"https://images.openfoodfacts.org/images/products/502/104/710/5317/front_fr.16.400.jpg",
    // Laitier (verified working)
    "lait entier":"https://images.openfoodfacts.org/images/products/353/363/178/1002/front_fr.4.400.jpg",
    "lait":"https://images.openfoodfacts.org/images/products/353/363/178/1002/front_fr.4.400.jpg",
    "beurre":"https://images.openfoodfacts.org/images/products/315/525/120/5500/front_fr.227.400.jpg",
    "beurre doux":"https://images.openfoodfacts.org/images/products/315/525/120/5500/front_fr.227.400.jpg",
    "fromage":"https://images.openfoodfacts.org/images/products/307/378/110/2093/front_fr.33.400.jpg",
    "fromage rapé":"https://images.openfoodfacts.org/images/products/307/378/110/2093/front_fr.33.400.jpg",
    "emmental":"https://images.openfoodfacts.org/images/products/307/378/110/2093/front_fr.33.400.jpg",
    "gruyere":"https://images.openfoodfacts.org/images/products/307/378/110/2093/front_fr.33.400.jpg",
    "yaourt":"https://images.openfoodfacts.org/images/products/611/103/200/2925/front_fr.44.400.jpg",
    "yaourts":"https://images.openfoodfacts.org/images/products/611/103/200/2925/front_fr.44.400.jpg",
    "yaourts nature":"https://images.openfoodfacts.org/images/products/611/103/200/2925/front_fr.44.400.jpg",
    // Boissons (verified working)
    "eau minerale":"https://images.openfoodfacts.org/images/products/370/012/330/0014/front_fr.108.400.jpg",
    "eau":"https://images.openfoodfacts.org/images/products/370/012/330/0014/front_fr.108.400.jpg",
    "coca":"https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.1107.400.jpg",
    "coca cola":"https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.1107.400.jpg",
    "orangina":"https://images.openfoodfacts.org/images/products/322/885/700/0166/front_fr.1869.400.jpg",
    "pain complet":"https://images.openfoodfacts.org/images/products/322/885/700/0166/front_fr.1869.400.jpg",
    "prince chocolat":"https://images.openfoodfacts.org/images/products/762/221/044/9283/front_en.605.400.jpg",
    "prince":"https://images.openfoodfacts.org/images/products/762/221/044/9283/front_en.605.400.jpg"
  };

  function _searchImageByName(name){
    if(!name)return Promise.resolve(null);
    // Check local database first (instant, no API call)
    var lowerName=name.toLowerCase();
    for(var key in _LOCAL_IMAGES){
      if(lowerName.indexOf(key)>=0||key.indexOf(lowerName)>=0){
        return Promise.resolve(_LOCAL_IMAGES[key]);
      }
    }
    // Fallback to API with throttle
    var now=Date.now();
    var delay=Math.max(0,1000-(now-_lastSearchTime));
    _lastSearchTime=now+delay;
    return new Promise(function(resolve){
      setTimeout(function(){
        var q=encodeURIComponent(name);
        var url="https://world.openfoodfacts.org/cgi/search.pl?search_terms="+q+"&search_simple=1&action=process&json=1&page_size=1&fields=image_front_small_url";
        fetch(url,{headers:{"User-Agent":"AcimCaisse/1.0"}}).then(function(r){
          if(!r.ok)return resolve(null);
          return r.json();
        }).then(function(d){
          if(!d||!d.products||!d.products.length)return resolve(null);
          var u=d.products[0].image_front_small_url;
          if(!u)return resolve(null);
          return fetch(u).then(function(ir){
            if(!ir.ok)return resolve(null);
            return ir.blob();
          }).then(function(b){
            if(!b)return resolve(null);
            var rd=new FileReader();
            rd.onload=function(){resolve(rd.result);};
            rd.onerror=function(){resolve(null);};
            rd.readAsDataURL(b);
          });
        }).catch(function(){resolve(null);});
      },delay);
    });
  }
  function _enqueueImage(bc,cb,name){
    if(!bc||_imgCache[bc]!==undefined)return;
    _imgQueue.push({bc:bc,cb:cb,name:name||""});
    _processImageQueue();
  }
  function _processImageQueue(){
    if(_imgProcessing||_imgQueue.length===0)return;
    _imgProcessing=true;
    var item=_imgQueue.shift();
    _fetchImageFromApi(item.bc).then(function(dataUrl){
      if(dataUrl){
        _cacheImage(item.bc,dataUrl);_imgTotalFetched++;
        if(item.cb)item.cb(dataUrl);
        _imgProcessing=false;
        _processImageQueue();
      }else if(item.name && !_batchMode){
        // Try search by name only in single-item mode (not batch)
        _searchImageByName(item.name).then(function(dataUrl2){
          if(dataUrl2){_cacheImage(item.bc,dataUrl2);_imgTotalFetched++;}
          else{_imgCache[item.bc]=null;}
          if(item.cb)item.cb(dataUrl2);
          _imgProcessing=false;
          _processImageQueue();
        }).catch(function(){_imgCache[item.bc]=null;_imgProcessing=false;_processImageQueue();});
      }else{
        _imgCache[item.bc]=null;
        if(item.cb)item.cb(null);
        _imgProcessing=false;
        _processImageQueue();
      }
    }).catch(function(){_imgProcessing=false;_processImageQueue();});
  }

  // ─── BATCH IMAGE FETCH (auto-fetch images for all products, priority: priced > sold) ──
  var _batchMode=false;
  function _batchFetchImages(products){
    if(navigator.webdriver) return;   // skip network batch in test/headless mode (Playwright) to keep screenshots clean
    _batchMode=true;
    var count=0;
    var toFetch=[];
    for(var i=0;i<products.length;i++){
      var p=products[i];
      if(!p.barcode)continue;
      if(_imgCache[p.barcode]!==undefined)continue;
      if(/^(ACIM-|INV-|TEST-|test-)/.test(p.barcode))continue;
      toFetch.push(p);
    }
    if(toFetch.length===0)return;
    // Sort: priced products first, then by last_updated desc
    toFetch.sort(function(a,b){
      var aPrice=(a.sale_price_cents||a.priceCents||0)>0?1:0;
      var bPrice=(b.sale_price_cents||b.priceCents||0)>0?1:0;
      if(aPrice!==bPrice)return bPrice-aPrice;
      return (Number(b.last_updated)||0) - (Number(a.last_updated)||0);
    });
    _log("Batch fetch: "+toFetch.length+" images \u00E0 t\u00E9l\u00E9charger (priorité: produits avec prix)");
    toFetch.forEach(function(p){
      _enqueueImage(p.barcode,function(url){
        if(url){
          count++;
          if(count%10===0)_log("Images t\u00E9l\u00E9charg\u00E9es: "+count);
          _renderGrid();
        }
      },p.name);
    });
    // Reset batch mode after queue drains
    setTimeout(function(){_batchMode=false;},100);
  }

  // ─── INIT ────────────────────────────────────────────
  function init(){
    if(!_acquireTabLock()){_toast("⚠ Caisse déjà ouverte dans un autre onglet");return;}
    // Sprint 4.1 PR A — open unified DB + migrate legacy DBs before anything else.
    _openUnifiedDB().then(function(db){
      if(!db){_err("Unified DB open failed at init");return null;}
      if(window._acimAudit)window._acimAudit._bind(db);
      if(window._acimAudit)return window._acimAudit.ensureSession();
      return null;
    }).then(function(sessionId){
      if(window._acimAudit&&sessionId){
        window._acimAudit.log({type:window._acimAudit.TYPE.SESSION_START,entityType:"session",entityId:sessionId,action:"start",payload:{bootTime:Date.now()}});
      }
      return _maybeMigrateLegacy();
    }).then(function(migRes){
      if(migRes) _log("Migration: "+(migRes.ok?(migRes.alreadyMigrated?"already migrated":"done: "+JSON.stringify(migRes.copied)):("FAILED: "+migRes.error)));
      return _seedDefaultUser();
    }).then(function(){
      // PR C — Restoring operator session if any (offline-first trust local meta).
      return _restoreSessionIfAny();
    }).then(function(actor){
      if(actor) _log("Operator session restored: "+actor.id+" ("+actor.name+")");
      return Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]);
    }).then(function(){
      _log("v1.3.0#40 — transactional stock + kg weight fix + version unification");
      _migrateSchema().then(function(mig){
        if(mig&&mig.applied>0)_log("Schema migrated: "+mig.applied+" step(s), v"+mig.from+"→"+mig.to);
        return _fetchCatalogJSON();
      }).then(function(){
        return _importBackupFromEmbedded();
      }).then(function(imported){
        if(imported)_toast("✅ Catalogue importé ("+(_BACKUP_DATA?_BACKUP_DATA.products.length:0)+" produits)");
        return _importSupplierCatalogFromMeta();
      }).then(function(imported){
        if(imported>0)_toast("✅ "+imported+" produits catalogue fournisseur importés");
        return _importYardenCatalog();
      }).then(function(yardenCount){
        if(yardenCount>0)_toast("✅ "+yardenCount+" produits Yarden importés");
        return _autoMatchInvoiceProducts();
      }).then(function(cleaned){
        if(cleaned>0)_toast("🔗 "+cleaned+" produit(s) facture synchronisé(s)");
        return _dbGetAll();
      }).then(function(all){
        _allProducts=all||[];
        _log("Produits charg\u00E9s: "+_allProducts.length);
        // Seed ideal cart products to IndexedDB if not already there
        return _seedIdealProducts(_allProducts).then(function(seeded){
          if(seeded>0){
            return _dbGetAll().then(function(all2){_allProducts=all2||[];_log("Total after seed: "+_allProducts.length);});
          }
        });
      }).then(function(){
        _createPOS();
        _renderPOS();
        _refreshActorBadge();
        if(!_getCurrentActor()){
          setTimeout(function(){_showLogin();},300);
        }
        _batchFetchImages(_allProducts);
      }).catch(function(e){
        _err("Init error:",e);
        _allProducts=[];
        _createPOS();
        _renderPOS();
        _refreshActorBadge();
        setTimeout(function(){_showLogin();},300);
      });
    }).catch(function(e){
      _err("DB migration init failed:",e);
    });

    // Fallback: always show login if no operator is logged in after 5s
    setTimeout(function(){
      if(!_getCurrentActor()){
        _showLogin();
      }
    }, 5000);
    document.addEventListener("keydown",function(e){
      if(e.ctrlKey&&e.key==="k"){e.preventDefault();if(_posSearch)_posSearch.focus();}
      if(e.ctrlKey&&e.key==="n"){e.preventDefault();_quickCreate("",0);}
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();

  window._acimGetCartInfo=_cartInfo;
  window._acimDebug=function(){return{cart:_myCart.length,ticket:_ticketSeq};};
  window._acimProcessBarcode=_processBarcode;
  window._acimAddToCart=function(name,price,cat){_addToCart(name,price,"",cat);};
  window._acimWeighProduct=_weighProduct;
  // Voice sprint-3: lookup products by fuzzy name and add via confirm.
  window._acimAddToCartByVoice=function(prodName,qty,unit){
    if(!prodName){return;}
    var q=prodName.toLowerCase().trim();
    return _dbGetAll().then(function(all){
      var matches=[];
      for(var i=0;i<all.length;i++){var p=all[i];
        var n=(p.name||"").toLowerCase();
        if(n.indexOf(q)>=0||q.indexOf(n)>=0){matches.push(p);}
      }
      if(matches.length===0){
        if(window._acimS3&&window._acimS3.speak)window._acimS3.speak("Produit introuvable: "+prodName);
        return;
      }
      if(matches.length===1){
        var p=matches[0];
        var promptTxt=(qty!=null?"Ajouter "+qty+" "+(unit||"unité")+" de ":"Ajouter ")+p.name+" à "+((p.sale_price_cents||0)/100).toFixed(2).replace(".",",")+" euros ?";
        if(window._acimS3&&window._acimS3.confirmVoice){
          window._acimS3.confirmVoice(promptTxt,function(){
            if(unit==="kg"&&p.pricePerUnit>0){
              // kg add: compute total via _calcWeightPrice
              var w=parseFloat(qty)||0;
              var total=_calcWeightPrice(w,"kg",p.pricePerUnit);
              _addToCart(p.name+" "+w.toFixed(3).replace(".",",")+" kg",total,p.barcode,p.category,w,"kg",p.pricePerUnit);
            }else if(qty!=null&&unit==="pc"){
              var tpc=(p.sale_price_cents||0)*qty;
              _addToCart(p.name+" × "+qty,tpc,p.barcode,p.category,null,null,null);
            }else{
              _addToCart(p.name,p.sale_price_cents||0,p.barcode,p.category);
            }
          });
        }else{
          // tests/sandbox: just add directly
          _addToCart(p.name,p.sale_price_cents||0,p.barcode,p.category);
        }
        return;
      }
      // Multiple matches → flash list (max 3) — user can scan or click the right one
      var top3=matches.slice(0,3);
      var listTxt=top3.map(function(p){
        return p.name+" — "+((p.sale_price_cents||0)/100).toFixed(2).replace(".",",")+" euros";
      }).join(" / ");
      if(window._acimS3&&window._acimS3.speak)window._acimS3.speak("Plusieurs matchs: "+listTxt+". Précisez le nom.");
      if(window._acimS3)window._acimS3.showFlash({name:prodName+" — "+matches.length+" matchs",priceCents:0,warn:"Précisez: "+listTxt,duration:4000,error:true});
    }).catch(function(e){_err("Voice add error:",e);});
  };
  // Test surface — used by tests.html. Not stable API for app code.
  window._acimTest={
    decrementStock:_decrementStock,
    restoreStock:_restoreStock,
    dbGet:_dbGet,
    dbPut:_dbPut,
    dbGetAll:_dbGetAll,
    dbDelete:_dbDelete,
    dbDeleteAll:_dbDeleteAll,
    openDB:_openDB,
    addToCart:_addToCart,
    cartTotal:_cartTotal,
    cartSubtotal:_cartSubtotal,
    isWeightProduct:_isWeightProduct,
    calcWeightPrice:_calcWeightPrice,
    finalizeSale:_finalizeSale,
    persistSale:_persistSale,
    undoLastSale:_undoLastSale,
    executeUndoSaleAtomic:_executeUndoSaleAtomic,
    // PR C — operator identity + manual stock adjust (test surface)
    adjustStock:_adjustStock,
    createUser:_createUser,
    listUsers:_listUsers,
    loginWithPin:_loginWithPin,
    logout:_logout,
    getCurrentActor:_getCurrentActor,
    getCurrentActorAsync:_getCurrentActorAsync,
    restoreSessionIfAny:_restoreSessionIfAny,
    hashPin:_hashPin,
    verifyPin:_verifyPin,
    bytesToBase64:_bytesToBase64,
    STOCK_ADJUST_REASON:STOCK_ADJUST_REASON,
    USER_META_KEY:_USER_META_KEY,
    clearCart:function(){_myCart=[];_realBcMap={};_cartDiscountCents=0;_renderPOS();},
    getCart:function(){return _myCart.slice();},
    formatWeight:_formatWeight,
    formatPricePerUnit:_formatPricePerUnit
  };
  // PR C — UI public surface
  window._acimAdjustStock=_adjustStock;
  window._acimShowLogin=_showLogin;
  window._acimLogout=_logout;
  window._acimGetCurrentActor=_getCurrentActor;
  window._acimGetCurrentActorAsync=_getCurrentActorAsync;
  window._acimRefreshActorBadge=_refreshActorBadge;
  window._closeCartSheet=_closeCartSheet;
  window._openCartSheet=_openCartSheet;
  window._filterProducts=_filterProducts;
  window._showMainMenu=_showMainMenu;
  window._showIdealCart=_showIdealCart;
  window._activeCat_ref=function(v){if(v!==undefined)_activeCat=v;return _activeCat;};
})();
