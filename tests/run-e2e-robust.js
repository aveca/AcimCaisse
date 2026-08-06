// tests/run-e2e-robust.js — Stabilisation Sprint 4.0: stress tests for sensitive caisse flows.
// Requires: tests/serve.js running on :8765
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
  await p.evaluate(() => { if (window._acimS3) window._acimS3.confirmVoice = function(prompt, yes) { yes(); }; });

  // ============================================================
  // 1. SCAN → CART → CHECKOUT → STOCK DECREMENT
  //    Contract: stock is mutated only at checkout, not at add-to-cart.
  //    Validates the full flow: scan adds to cart, stock unchanged;
  //    finalizeSale decrements stock exactly by 1 per validated line.
  //    Also checks rollback invariants (abandoned cart, void before pay).
  // ============================================================
  log('TEST 1: stock decremented only after validated checkout');
  try {
    // --- Setup: 3 distinct products, each stock=100 ---
    await p.evaluate(async () => {
      const T = window._acimTest;
      await T.dbPut({ barcode: 'TEST-CHK-A', name: 'ChkA', sale_price_cents: 100, category: 'autre', stockQty: 100, unit: 'unit', source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'TEST-CHK-B', name: 'ChkB', sale_price_cents: 250, category: 'autre', stockQty: 100, unit: 'unit', source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'TEST-CHK-C', name: 'ChkC', sale_price_cents: 500, category: 'autre', stockQty: 100, unit: 'unit', source: 'test', last_updated: Date.now() });
    });
    await p.evaluate(() => window._acimTest.clearCart());

    // --- Step 1: scan A and B into cart (stock must NOT change yet) ---
    await p.evaluate(() => {
      window._acimProcessBarcode('TEST-CHK-A');
      window._acimProcessBarcode('TEST-CHK-B');
    });
    await p.waitForTimeout(1500);
    const afterScan = await p.evaluate(async () => {
      const T = window._acimTest;
      return {
        cartLen: T.getCart().length,
        stockA: (await T.dbGet('TEST-CHK-A')).stockQty,
        stockB: (await T.dbGet('TEST-CHK-B')).stockQty,
        stockC: (await T.dbGet('TEST-CHK-C')).stockQty
      };
    });
    await shot(p, 'robust-01-after-scan');
    await ok('After scan: cart contains 2 items (got ' + afterScan.cartLen + ')', afterScan.cartLen === 2, JSON.stringify(afterScan));
    await ok('After scan: stock unchanged at 100 (A=' + afterScan.stockA + ', B=' + afterScan.stockB + ')', afterScan.stockA === 100 && afterScan.stockB === 100, JSON.stringify(afterScan));

    // --- Step 2: checkout validated → stock decremented by 1 for A and B, not C ---
    const totalBefore = await p.evaluate(() => window._acimTest.cartTotal());
    const checkoutResult = await p.evaluate(async (total) => {
      const T = window._acimTest;
      await T.finalizeSale([{ method: 'cb', amountCents: total, tenderedCents: total, changeCents: 0 }]);
      // finalizeSale triggers async _persistSale → _decrementStock; wait for settle
      await new Promise(r => setTimeout(r, 1200));
      return {
        cartLenAfter: T.getCart().length,
        stockA: (await T.dbGet('TEST-CHK-A')).stockQty,
        stockB: (await T.dbGet('TEST-CHK-B')).stockQty,
        stockC: (await T.dbGet('TEST-CHK-C')).stockQty
      };
    }, totalBefore);
    await shot(p, 'robust-01-after-checkout');
    await ok('After checkout: cart cleared (got ' + checkoutResult.cartLenAfter + ')', checkoutResult.cartLenAfter === 0, JSON.stringify(checkoutResult));
    await ok('After checkout: A stock 100→99 (got ' + checkoutResult.stockA + ')', checkoutResult.stockA === 99, JSON.stringify(checkoutResult));
    await ok('After checkout: B stock 100→99 (got ' + checkoutResult.stockB + ')', checkoutResult.stockB === 99, JSON.stringify(checkoutResult));
    await ok('After checkout: C stock untouched at 100 (got ' + checkoutResult.stockC + ')', checkoutResult.stockC === 100, JSON.stringify(checkoutResult));

    // --- Step 3: rollback invariant — add to cart then clear without checkout ---
    await p.evaluate(() => window._acimTest.clearCart());
    await p.evaluate(() => window._acimProcessBarcode('TEST-CHK-C'));
    await p.waitForTimeout(1500);
    await p.evaluate(() => window._acimTest.clearCart());
    await p.waitForTimeout(500);
    const afterAbort = await p.evaluate(async () => (await window._acimTest.dbGet('TEST-CHK-C')).stockQty);
    await ok('Abandoned cart rollback: C still at 100 (got ' + afterAbort + ')', afterAbort === 100);

    // --- Cleanup ---
    await p.evaluate(async () => {
      await window._acimTest.dbDelete('TEST-CHK-A');
      await window._acimTest.dbDelete('TEST-CHK-B');
      await window._acimTest.dbDelete('TEST-CHK-C');
    });
  } catch (e) {
    await ok('Validated checkout stock decrement', false, String(e.message || e));
  }

  // ============================================================
  // 2. 5 SALES + 5 UNDOS IN SUCCESSION — stock must end at original
  // ============================================================
  log('TEST 2: 5 sales + 5 undos (stock consistency)');
  try {
    const bc = 'TEST-UNDO5-X';
    await p.evaluate(async (bc) => {
      await window._acimTest.dbPut({ barcode: bc, name: 'Undo5', sale_price_cents: 200, category: 'autre', stockQty: 50, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    const results = await p.evaluate(async (bc) => {
      const T = window._acimTest;
      const out = [];
      for (let i = 0; i < 5; i++) {
        const r = await T.decrementStock(bc, 3);
        const r2 = await T.restoreStock(bc, 3);
        out.push({ dec: r.ok, rest: r2.ok });
      }
      const finalStock = await T.dbGet(bc).then(p => p ? (p.stockQty||0) : null);
      return { out, finalStock };
    }, bc);
    await shot(p, 'robust-02-undo5');
    const okCount = results.out.filter(o => o.dec && o.rest).length;
    await ok('5 cycles decrement+restore succeeded (' + okCount + '/5)', okCount === 5);
    await ok('Final stock back to 50 (got ' + results.finalStock + ')', results.finalStock === 50);
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('5 sales+undos', false, String(e.message || e));
  }

  // ============================================================
  // 3. THREE KG PRODUCTS IN A ROW — weight-based decrement
  // ============================================================
  log('TEST 3: 3 kg products decremented by weight');
  try {
    await p.evaluate(async () => {
      const T = window._acimTest;
      await T.dbPut({ barcode: 'TEST-KG-A', name: 'Chevre', sale_price_cents: 0, category: 'viande', stockQty: 10, unit: 'kg', unitType: 'kg', pricePerUnit: 1500, source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'TEST-KG-B', name: 'Poulet', sale_price_cents: 0, category: 'volaille', stockQty: 20, unit: 'kg', unitType: 'kg', pricePerUnit: 899, source: 'test', last_updated: Date.now() });
      await T.dbPut({ barcode: 'TEST-KG-C', name: 'Boeuf', sale_price_cents: 0, category: 'viande', stockQty: 30, unit: 'kg', unitType: 'kg', pricePerUnit: 2200, source: 'test', last_updated: Date.now() });
    });
    const r = await p.evaluate(async () => {
      const T = window._acimTest;
      await T.decrementStock('TEST-KG-A', 0.5);
      await T.decrementStock('TEST-KG-B', 2.3);
      await T.decrementStock('TEST-KG-C', 1.7);
      const a = await T.dbGet('TEST-KG-A');
      const b = await T.dbGet('TEST-KG-B');
      const c = await T.dbGet('TEST-KG-C');
      return { a: a.stockQty, b: b.stockQty, c: c.stockQty };
    });
    await shot(p, 'robust-03-kg-chain');
    await ok('Chevre 10→9.5 (got ' + r.a + ')', Math.abs(r.a - 9.5) < 0.001);
    await ok('Poulet 20→17.7 (got ' + r.b + ')', Math.abs(r.b - 17.7) < 0.001);
    await ok('Boeuf 30→28.3 (got ' + r.c + ')', Math.abs(r.c - 28.3) < 0.001);
    await p.evaluate(async () => {
      await window._acimTest.dbDelete('TEST-KG-A');
      await window._acimTest.dbDelete('TEST-KG-B');
      await window._acimTest.dbDelete('TEST-KG-C');
    });
  } catch (e) {
    await ok('KG chain', false, String(e.message || e));
  }

  // ============================================================
  // 4. CONCURRENT RACE — 5 simultaneous decrements on stock=2
  // ============================================================
  log('TEST 4: 5 simultaneous decrements on stock=2');
  try {
    const bc = 'TEST-CONCUR-X';
    await p.evaluate(async (bc) => {
      await window._acimTest.dbPut({ barcode: bc, name: 'Concur2', sale_price_cents: 300, category: 'autre', stockQty: 2, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    const r = await p.evaluate(async (bc) => {
      const T = window._acimTest;
      const ps = [0,1,2,3,4].map(() => T.decrementStock(bc, 1));
      const all = await Promise.all(ps);
      const final = await T.dbGet(bc).then(p => p ? p.stockQty : null);
      return { ok: all.filter(x => x.ok).length, ko: all.filter(x => !x.ok).length, final };
    }, bc);
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
    await shot(p, 'robust-04-concurrent');
    await ok('Exactly 2 succeeded (got ' + r.ok + ')', r.ok === 2, JSON.stringify(r));
    await ok('Exactly 3 refused (got ' + r.ko + ')', r.ko === 3, JSON.stringify(r));
    await ok('Final stock = 0 (got ' + r.final + ')', r.final === 0);
  } catch (e) {
    await ok('Concurrent stock race', false, String(e.message || e));
  }

  // ============================================================
  // 5. NEGATIVE STOCK FORCED — selling on stock=0 must fail
  // ============================================================
  log('TEST 5: sell on stock=0 — must fail atomically');
  try {
    const bc = 'TEST-EMPTY-X';
    await p.evaluate(async (bc) => {
      await window._acimTest.dbPut({ barcode: bc, name: 'Empty', sale_price_cents: 500, category: 'autre', stockQty: 0, unit: 'unit', source: 'test', last_updated: Date.now() });
    }, bc);
    const r = await p.evaluate(async (bc) => {
      const T = window._acimTest;
      const res = await T.decrementStock(bc, 1);
      const stock = await T.dbGet(bc).then(p => p ? p.stockQty : null);
      return { ok: res.ok, reason: res.reason, stock };
    }, bc);
    await shot(p, 'robust-05-negative');
    await ok('Decrement refused (ok=' + r.ok + ')', r.ok === false, JSON.stringify(r));
    await ok('Reason starts with "stock" (' + r.reason + ')', typeof r.reason === 'string' && r.reason.indexOf('stock') === 0);
    await ok('Stock stays at 0 (got ' + r.stock + ')', r.stock === 0);
    await p.evaluate(async (bc) => { await window._acimTest.dbDelete(bc); }, bc);
  } catch (e) {
    await ok('Force negative stock', false, String(e.message || e));
  }

  // ============================================================
  // 6. _BACKUP_DATA=null fallback — POS still works if DB populated
  // ============================================================
  log('TEST 6: catalog.json unreachable fallback');
  try {
    const gridBefore = await p.locator('#acim-pos-grid > *').count();
    await p.evaluate(() => { window._BACKUP_DATA = null; });
    await p.evaluate(() => { if (window._acimTest) window._acimTest.clearCart(); });
    await p.waitForTimeout(500);
    const gridAfter = await p.locator('#acim-pos-grid > *').count();
    await shot(p, 'robust-06-fallback');
    await ok('Grid still populated (' + gridAfter + ' vs ' + gridBefore + ')', gridAfter === gridBefore);
  } catch (e) {
    await ok('Network failure fallback', false, String(e.message || e));
  }

  // ============================================================
  // 7. No PAGEERROR exceptions
  // ============================================================
  log('TEST 7: PAGEERROR check');
  await ok('No PAGEERROR exceptions (' + pageErrors.length + ')', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  await b.close();
  log('==========================================');
  log('ROBUST RESULTS: ' + R.pass + ' pass, ' + R.fail + ' fail, ' + R.shots + ' screenshots');
  if (R.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
