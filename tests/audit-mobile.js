// tests/audit-mobile.js - Audit autonome UI mobile AcimCaisse
// Vérifie scroll H, overflow, tap targets, pageerror, fixed OOB, contraste, inputmode, alt, touch spacing.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://localhost:8765/';

const PROFILES = [
  { label: 'iphone13', device: devices['iPhone 13'], vw: 390, vh: 844 },
  { label: 'pixel5', device: devices['Pixel 5'], vw: 393, vh: 851 }
];

const PAGES = [
  'pos.html', 'dashboard.html', 'landing.html', 'codes-barres-kg.html',
  'migration.html', 'barcode.html', 'customer-display.html',
  'post-studio.html', 'post-system.html', 'tests.html'
];

const bugs = [];

function luminance(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg, bg) {
  const l1 = luminance(fg), l2 = luminance(bg);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

async function auditPage(page, pageName, prof) {
  const local = [];
  const pushBug = (cat, sel, desc, measure, fix) => local.push({
    page: pageName, device: prof.label, cat, sel, desc, measure, fix
  });

  // pageerrors
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + pageName, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1500);

  // a. Scroll horizontal
  try {
    const h = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth
    }));
    if (h.sw > h.cw + 2) {
      pushBug('scroll-h', 'html', 'Scroll horizontal détecté',
        `scrollWidth=${h.sw} > clientWidth=${h.cw}`,
        'Identifier les éléments débordants (width fixe, marges, flex sans min-width:0)');
    }
  } catch (e) {}

  // b. Éléments dépassant du viewport
  try {
    const overflow = await page.evaluate((vw) => {
      const out = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
        if (r.right > vw + 1) {
          out.push({
            sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()),
            right: Math.round(r.right),
            w: Math.round(r.width)
          });
        }
      }
      return out.slice(0, 10);
    }, prof.vw);
    for (const o of overflow) {
      pushBug('overflow-right', o.sel, 'Élément déborde à droite',
        `right=${o.right}px (vw=${prof.vw}px, width=${o.w}px)`,
        'Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent');
    }
  } catch (e) {}

  // c. Tap targets >= 32px
  try {
    const taps = await page.evaluate(() => {
      const out = [];
      const sel = 'button, a, input, select, [role=button], [onclick]';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (cs.opacity === '0') continue;
        const min = Math.min(r.width, r.height);
        if (min < 32) {
          out.push({
            sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase() + (el.type ? '[type=' + el.type + ']' : '')),
            w: Math.round(r.width), h: Math.round(r.height),
            text: (el.textContent || el.value || '').substr(0, 30)
          });
        }
      }
      return out.slice(0, 15);
    });
    for (const t of taps) {
      pushBug('tap-target', t.sel, `Tap target trop petit (${t.text ? '"' + t.text + '"' : ''})`,
        `${t.w}x${t.h}px (< 32px)`,
        'min-width/min-height:32px, padding:8px 12px minimum');
    }
  } catch (e) {}

  // j. Touch spacing >= 8px entre boutons proches
  try {
    const spacing = await page.evaluate(() => {
      const out = [];
      const sels = 'button, a[href], [role=button], [onclick]';
      const els = [...document.querySelectorAll(sels)].filter(e => {
        const r = e.getBoundingClientRect();
        if (r.width === 0) return false;
        const cs = getComputedStyle(e);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      });
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < Math.min(i + 6, els.length); j++) {
          const a = els[i].getBoundingClientRect();
          const b = els[j].getBoundingClientRect();
          const vgap = (b.top > a.bottom) ? b.top - a.bottom : (a.top > b.bottom ? a.top - b.bottom : 0);
          const hgap = (b.left > a.right) ? b.left - a.right : (a.left > b.right ? a.left - b.right : 0);
          if (a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left) {
            const gap = Math.max(vgap, hgap);
            if (gap > 0 && gap < 8) {
              out.push({
                a: els[i].id || els[i].tagName.toLowerCase(),
                b: els[j].id || els[j].tagName.toLowerCase(),
                gap: Math.round(gap)
              });
            }
          }
        }
      }
      return out.slice(0, 5);
    });
    for (const s of spacing) {
      pushBug('touch-spacing', `${s.a} ↔ ${s.b}`, 'Boutons trop proches',
        `gap=${s.gap}px (< 8px)`, 'Ajouter margin >= 8px entre les éléments interactifs');
    }
  } catch (e) {}

  // d. Pageerrors
  for (const e of errors) {
    pushBug('pageerror', '-', 'JS error', e.substr(0, 200), 'Corriger l\'erreur JS');
  }

  // e. Fixed OOB
  try {
    const fixed = await page.evaluate((vw, vh) => {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
          out.push({
            sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()),
            r: `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`
          });
        }
      }
      return out.slice(0, 5);
    }, prof.vw, prof.vh);
    for (const f of fixed) {
      pushBug('fixed-oob', f.sel, 'Élément fixed hors viewport',
        `rect=${f.r} (vw=${prof.vw}x${prof.vh})`, 'Bornir à viewport (max-width:100vw, transform:translateX(-50%) pour centrage)');
    }
  } catch (e) {}

  // f. Contraste
  try {
    const contrast_bugs = await page.evaluate(() => {
      const out = [];
      const all = document.querySelectorAll('*');
      let count = 0;
      for (const el of all) {
        if (count++ > 400) break;
        const cs = getComputedStyle(el);
        const color = cs.color;
        const bg = cs.backgroundColor;
        if (!color || color === 'rgba(0, 0, 0, 0)') continue;
        const txt = (el.textContent || '').trim();
        if (!txt || txt.length > 80) continue;
        if (el.children.length > 0 && el.childNodes[0].nodeType !== 3) continue;
        const fs = parseFloat(cs.fontSize);
        if (fs >= 18) continue;
        const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        const bgm = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!m) continue;
        let bgRgb = bgm ? [bgm[1], bgm[2], bgm[3]] : null;
        let cur = el.parentElement;
        while (!bgRgb && cur) {
          const pcs = getComputedStyle(cur);
          const pbg = pcs.backgroundColor;
          const pm = pbg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (pm) bgRgb = [pm[1], pm[2], pm[3]];
          cur = cur.parentElement;
        }
        if (!bgRgb) bgRgb = ['255', '255', '255'];
        const toHex = rgb => '#' + rgb.map(x => (+x).toString(16).padStart(2, '0')).join('');
        out.push({
          sel: el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase()),
          fg: toHex([m[1], m[2], m[3]]),
          bg: toHex(bgRgb),
          fs: Math.round(fs),
          text: txt.substr(0, 30)
        });
      }
      return out;
    });
    for (const c of contrast_bugs) {
      const ratio = contrast(c.fg, c.bg);
      if (ratio != null && ratio < 4.5 && ratio > 0.1) {
        pushBug('contrast', c.sel, `Contraste faible "${c.text}"`,
          `ratio=${ratio.toFixed(2)} (fg=${c.fg} bg=${c.bg} fs=${c.fs}px)`,
          'Ajuster couleur pour ratio >= 4.5 (WCAG AA)');
      }
    }
  } catch (e) {}

  // g. inputmode manquant
  try {
    const inputs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('input')) {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'checkbox' || el.type === 'radio') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const isNumeric = /\d|prix|montant|qt|stock|code|pin|zip|postal|tel|phone/i.test(el.placeholder || el.id || el.name || '');
        if (isNumeric && el.type !== 'number' && el.type !== 'tel' && el.type !== 'date' && !el.inputMode) {
          out.push({
            sel: el.id ? '#' + el.id : (el.name ? 'input[name=' + el.name + ']' : 'input'),
            type: el.type, ph: el.placeholder || ''
          });
        }
      }
      return out.slice(0, 8);
    });
    for (const i of inputs) {
      pushBug('inputmode', i.sel, 'Inputmode manquant pour saisie numérique',
        `type=${i.type} placeholder="${i.ph}"`, 'Ajouter inputmode="numeric" ou type="tel"');
    }
  } catch (e) {}

  // h. alt missing
  try {
    const imgs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('img')) {
        if (!el.hasAttribute('alt')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          out.push({
            src: el.src.replace(/^.*\/([^/]+)$/, '$1').substr(0, 40),
            w: Math.round(r.width), h: Math.round(r.height)
          });
        }
      }
      return out.slice(0, 8);
    });
    for (const i of imgs) {
      pushBug('alt-missing', `img[${i.src}]`, 'Image sans alt',
        `${i.w}x${i.h}px`, 'Ajouter alt="description" ou alt="" si pure déco');
    }
  } catch (e) {}

  // i. overflow:hidden sur body
  try {
    const bodyOverflow = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { x: cs.overflowX, y: cs.overflowY, h: cs.height };
    });
    if (bodyOverflow.x === 'hidden' && bodyOverflow.h !== 'auto' && parseInt(bodyOverflow.h) > 0 && parseInt(bodyOverflow.h) < 100) {
      // body overflow hidden peut casser scroll si authorized height pas viewport
    }
    if (bodyOverflow.x === 'hidden' && bodyOverflow.y === 'hidden') {
      // OK souvent intentionnel
    }
  } catch (e) {}

  return local;
}

// 5. Audit spécifique #acim-pos-checkout / .acim-bottom-nav
async function auditCheckoutConflict(page, prof) {
  const local = [];
  try {
    await page.goto(BASE + 'pos.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    // login
    const loginVisible = await page.locator('#acim-login').isVisible().catch(() => false);
    if (loginVisible) {
      await page.locator('#acim-login input[type=password]').fill('1234');
      await page.locator('#acim-login button').last().tap();
      await page.waitForTimeout(900);
    }
    const zinfo = await page.evaluate(() => {
      const zOf = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { z: cs.zIndex, display: cs.display, visibility: cs.visibility, pointerEvents: cs.pointerEvents };
      };
      return {
        bottomNav: zOf(document.querySelector('.acim-bottom-nav')),
        sheet: zOf(document.querySelector('#acim-sheet')),
        checkout: zOf(document.querySelector('#acim-pos-checkout')),
        checkoutRect: (() => {
          const el = document.querySelector('#acim-pos-checkout');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
        })(),
        navRect: (() => {
          const el = document.querySelector('.acim-bottom-nav');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
        })(),
        sheetRect: (() => {
          const el = document.querySelector('#acim-sheet');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
        })()
      };
    });
    local.push({ page: 'pos.html', device: prof.label, cat: 'zstack-info', sel: '.acim-bottom-nav vs #acim-sheet vs #acim-pos-checkout',
      desc: 'Z-stack checkout/bottom-nav', measure: JSON.stringify(zinfo), fix: 'analyse' });
    // Vérifier si le bottom-nav couvre le bouton checkout
    if (zinfo.checkoutRect && zinfo.navRect) {
      const checkoutBottom = zinfo.checkoutRect.bottom;
      const navTop = zinfo.navRect.top;
      // Bouton en bas: checkout.bottom est dans la zone du bottom-nav
      if (checkoutBottom > navTop) {
        local.push({ page: 'pos.html', device: prof.label, cat: 'pointer-block', sel: '#acim-pos-checkout',
          desc: 'Bottom-nav intercepte les pointer events du bouton Encaisser',
          measure: `checkout.bottom=${checkoutBottom}px vs bottomNav.top=${navTop}px (overlap=${checkoutBottom - navTop}px)`,
          fix: 'Augmenter z-index de #acim-sheet et #acim-pos-checkout > z-index .acim-bottom-nav, OU masquer .acim-bottom-nav quand #acim-sheet est ouvert, OU pointer-events:none sur .acim-bottom-nav quand sheet ouvert' });
      }
    }
  } catch (e) {
    local.push({ page: 'pos.html', device: prof.label, cat: 'audit-error', sel: '-', desc: 'Checkout audit failed: ' + e.message, measure: '', fix: '' });
  }
  return local;
}

(async () => {
  console.log('=== AcimCaisse audit mobile — start ===');
  const browser = await chromium.launch({ headless: true });
  let totalBugs = 0;
  let shotCount = 0;
  const perCat = {};
  const criticals = [];

  for (const prof of PROFILES) {
    console.log('\n--- Profile: ' + prof.label + ' (' + prof.vw + 'x' + prof.vh + ') ---');
    for (const pageName of PAGES) {
      process.stdout.write('  ' + pageName + ' ... ');
      const ctx = await browser.newContext({ ...prof.device });
      const page = await ctx.newPage();
      page.setDefaultTimeout(20000);
      try {
        const found = await auditPage(page, pageName, prof);
        if (found.length > 0) {
          console.log(found.length + ' bug(s)');
          // screenshot si bug
          try {
            const file = path.join(SHOTS, `audit-${prof.label}-${pageName.replace('.', '-')}.png`);
            await page.screenshot({ path: file, fullPage: false });
            shotCount++;
          } catch (_) {}
          for (const b of found) {
            bugs.push(b);
            perCat[b.cat] = (perCat[b.cat] || 0) + 1;
            totalBugs++;
            if (['scroll-h', 'overflow-right', 'pageerror', 'pointer-block', 'fixed-oob'].includes(b.cat)) {
              criticals.push(b);
            }
          }
        } else {
          console.log('clean');
        }
      } catch (e) {
        console.log('ERROR: ' + e.message);
        bugs.push({ page: pageName, device: prof.label, cat: 'load-error', sel: '-', desc: 'Page load failed: ' + e.message, measure: '', fix: '' });
        totalBugs++;
      }
      await ctx.close();
    }
    // Audit spécifique checkout conflict
    const ctx2 = await browser.newContext({ ...prof.device });
    const page2 = await ctx2.newPage();
    const cbugs = await auditCheckoutConflict(page2, prof);
    for (const b of cbugs) {
      if (b.cat === 'pointer-block') {
        try {
          const file = path.join(SHOTS, `audit-${prof.label}-checkout-conflict.png`);
          await page2.screenshot({ path: file, fullPage: false });
          shotCount++;
        } catch (_) {}
        criticals.push(b);
      }
      bugs.push(b);
      if (b.cat !== 'zstack-info') {
        perCat[b.cat] = (perCat[b.cat] || 0) + 1;
        totalBugs++;
      }
    }
    await ctx2.close();
  }

  await browser.close();

  // Génération du rapport markdown
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(__dirname, '..', 'docs', `audit-mobile-${today}.md`);
  let md = `# Audit UI Mobile AcimCaisse — ${today}\n\n`;
  md += `Audit autonome via Playwright (iPhone 13 + Pixel 5, headless).\n`;
  md += `Pages auditées: ${PAGES.length} × ${PROFILES.length} devices = ${PAGES.length * PROFILES.length} runs.\n\n`;
  md += `## Synthèse\n\n`;
  md += `- **Bugs trouvés**: ${totalBugs}\n`;
  md += `- **Screenshots**: ${shotCount} (dans tests/screenshots/)\n`;
  md += `- **Bugs critiques**: ${criticals.length}\n\n`;
  md += `### Par catégorie\n\n| Catégorie | Nombre |\n|---|---|\n`;
  for (const [cat, n] of Object.entries(perCat).sort((a, b) => b[1] - a[1])) {
    md += `| ${cat} | ${n} |\n`;
  }
  md += `\n## Bugs critiques (bloquent l'UX mobile)\n\n`;
  if (criticals.length === 0) md += '_Aucun bug critique détecté._\n\n';
  else {
    md += '| Page | Device | Sélecteur | Catégorie | Mesure | Suggestion |\n|---|---|---|---|---|---|\n';
    for (const b of criticals) {
      md += `| ${b.page} | ${b.device} | ${b.sel} | ${b.cat} | ${b.measure.replace(/\|/g, '\\|')} | ${b.fix.replace(/\|/g, '\\|')} |\n`;
    }
    md += '\n';
  }
  md += `## Tous les bugs\n\n`;
  md += '| Page | Device | Catégorie | Sélecteur | Description | Mesure | Suggestion |\n|---|---|---|---|---|---|---|\n';
  for (const b of bugs.filter(b => b.cat !== 'zstack-info')) {
    const desc = (b.desc || '').replace(/\|/g, '\\|').substr(0, 80);
    md += `| ${b.page} | ${b.device} | ${b.cat} | ${b.sel} | ${desc} | ${b.measure.replace(/\|/g, '\\|')} | ${b.fix.replace(/\|/g, '\\|')} |\n`;
  }
  // Z-stack info détaillée pour checkout conflict
  md += `\n## Analyse z-stack #acim-pos-checkout / .acim-bottom-nav\n\n`;
  for (const b of bugs.filter(b => b.cat === 'zstack-info')) {
    md += `### ${b.device}\n measure: \`${b.measure}\`\n suggestion: ${b.fix}\n\n`;
  }
  md += `\n## Top 5 corrections à prioriser\n\n`;
  // Trier criticals par impact
  const top = criticals.slice(0, 5);
  if (top.length === 0) {
    md += 'Aucun bug critique — prioriser les bugs mineurs d\'accessibilité (alt, inputmode, contraste).\n';
  } else {
    top.forEach((b, i) => {
      md += `${i + 1}. **${b.page} - ${b.sel}** (${b.cat}): ${b.desc}\n   Mesure: ${b.measure}\n   Fix: ${b.fix}\n\n`;
    });
  }
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log('\n=== Résumé ===');
  console.log('Bugs total:', totalBugs);
  console.log('Bugs critiques:', criticals.length);
  console.log('Par catégorie:', JSON.stringify(perCat));
  console.log('Rapport:', reportPath);
  console.log('=== Fin audit ===');
})();
