// tests/run-funnel.js - Playwright E2E suite for the conversion funnel
//   landing.html -> hero CTA -> post-system.html (POS) -> footer/copyright checks
// Usage: node tests/run-funnel.js
// Require: tests/serve.js running on http://localhost:8765
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots-funnel');
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
  const consoleErrors = [];

  async function newPage(ctx) {
    const page = await ctx.newPage();
    page.setDefaultTimeout(12000);
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));
    return page;
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // ============================================================
  // 1. Landing page loads + funnel hero CTA
  // ============================================================
  log('TEST 1: Landing funnel loads');
  try {
    const page = await newPage(ctx);
    await page.goto(BASE + 'landing.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(900);
    await shot(page, '01-landing');
    const hero = await page.getByText('Vos plats préférés, livrés rapidement').isVisible().catch(() => false);
    const usp = await page.getByText('Pourquoi commander avec PostSystem ?').isVisible().catch(() => false);
    const restaurants = await page.locator('.ue-card').count();
    const cta = await page.locator('#hero-cta').isVisible().catch(() => false);
    await assertOk('Hero headline visible', hero);
    await assertOk('USP section visible', usp);
    await assertOk('Restaurant cards rendered (3)', restaurants === 3, String(restaurants));
    await assertOk('Hero CTA present', cta);
  } catch (e) {
    await assertOk('Landing loads', false, String(e.message || e));
  }

  // ============================================================
  // 2. Footer / copyright present on landing
  // ============================================================
  log('TEST 2: footer copyright on landing');
  try {
    const page = await newPage(ctx);
    await page.goto(BASE + 'landing.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const copyright = await page.locator('.ue-footer-copy').textContent().catch(() => '');
    const linksOk = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('.ue-footer-links a')).map(x => x.textContent.trim());
      return a.includes('Source') && a.includes('Caisse');
    });
    await assertOk('Copyright text present', copyright.includes('2026 PostSystem'), copyright);
    await assertOk('Footer nav links (Caisse + Source)', linksOk);
  } catch (e) {
    await assertOk('Footer', false, String(e.message || e));
  }

  // ============================================================
  // 3. Funnel: hero CTA navigates to post-system.html
  // ============================================================
  log('TEST 3: hero CTA -> post-system.html');
  try {
    const page = await newPage(ctx);
    await page.goto(BASE + 'landing.html', { waitUntil: 'domcontentloaded' });
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
      page.locator('#hero-cta').click(),
    ]);
    const target = popup ? popup.url() : page.url();
    await assertOk('CTA targets post-system.html', target.includes('post-system.html'), target);
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await popup.waitForSelector('#ps-grid, #ps-banner, #acim-login', { state: 'attached', timeout: 10000 }).catch(() => {});
      const posReady = await popup.locator('#ps-grid').count();
      await assertOk('POS app mounted on target page', posReady > 0, String(posReady));
      await popup.close();
    } else {
      // same-tab navigation fallback
      await page.waitForURL(/post-system\.html/, { timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await page.waitForSelector('#ps-grid, #ps-banner, #acim-login', { state: 'attached', timeout: 10000 }).catch(() => {});
      const posReady = await page.locator('#ps-grid').count();
      await assertOk('POS app mounted (same tab)', posReady > 0, String(posReady));
    }
  } catch (e) {
    await assertOk('Funnel navigation', false, String(e.message || e));
  }

  // ============================================================
  // 4. post-system.html footer copyright present
  // ============================================================
  log('TEST 4: post-system footer copyright');
  try {
    const page = await newPage(ctx);
    await page.goto(BASE + 'post-system.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await shot(page, '02-post-system');
    const copyright = await page.locator('.ue-copyright').textContent().catch(() => '');
    await assertOk('post-system copyright footer', copyright.includes('2026 PostSystem'), copyright);
  } catch (e) {
    await assertOk('post-system footer', false, String(e.message || e));
  }

  // ============================================================
  // 5. post-studio.html footer copyright present
  // ============================================================
  log('TEST 5: post-studio footer/branding');
  try {
    const page = await newPage(ctx);
    await page.goto(BASE + 'post-studio.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await shot(page, '03-post-studio');
    const title = await page.title();
    await assertOk('Title = Post Studio', title.includes('Post Studio'), title);
    const brand = await page.getByText('Post Studio').first().isVisible().catch(() => false);
    await assertOk('Branding visible', brand);
  } catch (e) {
    await assertOk('post-studio', false, String(e.message || e));
  }

  // ============================================================
  // 6. Mobile funnel
  // ============================================================
  log('TEST 6: mobile funnel');
  try {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await newPage(mctx);
    await page.goto(BASE + 'landing.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const sticky = await page.locator('#sticky-cta').isVisible().catch(() => false);
    await assertOk('Sticky mobile CTA visible', sticky);
    await page.locator('#sticky-cta').click();
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForSelector('#ps-grid, #acim-login', { state: 'attached', timeout: 10000 }).catch(() => {});
    const posReady = await page.locator('#ps-grid').count();
    await assertOk('Sticky CTA opens POS', posReady > 0, String(posReady));
    await shot(page, '04-mobile-funnel');
    await mctx.close();
  } catch (e) {
    await assertOk('Mobile funnel', false, String(e.message || e));
  }

  // ============================================================
  // 7. No console errors across the funnel
  // ============================================================
  log('TEST 7: console errors');
  await assertOk('Zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  log('==================================================');
  log('Funnel E2E: ' + results.pass + ' passed, ' + results.fail + ' failed, ' + results.shots + ' screenshots');
  log('==================================================');
  process.exit(results.fail > 0 ? 1 : 0);
})();
