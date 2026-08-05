// tests/run-e2e-audit-b.js — Sprint 4.1 PR B tests.
// Validates: unei-transactional audit emission for _finalizeSale and _undoLastSale.
// 5 scenarios: nominal sale, audit rollback, 5 sales+5 undo, kg chain, insufficient stock.
// Plus: NON-regression on Sprint 4.0 + PAGEERROR.
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
}

// Fetch a single product document fresh from DB.
async function getProduct(p, bc){
  return await p.evaluate(async (bc) => {
    const T = window._acimTest;
    return await T.dbGet(bc);
  }, bc);
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

  // ============================================================
  // 1. TEST NOMINAL — checkout emits SALE_COMPLETED + STOCK_DECREMENT
  // ============================================================
  log('TEST 1: nominal checkout emits SALE_COMPLETED + STOCK_DECREMENT');
  try {
    const bc = 'AUDIT-B-SMOKE-A';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'SmokeB', sale_price_cents: 240, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
      T.clearCart();
    }, bc);
    await clearAudit(p);
    // Scan + checkout
    await p.evaluate((bc) => {
      window._acimProcessBarcode(bc);
    }, bc);
    await p.waitForTimeout(1500);
    const cartTotal = await p.evaluate(() => window._acimTest.cartTotal());
    const finalizeRes = await p.evaluate(async (t) => {
      await window._acimTest.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
      return await new Promise(r => setTimeout(() => r('ok'), 1300));
    }, cartTotal);
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const saleEvents = await A.getByType("SALE_COMPLETED");
      const decEvents = await A.getByType("STOCK_DECREMENT");
      const product = await window._acimTest.dbGet('AUDIT-B-SMOKE-A');
      return {
        saleCompletedCount: saleEvents.length,
        decCount: decEvents.length,
        saleEvent: saleEvents[0] || null,
        decEvent: decEvents[0] || null,
        productStock: product ? product.stockQty : null
      };
    });
    await shot(p, 'audit-b-01-nominal');
    await ok('Sale emitted SALE_COMPLETED (got ' + probe.saleCompletedCount + ')', probe.saleCompletedCount === 1, JSON.stringify({sale: probe.saleEvent}));
    await ok('Sale emitted STOCK_DECREMENT (got ' + probe.decCount + ')', probe.decCount === 1, JSON.stringify({dec: probe.decEvent}));
    await ok('SALE_COMPLETED.entityId = ticketNumber', probe.saleEvent && probe.saleEvent.entityId && probe.saleEvent.entityId.length > 0, 'entityId='+(probe.saleEvent&&probe.saleEvent.entityId));
    await ok('SALE_COMPLETED.payload.totalCents = 240', probe.saleEvent && probe.saleEvent.payload && probe.saleEvent.payload.totalCents === 240, JSON.stringify(probe.saleEvent&&probe.saleEvent.payload));
    await ok('SALE_COMPLETED.payload.paymentMethods = ["cb"]', probe.saleEvent && probe.saleEvent.payload && JSON.stringify(probe.saleEvent.payload.paymentMethods) === '["cb"]', JSON.stringify(probe.saleEvent&&probe.saleEvent.payload&&probe.saleEvent.payload.paymentMethods));
    await ok('STOCK_DECREMENT.previousState.stockQty = 10', probe.decEvent && probe.decEvent.previousState && probe.decEvent.previousState.stockQty === 10, JSON.stringify(probe.decEvent&&probe.decEvent.previousState));
    await ok('STOCK_DECREMENT.newState.stockQty = 9', probe.decEvent && probe.decEvent.newState && probe.decEvent.newState.stockQty === 9, JSON.stringify(probe.decEvent&&probe.decEvent.newState));
    await ok('Product final stock = 9 (got ' + probe.productStock + ')', probe.productStock === 9, String(probe.productStock));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Nominal checkout audit', false, String(e.message || e));
  }

  // ============================================================
  // 2. ROLLBACK AUDIT — if logInTx throws, TX aborts → no sale, no stock mutation
  // ============================================================
  log('TEST 2: audit failure aborts entire TX (no partial mutation)');
  try {
    const bc = 'AUDIT-B-ROLLBACK-A';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'RollbackB', sale_price_cents: 100, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
      T.clearCart();
    }, bc);
    await clearAudit(p);
    // Monkey-patch logInTx to throw on the SALE_COMPLETED call (after STOCK_DECREMENT).
    await p.evaluate(() => {
      const A = window._acimAudit;
      const orig = A.logInTx;
      A._origLogInTx = orig;
      A.logInTx = function(tx, partial) {
        if (partial.type === "SALE_COMPLETED") {
          throw new Error("Simulated audit failure on SALE_COMPLETED");
        }
        return orig.call(this, tx, partial);
      };
    });
    await p.evaluate((bc) => {
      window._acimProcessBarcode(bc);
    }, bc);
    await p.waitForTimeout(1500);
    const cartTotal = await p.evaluate(() => window._acimTest.cartTotal());
    // This finalize should abort because SALE_COMPLETED audit throws.
    try {
      await p.evaluate(async (t) => {
        await window._acimTest.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
      }, cartTotal);
      await p.waitForTimeout(1500);
    } catch (e) { /* ignored: TX abort is not a page-level throw, it's a silent tx.onabort */ }
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const saleEvents = await A.getByType("SALE_COMPLETED");
      const decEvents = await A.getByType("STOCK_DECREMENT");
      const product = await window._acimTest.dbGet('AUDIT-B-ROLLBACK-A');
      return { sale: saleEvents.length, dec: decEvents.length, stock: product ? product.stockQty : null };
    });
    // Restore monkey-patch
    await p.evaluate(() => {
      const A = window._acimAudit;
      if (A._origLogInTx) { A.logInTx = A._origLogInTx; delete A._origLogInTx; }
    });
    await shot(p, 'audit-b-02-rollback');
    await ok('SALE_COMPLETED NOT persisted after audit failure (got ' + probe.sale + ')', probe.sale === 0, JSON.stringify(probe));
    await ok('STOCK_DECREMENT NOT persisted after audit failure (got ' + probe.dec + ')', probe.dec === 0, JSON.stringify(probe));
    await ok('Stock unchanged at 10 (got ' + probe.stock + ')', probe.stock === 10, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Audit rollback on failure', false, String(e.message || e));
  }

  // ============================================================
  // 3. 5 SALES + 5 UNDOS — Sprint 4.0 invariant + audit counts
  // ============================================================
  log('TEST 3: 5 sales + 5 undos with audit');
  try {
    const bc = 'AUDIT-B-UNDO5-X';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'Undo5B', sale_price_cents: 200, category: 'autre', stockQty: 50, unit: 'unit', source: 'test', last_updated: Date.now() });
      T.clearCart();
    }, bc);
    await clearAudit(p);
    for (let i = 0; i < 5; i++) {
      await p.evaluate((bc) => { window._acimProcessBarcode(bc); }, bc);
      await p.waitForTimeout(700);
      const t = await p.evaluate(() => window._acimTest.cartTotal());
      await p.evaluate(async (t) => {
        await window._acimTest.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
      }, t);
      await p.waitForTimeout(900);
      // Undo programmatically — _undoLastSale shows modal, we use the internal
      // atomic executor to bypass UI confirmation.
      await p.evaluate(async () => {
        const db = await window._acimTest.openDB();
        // re-fetch last sale
        const sale = await new Promise(res => {
          const tx = db.transaction("sales","readonly");
          const r = tx.objectStore("sales").openCursor(null,"prev");
          r.onsuccess = (e) => { const c = r.result; res(c ? c.value : null); };
          r.onerror = () => res(null);
        });
        if (!sale) return;
        await new Promise(res => {
          window._acimTest.executeUndoSaleAtomic(db, sale, res);
        });
      });
      await p.waitForTimeout(800);
    }
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-B-UNDO5-X');
      return {
        stock: product ? product.stockQty : null,
        sales: (await A.getByType("SALE_COMPLETED")).length,
        decs: (await A.getByType("STOCK_DECREMENT")).length,
        cancels: (await A.getByType("SALE_CANCELLED")).length,
        incs: (await A.getByType("STOCK_INCREMENT")).length
      };
    });
    await shot(p, 'audit-b-03-undo5');
    await ok('Stock back to 50 (got ' + probe.stock + ')', probe.stock === 50, JSON.stringify(probe));
    await ok('SALE_COMPLETED = 5 (got ' + probe.sales + ')', probe.sales === 5, JSON.stringify(probe));
    await ok('STOCK_DECREMENT = 5 (got ' + probe.decs + ')', probe.decs === 5, JSON.stringify(probe));
    await ok('SALE_CANCELLED = 5 (got ' + probe.cancels + ')', probe.cancels === 5, JSON.stringify(probe));
    await ok('STOCK_INCREMENT = 5 (got ' + probe.incs + ')', probe.incs === 5, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('5 sales + 5 undo audit', false, String(e.message || e));
  }

  // ============================================================
  // 4. KG PRODUCTS — weight-aware STOCK_DECREMENT per item
  // ============================================================
  log('TEST 4: kg checkout emits STOCK_DECREMENT with weight');
  try {
    await p.evaluate(async () => {
      const T = window._acimTest;
      await T.dbPut({ barcode: 'AUDIT-B-KG-A', name: 'ChevreB', sale_price_cents: 0, category: 'viande', stockQty: 10, unit: 'kg', unitType: 'kg', pricePerUnit: 1500, source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'AUDIT-B-KG-B', name: 'PouletB', sale_price_cents: 0, category: 'volaille', stockQty: 20, unit: 'kg', unitType: 'kg', pricePerUnit: 899, source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'AUDIT-B-KG-C', name: 'BoeufB', sale_price_cents: 0, category: 'viande', stockQty: 30, unit: 'kg', unitType: 'kg', pricePerUnit: 2200, source: 'test', last_updated: Date.now() });
      T.clearCart();
    });
    await clearAudit(p);
    // Add 3 kg products with weights via direct addToCart
    await p.evaluate(async () => {
      const T = window._acimTest;
      T.addToCart('ChevreB 0,500 kg', 750, 'AUDIT-B-KG-A', 'viande', 0.5, 'kg', 1500);
      T.addToCart('PouletB 2,300 kg', 2067.7, 'AUDIT-B-KG-B', 'volaille', 2.3, 'kg', 899);
      T.addToCart('BoeufB 1,700 kg', 3740, 'AUDIT-B-KG-C', 'viande', 1.7, 'kg', 2200);
    });
    await p.waitForTimeout(700);
    const cartTotal = await p.evaluate(() => window._acimTest.cartTotal());
    await p.evaluate(async (t) => {
      await window._acimTest.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
    }, cartTotal);
    await p.waitForTimeout(1500);
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const decs = await A.getByType("STOCK_DECREMENT");
      const sales = await A.getByType("SALE_COMPLETED");
      const A_p = await window._acimTest.dbGet('AUDIT-B-KG-A');
      const B_p = await window._acimTest.dbGet('AUDIT-B-KG-B');
      const C_p = await window._acimTest.dbGet('AUDIT-B-KG-C');
      return {
        decCount: decs.length,
        saleCount: sales.length,
        amounts: decs.map(d => d.payload.amount),
        barcodes: decs.map(d => d.entityId),
        stockA: A_p && A_p.stockQty,
        stockB: B_p && B_p.stockQty,
        stockC: C_p && C_p.stockQty
      };
    });
    await shot(p, 'audit-b-04-kg');
    await ok('3 STOCK_DECREMENT events (got ' + probe.decCount + ')', probe.decCount === 3, JSON.stringify(probe));
    await ok('1 SALE_COMPLETED (got ' + probe.saleCount + ')', probe.saleCount === 1, JSON.stringify(probe));
    await ok('STOCK_DECREMENT amounts include 0.5 (got ' + probe.amounts + ')', probe.amounts.includes(0.5), JSON.stringify(probe.amounts));
    await ok('STOCK_DECREMENT amounts include 2.3 (got ' + probe.amounts + ')', probe.amounts.includes(2.3), JSON.stringify(probe.amounts));
    await ok('STOCK_DECREMENT amounts include 1.7 (got ' + probe.amounts + ')', probe.amounts.includes(1.7), JSON.stringify(probe.amounts));
    await ok('Stock A = 9.5 (got ' + probe.stockA + ')', Math.abs((probe.stockA || 0) - 9.5) < 0.001, JSON.stringify(probe));
    await ok('Stock B = 17.7 (got ' + probe.stockB + ')', Math.abs((probe.stockB || 0) - 17.7) < 0.001, JSON.stringify(probe));
    await ok('Stock C = 28.3 (got ' + probe.stockC + ')', Math.abs((probe.stockC || 0) - 28.3) < 0.001, JSON.stringify(probe));
    await p.evaluate(async () => {
      await window._acimTest.dbDelete('AUDIT-B-KG-A');
      await window._acimTest.dbDelete('AUDIT-B-KG-B');
      await window._acimTest.dbDelete('AUDIT-B-KG-C');
    });
  } catch (e) {
    await ok('KG audit chain', false, String(e.message || e));
  }

  // ============================================================
  // 5. INSUFFICIENT STOCK — checkout aborts, NO audit emitted, stock unchanged
  // ============================================================
  log('TEST 5: insufficient stock aborts TX → no audit, no mutation');
  try {
    const bc = 'AUDIT-B-NOSTOCK-A';
    await p.evaluate(async (bc) => {
      const T = window._acimTest;
      await T.dbPut({ barcode: bc, name: 'NoStockB', sale_price_cents: 50, category: 'autre', stockQty: 2, unit: 'unit', source: 'test', last_updated: Date.now() });
      T.clearCart();
    }, bc);
    await clearAudit(p);
    // 5 adds × 1 each = 5 units asked, stock is 2 → TX must abort
    for (let i = 0; i < 5; i++) {
      await p.evaluate((bc) => { window._acimProcessBarcode(bc); }, bc);
      await p.waitForTimeout(300);
    }
    const cartTotal = await p.evaluate(() => window._acimTest.cartTotal());
    await p.evaluate(async (t) => {
      try {
        await window._acimTest.finalizeSale([{ method: 'cb', amountCents: t, tenderedCents: t, changeCents: 0 }]);
      } catch(e){}
    }, cartTotal);
    await p.waitForTimeout(1500);
    const probe = await p.evaluate(async () => {
      const A = window._acimAudit;
      const product = await window._acimTest.dbGet('AUDIT-B-NOSTOCK-A');
      return {
        stock: product ? product.stockQty : null,
        sales: (await A.getByType("SALE_COMPLETED")).length,
        decs: (await A.getByType("STOCK_DECREMENT")).length
      };
    });
    await shot(p, 'audit-b-05-nostock');
    await ok('Stock unchanged at 2 (got ' + probe.stock + ')', probe.stock === 2, JSON.stringify(probe));
    await ok('SALE_COMPLETED NOT emitted (got ' + probe.sales + ')', probe.sales === 0, JSON.stringify(probe));
    await ok('STOCK_DECREMENT NOT emitted (got ' + probe.decs + ')', probe.decs === 0, JSON.stringify(probe));
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Insufficient stock audit behavior', false, String(e.message || e));
  }

  // ============================================================
  // 6. PAGEERROR check across all 5 tests
  // ============================================================
  log('TEST 6: PAGEERROR check');
  await ok('No PAGEERROR exceptions (' + pageErrors.length + ')', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await b.close();
  log('==========================================');
  log('AUDIT PR B RESULTS: ' + R.pass + ' pass, ' + R.fail + ' fail, ' + R.shots + ' screenshots');
  if (R.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
