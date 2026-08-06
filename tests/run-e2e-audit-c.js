// tests/run-e2e-audit-c.js — Sprint 4.1 PR C tests.
// Validates: _adjustStock atomic + STOCK_ADJUSTED audit + operator PIN identity
// + actorId alimentation automatique.
// 8 scenarios + PAGEERROR check.
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

async function clearAudit(p){
  return await p.evaluate(async () => {
    return await new Promise(res => {
      const r = indexedDB.open("acim", 3);
      r.onsuccess = (e) => {
        const d = e.target.result;
        try {
          const tx = d.transaction("audit_events","readwrite");
          tx.objectStore("audit_events").clear();
          tx.oncomplete = () => { d.close(); res(); };
          tx.onerror = () => { d.close(); res(); };
        } catch(err){ d.close(); res(); }
      };
    });
  });
}

async function clearUsers(p){
  return await p.evaluate(async () => {
    return await new Promise(res => {
      const r = indexedDB.open("acim", 3);
      r.onsuccess = (e) => {
        const d = e.target.result;
        if(!d.objectStoreNames.contains("users")){ d.close(); res(); return; }
        try {
          const tx = d.transaction("users","readwrite");
          tx.objectStore("users").clear();
          tx.oncomplete = () => { d.close(); res(); };
          tx.onerror   = () => { d.close(); res(); };
        } catch(err){ d.close(); res(); }
      };
    });
  });
}

async function clearSessionMeta(p){
  return await p.evaluate(async () => {
    return await new Promise(res => {
      const r = indexedDB.open("acim", 3);
      r.onsuccess = (e) => {
        const d = e.target.result;
        try {
          const tx = d.transaction("meta","readwrite");
          tx.objectStore("meta").delete("acim-current-actor-id");
          tx.oncomplete = () => { d.close(); res(); };
          tx.onerror   = () => { d.close(); res(); };
        } catch(err){ d.close(); res(); }
      };
    });
  });
}

(async () => {
  log('Launching Chromium...');
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  const pageErrors = [];
  p.on('pageerror', e => pageErrors.push(e.message));

  await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(5500);
  // Ensure no operator is logged in for the audit scenarios
  await p.evaluate(() => { if(window._acimLogout) return window._acimLogout(); });

  // ============================================================
  // 1. AJUSTEMENT POSITIF — restock +5
  // ============================================================
  log('TEST 1: positive stock adjustment (restock +5)');
  try {
    const bc = 'AUDIT-C-ADJ-POS';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'AdjPos', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.RESTOCK);
    }, { bc, delta: 5 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-ADJ-POS');
      const adjEvents = await A.getByType("STOCK_ADJUSTED");
      return {
        stock: product ? product.stockQty : null,
        adjCount: adjEvents.length,
        ev: adjEvents[0] || null
      };
    });
    await shot(p, 'audit-c-01-positif');
    await ok('adjustStock returned ok=true (got ' + r.ok + ')', r.ok === true, JSON.stringify(r));
    await ok('Product stock 10→15 (got ' + probe.stock + ')', probe.stock === 15, JSON.stringify(probe));
    await ok('1 STOCK_ADJUSTED event (got ' + probe.adjCount + ')', probe.adjCount === 1, JSON.stringify(probe));
    await ok('Event previousState.stockQty = 10', probe.ev && probe.ev.previousState && probe.ev.previousState.stockQty === 10, JSON.stringify(probe.ev));
    await ok('Event newState.stockQty = 15', probe.ev && probe.ev.newState && probe.ev.newState.stockQty === 15, JSON.stringify(probe.ev));
    await ok('Event payload.delta = 5', probe.ev && probe.ev.payload && probe.ev.payload.delta === 5, JSON.stringify(probe.ev));
    await ok('Event payload.reason = "restock"', probe.ev && probe.ev.payload && probe.ev.payload.reason === "restock", JSON.stringify(probe.ev));
    await ok('Event entityId = barcode', probe.ev && probe.ev.entityId === bc, JSON.stringify(probe.ev));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Positive adjustment', false, String(e.message || e));
  }

  // ============================================================
  // 1b. REFUS DOUBLON createUser — même id ⇒ error "id-exists"
  // ============================================================
  log('TEST 1b: createUser rejects duplicate id');
  try {
    await clearUsers(p);
    const first = await p.evaluate(async (args) => {
      return await window._acimTest.createUser(args.id, args.pin, args.name, args.role);
    }, { id: 'dup001', pin: '1111', name: 'Dup', role: 'cashier' });
    await ok('First createUser ok=true (got ' + first.ok + ')', first.ok === true, JSON.stringify(first));

    const second = await p.evaluate(async (args) => {
      return await window._acimTest.createUser(args.id, args.pin2, args.name2, args.role);
    }, { id: 'dup001', pin2: '2222', name2: 'Dup2', role: 'manager' });
    await ok('Second createUser ok=false (got ' + second.ok + ')', second.ok === false, JSON.stringify(second));
    await ok('Second createUser error = "id-exists" (got ' + second.error + ')', second.error === "id-exists", JSON.stringify(second));

    // Verify the stored user is still the first one (name "Dup", not "Dup2")
    const stored = await p.evaluate(async (id) => {
      return await new Promise(res => {
        const r = indexedDB.open("acim", 3);
        r.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("users","readonly");
          const rq = tx.objectStore("users").get(id);
          rq.onsuccess = () => { d.close(); res(rq.result || null); };
          rq.onerror = () => { d.close(); res(null); };
          };
        });
    }, 'dup001');
    await ok('Original user preserved (name="Dup")', !!stored && stored.name === "Dup", JSON.stringify(stored));

    await clearUsers(p);
  } catch (e) {
    await ok('Duplicate id rejection', false, String(e.message || e));
  }

  // ============================================================
  // 2. AJUSTEMENT NÉGATIF — loss -3
  // ============================================================
  log('TEST 2: negative stock adjustment (loss -3)');
  try {
    const bc = 'AUDIT-C-ADJ-NEG';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'AdjNeg', sale_price_cents: 200, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.LOSS);
    }, { bc, delta: -3 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-ADJ-NEG');
      const adjEvents = await A.getByType("STOCK_ADJUSTED");
      return { stock: product ? product.stockQty : null, ev: adjEvents[0] || null };
    });
    await shot(p, 'audit-c-02-negatif');
    await ok('adjustStock returned ok=true', r.ok === true, JSON.stringify(r));
    await ok('Product stock 10→7 (got ' + probe.stock + ')', probe.stock === 7, JSON.stringify(probe));
    await ok('Event payload.delta = -3', probe.ev && probe.ev.payload && probe.ev.payload.delta === -3, JSON.stringify(probe.ev));
    await ok('Event payload.reason = "loss"', probe.ev && probe.ev.payload && probe.ev.payload.reason === "loss", JSON.stringify(probe.ev));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Negative adjustment', false, String(e.message || e));
  }

  // ============================================================
  // 3. PRODUIT PESÉ (kg)
  // ============================================================
  log('TEST 3: kg product adjustment (+0.5)');
  try {
    const bc = 'AUDIT-C-ADJ-KG';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'AdjKg', sale_price_cents: 0, category: 'viande', stockQty: 2.5, unit: 'kg', unitType: 'kg', pricePerUnit: 1500, source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.RESTOCK);
    }, { bc, delta: 0.5 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-ADJ-KG');
      const ev = (await A.getByType("STOCK_ADJUSTED"))[0] || null;
      return { stock: product ? product.stockQty : null, ev };
    });
    await shot(p, 'audit-c-03-kg');
    await ok('adjustStock returned ok=true', r.ok === true, JSON.stringify(r));
    await ok('Stock 2.5→3.0 (got ' + probe.stock + ')', probe.stock !== null && Math.abs(probe.stock - 3.0) < 0.001, JSON.stringify(probe));
    await ok('Event payload.delta = 0.5', probe.ev && probe.ev.payload && Math.abs(probe.ev.payload.delta - 0.5) < 0.001, JSON.stringify(probe.ev));
    await ok('Event previousState.stockQty = 2.5', probe.ev && probe.ev.previousState && Math.abs(probe.ev.previousState.stockQty - 2.5) < 0.001, JSON.stringify(probe.ev));
    await ok('Event newState.stockQty = 3.0', probe.ev && probe.ev.newState && Math.abs(probe.ev.newState.stockQty - 3.0) < 0.001, JSON.stringify(probe.ev));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Kg adjustment', false, String(e.message || e));
  }

  // ============================================================
  // 4. STOCK NÉGATIF — ajustement impossible
  // ============================================================
  log('TEST 4: insufficient stock aborts adjustment');
  try {
    const bc = 'AUDIT-C-ADJ-NOGO';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'AdjNogo', sale_price_cents: 50, category: 'autre', stockQty: 2, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.LOSS);
    }, { bc, delta: -5 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-ADJ-NOGO');
      return { stock: product ? product.stockQty : null, adjCount: (await A.getByType("STOCK_ADJUSTED")).length };
    });
    await shot(p, 'audit-c-04-nogo');
    await ok('adjustStock returned ok=false', r.ok === false, JSON.stringify(r));
    await ok('adjustStock reason starts with "stock" (got ' + r.reason + ')', typeof r.reason === "string" && r.reason.indexOf("stock") === 0, JSON.stringify(r));
    await ok('Product stock unchanged 2 (got ' + probe.stock + ')', probe.stock === 2, JSON.stringify(probe));
    await ok('0 STOCK_ADJUSTED event (got ' + probe.adjCount + ')', probe.adjCount === 0, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Insufficient stock adjustment', false, String(e.message || e));
  }

  // ============================================================
  // 5. ROLLBACK AUDIT — logInTx throw → TX aborte
  // ============================================================
  log('TEST 5: audit failure aborts adjustment TX');
  try {
    const bc = 'AUDIT-C-ADJ-RB';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'AdjRb', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    // Monkey-patch logInTx to throw on STOCK_ADJUSTED
    await p.evaluate(() => {
      const A = window._acimAudit;
      A._origLogInTx = A.logInTx;
      A.logInTx = function(tx, partial) {
        if (partial.type === "STOCK_ADJUSTED") throw new Error("Simulated audit failure on STOCK_ADJUSTED");
        return A._origLogInTx.call(this, tx, partial);
      };
    });
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.RESTOCK);
    }, { bc, delta: 5 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-ADJ-RB');
      return { stock: product ? product.stockQty : null, adjCount: (await A.getByType("STOCK_ADJUSTED")).length };
    });
    // Restore monkey-patch
    await p.evaluate(() => {
      const A = window._acimAudit;
      if (A._origLogInTx) { A.logInTx = A._origLogInTx; delete A._origLogInTx; }
    });
    await shot(p, 'audit-c-05-rollback');
    await ok('adjustStock returned ok=false (audit-error)', r.ok === false && r.reason === "audit-error", JSON.stringify(r));
    await ok('Stock unchanged 10 (got ' + probe.stock + ')', probe.stock === 10, JSON.stringify(probe));
    await ok('0 STOCK_ADJUSTED event (got ' + probe.adjCount + ')', probe.adjCount === 0, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Rollback audit', false, String(e.message || e));
  }

  // ============================================================
  // 6. ACTOR ALIMENTÉ APRÈS LOGIN
  // ============================================================
  log('TEST 6: actorId populated after PIN login');
  try {
    // Ensure clean state
    await clearUsers(p);
    await clearSessionMeta(p);
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); });

    const createRes = await p.evaluate(async (args) => {
      return await window._acimTest.createUser(args.id, args.pin, args.name, args.role);
    }, { id: 'u001', pin: '1234', name: 'Alice', role: 'cashier' });
    await ok('createUser ok=true (got ' + createRes.ok + ')', createRes.ok === true, JSON.stringify(createRes));

    // PR C invariant #1: user record holds salt + pinHash (base64, distinct)
    const stored = await p.evaluate(async (id) => {
      return await new Promise(res => {
        const r = indexedDB.open("acim", 3);
        r.onsuccess = (e) => {
          const d = e.target.result;
          if(!d.objectStoreNames.contains("users")){ d.close(); res(null); return; }
          const tx = d.transaction("users","readonly");
          const rq = tx.objectStore("users").get(id);
          rq.onsuccess = () => { d.close(); res(rq.result || null); };
          rq.onerror = () => { d.close(); res(null); };
        };
      });
    }, 'u001');
    await ok('Stored user has salt (base64)', !!stored && typeof stored.salt === "string" && /^[A-Za-z0-9+/]{16,}={0,2}$/.test(stored.salt), JSON.stringify(stored));
    await ok('Stored user has pinHash (base64)', !!stored && typeof stored.pinHash === "string" && /^[A-Za-z0-9+/]{32,}={0,2}$/.test(stored.pinHash), JSON.stringify(stored));
    await ok('Stored user salt != pinHash', !!stored && stored.salt !== stored.pinHash, JSON.stringify(stored));
    await ok('Stored user active=true', !!stored && stored.active === true, JSON.stringify(stored));
    await ok('Stored user role="cashier"', !!stored && stored.role === "cashier", JSON.stringify(stored));

    const loginRes = await p.evaluate(() => window._acimTest.loginWithPin('1234'));
    await ok('loginWithPin ok=true (got ' + loginRes.ok + ')', loginRes.ok === true, JSON.stringify(loginRes));
    await ok('loginWithPin actor.id = "u001"', loginRes.actor && loginRes.actor.id === 'u001', JSON.stringify(loginRes));
    await ok('loginWithPin actor.name = "Alice"', loginRes.actor && loginRes.actor.name === 'Alice', JSON.stringify(loginRes));

    // Create a product and adjust stock — the emitted event must carry actorId="u001"
    const bc = 'AUDIT-C-ACTOR-ALICE';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'ActorAlice', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    await p.evaluate(async (args) => {
      const T = window._acimTest;
      await T.adjustStock(args.bc, 5, T.STOCK_ADJUST_REASON.RESTOCK);
    }, { bc });
    const probe = await p.evaluate(async () => {
      const ev = (await window._acimAudit.getByType("STOCK_ADJUSTED"))[0] || null;
      return { actorId: ev ? ev.actorId : null };
    });
    await shot(p, 'audit-c-06-actor');
    await ok('Event actorId = "u001" (got ' + probe.actorId + ')', probe.actorId === 'u001', JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
    // Cleanup user
    await p.evaluate(() => window._acimTest.logout());
    await clearUsers(p);
    await clearSessionMeta(p);
  } catch (e) {
    await ok('Actor populated after login', false, String(e.message || e));
  }

  // ============================================================
  // 6b. LOGIN INVALIDE — mauvais PIN ⇒ {ok:false, error:"no-match"}
  // ============================================================
  log('TEST 6b: loginWithPin rejects wrong PIN');
  try {
    await clearUsers(p);
    await clearSessionMeta(p);
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); });

    await p.evaluate(async (args) => {
      return await window._acimTest.createUser(args.id, args.pin, args.name, args.role);
    }, { id: 'u_wpin', pin: '1234', name: 'Wpin', role: 'cashier' });

    // Pin format-invalid (3 digits) → pin-invalid (validated before DB access)
    const r1 = await p.evaluate(() => window._acimTest.loginWithPin('123'));
    await ok('loginWithPin 3-digit pin → ok=false (got ' + r1.ok + ')', r1.ok === false, JSON.stringify(r1));
    await ok('loginWithPin 3-digit pin → error="pin-invalid" (got ' + r1.error + ')', r1.error === "pin-invalid", JSON.stringify(r1));

    // Pin format-valid but no match in DB
    const r2 = await p.evaluate(() => window._acimTest.loginWithPin('9999'));
    await ok('loginWithPin wrong PIN 4-digit → ok=false (got ' + r2.ok + ')', r2.ok === false, JSON.stringify(r2));
    await ok('loginWithPin wrong PIN 4-digit → error="no-match" (got ' + r2.error + ')', r2.error === "no-match", JSON.stringify(r2));

    // Verify no actor was populated
    const a = await p.evaluate(async () => await window._acimTest.getCurrentActorAsync());
    await ok('Wrong PIN does not populate actor (got ' + JSON.stringify(a) + ')', a === null, JSON.stringify(a));

    // Verify no session meta was written
    const sessionMeta = await p.evaluate(async () => {
      return await new Promise(res => {
        const r = indexedDB.open("acim", 3);
        r.onsuccess = (e) => {
          const d = e.target.result;
          try {
            const tx = d.transaction("meta","readonly");
            const rq = tx.objectStore("meta").get(window._acimTest.USER_META_KEY);
            rq.onsuccess = () => { d.close(); res(rq.result || null); };
            rq.onerror   = () => { d.close(); res(null); };
          } catch(err){ d.close(); res(null); }
        };
      });
    });
    await ok('Wrong PIN does not persist session meta', sessionMeta === null, JSON.stringify(sessionMeta));

    await clearUsers(p);
    await clearSessionMeta(p);
  } catch (e) {
    await ok('Wrong PIN rejection', false, String(e.message || e));
  }

  // ============================================================
  // 7. ACTOR NULL HORS LOGIN
  // ============================================================
  log('TEST 7: actorId null when not logged in');
  try {
    await clearUsers(p);
    await clearSessionMeta(p);
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); });

    const bc = 'AUDIT-C-ACTOR-NULL';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'ActorNull', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    await p.evaluate(async (args) => {
      const T = window._acimTest;
      await T.adjustStock(args.bc, 5, T.STOCK_ADJUST_REASON.RESTOCK);
    }, { bc });
    const probe = await p.evaluate(async () => {
      const ev = (await window._acimAudit.getByType("STOCK_ADJUSTED"))[0] || null;
      return { actorId: ev ? ev.actorId : 'NO_EVENT' };
    });
    await shot(p, 'audit-c-07-null');
    await ok('Event actorId = null (got ' + probe.actorId + ')', probe.actorId === null, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Actor null when not logged in', false, String(e.message || e));
  }

  // ============================================================
  // 7b. RESTAURATION DE SESSION — reload → _restoreSessionIfAny()
  // PR C invariant #5: trust local meta; survive full page reload without re-login.
  // We intentionally force a real reload so the in-memory actor cache is wiped.
  // ============================================================
  log('TEST 7b: session restored after page.reload()');
  try {
    await clearUsers(p);
    await clearSessionMeta(p);
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); });

    await p.evaluate(async (args) => {
      return await window._acimTest.createUser(args.id, args.pin, args.name, args.role);
    }, { id: 'u_persist', pin: '4321', name: 'Persist', role: 'manager' });

    const loginRes = await p.evaluate(async () => await window._acimTest.loginWithPin('4321'));
    await ok('Pre-reload login ok=true (got ' + loginRes.ok + ')', loginRes.ok === true, JSON.stringify(loginRes));

    // Confirm session meta was persisted (trust local)
    const metaBefore = await p.evaluate(async () => {
      return await new Promise(res => {
        const r = indexedDB.open("acim", 3);
        r.onsuccess = (e) => {
          const d = e.target.result;
          const tx = d.transaction("meta","readonly");
          const rq = tx.objectStore("meta").get(window._acimTest.USER_META_KEY);
          rq.onsuccess = () => { d.close(); res(rq.result || null); };
          rq.onerror   = () => { d.close(); res(null); };
        };
      });
    });
    await ok('Session meta persisted pre-reload (value="u_persist")', !!metaBefore && metaBefore.value === "u_persist", JSON.stringify(metaBefore));

    // Wipe in-memory actor cache via reload; init() → _restoreSessionIfAny()
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);

    // After reload + init, actor should be {id:"u_persist", name:"Persist", role:"manager"}
    const restored = await p.evaluate(async () => await window._acimTest.getCurrentActorAsync());
    await shot(p, 'audit-c-07b-restored');
    await ok('Restored actor id="u_persist" (got ' + (restored && restored.id) + ')', !!restored && restored.id === "u_persist", JSON.stringify(restored));
    await ok('Restored actor name="Persist"', !!restored && restored.name === "Persist", JSON.stringify(restored));
    await ok('Restored actor role="manager"', !!restored && restored.role === "manager", JSON.stringify(restored));

    // Sanity: emitting an audit event post-restore carries actorId="u_persist"
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); }); // simulate fresh session
    await p.evaluate(async () => { return await window._acimTest.restoreSessionIfAny(); });
    const restoredAgain = await p.evaluate(async () => await window._acimTest.getCurrentActorAsync());
    await ok('restoreSessionIfAny() repopulates actor', !!restoredAgain && restoredAgain.id === "u_persist", JSON.stringify(restoredAgain));

    await p.evaluate(async () => await window._acimTest.logout());
    await clearUsers(p);
    await clearSessionMeta(p);
  } catch (e) {
    await ok('Session restore after reload', false, String(e.message || e));
  }

  // ============================================================
  // 8. PLUSIEURS EMPLOYÉS SUCCESSIFS
  // ============================================================
  log('TEST 8: multiple successive operators');
  try {
    await clearUsers(p);
    await clearSessionMeta(p);
    await p.evaluate(() => { if(window._acimAudit) window._acimAudit.setActor(null); });

    await p.evaluate(async (args) => { return await window._acimTest.createUser(args.id, args.pin, args.name, args.role); }, { id: 'u001', pin: '1111', name: 'Alice', role: 'cashier' });
    await p.evaluate(async (args) => { return await window._acimTest.createUser(args.id, args.pin, args.name, args.role); }, { id: 'u002', pin: '2222', name: 'Bob',   role: 'cashier' });

    const bc = 'AUDIT-C-MULTI-ACTOR';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'Multi', sale_price_cents: 100, category: 'autre', stockQty: 100, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);

    // Alice adjusts
    await p.evaluate(() => window._acimTest.loginWithPin('1111'));
    await p.evaluate(async (args) => { await window._acimTest.adjustStock(args.bc, 1, window._acimTest.STOCK_ADJUST_REASON.RESTOCK); }, { bc });
    await p.evaluate(() => window._acimTest.logout());

    // Bob adjusts
    await p.evaluate(() => window._acimTest.loginWithPin('2222'));
    await p.evaluate(async (args) => { await window._acimTest.adjustStock(args.bc, 1, window._acimTest.STOCK_ADJUST_REASON.RESTOCK); }, { bc });
    await p.evaluate(() => window._acimTest.logout());

    const probe = await p.evaluate(async () => {
      const events = await window._acimAudit.getByType("STOCK_ADJUSTED");
      return {
        count: events.length,
        firstActor: events[0] ? events[0].actorId : null,
        secondActor: events[1] ? events[1].actorId : null
      };
    });
    await shot(p, 'audit-c-08-multi');
    await ok('2 STOCK_ADJUSTED events (got ' + probe.count + ')', probe.count === 2, JSON.stringify(probe));
    await ok('First event actorId = "u001" (Alice)', probe.firstActor === 'u001', JSON.stringify(probe));
    await ok('Second event actorId = "u002" (Bob)', probe.secondActor === 'u002', JSON.stringify(probe));

    // Logout → next event should be actorId=null
    await p.evaluate(async (args) => { await window._acimTest.adjustStock(args.bc, 1, window._acimTest.STOCK_ADJUST_REASON.RESTOCK); }, { bc });
    const finalProbe = await p.evaluate(async () => {
      const events = await window._acimAudit.getByType("STOCK_ADJUSTED");
      return { lastActor: events[events.length-1] ? events[events.length-1].actorId : null };
    });
    await ok('After logout, event actorId = null (got ' + finalProbe.lastActor + ')', finalProbe.lastActor === null, JSON.stringify(finalProbe));

    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
    await clearUsers(p);
    await clearSessionMeta(p);
  } catch (e) {
    await ok('Multiple operators', false, String(e.message || e));
  }

  // ============================================================
  // 8b. STOCK EXTRÊME — delta -9999 sur stock=10 ⇒ refus sans écriture
  // PR C invariant #8: refuse inifinitely-large delta atomically.
  // Validates that _adjustStock doesn't write a partial/audit event
  // even for absurd deltas, just like Test 4 (regular insufficient).
  // ============================================================
  log('TEST 8b: extreme delta -9999 aborts atomically');
  try {
    const bc = 'AUDIT-C-EXTREME';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'Extreme', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    await clearAudit(p);
    const r = await p.evaluate(async (args) => {
      const T = window._acimTest;
      return await T.adjustStock(args.bc, args.delta, T.STOCK_ADJUST_REASON.LOSS);
    }, { bc, delta: -9999 });
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-C-EXTREME');
      return { stock: product ? product.stockQty : null, adjCount: (await A.getByType("STOCK_ADJUSTED")).length };
    });
    await shot(p, 'audit-c-08b-extreme');
    await ok('Extreme delta returns ok=false', r.ok === false, JSON.stringify(r));
    await ok('Extreme delta reason starts with "stock" (got ' + r.reason + ')', typeof r.reason === "string" && r.reason.indexOf("stock") === 0, JSON.stringify(r));
    await ok('Stock unchanged at 10 (got ' + probe.stock + ')', probe.stock === 10, JSON.stringify(probe));
    await ok('0 STOCK_ADJUSTED event (got ' + probe.adjCount + ')', probe.adjCount === 0, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Extreme delta aborts', false, String(e.message || e));
  }

  // ============================================================
  // 8c. BONUS — _hashPin non-déterministe (salts aléatoires)
  // Validates that calling _hashPin twice with the same pin produces
  // different salts and therefore different pinHash values.
  // ============================================================
  log('TEST 8c: _hashPin is non-deterministic (random salt per call)');
  try {
    const hashes = await p.evaluate(async () => {
      const a = await window._acimTest.hashPin('1234');
      const b = await window._acimTest.hashPin('1234');
      return { a, b };
    });
    const { a, b } = hashes;
    await ok('hash#1.salt is base64 (got ' + (a && a.salt ? a.salt.slice(0,8)+'...' : 'null') + ')', !!a && typeof a.salt === "string" && a.salt.length >= 16, JSON.stringify(a));
    await ok('hash#2.salt is base64', !!b && typeof b.salt === "string" && b.salt.length >= 16, JSON.stringify(b));
    await ok('hash#1.pinHash is base64 (got ' + (a && a.pinHash ? a.pinHash.slice(0,8)+'...' : 'null') + ')', !!a && typeof a.pinHash === "string" && a.pinHash.length >= 32, JSON.stringify(a));
    await ok('hash#2.pinHash is base64', !!b && typeof b.pinHash === "string" && b.pinHash.length >= 32, JSON.stringify(b));
    await ok('Two salts differ (non-deterministic)', a.salt !== b.salt, JSON.stringify({sa:a.salt, sb:b.salt}));
    await ok('Two pinHashes differ (non-deterministic)', a.pinHash !== b.pinHash, JSON.stringify({ha:a.pinHash, hb:b.pinHash}));
  } catch (e) {
    await ok('_hashPin non-determinism', false, String(e.message || e));
  }

  // ============================================================
  // 8d. BONUS — _verifyPin true/false indépendamment du stockage
  // Validates the pair _hashPin/_verifyPin against a fresh pin record.
  // ============================================================
  log('TEST 8d: _verifyPin accepts correct PIN, rejects wrong PIN');
  try {
    const verdict = await p.evaluate(async () => {
      const T = window._acimTest;
      const h = await T.hashPin('1234');
      const trueMatch = await T.verifyPin('1234', h.salt, h.pinHash);
      const falseMatch = await T.verifyPin('5678', h.salt, h.pinHash);
      // Garbage salt should not throw — must resolve false
      const garbage = await T.verifyPin('1234', '!!!garbage!!!', h.pinHash).catch(() => 'threw');
      return { salt: h.salt, trueMatch, falseMatch, garbage };
    });
    await ok('verifyPin("1234", correct salt) → true', verdict.trueMatch === true, JSON.stringify(verdict));
    await ok('verifyPin("5678", correct salt) → false', verdict.falseMatch === false, JSON.stringify(verdict));
    await ok('verifyPin with garbage salt → false (no throw)', verdict.garbage === false, JSON.stringify(verdict));
  } catch (e) {
    await ok('_verifyPin true/false pair', false, String(e.message || e));
  }

  // ============================================================
  // 9. PAGEERROR check
  // ============================================================
  log('TEST 9: PAGEERROR check');
  await ok('No PAGEERROR exceptions (' + pageErrors.length + ')', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await b.close();
  log('==========================================');
  log('AUDIT PR C RESULTS: ' + R.pass + ' pass, ' + R.fail + ' fail, ' + R.shots + ' screenshots');
  if (R.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
