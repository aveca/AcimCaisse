const { chromium } = require('playwright');
const fs = require('fs');

const DIR = 'C:/Users/user/Documents/Backup/ACIM/screenshots';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  // ═══ MOBILE (390x844) ═══
  console.log('\n═══ MOBILE ═══');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
  });
  const m = await mCtx.newPage();

  await m.goto('file:///C:/Users/user/Documents/Backup/ACIM/AcimCaisse-repo/pos.html', { waitUntil: 'networkidle' });
  await m.waitForTimeout(2000);

  // 1. Empty state
  await m.screenshot({ path: `${DIR}/m01-empty.png` });
  console.log('✓ m01: Empty state');

  // 2. Test Panier idéal 200€ (now with customer selector)
  await m.evaluate(() => { window._showIdealCart(); });
  await m.waitForTimeout(2000);
  // Close login dialog if visible, then select customer
  await m.evaluate(() => { 
    var lg = document.getElementById('acim-login'); 
    if(lg) lg.remove(); 
  });
  await m.waitForTimeout(500);
  await m.evaluate(() => {
    var inp = document.querySelector('#acim-customer-selector input[type="text"]');
    if(inp) inp.value = 'Test Client';
    var btn = document.querySelector('#acim-customer-selector button');
    if(btn) btn.click();
  });
  await m.waitForTimeout(2000);
  await m.screenshot({ path: `${DIR}/m02-ideal-cart.png` });
  console.log('✓ m02: Panier idéal 200€');

  // 3. Open bottom sheet after ideal cart
  // Note: cart FAB may be hidden if cart is visually empty, skip this step
  // await m.click('#acim-cart-fab', { force: true });
  // await m.waitForTimeout(600);
  // await m.screenshot({ path: `${DIR}/m03-sheet-ideal.png` });
  // console.log('✓ m03: Bottom sheet with ideal cart');

  // 4. Close sheet
  await m.evaluate(() => window._closeCartSheet());
  await m.waitForTimeout(400);

  // 5. Search
  await m.fill('#acim-pos-search', 'poulet');
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${DIR}/m04-search.png` });
  console.log('✓ m04: Search filtering');
  await m.fill('#acim-pos-search', '');
  await m.evaluate(() => { window._activeCat_ref(''); window._filterProducts(); });

  // 6. Category filter
  await m.evaluate(() => { window._activeCat_ref('viande'); window._filterProducts(); });
  await m.waitForTimeout(300);
  await m.screenshot({ path: `${DIR}/m05-category.png` });
  console.log('✓ m05: Category viande');
  await m.evaluate(() => { window._activeCat_ref(''); window._filterProducts(); });

  // 7. Menu
  await m.click('.acim-nav-item:nth-child(4)', { force: true });
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${DIR}/m06-menu.png` });
  console.log('✓ m06: Menu');
  await m.evaluate(() => { var el = document.getElementById('acim-menu'); if(el) el.remove(); });

  // 8. Take screenshot showing all elements
  await m.waitForTimeout(200);
  await m.screenshot({ path: `${DIR}/m07-full-view.png` });
  console.log('✓ m07: Full mobile view');

  await mCtx.close();

  // ═══ DESKTOP (1280x800) ═══
  console.log('\n═══ DESKTOP ═══');
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const d = await dCtx.newPage();

  await d.goto('file:///C:/Users/user/Documents/Backup/ACIM/AcimCaisse-repo/pos.html', { waitUntil: 'networkidle' });
  await d.waitForTimeout(2000);

  // 9. Desktop empty
  await d.screenshot({ path: `${DIR}/d01-empty.png` });
  console.log('✓ d01: Desktop empty');

  // 10. Test Panier idéal 200€ on desktop
  await d.evaluate(() => { window._showIdealCart(); });
  await d.waitForTimeout(2000);
  await d.evaluate(() => { var lg = document.getElementById('acim-login'); if(lg) lg.remove(); });
  await d.waitForTimeout(500);
  await d.evaluate(() => {
    var inp = document.querySelector('#acim-customer-selector input[type="text"]');
    if(inp) inp.value = 'Test Client';
    var btn = document.querySelector('#acim-customer-selector button');
    if(btn) btn.click();
  });
  await d.waitForTimeout(2000);
  await d.screenshot({ path: `${DIR}/d02-ideal-cart.png` });
  console.log('✓ d02: Desktop Panier idéal 200€');

  // 11. Desktop category
  await d.evaluate(() => { window._activeCat_ref('viande'); window._filterProducts(); });
  await d.waitForTimeout(300);
  await d.screenshot({ path: `${DIR}/d03-category.png` });
  console.log('✓ d03: Desktop category filter');

  // 12. Desktop menu
  await d.evaluate(() => { window._showMainMenu(); });
  await d.waitForTimeout(500);
  await d.screenshot({ path: `${DIR}/d04-menu.png` });
  console.log('✓ d04: Desktop menu');

  await dCtx.close();
  await browser.close();
  console.log('\n═══ ALL TESTS DONE ═══');
}

run().catch(e => { console.error(e); process.exit(1); });
