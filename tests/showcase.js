const { chromium } = require('playwright');
const path = require('path');
const BASE = 'http://localhost:8765/';
const OUT = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // Login
  const loginVisible = await page.locator('#acim-login').isVisible().catch(() => false);
  if (loginVisible) {
    await page.locator('#acim-login input[type=password]').fill('1234');
    await page.locator('#acim-login button').last().click();
    await page.waitForTimeout(2000);
  }

  // 1: Full POS after login - header + categories + grid
  await page.screenshot({ path: path.join(OUT, 'v2-01-pos-full.png'), fullPage: false });
  console.log('1/6 Full POS');

  // 2: Click viande category
  const cats = page.locator('.mk-category');
  if (await cats.count() > 1) {
    await cats.nth(1).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'v2-02-category-viande.png'), fullPage: false });
    console.log('2/6 Category viande');
    await cats.nth(0).click();
    await page.waitForTimeout(500);
  }

  // 3: Search poulet
  await page.locator('#acim-pos-search').fill('poulet');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'v2-03-search-poulet.png'), fullPage: false });
  console.log('3/6 Search poulet');
  await page.locator('#acim-pos-search').fill('');
  await page.waitForTimeout(500);

  // 4: Add products to cart
  const cards = page.locator('.mk-product');
  const count = await cards.count();
  if (count > 8) {
    await cards.nth(0).click(); await page.waitForTimeout(300);
    await cards.nth(1).click(); await page.waitForTimeout(300);
    await cards.nth(2).click(); await page.waitForTimeout(300);
    await cards.nth(5).click(); await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(OUT, 'v2-04-cart-items.png'), fullPage: false });
  console.log('4/6 Cart items');

  // 5: Open cart sheet
  await page.evaluate(() => {
    if (typeof window._openCartSheet === 'function') window._openCartSheet();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'v2-05-cart-sheet.png'), fullPage: false });
  console.log('5/6 Cart sheet');

  // 6: Close sheet, quick-create
  await page.evaluate(() => {
    if (typeof window._closeCartSheet === 'function') window._closeCartSheet();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    if (typeof window._quickCreate === 'function') window._quickCreate('', 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'v2-06-quick-create.png'), fullPage: false });
  console.log('6/6 Quick create');

  await browser.close();
  console.log('DONE');
})();
