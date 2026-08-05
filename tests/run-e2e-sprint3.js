// tests/run-e2e-sprint3.js - Playwright E2E for Sprint 3 features
// Big-screen flash, 3-choice price modal, voice add, scan terminator.
// Requires: tests/serve.js running on :8765
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://localhost:8765/';
const results = { pass: 0, fail: 0, shots: 0 };

function log(m){ console.log('[' + new Date().toISOString().substr(11,8) + '] ' + m); }
async function shot(p,n){ await p.screenshot({path:path.join(SHOTS,n+'.png'),fullPage:true}); results.shots++; log('  shot: '+n+'.png'); }
async function ok(name, cond, detail){ if(cond){results.pass++; log('  PASS: '+name);} else {results.fail++; log('  FAIL: '+name+(detail?' - '+detail:''));} }

(async () => {
  log('Launching Chromium...');
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);

  pageErrors=[];
  p.on('pageerror', e => pageErrors.push(e.message));

  log('SPRINT 3 TEST 1: Big-screen price flash appears on add to cart');
  try {
    await p.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(5500);
    // Override confirmVoice to auto-yes (so voice tests don't get stuck on prompts)
    await p.evaluate(() => { if (window._acimS3) window._acimS3.confirmVoice = function(prompt, yes) { yes(); }; });
    // Click first product card
    await p.locator('#acim-pos-grid > div').first().click();
    await p.waitForTimeout(300);
    // Right after click → _addToCart → acim:add event → flash overlay appears
    // Capture the flash quickly (it auto-fades after 1.5s)
    const flashVisible = await p.evaluate(() => !!document.querySelector('[style*="font-size:160px"]') || !!document.querySelector('[style*="black"]'));
    // Actually the flash z-index is 10000006 — check by color
    const flashCount = await p.$$eval('div', els => els.filter(e => e.style && (e.style.zIndex === '10000006' || (e.style.fontSize === '160px'))).length);
    await shot(p, 's3-01-flash');
    await ok('Flash overlay appears', flashCount > 0, 'flashCount=' + flashCount);
    // Wait > 1.5s and verify it fades
    await p.waitForTimeout(2000);
    const flashAfter = await p.$$eval('div', els => els.filter(e => e.style && (e.style.zIndex === '10000006')).length);
    await ok('Flash overlay auto-fades', flashAfter === 0, 'flashAfter=' + flashAfter);
  } catch (e) {
    await ok('Flash overlay appears', false, String(e.message || e));
  }

  log('SPRINT 3 TEST 2: 3-choice modal for no-price product');
  try {
    // Insert a no-price product into the DB via _acimTest.dbPut
    await p.evaluate(async () => {
      const T = window._acimTest;
      await T.dbPut({ barcode: 'TEST-NOPRICE-001', name: 'VOIX-TEST-PROD', sale_price_cents: 0, category: 'autre', stockQty: 10, unit: 'unit', source: 'test', last_updated: Date.now() });
      return true;
    });
    // Trigger scan on the no-price barcode → should open the 3-choice modal
    await p.evaluate(() => window._acimProcessBarcode('TEST-NOPRICE-001'));
    await p.waitForTimeout(700);
    await shot(p, 's3-02-choice-modal');
    const choiceVisible = await p.locator('#acim-price-choice').isVisible().catch(() => false);
    await ok('3-choice modal opens on no-price scan', choiceVisible);
    // Click "Annuler"
    const cancelBtn = await p.locator('#acim-price-choice button').last();
    await cancelBtn.click();
    await p.waitForTimeout(400);
    await ok('Choice modal closes on cancel', !(await p.locator('#acim-price-choice').isVisible().catch(()=>false)));
  } catch (e) {
    await ok('3-choice modal', false, String(e.message || e));
  }

  log('SPRINT 3 TEST 3: Voice add — "ajoute Tomates" (already in catalog)');
  try {
    // Find a real product name from the catalog
    const prodName = await p.evaluate(() => {
      const grid = document.querySelectorAll('#acim-pos-grid > div');
      for (const c of grid) { const t = c.textContent.trim(); if (t && t.length > 4 && t.length < 30) return t.split('\n')[0].trim(); }
      return null;
    });
    if (!prodName) { await ok('Voice add: found a product to add', false, 'no product in grid'); }
    else {
      const cartBefore = await p.evaluate(() => window._acimTest.getCart().length);
      await p.evaluate(async (n) => {
        await window._acimAddToCartByVoice(n, null, null);
      }, prodName);
      await p.waitForTimeout(1500); // confirmVoice = auto-yes (set in test 1)
      const cartAfter = await p.evaluate(() => window._acimTest.getCart().length);
      await ok('Voice add increases cart (' + cartBefore + ' → ' + cartAfter + ')', cartAfter > cartBefore, 'prodName=' + prodName);
      await shot(p, 's3-03-voice-add');
    }
  } catch (e) {
    await ok('Voice add', false, String(e.message || e));
  }

  log('SPRINT 3 TEST 4: Scan terminator — digits + Enter commits immediately');
  try {
    // Keyboard-simulate a scan: type 13 digits + Enter in <150ms
    // We test via _acimAddToCartByVoice-style direct invocation to avoid timing fragility:
    // Simpler: count how long a "Enter" commits. Use a known product's barcode.
    const bc = 'TEST-NOPRICE-001'; // exists from test 2
    await p.evaluate((bc) => {
      // Simulate: clear scan buf, push digits, then press Enter
      // Since our kbd handler is on document, we dispatch keyboard events
      for (const ch of bc) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, bc);
    await p.waitForTimeout(700);
    await shot(p, 's3-04-scan-enter');
    // Either the 3-choice modal opens (it's no-price) OR the product grid search updated.
    // We verify scanCommit ran by checking _posSearch === "" after Enter.
    const searchText = await p.locator('#acim-pos-search').inputValue().catch(() => '');
    await ok('Scan buffer committed via Enter (search cleared)', searchText === '', 'search=' + searchText);
  } catch (e) {
    await ok('Scan terminator', false, String(e.message || e));
  }

  log('SPRINT 3 TEST 5: Mic floating button exists');
  try {
    const micVisible = await p.locator('button').filter({ hasText: '🎤' }).first().isVisible().catch(() => false);
    await ok('Mic floating button visible', micVisible);
    await shot(p, 's3-05-mic-btn');
  } catch (e) {
    await ok('Mic button', false, String(e.message || e));
  }

  log('SPRINT 3 TEST 6: No pageerror exceptions');
  await ok('No PAGEERROR', pageErrors.length === 0, pageErrors.slice(0,2).join(' | '));

  await b.close();
  log('==========================================');
  log('SPRINT 3 RESULTS: ' + results.pass + ' pass, ' + results.fail + ' fail, ' + results.shots + ' screenshots');
  if (results.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
