// tests/run-e2e.js - Playwright E2E suite for AcimCaisse v1.3.0
// Takes screenshots of every page + runs critical path assertions.
// Usage: node tests/run-e2e.js
// Require: tests/serve.js running on http://localhost:8765
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const BASE = 'http://localhost:8765/';
const results = { pass: 0, fail: 0, shots: 0 };

function log(msg) {
  const stamp = new Date().toISOString().substr(11, 8);
  console.log('[' + stamp + '] ' + msg);
}

async function shot(page, name) {
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  results.shots++;
  log('  Screenshot: ' + name + '.png');
}

async function assertOk(name, cond, detail) {
  if (cond) { results.pass++; log('  PASS: ' + name); }
  else { results.fail++; log('  FAIL: ' + name + (detail ? ' - ' + detail : '')); }
}

(async () => {
  log('Launching Chromium (headless)...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  // ============================================================
  // 1. POS loads
  // ============================================================
  log('TEST 1: POS caisse loads');
  try {
    await page.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(5500);
    await shot(page, '01-pos-caisse');
    const grid = await page.locator('#acim-pos-grid > *').count();
    const cats = await page.locator('#acim-pos-cats > *').count();
    const totalVisible = await page.locator('#acim-pos-total').isVisible().catch(() => false);
    await assertOk('Product grid populated (' + grid + ' cards)', grid > 100);
    await assertOk('Categories rendered (' + cats + ')', cats >= 8);
    await assertOk('TOTAL label visible', totalVisible);
  } catch (e) {
    await assertOk('POS loads', false, String(e.message || e));
  }

  // ============================================================
  // 2. Add product to cart (click first visible card)
  // ============================================================
  log('TEST 2: add product to cart');
  try {
    const card = page.locator('#acim-pos-grid > div').first();
    await card.click();
    await page.waitForTimeout(800);
    await shot(page, '02-after-add-to-cart');
    const cartRows = await page.locator('#acim-pos-items > div').count();
    await assertOk('Cart row added (' + cartRows + ')', cartRows >= 1);
    const totalText = await page.locator('#acim-pos-total').textContent();
    log('  TOTAL: ' + totalText.trim());
  } catch (e) {
    await assertOk('Add to cart', false, String(e.message || e));
  }

  // ============================================================
  // 3. Search filter
  // ============================================================
  log('TEST 3: search filter');
  try {
    await page.fill('#acim-pos-search', 'poulet');
    await page.waitForTimeout(700);
    await shot(page, '03-search-poulet');
    const n = await page.locator('#acim-pos-grid > div').count();
    await assertOk('Search "poulet" filters grid (' + n + ')', n > 0 && n < 1264);
    await page.fill('#acim-pos-search', '');
    await page.waitForTimeout(400);
  } catch (e) {
    await assertOk('Search filter', false, String(e.message || e));
  }

  // ============================================================
  // 4. Quick-create modal via the first button (header)
  // ============================================================
  log('TEST 4: quick-create modal');
  try {
    await page.locator('button').first().click();
    await page.waitForTimeout(700);
    await shot(page, '04-quick-create');
    const quickVisible = await page.locator('#acim-quick').isVisible().catch(() => false);
    await assertOk('Quick-create modal opens', quickVisible);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) {
    await assertOk('Quick-create modal', false, String(e.message || e));
  }

  // ============================================================
  // 5. Dashboard
  // ============================================================
  log('TEST 5: dashboard.html');
  try {
    await page.goto(BASE + 'dashboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await shot(page, '05-dashboard');
    const metrics = await page.locator('.metric').count();
    await assertOk('Dashboard metrics (' + metrics + ')', metrics >= 4);
    const totalLabel = await page.locator('text=Total des ventes').count();
    await assertOk('Dashboard "Total des ventes" present', totalLabel > 0);
    const top15 = await page.locator('text=Top 15 produits').count();
    await assertOk('Dashboard top-15 table present', top15 > 0);
  } catch (e) {
    await assertOk('Dashboard loads', false, String(e.message || e));
  }

  // ============================================================
  // 6. Codes-barres kg
  // ============================================================
  log('TEST 6: codes-barres-kg.html');
  try {
    await page.goto(BASE + 'codes-barres-kg.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await shot(page, '06-codes-barres-kg');
    const n = await page.locator('svg').count();
    await assertOk('Codes-barres kg SVGs (' + n + ')', n >= 15);
  } catch (e) {
    await assertOk('Codes-barres kg loads', false, String(e.message || e));
  }

  // ============================================================
  // 7. Migration
  // ============================================================
  log('TEST 7: migration.html');
  try {
    await page.goto(BASE + 'migration.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await shot(page, '07-migration');
    const title = await page.title();
    await assertOk('Migration title contains 1.3.0', /1\.3\.0/.test(title), 'title=' + title);
  } catch (e) {
    await assertOk('Migration loads', false, String(e.message || e));
  }

  // ============================================================
  // 8. tests.html self-test
  // ============================================================
  log('TEST 8: tests.html self-test');
  try {
    await page.goto(BASE + 'tests.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await shot(page, '08-tests-html');
    const summary = await page.locator('#summary').textContent();
    log('  Self-test summary: ' + summary.trim());
    const failMatch = summary.match(/(\d+)\s*fail/i);
    const failCount = failMatch ? parseInt(failMatch[1], 10) : -1;
    await assertOk('Self-test has 0 fails', failCount === 0, 'summary=' + summary.trim());
  } catch (e) {
    await assertOk('tests.html loads', false, String(e.message || e));
  }

  // ============================================================
  // 9. Console errors
  // ============================================================
  log('TEST 9: console errors');
  log('  ' + consoleErrors.length + ' console errors captured');
  const realErrors = consoleErrors.filter(e => e.startsWith('PAGEERROR'));
  await assertOk('No PAGEERROR exceptions', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  log('  (non-fatal console noise: ' + consoleErrors.filter(e => !e.startsWith('PAGEERROR')).length + ' msgs)');

  await browser.close();

  // ============================================================
  // Summary
  // ============================================================
  log('==========================================');
  log('RESULTS: ' + results.pass + ' pass, ' + results.fail + ' fail, ' + results.shots + ' screenshots');
  log('Screenshots dir: ' + SHOTS);
  log('==========================================');
  if (results.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
