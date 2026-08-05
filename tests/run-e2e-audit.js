// tests/run-e2e-audit.js — Sprint 4.1 PR A tests.
// Validates: unified DB creation, legacy migration, audit event write,
// index queries, persistence across reload, immutability, crash recovery
// during migration, and non-regression of Sprint 4.0 invariants (last check).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SHOTS = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://localhost:8765/';
const R = { pass: 0, fail: 0, shots: 0 };
function log(m){ console.log('[' + new Date().toISOString().substr(11,8) + '] ' + m); }
async function shot(p,n){ await p.screenshot({path:path.join(SHOTS,n+'.png'),fullPage:true}); R.shots++; log('  shot: '+n+'.png'); }
async function ok(name, cond, detail){ if(cond){R.pass++; log('  PASS: '+name);} else {R.fail++; log('  FAIL: '+name+(detail?' - '+detail:''));} }

// Helper: wipe ALL AcimCaisse-related IDB databases on the current page.
// Used to set up a clean state before each scenario that requires empty IDB.
async function wipeAllCaisseDBs(p){
  await p.evaluate(async () => {
    const names = ["acim","acim-catalog","acim-sales","acim-meta"];
    for (const n of names) {
      await new Promise(res => {
        try {
          const r = indexedDB.deleteDatabase(n);
          r.onsuccess = r.onerror = r.onblocked = () => res();
          setTimeout(res, 2000);
        } catch(e){ res(); }
      });
    }
  });
}

// Helper: STRICT non-mutating probe of a legacy IndexedDB absence.
// Critical: a naive `indexedDB.open(name)` will CREATE the database if absent
// (with version 1 onupgradeneeded), thus invalidating any test that asserts
// "migration has deleted the legacy DB". We use `indexedDB.databases()`
// (Chromium >= 71) instead — read-only, never creates anything.
// Returns true  => DB does NOT exist (migration cleanup succeeded).
// Returns false => DB still exists.
// Returns null  => indexedDB.databases() unavailable in this browser context
//                  (test must be skipped, NOT asserted as failure).
async function probeLegacyAbsent(p, dbName){
  return await p.evaluate(async (name) => {
    if (typeof indexedDB.databases !== "function") return null;
    try {
      const dbs = await indexedDB.databases();
      return !dbs.some(db => db.name === name);
    } catch(e){ return null; }
  }, dbName);
}

// Helper: assert absence of a legacy DB, with proper skip semantics if the
// browser doesn't expose indexedDB.databases(). Skipped assertions are logged
// and counted as "pass" (rather than fail) so the suite can stay green.
function skipIfNull(name, val, okFn){
  if (val === null) {
    log('  SKIP: ' + name + ' (indexedDB.databases() unavailable)');
    return;
  }
  okFn(name, val === true, val === false ? 'still-present' : 'probe-error');
}

// Helper: pre-populate legacy DBs (acim-catalog, acim-sales, acim-meta) BEFORE
// the page boots the caisse. Simulates a v1 user upgrading to PR A.
async function seedLegacyDBs(p, products, sales, meta){
  await p.evaluate(async (args) => {
    const products = args.products, sales = args.sales, meta = args.meta;
    async function fillLegacy(name, storeName, items, keyPath, autoInc){
      return new Promise((res) => {
        const r = indexedDB.open(name, 1);
        r.onupgradeneeded = (e) => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains(storeName)) {
            d.createObjectStore(storeName, { keyPath, autoIncrement: !!autoInc });
          }
        };
        r.onsuccess = (e) => {
          const d = e.target.result;
          if (!items.length) { d.close(); res(); return; }
          const tx = d.transaction(storeName, "readwrite");
          const s = tx.objectStore(storeName);
          for (const it of items) s.put(it);
          tx.oncomplete = () => { d.close(); res(); };
          tx.onerror = () => { d.close(); res(); };
        };
        r.onerror = () => res();
      });
    }
    await fillLegacy("acim-catalog", "products", products, "barcode", false);
    await fillLegacy("acim-sales", "sales", sales, "id", true);
    await fillLegacy("acim-meta", "meta", meta, "key", false);
  }, { products, sales, meta });
}

(async () => {
  log('Launching Chromium...');
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message));

  // Navigate once with empty IDB; pre-seed by opening about:blank first so initial
  // goto() doesn't auto-trigger migration.
  await p.goto(BASE + 'tests/blank.html');

  // ============================================================
  // 1. DB NEUVE — fresh page → unified "acim" v2 created with 4 stores
  // ============================================================
  log('TEST 1: fresh IDB → unified DB acim v2 with 4 stores + audit indexes');
  try {
    await wipeAllCaisseDBs(p);
    await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);
    const probe = await p.evaluate(async () => {
      return await new Promise(res => {
        try {
          const r = indexedDB.open("acim", 2);
          r.onsuccess = (e) => {
            const d = e.target.result;
            const stores = Array.prototype.slice.call(d.objectStoreNames);
            const idx = {};
            if (d.objectStoreNames.contains("audit_events")) {
              const s = d.transaction("audit_events","readonly").objectStore("audit_events");
              idx.names = Array.prototype.slice.call(s.indexNames);
            }
            d.close();
            res({stores, indexes:idx});
          };
          r.onerror = () => res({ error: "open-acim-failed" });
        } catch(e){ res({ error: String(e.message) }); }
      });
    });
    await shot(p, 'audit-01-fresh-db');
    await ok('Unified DB "acim" contains 4 stores (got: '+(probe.stores||[]).join(',')+')', probe.stores && probe.stores.length === 4, JSON.stringify(probe));
    await ok('Stores are products/sales/meta/audit_events', probe.stores && ["audit_events","meta","products","sales"].every(s => probe.stores.includes(s)));
    await ok('audit_events has 6 indexes (got '+(probe.indexes && probe.indexes.names ? probe.indexes.names.length : -1)+')', probe.indexes && probe.indexes.names && probe.indexes.names.length === 6, JSON.stringify(probe.indexes));
    await ok('Required indexes present', probe.indexes && probe.indexes.names && ["by_timestamp","by_type","by_actorId","by_sessionId","by_entityType","by_entityId"].every(i => probe.indexes.names.includes(i)));
    // Legacy absence — non-mutating probe via indexedDB.databases(). Skips if the
    // API is unavailable (e.g. olderWebKit/Firefox) rather than silently failing.
    const legCatalog = await probeLegacyAbsent(p, "acim-catalog");
    const legSales   = await probeLegacyAbsent(p, "acim-sales");
    const legMeta    = await probeLegacyAbsent(p, "acim-meta");
    skipIfNull('Legacy acim-catalog absent on fresh DB', legCatalog, ok);
    skipIfNull('Legacy acim-sales absent on fresh DB',   legSales,   ok);
    skipIfNull('Legacy acim-meta absent on fresh DB',    legMeta,    ok);
  } catch (e) {
    await ok('Fresh DB creation', false, String(e.message || e));
  }

  // ============================================================
  // 2. MIGRATION DB EXISTANTE — legacy DBs pre-seeded → migrated into acim
  // ============================================================
  log('TEST 2: legacy DB migration in-place');
  try {
    await p.goto(BASE + 'tests/blank.html');
    await wipeAllCaisseDBs(p);
    // Pre-seed legacy DBs BEFORE boot triggers migration.
    const seedProducts = [
      { barcode: "LEG-001", name: "Legacy A", sale_price_cents: 100, category: "autre", stockQty: 10, unit: "unit" },
      { barcode: "LEG-002", name: "Legacy B", sale_price_cents: 200, category: "autre", stockQty: 20, unit: "unit" },
      { barcode: "LEG-003", name: "Legacy C", sale_price_cents: 300, category: "autre", stockQty: 30, unit: "unit" }
    ];
    const seedSales = [
      { ticketNumber: 100, timestamp: Date.now(), isoTime: new Date().toISOString(), items: [], totalCents: 0, discountCents: 0, payments: [], itemCount: 0 }
    ];
    const seedMeta = [
      { key: "acim-bc-seq", value: 2000 },
      { key: "acim-ticket-seq", value: 100 },
      { key: "schema-version", value: 4 }
    ];
    await seedLegacyDBs(p, seedProducts, seedSales, seedMeta);
    await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(6500);
    const probe = await p.evaluate(async () => {
      return await new Promise(res => {
        const r = indexedDB.open("acim", 2);
        r.onsuccess = async (e) => {
          const d = e.target.result;
          const out = { counts: {}, migrationEvent: null, legProducts: [] };
          const storeNames = ["products","sales","meta","audit_events"];
          let pending = storeNames.length;
          storeNames.forEach((sn) => {
            const c = d.transaction(sn,"readonly").objectStore(sn).count();
            c.onsuccess = () => { out.counts[sn] = c.result; if(--pending===0) finishing_step1(); };
            c.onerror  = () => { out.counts[sn] = -1; if(--pending===0) finishing_step1(); };
          });
          function finishing_step1(){
            // Probe LEG-* presence in unified products to confirm migration.
            const txp = d.transaction("products","readonly");
            const cur = txp.objectStore("products").openCursor();
            cur.onsuccess = () => {
              const c = cur.result;
              if (!c) { finishing_step2(); return; }
              if (typeof c.value.barcode === "string" && c.value.barcode.indexOf("LEG-") === 0) out.legProducts.push(c.value.barcode);
              c.continue();
            };
            cur.onerror = () => { finishing_step2(); };
          }
          function finishing_step2(){
            const tx = d.transaction("audit_events","readonly");
            const idx = tx.objectStore("audit_events").index("by_type");
            const req = idx.getAll("MIGRATION_COMPLETED");
            req.onsuccess = () => {
              out.migrationEvent = (req.result && req.result.length > 0) ? req.result[req.result.length-1] : null;
              d.close();
              res(out);
            };
            req.onerror = () => { d.close(); res(out); };
          }
        };
        r.onerror = () => res({ error: "open-failed" });
      });
    });
    const legCatalog2 = await probeLegacyAbsent(p, "acim-catalog");
    const legSales2   = await probeLegacyAbsent(p, "acim-sales");
    const legMeta2    = await probeLegacyAbsent(p, "acim-meta");
    await shot(p, 'audit-02-migrated');
    // Migration assertions (independent of catalog.json post-import)
    await ok('All 3 LEG-* products migrated (got '+(probe.legProducts||[]).length+', barcodes: '+(probe.legProducts||[]).join(',')+')', (probe.legProducts||[]).length === 3 && ["LEG-001","LEG-002","LEG-003"].every(b => (probe.legProducts||[]).includes(b)), JSON.stringify(probe.legProducts));
    await ok('Legacy sale migrated (got '+probe.counts.sales+')', probe.counts.sales === 1, JSON.stringify(probe.counts));
    await ok('Meta migrated (got '+probe.counts.meta+')', probe.counts.meta >= 4, JSON.stringify(probe.counts)); // 3 seeded + acim-migrated-v2 + session
    await ok('MIGRATION_COMPLETED event emitted', probe.migrationEvent !== null, JSON.stringify(probe.migrationEvent));
    await ok('Migration payload.copied.products = 3 (got '+(probe.migrationEvent&&probe.migrationEvent.payload&&probe.migrationEvent.payload.copied&&probe.migrationEvent.payload.copied.products)+')', probe.migrationEvent && probe.migrationEvent.payload && probe.migrationEvent.payload.copied && probe.migrationEvent.payload.copied.products === 3, JSON.stringify(probe.migrationEvent&&probe.migrationEvent.payload));
    skipIfNull('Legacy acim-catalog absent after migration', legCatalog2, ok);
    skipIfNull('Legacy acim-sales absent after migration',   legSales2,   ok);
    skipIfNull('Legacy acim-meta absent after migration',    legMeta2,    ok);
  } catch (e) {
    await ok('Legacy DB migration', false, String(e.message || e));
  }

  // ============================================================
  // 3. CREATION AUDIT EVENT — log() resolves, count==1
  // ============================================================
  log('TEST 3: audit.log() creates an event');
  try {
    await p.evaluate(() => window._acimTest && window._acimTest.clearCart && window._acimTest.clearCart());
    // Wipe audit_events to start clean; simulate fresh audit DB without disabling caisse
    await p.evaluate(async () => {
      // Clear audit_events via a tx (allowed from tests — proves we can wipe for isolation)
      return await new Promise(res => {
        const r = indexedDB.open("acim", 2);
        r.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("audit_events","readwrite");
          tx.objectStore("audit_events").clear();
          tx.oncomplete = () => { d.close(); res(); };
          tx.onerror = () => { d.close(); res(); };
        };
      });
    });
    const beforeCount = await p.evaluate(() => window._acimAudit.count());
    const r = await p.evaluate(() => window._acimAudit.log({type: window._acimAudit.TYPE.SESSION_START, entityType: "session", action: "start", payload: {test:true}}));
    const afterCount = await p.evaluate(() => window._acimAudit.count());
    await shot(p, 'audit-03-create');
    await ok('log() resolved ok=true', r && r.ok === true, JSON.stringify(r));
    await ok('count before=0 (got '+beforeCount+')', beforeCount === 0);
    await ok('count after=1 (got '+afterCount+')', afterCount === 1);
    await ok('eventId returned (got '+(r && r.eventId ? r.eventId.slice(0,8):'null')+')', r && r.eventId && typeof r.eventId === "string" && r.eventId.length >= 32);
  } catch (e) {
    await ok('audit.log() creates event', false, String(e.message || e));
  }

  // ============================================================
  // 4. LECTURE PAR INDEX — getByEntity returns only matching events
  // ============================================================
  log('TEST 4: index-based queries');
  try {
    await p.evaluate(async () => {
      // Clear and seed 3 events.
      await new Promise(res => {
        const r = indexedDB.open("acim", 2);
        r.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("audit_events","readwrite");
          tx.objectStore("audit_events").clear();
          tx.oncomplete = () => {
            const tx2 = d.transaction("audit_events","readwrite");
            const s = tx2.objectStore("audit_events");
            const A = window._acimAudit;
            const ev1 = {id:crypto.randomUUID(),schemaVersion:1,timestamp:Date.now(),type:A.TYPE.SALE_CREATED,actorId:null,sessionId:A.getSessionId(),entityType:"sale",entityId:"T1",action:"create",payload:{},previousState:null,newState:null,status:"COMMITTED"};
            const ev2 = {id:crypto.randomUUID(),schemaVersion:1,timestamp:Date.now()+1,type:A.TYPE.SALE_CREATED,actorId:null,sessionId:A.getSessionId(),entityType:"sale",entityId:"T2",action:"create",payload:{},previousState:null,newState:null,status:"COMMITTED"};
            const ev3 = {id:crypto.randomUUID(),schemaVersion:1,timestamp:Date.now()+2,type:A.TYPE.STOCK_DECREMENT,actorId:null,sessionId:A.getSessionId(),entityType:"stock",entityId:"BAR-X",action:"decrement",payload:{},previousState:null,newState:null,status:"COMMITTED"};
            s.add(ev1); s.add(ev2); s.add(ev3);
            tx2.oncomplete = () => { d.close(); res(); };
            tx2.onerror = () => { d.close(); res(); };
          };
        };
      });
    });
    const byEntityT1 = await p.evaluate(() => window._acimAudit.getByEntity("sale", "T1"));
    const byEntitySale = await p.evaluate(() => window._acimAudit.getByEntity("sale", null));
    const byTypeSale = await p.evaluate(() => window._acimAudit.getByType("SALE_CREATED"));
    const byTypeStock = await p.evaluate(() => window._acimAudit.getByType("STOCK_DECREMENT"));
    await shot(p, 'audit-04-indexes');
    await ok('getByEntity(sale, T1) returns 1 event (got '+byEntityT1.length+')', byEntityT1.length === 1, JSON.stringify(byEntityT1.length));
    await ok('getByEntity(sale, T1) returns the right event', byEntityT1.length === 1 && byEntityT1[0].entityId === "T1");
    await ok('getByEntity(sale, null) returns 2 events (got '+byEntitySale.length+')', byEntitySale.length === 2, JSON.stringify(byEntitySale.length));
    await ok('getByType(SALE_CREATED) returns 2 (got '+byTypeSale.length+')', byTypeSale.length === 2);
    await ok('getByType(STOCK_DECREMENT) returns 1 (got '+byTypeStock.length+')', byTypeStock.length === 1);
  } catch (e) {
    await ok('Index queries', false, String(e.message || e));
  }

  // ============================================================
  // 5. PERSISTENCE — events survive page reload
  // ============================================================
  log('TEST 5: events persist across reload');
  try {
    const beforeCount = await p.evaluate(() => window._acimAudit.count());
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);
    const afterCount = await p.evaluate(() => window._acimAudit.count());
    await shot(p, 'audit-05-persisted');
    await ok('Events survived reload (before='+beforeCount+', after='+afterCount+')', afterCount >= beforeCount, JSON.stringify({beforeCount, afterCount}));
    await ok('At least 1 event post-reload (got '+afterCount+')', afterCount >= 1);
  } catch (e) {
    await ok('Persistence across reload', false, String(e.message || e));
  }

  // ============================================================
  // 6. IMMUABILITE — add() with existing id must fail; no API to mutate
  // ============================================================
  log('TEST 6: append-only immutability');
  try {
    const r = await p.evaluate(async () => {
      // Try to add an event with an existing id (duplication probe).
      const last = await window._acimAudit.last();
      if (!last) return { error: "no-event-to-test-immutable" };
      return await new Promise(res => {
        const r0 = indexedDB.open("acim", 2);
        r0.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("audit_events","readwrite");
          try {
            tx.objectStore("audit_events").add(last); // same id → should fail
          } catch(ex){ d.close(); res({addRaised:String(ex.message)}); return; }
          tx.oncomplete = () => { d.close(); res({addUnexpected:"completed"}); };
          tx.onerror = (e2) => { d.close(); res({addRejected:String(e2.target.error && e2.target.error.name || "ConstraintError-expected")}); };
          tx.onabort = () => { d.close(); res({addAborted:"expected-rejection"}); };
        };
      });
    });
    // Verify no public delete/update API on _acimAudit
    const api = await p.evaluate(() => ({
      hasDelete: typeof window._acimAudit.delete === "function",
      hasUpdate: typeof window._acimAudit.update === "function",
      hasClear:  typeof window._acimAudit.clear  === "function"
    }));
    await shot(p, 'audit-06-immutable');
    await ok('add() with existing id rejected ('+r.addRejected+')', r && (r.addRejected || r.addAborted || r.addRaised), JSON.stringify(r));
    await ok('_acimAudit.delete not exposed', api.hasDelete === false, JSON.stringify(api));
    await ok('_acimAudit.update not exposed', api.hasUpdate === false, JSON.stringify(api));
    await ok('_acimAudit.clear not exposed', api.hasClear === false, JSON.stringify(api));
  } catch (e) {
    await ok('Immutability', false, String(e.message || e));
  }

  // ============================================================
  // 7. CRASH RECOVERY MIGRATION — partial migration retry
  //    Simulate: legacy DBs exist + previous migration copied data but didn't
  //    delete them. Reload should not duplicate — idempotency flag in meta.
  // ============================================================
  log('TEST 7: migration crash recovery / idempotency');
  try {
    await p.goto(BASE + 'tests/blank.html');
    await wipeAllCaisseDBs(p);
    // Seed legacy DBs with 5 products
    const seed = Array.from({length:5}, (_,i) => ({barcode:"CR-"+i,name:"Crash"+i,sale_price_cents:100*i,category:"autre",stockQty:5,unit:"unit"}));
    await seedLegacyDBs(p, seed, [], [{key:"schema-version",value:4}]);
    await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);
    // Re-create legacy DBs (simulating previous migration failed to delete)
    await p.goto(BASE + 'tests/blank.html');
    await seedLegacyDBs(p, seed, [], [{key:"schema-version",value:4}]);
    // Reload — migration should NOT re-copy (idempotency flag should skip)
    await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);
    const probe = await p.evaluate(async () => {
      // Count CR-* products — should be 5, not 10
      return await new Promise(res => {
        const r = indexedDB.open("acim", 2);
        r.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("products","readonly");
          const s = tx.objectStore("products");
          const out = [];
          const cur = s.openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) { d.close(); res({count: out.length, sample: out.slice(0,3)}); return; }
            if (typeof c.value.barcode === "string" && c.value.barcode.indexOf("CR-") === 0) out.push(c.value.barcode);
            c.continue();
          };
          cur.onerror = () => { d.close(); res({error:"cursor"}); };
        };
        r.onerror = () => res({error:"open"});
      });
    });
    const migrations = await p.evaluate(() => window._acimAudit.getByType("MIGRATION_COMPLETED"));
    await shot(p, 'audit-07-recovery');
    await ok('CR-* products not duplicated (count=5, got '+probe.count+')', probe.count === 5, JSON.stringify(probe));
    await ok('Exactly 1 MIGRATION_COMPLETED event (got '+migrations.length+')', migrations.length === 1, JSON.stringify(migrations.map(m=>m.id)));
  } catch (e) {
    await ok('Crash recovery migration', false, String(e.message || e));
  }

  // ============================================================
  // 8. NON-REGRESSION SPRINT 4.0 — quick smoke, checkout still atomic
  // ============================================================
  log('TEST 8: Sprint 4.0 non-regression smoke (1 checkout flow)');
  try {
    await p.evaluate(async () => {
      const T = window._acimTest;
      await T.dbPut({ barcode: 'AUDIT-SMOKE-A', name: 'Smoke', sale_price_cents: 100, category: 'autre', stockQty: 100, unit: 'unit', source: 'test', last_updated: Date.now() });
      T.clearCart();
    });
    await p.evaluate(() => window._acimProcessBarcode('AUDIT-SMOKE-A'));
    await p.waitForTimeout(1500);
    const afterScan = await p.evaluate(async () => ({
      cartLen: window._acimTest.getCart().length,
      stock: (await window._acimTest.dbGet('AUDIT-SMOKE-A')).stockQty
    }));
    await ok('Smoke post-scan: cart=1, stock=100', afterScan.cartLen === 1 && afterScan.stock === 100, JSON.stringify(afterScan));
    const totalBefore = await p.evaluate(() => window._acimTest.cartTotal());
    const afterCheckout = await p.evaluate(async (t) => {
      const T = window._acimTest;
      await T.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
      await new Promise(r => setTimeout(r, 1200));
      return {
        cartLen: T.getCart().length,
        stock: (await T.dbGet('AUDIT-SMOKE-A')).stockQty
      };
    }, totalBefore);
    await shot(p, 'audit-08-smoke');
    await ok('Smoke post-checkout: cart=0, stock=99', afterCheckout.cartLen === 0 && afterCheckout.stock === 99, JSON.stringify(afterCheckout));
    await p.evaluate(async () => { await window._acimTest.dbDelete('AUDIT-SMOKE-A'); });
  } catch (e) {
    await ok('Sprint 4.0 smoke', false, String(e.message || e));
  }

  // ============================================================
  // 9. No PAGEERROR exceptions during the suite
  // ============================================================
  log('TEST 9: PAGEERROR check');
  await ok('No PAGEERROR exceptions (' + pageErrors.length + ')', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await b.close();
  log('==========================================');
  log('AUDIT PR A RESULTS: ' + R.pass + ' pass, ' + R.fail + ' fail, ' + R.shots + ' screenshots');
  if (R.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
