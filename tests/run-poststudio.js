// tests/run-poststudio.js - Playwright E2E suite for Post Studio (post-studio.html)
// Usage: node tests/run-poststudio.js
// Require: tests/serve.js running on http://localhost:8765
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots-poststudio');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const BASE = 'http://localhost:8765/post-studio.html';
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  // ============================================================
  // 1. App loads + clean slate
  // ============================================================
  log('TEST 1: Post Studio loads');
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await shot(page, '01-dashboard');
    const hero = await page.getByText('Publiez, planifiez et pilotez vos offres locales', { exact: false }).isVisible().catch(() => false);
    const sidebar = await page.getByRole('button', { name: 'Bistro Nova' }).isVisible().catch(() => false);
    const composer = await page.getByText('Créer la publication').isVisible().catch(() => false);
    const preview = await page.getByText('Aperçu de diffusion').isVisible().catch(() => false);
    await assertOk('Hero visible', hero);
    await assertOk('Sidebar restaurants visible', sidebar);
    await assertOk('Composer visible', composer);
    await assertOk('Live preview visible', preview);
  } catch (e) {
    await assertOk('App loads', false, String(e.message || e));
  }

  // ============================================================
  // 2. Template switching updates composer
  // ============================================================
  log('TEST 2: template switch updates title');
  try {
    await page.getByRole('button', { name: 'Nouveau plat' }).click();
    await page.waitForTimeout(400);
    const title = await page.getByLabel('Titre de la publication').inputValue();
    await assertOk('Template "Nouveau plat" applied to title', title.includes('signature'), title);
    await page.getByRole('button', { name: 'Lunch express' }).click();
    await page.waitForTimeout(400);
    const title2 = await page.getByLabel('Titre de la publication').inputValue();
    await assertOk('Template "Lunch express" applied to title', title2.includes('Menu du midi'), title2);
  } catch (e) {
    await assertOk('Template switch', false, String(e.message || e));
  }

  // ============================================================
  // 3. Publish validation: empty content -> error toast, no save
  // ============================================================
  log('TEST 3: validation on empty content');
  try {
    await page.getByLabel('Titre de la publication').fill('');
    await page.getByLabel('Message').fill('');
    await page.getByRole('button', { name: 'Publier maintenant' }).click();
    await page.waitForTimeout(500);
    const toast = await page.getByRole('status').textContent().catch(() => '');
    await assertOk('Error toast shown', toast.includes('Renseignez'), toast);
    await page.waitForTimeout(3400);
    const toastGone = await page.getByRole('status').isVisible().catch(() => false);
    await assertOk('Toast auto-dismisses', !toastGone);
  } catch (e) {
    await assertOk('Validation', false, String(e.message || e));
  }

  // ============================================================
  // 4. Publish flow: fill + publish -> Programmé + activity update
  // ============================================================
  log('TEST 4: publish a scheduled post');
  try {
    await page.getByLabel('Titre de la publication').fill('Menu du midi disponible dès 11h30');
    await page.getByLabel('Message').fill('Un menu rapide, généreux et pensé pour les pauses courtes.');
    await page.getByRole('button', { name: 'Publier maintenant' }).click();
    await page.waitForTimeout(600);
    const toast = await page.getByRole('status').textContent().catch(() => '');
    await assertOk('Success toast "programmée"', toast.includes('programmée'), toast);
    const heroBadge = await page.getByText('Programmé', { exact: true }).first().textContent().catch(() => '');
    await assertOk('Hero status = Programmé', heroBadge === 'Programmé', heroBadge);
    const activityHas = await page.getByText('Menu du midi disponible dès 11h30', { exact: true }).count();
    await assertOk('Activity feed updated', activityHas >= 1);
    await page.waitForTimeout(3400);
  } catch (e) {
    await assertOk('Publish flow', false, String(e.message || e));
  }

  // ============================================================
  // 5. Editing resets status to Brouillon
  // ============================================================
  log('TEST 5: edit resets status to Brouillon');
  try {
    await page.getByLabel('Titre de la publication').fill('Titre modifié en direct');
    await page.waitForTimeout(400);
    const heroBadge = await page.getByText('Brouillon', { exact: true }).first().textContent().catch(() => '');
    await assertOk('Status reset to Brouillon after edit', heroBadge === 'Brouillon', heroBadge);
    await page.getByLabel('Titre de la publication').fill('Menu du midi disponible dès 11h30');
  } catch (e) {
    await assertOk('Status reset', false, String(e.message || e));
  }

  // ============================================================
  // 6. Publications view: list, filter, resume
  // ============================================================
  log('TEST 6: Publications library');
  try {
    await page.getByRole('button', { name: 'Publications' }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '02-publications');
    const card = await page.getByText('Menu du midi disponible dès 11h30', { exact: true }).count();
    await assertOk('Publication listed', card >= 1);
    await page.getByRole('button', { name: 'Brouillon', exact: true }).click();
    await page.waitForTimeout(400);
    const empty = await page.getByText("Aucune publication pour l'instant").isVisible().catch(() => false);
    await assertOk('Filter "Brouillon" shows empty state', empty);
    await page.getByRole('button', { name: 'Tous', exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Reprendre' }).click();
    await page.waitForTimeout(800);
    const titleVal = await page.getByLabel('Titre de la publication').inputValue().catch(() => '');
    const viewBack = await page.getByText('Créer la publication').isVisible().catch(() => false);
    await assertOk('Reprendre loads post into composer', viewBack && titleVal.includes('Menu du midi'), titleVal);
  } catch (e) {
    await assertOk('Publications view', false, String(e.message || e));
  }

  // ============================================================
  // 7. Calendrier view: scheduled post grouped
  // ============================================================
  log('TEST 7: Calendrier groups scheduled posts');
  try {
    await page.getByRole('button', { name: 'Calendrier' }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '03-calendrier');
    const scheduled = await page.getByText('Menu du midi disponible dès 11h30', { exact: true }).count();
    await assertOk('Scheduled post in calendar', scheduled >= 1);
    const day = await page.getByText('mercredi 12 août', { exact: false }).count();
    await assertOk('Day group rendered', day >= 1);
  } catch (e) {
    await assertOk('Calendrier view', false, String(e.message || e));
  }

  // ============================================================
  // 8. Campagnes view: template cards -> composer
  // ============================================================
  log('TEST 8: Campagnes template cards');
  try {
    await page.getByRole('button', { name: 'Campagnes' }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '04-campagnes');
    const cards = await page.getByRole('button', { name: 'Utiliser ce modèle' }).count();
    await assertOk('3 template cards', cards === 3, String(cards));
    await page.getByRole('button', { name: 'Utiliser ce modèle' }).nth(2).click();
    await page.waitForTimeout(900);
    const titleVal = await page.getByLabel('Titre de la publication').inputValue().catch(() => '');
    await assertOk('Model applied to composer', titleVal.includes('soirée'), titleVal);
  } catch (e) {
    await assertOk('Campagnes view', false, String(e.message || e));
  }

  // ============================================================
  // 9. Statistiques view renders
  // ============================================================
  log('TEST 9: Statistiques view');
  try {
    await page.getByRole('button', { name: 'Statistiques' }).first().click();
    await page.waitForTimeout(600);
    await shot(page, '05-statistiques');
    const heading = await page.getByText('Statistiques par restaurant').isVisible().catch(() => false);
    const total = await page.getByText('Total publications').isVisible().catch(() => false);
    const count = await page.locator('text=1 publication').count();
    await assertOk('Stats heading visible', heading);
    await assertOk('Total publications block', total);
    await assertOk('Per-restaurant publication count shown', count >= 1);
  } catch (e) {
    await assertOk('Statistiques view', false, String(e.message || e));
  }

  // ============================================================
  // 10. Hero CTA "Voir le calendrier" + persistence on reload
  // ============================================================
  log('TEST 10: hero CTA + persistence');
  try {
    await page.getByRole('button', { name: 'Dashboard' }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Voir le calendrier' }).click();
    await page.waitForTimeout(600);
    const calendarShown = await page.getByText('Calendrier des publications').isVisible().catch(() => false);
    await assertOk('Hero CTA opens calendar', calendarShown);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Publications' }).first().click();
    await page.waitForTimeout(600);
    const persisted = await page.getByText('Menu du midi disponible dès 11h30', { exact: true }).count();
    await assertOk('Publications persist after reload', persisted >= 1);
  } catch (e) {
    await assertOk('Hero CTA + persistence', false, String(e.message || e));
  }

  // ============================================================
  // 11. Delete + empty state
  // ============================================================
  log('TEST 11: delete publication');
  try {
    await page.getByRole('button', { name: 'Supprimer' }).first().click();
    await page.waitForTimeout(500);
    const empty = await page.getByText("Aucune publication pour l'instant").isVisible().catch(() => false);
    await assertOk('Empty state after delete', empty);
  } catch (e) {
    await assertOk('Delete', false, String(e.message || e));
  }

  // ============================================================
  // 12. Mobile: nav pills + composer usable
  // ============================================================
  log('TEST 12: mobile layout');
  try {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mpage = await mctx.newPage();
    mpage.setDefaultTimeout(15000);
    await mpage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await mpage.waitForTimeout(1000);
    const pills = await mpage.getByRole('button', { name: 'Publications' }).isVisible().catch(() => false);
    await assertOk('Mobile nav pills visible', pills);
    await mpage.getByRole('button', { name: 'Statistiques' }).click();
    await mpage.waitForTimeout(600);
    const stats = await mpage.getByText('Statistiques par restaurant').isVisible().catch(() => false);
    await assertOk('Mobile view switch works', stats);
    await shot(mpage, '06-mobile-stats');
    await mctx.close();
  } catch (e) {
    await assertOk('Mobile layout', false, String(e.message || e));
  }

  // ============================================================
  // 13. No console errors
  // ============================================================
  log('TEST 13: console errors');
  await assertOk('Zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  log('==================================================');
  log('Post Studio E2E: ' + results.pass + ' passed, ' + results.fail + ' failed, ' + results.shots + ' screenshots');
  log('==================================================');
  process.exit(results.fail > 0 ? 1 : 0);
})();
