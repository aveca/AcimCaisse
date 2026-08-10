// tests/run-mobile.js - AcimCaisse mobile UI E2E (Playwright)
// Simule un iPhone 13 (390x844) + un Android Pixel 5 (393x851).
// Vérifie que les éléments clés du POS restent visibles/utilisables sur mobile.
// Usage: node tests/run-mobile.js  (requiert tests/serve.js sur http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

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
  await page.screenshot({ path: file, fullPage: false });
  results.shots++;
  log('  Screenshot: ' + name + '.png');
}

async function assertOk(name, cond, detail) {
  if (cond) { results.pass++; log('  PASS: ' + name); }
  else { results.fail++; log('  FAIL: ' + name + (detail ? ' - ' + detail : '')); }
}

// Vrai device: iPhone 13 (Playwright 'iPhone 13') + Pixel 5 (Playwright 'Pixel 5')
const PROFILES = [
  { label: 'iphone13', device: devices['iPhone 13'] },
  { label: 'pixel5', device: devices['Pixel 5'] }
];

(async () => {
  log('Launching Chromium (headless) for mobile UI tests...');
  const browser = await chromium.launch({ headless: true });

  for (const prof of PROFILES) {
    log('=== Profile: ' + prof.label + ' ===');
    const ctx = await browser.newContext({ ...prof.device });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);

    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

    // 1. POS load on mobile
    try {
      await page.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(5500);
      await shot(page, 'm-' + prof.label + '-01-pos');
      const grid = await page.locator('#acim-pos-grid > *').count();
      const cats = await page.locator('#acim-pos-cats > *').count();
      await assertOk(prof.label + ': grid populated (' + grid + ')', grid > 50, 'grid=' + grid);
      await assertOk(prof.label + ': cats visible (' + cats + ')', cats >= 1, 'cats=' + cats);
    } catch (e) {
      await assertOk(prof.label + ': POS loads', false, String(e.message || e));
    }

    // 1b. Auto-login (default admin PIN 1234) — login modal intercepts taps sinon
    try {
      const loginVisible = await page.locator('#acim-login').isVisible().catch(() => false);
      if (loginVisible) {
        await page.locator('#acim-login input[type=password]').fill('1234');
        await page.locator('#acim-login button').last().tap();
        await page.waitForTimeout(900);
        log('  Login: default admin PIN 1234');
      }
    } catch (e) { /* non-fatal */ }

    // 2. No horizontal scroll (mobile breakage marker)
    try {
      const hasHScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
      });
      await assertOk(prof.label + ': no horizontal scroll', !hasHScroll);
    } catch (e) {
      await assertOk(prof.label + ': no horizontal scroll', false, String(e.message || e));
    }

    // 3. Search bar usable (visible + clickable)
    try {
      const search = page.locator('#acim-pos-search');
      const visible = await search.isVisible().catch(() => false);
      await assertOk(prof.label + ': search visible', visible);
      if (visible) {
        await search.fill('poulet');
        await page.waitForTimeout(700);
        await shot(page, 'm-' + prof.label + '-02-search-poulet');
        const n = await page.locator('#acim-pos-grid > *').count();
        await assertOk(prof.label + ': search filter works (' + n + ')', n > 0 && n < 500);
        await search.fill('');
        await page.waitForTimeout(300);
      }
    } catch (e) {
      await assertOk(prof.label + ': search usable', false, String(e.message || e));
    }

    // 4. Tap a product card (mobile tap target >= 32px ideal)
    try {
      const card = page.locator('#acim-pos-grid > div').first();
      const box = await card.boundingBox();
      const okSize = box && box.height >= 32 && box.width >= 32;
      await assertOk(prof.label + ': card tap target OK', okSize, 'box=' + JSON.stringify(box));
      if (okSize) {
        await card.tap();
        await page.waitForTimeout(800);
        await shot(page, 'm-' + prof.label + '-03-cart');
        const cartRows = await page.locator('#acim-pos-items > div').count();
        await assertOk(prof.label + ': cart row added (' + cartRows + ')', cartRows >= 1);
      }
    } catch (e) {
      await assertOk(prof.label + ': tap card', false, String(e.message || e));
    }

    // 5. Dashboard mobile
    try {
      await page.goto(BASE + 'dashboard.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await shot(page, 'm-' + prof.label + '-04-dashboard');
      const metrics = await page.locator('.metric').count();
      await assertOk(prof.label + ': dashboard mobile metrics (' + metrics + ')', metrics >= 1);
    } catch (e) {
      await assertOk(prof.label + ': dashboard mobile', false, String(e.message || e));
    }

    log('  ' + consoleErrors.length + ' console errors on ' + prof.label);
    const pageErrors = consoleErrors.filter(e => e.startsWith('PAGEERROR'));
    await assertOk(prof.label + ': no PAGEERROR', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

    await ctx.close();
  }

  await browser.close();
  log('==========================================');
  log('MOBILE RESULTS: ' + results.pass + ' pass, ' + results.fail + ' fail, ' + results.shots + ' screenshots');
  log('==========================================');
  if (results.fail > 0) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
