# Audit UI Mobile AcimCaisse — 2026-08-10

Audit autonome via Playwright (iPhone 13 + Pixel 5, headless).
Pages auditées: 10 × 2 devices = 20 runs.

## Synthèse

- **Bugs trouvés**: 671
- **Screenshots**: 20 (dans tests/screenshots/)
- **Bugs critiques**: 132

### Par catégorie

| Catégorie | Nombre |
|---|---|
| contrast | 419 |
| overflow-right | 126 |
| tap-target | 80 |
| alt-missing | 32 |
| inputmode | 6 |
| scroll-h | 4 |
| touch-spacing | 2 |
| pointer-block | 2 |

## Bugs critiques (bloquent l'UX mobile)

| Page | Device | Sélecteur | Catégorie | Mesure | Suggestion |
|---|---|---|---|---|---|
| pos.html | iphone13 | #acim-actor-badge | overflow-right | right=416px (vw=390px, width=92px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | button | overflow-right | right=416px (vw=390px, width=84px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-item | overflow-right | right=400px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-icon | overflow-right | right=396px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-item | overflow-right | right=480px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-icon | overflow-right | right=476px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-label | overflow-right | right=469px (vw=390px, width=42px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-item | overflow-right | right=560px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-icon | overflow-right | right=556px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | .acim-category-label | overflow-right | right=549px (vw=390px, width=43px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | html | scroll-h | scrollWidth=1034 > clientWidth=980 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| dashboard.html | iphone13 | .container | overflow-right | right=980px (vw=390px, width=980px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | .no-print | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | button | overflow-right | right=960px (vw=390px, width=173px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | header | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | h1 | overflow-right | right=940px (vw=390px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | .subtitle | overflow-right | right=940px (vw=390px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | h2 | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | .row | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | .card | overflow-right | right=483px (vw=390px, width=224px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | .label | overflow-right | right=464px (vw=390px, width=183px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .ue-card | overflow-right | right=548px (vw=390px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .body | overflow-right | right=547px (vw=390px, width=256px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .name | overflow-right | right=533px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .meta | overflow-right | right=533px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .eta | overflow-right | right=631px (vw=390px, width=327px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | svg | overflow-right | right=579px (vw=390px, width=274px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .ue-card | overflow-right | right=821px (vw=390px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .body | overflow-right | right=820px (vw=390px, width=256px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .name | overflow-right | right=806px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | .meta | overflow-right | right=806px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | h1 | overflow-right | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .subtitle | overflow-right | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .info | overflow-right | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .no-print | overflow-right | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | button | overflow-right | right=630px (vw=390px, width=280px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .grid | overflow-right | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .card | overflow-right | right=643px (vw=390px, width=307px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .cat | overflow-right | right=509px (vw=390px, width=38px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .name | overflow-right | right=579px (vw=390px, width=178px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | .barcode | overflow-right | right=594px (vw=390px, width=208px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | .no-print | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | h1 | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | .sous-titre | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | .section | overflow-right | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | h2 | overflow-right | right=944px (vw=390px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | .form-row | overflow-right | right=944px (vw=390px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | div | overflow-right | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | label | overflow-right | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | #inpCode | overflow-right | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | div | overflow-right | right=532px (vw=390px, width=80px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | html | scroll-h | scrollWidth=664 > clientWidth=390 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| post-studio.html | iphone13 | .flex-1 | overflow-right | right=664px (vw=390px, width=664px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .mb-4 | overflow-right | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .flex | overflow-right | right=631px (vw=390px, width=598px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .rounded-full | overflow-right | right=631px (vw=390px, width=87px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .shrink-0 | overflow-right | right=508px (vw=390px, width=117px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .shrink-0 | overflow-right | right=631px (vw=390px, width=115px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | div | overflow-right | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .relative | overflow-right | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .absolute | overflow-right | right=647px (vw=390px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | .relative | overflow-right | right=647px (vw=390px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | .ps-banner__blob | overflow-right | right=418px (vw=390px, width=220px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | .ps-cat | overflow-right | right=438px (vw=390px, width=111px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | .ps-cat | overflow-right | right=558px (vw=390px, width=112px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | #acim-pos-checkout | pointer-block | checkout.bottom=1123px vs bottomNav.top=604px (overlap=519px) | Augmenter z-index de #acim-sheet et #acim-pos-checkout > z-index .acim-bottom-nav, OU masquer .acim-bottom-nav quand #acim-sheet est ouvert, OU pointer-events:none sur .acim-bottom-nav quand sheet ouvert |
| pos.html | pixel5 | #acim-actor-badge | overflow-right | right=416px (vw=393px, width=92px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | button | overflow-right | right=416px (vw=393px, width=84px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-item | overflow-right | right=400px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-icon | overflow-right | right=396px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-item | overflow-right | right=480px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-icon | overflow-right | right=476px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-label | overflow-right | right=469px (vw=393px, width=42px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-item | overflow-right | right=560px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-icon | overflow-right | right=556px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | .acim-category-label | overflow-right | right=549px (vw=393px, width=43px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | html | scroll-h | scrollWidth=1034 > clientWidth=980 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| dashboard.html | pixel5 | .container | overflow-right | right=980px (vw=393px, width=980px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | .no-print | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | button | overflow-right | right=960px (vw=393px, width=173px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | header | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | h1 | overflow-right | right=940px (vw=393px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | .subtitle | overflow-right | right=940px (vw=393px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | h2 | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | .row | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | .card | overflow-right | right=483px (vw=393px, width=224px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | .label | overflow-right | right=464px (vw=393px, width=183px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .ue-card | overflow-right | right=552px (vw=393px, width=260px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | img | overflow-right | right=551px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .body | overflow-right | right=551px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .name | overflow-right | right=537px (vw=393px, width=230px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .meta | overflow-right | right=537px (vw=393px, width=230px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .eta | overflow-right | right=633px (vw=393px, width=327px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | svg | overflow-right | right=581px (vw=393px, width=274px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .ue-card | overflow-right | right=828px (vw=393px, width=260px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | img | overflow-right | right=827px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | .body | overflow-right | right=827px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | h1 | overflow-right | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .subtitle | overflow-right | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .info | overflow-right | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .no-print | overflow-right | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | button | overflow-right | right=630px (vw=393px, width=280px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .grid | overflow-right | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .card | overflow-right | right=643px (vw=393px, width=307px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .cat | overflow-right | right=509px (vw=393px, width=38px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .name | overflow-right | right=579px (vw=393px, width=178px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | .barcode | overflow-right | right=594px (vw=393px, width=208px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | .no-print | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | h1 | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | .sous-titre | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | .section | overflow-right | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | h2 | overflow-right | right=944px (vw=393px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | .form-row | overflow-right | right=944px (vw=393px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | div | overflow-right | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | label | overflow-right | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | #inpCode | overflow-right | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | div | overflow-right | right=532px (vw=393px, width=80px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | html | scroll-h | scrollWidth=664 > clientWidth=393 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| post-studio.html | pixel5 | .flex-1 | overflow-right | right=664px (vw=393px, width=664px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .mb-4 | overflow-right | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .flex | overflow-right | right=631px (vw=393px, width=598px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .rounded-full | overflow-right | right=631px (vw=393px, width=87px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .shrink-0 | overflow-right | right=508px (vw=393px, width=117px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .shrink-0 | overflow-right | right=631px (vw=393px, width=115px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | div | overflow-right | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .relative | overflow-right | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .absolute | overflow-right | right=647px (vw=393px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | .relative | overflow-right | right=647px (vw=393px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | .ps-banner__blob | overflow-right | right=421px (vw=393px, width=220px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | .ps-cat | overflow-right | right=438px (vw=393px, width=111px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | .ps-cat | overflow-right | right=558px (vw=393px, width=112px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | #acim-pos-checkout | pointer-block | checkout.bottom=1186px vs bottomNav.top=667px (overlap=519px) | Augmenter z-index de #acim-sheet et #acim-pos-checkout > z-index .acim-bottom-nav, OU masquer .acim-bottom-nav quand #acim-sheet est ouvert, OU pointer-events:none sur .acim-bottom-nav quand sheet ouvert |

## Tous les bugs

| Page | Device | Catégorie | Sélecteur | Description | Mesure | Suggestion |
|---|---|---|---|---|---|---|
| pos.html | iphone13 | overflow-right | #acim-actor-badge | Élément déborde à droite | right=416px (vw=390px, width=92px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | button | Élément déborde à droite | right=416px (vw=390px, width=84px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-item | Élément déborde à droite | right=400px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-icon | Élément déborde à droite | right=396px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-item | Élément déborde à droite | right=480px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-icon | Élément déborde à droite | right=476px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-label | Élément déborde à droite | right=469px (vw=390px, width=42px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-item | Élément déborde à droite | right=560px (vw=390px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-icon | Élément déborde à droite | right=556px (vw=390px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | overflow-right | .acim-category-label | Élément déborde à droite | right=549px (vw=390px, width=43px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | iphone13 | tap-target | #acim-pos-search | Tap target trop petit () | 199x20px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | #mk-search-voice | Tap target trop petit ("🎤") | 34x23px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | button[type=submit] | Tap target trop petit ("Connexion") | 84x25px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | button[type=submit] | Tap target trop petit ("⇅ Trier") | 56x22px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | iphone13 | touch-spacing | button ↔ button | Boutons trop proches | gap=6px (< 8px) | Ajouter margin >= 8px entre les éléments interactifs |
| pos.html | iphone13 | contrast | #acim-splash | Contraste faible "🏪 AcimCaisse
    Chargement d" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | span | Contraste faible "👤 ops?" | ratio=3.54 (fg=#888888 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-category-label | Contraste faible "Tous" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "12,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "8,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "12,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "59,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "19,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "35,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "14,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "69,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "25,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "20,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "22,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "79,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "10,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "8,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "7,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "25,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "20,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "0,18 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "17,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "14,32 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "50,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "57,60 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "10,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "7,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "35,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-price | Contraste faible "13,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | iphone13 | inputmode | #acim-pos-search | Inputmode manquant pour saisie numérique | type=text placeholder="Rechercher un produit ou scanner un code-barres..." | Ajouter inputmode="numeric" ou type="tel" |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 74x74px | Ajouter alt="description" ou alt="" si pure déco |
| dashboard.html | iphone13 | scroll-h | html | Scroll horizontal détecté | scrollWidth=1034 > clientWidth=980 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| dashboard.html | iphone13 | overflow-right | .container | Élément déborde à droite | right=980px (vw=390px, width=980px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | .no-print | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | button | Élément déborde à droite | right=960px (vw=390px, width=173px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | header | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | h1 | Élément déborde à droite | right=940px (vw=390px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | .subtitle | Élément déborde à droite | right=940px (vw=390px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | h2 | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | .row | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | .card | Élément déborde à droite | right=483px (vw=390px, width=224px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | overflow-right | .label | Élément déborde à droite | right=464px (vw=390px, width=183px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | iphone13 | contrast | .subtitle | Contraste faible "Période : 16/07/2026 → 04/08/2" | ratio=1.07 (fg=#ffffff bg=#f5f7fa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | div | Contraste faible "89 ventes valides" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | div | Contraste faible "89 tickets" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | div | Contraste faible "Pertes : 497,50 € (2.2%)" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | div | Contraste faible "78 produits distincts" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | div | Contraste faible "12 catégories" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | .bar-label | Contraste faible "14712,69 €" | ratio=1.14 (fg=#ffffff bg=#f0f0f0 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | .badge | Contraste faible "Espèces" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | .badge | Contraste faible "Carte" | ratio=3.04 (fg=#ffffff bg=#17a2b8 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | em | Contraste faible "Aucun item" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | em | Contraste faible "—" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | em | Contraste faible "Aucun item" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | em | Contraste faible "—" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | .badge | Contraste faible "livrée" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | iphone13 | contrast | .badge | Contraste faible "livrée" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | overflow-right | .ue-card | Élément déborde à droite | right=548px (vw=390px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .body | Élément déborde à droite | right=547px (vw=390px, width=256px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .name | Élément déborde à droite | right=533px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .meta | Élément déborde à droite | right=533px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .eta | Élément déborde à droite | right=631px (vw=390px, width=327px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | svg | Élément déborde à droite | right=579px (vw=390px, width=274px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .ue-card | Élément déborde à droite | right=821px (vw=390px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .body | Élément déborde à droite | right=820px (vw=390px, width=256px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .name | Élément déborde à droite | right=806px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | overflow-right | .meta | Élément déborde à droite | right=806px (vw=390px, width=228px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("Restaurants") | 74x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("À propos") | 58x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("Caisse") | 39x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("Caisse") | 35x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("Post Studio") | 64x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | tap-target | a | Tap target trop petit ("Source") | 39x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | iphone13 | contrast | a | Contraste faible "Restaurants" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | a | Contraste faible "À propos" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | a | Contraste faible "Caisse" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | #hero-cta | Contraste faible "Commander" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | .ue-footer-copy | Contraste faible "© 2026 PostSystem — AcimCaisse" | ratio=2.73 (fg=#999999 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | a | Contraste faible "Caisse" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | a | Contraste faible "Post Studio" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | a | Contraste faible "Source" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | iphone13 | contrast | #sticky-cta | Contraste faible "Commander maintenant" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=15px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| codes-barres-kg.html | iphone13 | overflow-right | h1 | Élément déborde à droite | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .subtitle | Élément déborde à droite | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .info | Élément déborde à droite | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .no-print | Élément déborde à droite | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | button | Élément déborde à droite | right=630px (vw=390px, width=280px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .grid | Élément déborde à droite | right=965px (vw=390px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .card | Élément déborde à droite | right=643px (vw=390px, width=307px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .cat | Élément déborde à droite | right=509px (vw=390px, width=38px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .name | Élément déborde à droite | right=579px (vw=390px, width=178px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | iphone13 | overflow-right | .barcode | Élément déborde à droite | right=594px (vw=390px, width=208px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| migration.html | iphone13 | contrast | #btn1 | Contraste faible "🔍 Scanner et migrer automatiq" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | iphone13 | overflow-right | .no-print | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | h1 | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | .sous-titre | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | .section | Élément déborde à droite | right=960px (vw=390px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | h2 | Élément déborde à droite | right=944px (vw=390px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | .form-row | Élément déborde à droite | right=944px (vw=390px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | div | Élément déborde à droite | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | label | Élément déborde à droite | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | #inpCode | Élément déborde à droite | right=444px (vw=390px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | overflow-right | div | Élément déborde à droite | right=532px (vw=390px, width=80px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | iphone13 | tap-target | #inpNom | Tap target trop petit () | 200x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | #inpCode | Tap target trop petit () | 200x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | #inpQte | Tap target trop petit ("1") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | .btn | Tap target trop petit ("+ Ajouter") | 89x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | #inpPrefix | Tap target trop petit ("3000") | 100x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | #inpDebut | Tap target trop petit ("1") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | tap-target | #inpFin | Tap target trop petit ("30") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | iphone13 | contrast | .btn | Contraste faible "+ Ajouter" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | iphone13 | contrast | .btn | Contraste faible "🖨️ Imprimer" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | iphone13 | inputmode | #inpCode | Inputmode manquant pour saisie numérique | type=text placeholder="Ex: 3760001000019" | Ajouter inputmode="numeric" ou type="tel" |
| post-studio.html | iphone13 | scroll-h | html | Scroll horizontal détecté | scrollWidth=664 > clientWidth=390 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| post-studio.html | iphone13 | overflow-right | .flex-1 | Élément déborde à droite | right=664px (vw=390px, width=664px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .mb-4 | Élément déborde à droite | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .flex | Élément déborde à droite | right=631px (vw=390px, width=598px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .rounded-full | Élément déborde à droite | right=631px (vw=390px, width=87px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .shrink-0 | Élément déborde à droite | right=508px (vw=390px, width=117px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .shrink-0 | Élément déborde à droite | right=631px (vw=390px, width=115px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | div | Élément déborde à droite | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .relative | Élément déborde à droite | right=648px (vw=390px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .absolute | Élément déborde à droite | right=647px (vw=390px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | overflow-right | .relative | Élément déborde à droite | right=647px (vw=390px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | iphone13 | tap-target | .text-zinc-600 | Tap target trop petit ("Accueil") | 38x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | iphone13 | tap-target | .text-zinc-600 | Tap target trop petit ("Caisse") | 33x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | iphone13 | tap-target | .text-zinc-600 | Tap target trop petit ("Source") | 36x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | iphone13 | contrast | .font-medium | Contraste faible "Terra Rosa" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .font-medium | Contraste faible "Saigon 82" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Bistro Nova" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .shrink-0 | Contraste faible "Dashboard" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Voir le calendrier" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .font-medium | Contraste faible "Publication planifiée" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Paris" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Lunch express" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Clients fidèles" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Déjeuner" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "App mobile" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Site web" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Publier maintenant" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | iphone13 | contrast | .rounded-full | Contraste faible "Programmé" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | overflow-right | .ps-banner__blob | Élément déborde à droite | right=418px (vw=390px, width=220px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | overflow-right | .ps-cat | Élément déborde à droite | right=438px (vw=390px, width=111px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | overflow-right | .ps-cat | Élément déborde à droite | right=558px (vw=390px, width=112px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | iphone13 | tap-target | .ps-demo-btn | Tap target trop petit ("🎬 Mode démo") | 120x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | tap-target | #ps-search | Tap target trop petit () | 298x20px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | tap-target | .close | Tap target trop petit ("✕") | 28x39px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | tap-target | a | Tap target trop petit ("Accueil") | 37x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | tap-target | a | Tap target trop petit ("Post Studio") | 59x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | tap-target | a | Tap target trop petit ("Source") | 36x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | iphone13 | contrast | .ps-logo__badge | Contraste faible "🛵" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=17px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-demo-btn | Contraste faible "🎬 Mode démo" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-resto-desc | Contraste faible "Pizzas, pâtes & cuisine italie" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=15px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-banner__meta | Contraste faible "⭐ 4,8
        🕑 25–35 min
   " | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "⭐ 4,8" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-rate | Contraste faible "4,8" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "🕑 25–35 min" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-eta | Contraste faible "25–35 min" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "🛵 2,90 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-fee | Contraste faible "2,90 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "💰 10,00 € minimum" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-min | Contraste faible "10,00 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .t | Contraste faible "Aucun plat trouvé" | ratio=4.41 (fg=#757575 bg=#fafafa fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .s | Contraste faible "Essayez un autre mot-clé ou un" | ratio=1.96 (fg=#b5b5b5 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | #ps-cart-count | Contraste faible "0 article" | ratio=3.35 (fg=#059c54 bg=#e8fdf0 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "Ajoutez des plats pour commenc" | ratio=2.05 (fg=#b5b5b5 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | b | Contraste faible "GRATUITE" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "💰 Ajoutez un produit" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-btn__sub | Contraste faible "0,00 €" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "Ajoutez des plats pour commenc" | ratio=2.05 (fg=#b5b5b5 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | b | Contraste faible "GRATUITE" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | span | Contraste faible "💰 Ajoutez un produit" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ps-btn__sub | Contraste faible "0,00 €" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | .ue-copyright | Contraste faible "© 2026 PostSystem — AcimCaisse" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | a | Contraste faible "Accueil" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | a | Contraste faible "Post Studio" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | iphone13 | contrast | a | Contraste faible "Source" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | tap-target | #acim-pos-search | Tap target trop petit () | 177x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | iphone13 | tap-target | button[type=submit] | Tap target trop petit ("Connexion") | 89x25px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | iphone13 | tap-target | button[type=submit] | Tap target trop petit ("Appliquer une remise") | 159x29px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | iphone13 | contrast | #runAll | Contraste faible "▶️ Tout lancer" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #runNormal | Contraste faible "1. Vente normale" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #runKg | Contraste faible "2. Vente kg" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #runConcurrent | Contraste faible "3. Vente concurrente" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #runUndo | Contraste faible "4. Ticket annulé" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #runBackup | Contraste faible "5. Backup/Restore" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-header-btn | Contraste faible "+" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-header-btn | Contraste faible "✕" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | #mk-search-voice | Contraste faible "🎤" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | button | Contraste faible "Connexion" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | button | Contraste faible "⇅ Trier" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | iphone13 | inputmode | #acim-pos-search | Inputmode manquant pour saisie numérique | type=text placeholder="Rechercher un produit ou scanner un code-barres..." | Ajouter inputmode="numeric" ou type="tel" |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | iphone13 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 256x256px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | iphone13 | pointer-block | #acim-pos-checkout | Bottom-nav intercepte les pointer events du bouton Encaisser | checkout.bottom=1123px vs bottomNav.top=604px (overlap=519px) | Augmenter z-index de #acim-sheet et #acim-pos-checkout > z-index .acim-bottom-nav, OU masquer .acim-bottom-nav quand #acim-sheet est ouvert, OU pointer-events:none sur .acim-bottom-nav quand sheet ouvert |
| pos.html | pixel5 | overflow-right | #acim-actor-badge | Élément déborde à droite | right=416px (vw=393px, width=92px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | button | Élément déborde à droite | right=416px (vw=393px, width=84px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-item | Élément déborde à droite | right=400px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-icon | Élément déborde à droite | right=396px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-item | Élément déborde à droite | right=480px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-icon | Élément déborde à droite | right=476px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-label | Élément déborde à droite | right=469px (vw=393px, width=42px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-item | Élément déborde à droite | right=560px (vw=393px, width=64px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-icon | Élément déborde à droite | right=556px (vw=393px, width=56px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | overflow-right | .acim-category-label | Élément déborde à droite | right=549px (vw=393px, width=43px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| pos.html | pixel5 | tap-target | #acim-pos-search | Tap target trop petit () | 199x20px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | #mk-search-voice | Tap target trop petit ("🎤") | 34x23px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | button[type=submit] | Tap target trop petit ("Connexion") | 84x25px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | button[type=submit] | Tap target trop petit ("⇅ Trier") | 56x22px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-camera | Tap target trop petit ("📷") | 28x28px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | tap-target | .acim-product-delete | Tap target trop petit ("🗑️") | 24x24px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| pos.html | pixel5 | touch-spacing | button ↔ button | Boutons trop proches | gap=6px (< 8px) | Ajouter margin >= 8px entre les éléments interactifs |
| pos.html | pixel5 | contrast | #acim-splash | Contraste faible "🏪 AcimCaisse
    Chargement d" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | span | Contraste faible "👤 ops?" | ratio=3.54 (fg=#888888 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-category-label | Contraste faible "Tous" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "7,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "25,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "20,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "12,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "0,18 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "17,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "14,32 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "50,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "7,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "57,60 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "10,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "7,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "35,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "0,01 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "13,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "12,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "59,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "19,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "35,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "14,90 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "69,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "25,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "20,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "22,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "79,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "10,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-price | Contraste faible "10,00 €" | ratio=3.79 (fg=#e65100 bg=#ffffff fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| pos.html | pixel5 | inputmode | #acim-pos-search | Inputmode manquant pour saisie numérique | type=text placeholder="Rechercher un produit ou scanner un code-barres..." | Ajouter inputmode="numeric" ou type="tel" |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 76x76px | Ajouter alt="description" ou alt="" si pure déco |
| dashboard.html | pixel5 | scroll-h | html | Scroll horizontal détecté | scrollWidth=1034 > clientWidth=980 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| dashboard.html | pixel5 | overflow-right | .container | Élément déborde à droite | right=980px (vw=393px, width=980px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | .no-print | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | button | Élément déborde à droite | right=960px (vw=393px, width=173px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | header | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | h1 | Élément déborde à droite | right=940px (vw=393px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | .subtitle | Élément déborde à droite | right=940px (vw=393px, width=900px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | h2 | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | .row | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | .card | Élément déborde à droite | right=483px (vw=393px, width=224px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | overflow-right | .label | Élément déborde à droite | right=464px (vw=393px, width=183px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| dashboard.html | pixel5 | contrast | .subtitle | Contraste faible "Période : 16/07/2026 → 04/08/2" | ratio=1.07 (fg=#ffffff bg=#f5f7fa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | div | Contraste faible "89 ventes valides" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | div | Contraste faible "89 tickets" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | div | Contraste faible "Pertes : 497,50 € (2.2%)" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | div | Contraste faible "78 produits distincts" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | div | Contraste faible "12 catégories" | ratio=2.85 (fg=#999999 bg=#ffffff fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | .bar-label | Contraste faible "14712,69 €" | ratio=1.14 (fg=#ffffff bg=#f0f0f0 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | .badge | Contraste faible "Espèces" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | .badge | Contraste faible "Carte" | ratio=3.04 (fg=#ffffff bg=#17a2b8 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | em | Contraste faible "Aucun item" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | em | Contraste faible "—" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | em | Contraste faible "Aucun item" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | em | Contraste faible "—" | ratio=2.85 (fg=#999999 bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | .badge | Contraste faible "livrée" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| dashboard.html | pixel5 | contrast | .badge | Contraste faible "livrée" | ratio=3.13 (fg=#ffffff bg=#28a745 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | overflow-right | .ue-card | Élément déborde à droite | right=552px (vw=393px, width=260px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | img | Élément déborde à droite | right=551px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .body | Élément déborde à droite | right=551px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .name | Élément déborde à droite | right=537px (vw=393px, width=230px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .meta | Élément déborde à droite | right=537px (vw=393px, width=230px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .eta | Élément déborde à droite | right=633px (vw=393px, width=327px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | svg | Élément déborde à droite | right=581px (vw=393px, width=274px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .ue-card | Élément déborde à droite | right=828px (vw=393px, width=260px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | img | Élément déborde à droite | right=827px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | overflow-right | .body | Élément déborde à droite | right=827px (vw=393px, width=258px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("Restaurants") | 74x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("À propos") | 58x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("Caisse") | 39x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("Caisse") | 35x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("Post Studio") | 64x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | tap-target | a | Tap target trop petit ("Source") | 39x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| landing.html | pixel5 | contrast | a | Contraste faible "Restaurants" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | a | Contraste faible "À propos" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | a | Contraste faible "Caisse" | ratio=4.41 (fg=#757575 bg=#fafafa fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | #hero-cta | Contraste faible "Commander" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | .ue-footer-copy | Contraste faible "© 2026 PostSystem — AcimCaisse" | ratio=2.73 (fg=#999999 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | a | Contraste faible "Caisse" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | a | Contraste faible "Post Studio" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | a | Contraste faible "Source" | ratio=3.42 (fg=#059c54 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| landing.html | pixel5 | contrast | #sticky-cta | Contraste faible "Commander maintenant" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=15px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| codes-barres-kg.html | pixel5 | overflow-right | h1 | Élément déborde à droite | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .subtitle | Élément déborde à droite | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .info | Élément déborde à droite | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .no-print | Élément déborde à droite | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | button | Élément déborde à droite | right=630px (vw=393px, width=280px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .grid | Élément déborde à droite | right=965px (vw=393px, width=950px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .card | Élément déborde à droite | right=643px (vw=393px, width=307px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .cat | Élément déborde à droite | right=509px (vw=393px, width=38px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .name | Élément déborde à droite | right=579px (vw=393px, width=178px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| codes-barres-kg.html | pixel5 | overflow-right | .barcode | Élément déborde à droite | right=594px (vw=393px, width=208px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| migration.html | pixel5 | contrast | #btn1 | Contraste faible "🔍 Scanner et migrer automatiq" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | pixel5 | overflow-right | .no-print | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | h1 | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | .sous-titre | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | .section | Élément déborde à droite | right=960px (vw=393px, width=940px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | h2 | Élément déborde à droite | right=944px (vw=393px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | .form-row | Élément déborde à droite | right=944px (vw=393px, width=908px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | div | Élément déborde à droite | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | label | Élément déborde à droite | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | #inpCode | Élément déborde à droite | right=444px (vw=393px, width=200px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | overflow-right | div | Élément déborde à droite | right=532px (vw=393px, width=80px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| barcode.html | pixel5 | tap-target | #inpNom | Tap target trop petit () | 200x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | #inpCode | Tap target trop petit () | 200x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | #inpQte | Tap target trop petit ("1") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | .btn | Tap target trop petit ("+ Ajouter") | 89x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | #inpPrefix | Tap target trop petit ("3000") | 100x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | #inpDebut | Tap target trop petit ("1") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | tap-target | #inpFin | Tap target trop petit ("30") | 80x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| barcode.html | pixel5 | contrast | .btn | Contraste faible "+ Ajouter" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | pixel5 | contrast | .btn | Contraste faible "🖨️ Imprimer" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| barcode.html | pixel5 | inputmode | #inpCode | Inputmode manquant pour saisie numérique | type=text placeholder="Ex: 3760001000019" | Ajouter inputmode="numeric" ou type="tel" |
| post-studio.html | pixel5 | scroll-h | html | Scroll horizontal détecté | scrollWidth=664 > clientWidth=393 | Identifier les éléments débordants (width fixe, marges, flex sans min-width:0) |
| post-studio.html | pixel5 | overflow-right | .flex-1 | Élément déborde à droite | right=664px (vw=393px, width=664px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .mb-4 | Élément déborde à droite | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .flex | Élément déborde à droite | right=631px (vw=393px, width=598px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .rounded-full | Élément déborde à droite | right=631px (vw=393px, width=87px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .shrink-0 | Élément déborde à droite | right=508px (vw=393px, width=117px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .shrink-0 | Élément déborde à droite | right=631px (vw=393px, width=115px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | div | Élément déborde à droite | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .relative | Élément déborde à droite | right=648px (vw=393px, width=632px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .absolute | Élément déborde à droite | right=647px (vw=393px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | overflow-right | .relative | Élément déborde à droite | right=647px (vw=393px, width=630px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-studio.html | pixel5 | tap-target | .text-zinc-600 | Tap target trop petit ("Accueil") | 38x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | pixel5 | tap-target | .text-zinc-600 | Tap target trop petit ("Caisse") | 33x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | pixel5 | tap-target | .text-zinc-600 | Tap target trop petit ("Source") | 36x16px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-studio.html | pixel5 | contrast | .font-medium | Contraste faible "Terra Rosa" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .font-medium | Contraste faible "Saigon 82" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Bistro Nova" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .shrink-0 | Contraste faible "Dashboard" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Voir le calendrier" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .font-medium | Contraste faible "Publication planifiée" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Paris" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Lunch express" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Clients fidèles" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Déjeuner" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "App mobile" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Site web" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Publier maintenant" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-studio.html | pixel5 | contrast | .rounded-full | Contraste faible "Programmé" | ratio=1.20 (fg=#ffffff bg=#eceae2 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | overflow-right | .ps-banner__blob | Élément déborde à droite | right=421px (vw=393px, width=220px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | overflow-right | .ps-cat | Élément déborde à droite | right=438px (vw=393px, width=111px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | overflow-right | .ps-cat | Élément déborde à droite | right=558px (vw=393px, width=112px) | Ajouter max-width:100vw / box-sizing / overflow-x:hidden sur parent |
| post-system.html | pixel5 | tap-target | .ps-demo-btn | Tap target trop petit ("🎬 Mode démo") | 120x30px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | tap-target | #ps-search | Tap target trop petit () | 301x20px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | tap-target | .close | Tap target trop petit ("✕") | 28x39px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | tap-target | a | Tap target trop petit ("Accueil") | 37x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | tap-target | a | Tap target trop petit ("Post Studio") | 59x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | tap-target | a | Tap target trop petit ("Source") | 36x15px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| post-system.html | pixel5 | contrast | .ps-logo__badge | Contraste faible "🛵" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=17px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-demo-btn | Contraste faible "🎬 Mode démo" | ratio=2.38 (fg=#ffffff bg=#06c167 fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-resto-desc | Contraste faible "Pizzas, pâtes & cuisine italie" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=15px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-banner__meta | Contraste faible "⭐ 4,8
        🕑 25–35 min
   " | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "⭐ 4,8" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-rate | Contraste faible "4,8" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "🕑 25–35 min" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-eta | Contraste faible "25–35 min" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "🛵 2,90 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-fee | Contraste faible "2,90 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "💰 10,00 € minimum" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-min | Contraste faible "10,00 €" | ratio=1.04 (fg=#ffffff bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-card__badge | Contraste faible "⭐ Populaire" | ratio=1.12 (fg=#ffffff bg=#f2f2f2 fs=11px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .t | Contraste faible "Aucun plat trouvé" | ratio=4.41 (fg=#757575 bg=#fafafa fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .s | Contraste faible "Essayez un autre mot-clé ou un" | ratio=1.96 (fg=#b5b5b5 bg=#fafafa fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | #ps-cart-count | Contraste faible "0 article" | ratio=3.35 (fg=#059c54 bg=#e8fdf0 fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "Ajoutez des plats pour commenc" | ratio=2.05 (fg=#b5b5b5 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | b | Contraste faible "GRATUITE" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "💰 Ajoutez un produit" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-btn__sub | Contraste faible "0,00 €" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "Ajoutez des plats pour commenc" | ratio=2.05 (fg=#b5b5b5 bg=#ffffff fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | b | Contraste faible "GRATUITE" | ratio=2.38 (fg=#06c167 bg=#ffffff fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | span | Contraste faible "💰 Ajoutez un produit" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=16px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ps-btn__sub | Contraste faible "0,00 €" | ratio=1.56 (fg=#ffffff bg=#cfcfcf fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | .ue-copyright | Contraste faible "© 2026 PostSystem — AcimCaisse" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | a | Contraste faible "Accueil" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | a | Contraste faible "Post Studio" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| post-system.html | pixel5 | contrast | a | Contraste faible "Source" | ratio=4.41 (fg=#757575 bg=#fafafa fs=12px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | tap-target | #acim-pos-search | Tap target trop petit () | 177x21px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | pixel5 | tap-target | button[type=submit] | Tap target trop petit ("Connexion") | 89x25px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | pixel5 | tap-target | button[type=submit] | Tap target trop petit ("Appliquer une remise") | 159x29px (< 32px) | min-width/min-height:32px, padding:8px 12px minimum |
| tests.html | pixel5 | contrast | #runAll | Contraste faible "▶️ Tout lancer" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #runNormal | Contraste faible "1. Vente normale" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #runKg | Contraste faible "2. Vente kg" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #runConcurrent | Contraste faible "3. Vente concurrente" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #runUndo | Contraste faible "4. Ticket annulé" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #runBackup | Contraste faible "5. Backup/Restore" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-header-btn | Contraste faible "+" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-header-btn | Contraste faible "✕" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | #mk-search-voice | Contraste faible "🎤" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | button | Contraste faible "Connexion" | ratio=1.00 (fg=#ffffff bg=#ffffff fs=13px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | button | Contraste faible "⇅ Trier" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-delete | Contraste faible "🗑️" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | contrast | .acim-product-camera | Contraste faible "📷" | ratio=3.79 (fg=#ffffff bg=#e65100 fs=14px) | Ajuster couleur pour ratio >= 4.5 (WCAG AA) |
| tests.html | pixel5 | inputmode | #acim-pos-search | Inputmode manquant pour saisie numérique | type=text placeholder="Rechercher un produit ou scanner un code-barres..." | Ajouter inputmode="numeric" ou type="tel" |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| tests.html | pixel5 | alt-missing | img[svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2] | Image sans alt | 259x259px | Ajouter alt="description" ou alt="" si pure déco |
| pos.html | pixel5 | pointer-block | #acim-pos-checkout | Bottom-nav intercepte les pointer events du bouton Encaisser | checkout.bottom=1186px vs bottomNav.top=667px (overlap=519px) | Augmenter z-index de #acim-sheet et #acim-pos-checkout > z-index .acim-bottom-nav, OU masquer .acim-bottom-nav quand #acim-sheet est ouvert, OU pointer-events:none sur .acim-bottom-nav quand sheet ouvert |


## Analyse z-stack #acim-pos-checkout / .acim-bottom-nav (bug connu confirmé)

### Mesures relevées (Playwright)

| Device | .acim-bottom-nav z | #acim-sheet z | #acim-pos-checkout z | checkout.bottom | bottomNav.top | Overlap |
|---|---|---|---|---|---|---|
| iPhone 13 (390x844) | 10000010 | 2001 | auto (in sheet) | 1123px | 604px | **519px** |
| Pixel 5 (393x851)  | 10000010 | 2001 | auto (in sheet) | 1186px | 667px | **519px** |

### Diagnostic

- #acim-pos-checkout vit DANS #acim-sheet (z-index hérité uto), donc son z-index effectif = z-index du sheet = **2001**.
- .acim-bottom-nav a z-index: 10000010 **très supérieur** au sheet. Il reste donc au-dessus du bottom-sheet ouvert et intercepte les pointer events dans toute la zone basse du sheet (overlap 519pxconstant).
- Le test E2E existant (run-mobile.js) confirme : il doit appeler onclick via page.evaluate parce que 	ap() échoue.
- Source du bug : cim-uber-eats.css:343 (.acim-bottom-nav { z-index: 10000010 }) — valeur anormalement haute (sous-entend un hack empilement).

### Correction CSS exacte proposée

**Option A — minimale, ciblée (recommandée)** : augmenter le z-index du sheet au-dessus du bottom-nav quand il est ouvert.

`css
/* acim-uber-eats.css — ligne 478 (règle .acim-sheet) */
/* AVANT : */ z-index: 2001;
/* APRÈS : */ z-index: 10000020;  /* au-dessus de .acim-bottom-nav (10000010) */
`

Idem pour .acim-sheet-overlay (ligne 459) :

`css
/* AVANT : */ z-index: 2000;
/* APRÈS : */ z-index: 10000019;
`

Et de manière cohérente dans cim-makolette.css ligne 860 (.mk-sheet) passer z-index: 2001 -> 10000020, et la feuille .mk-sheet-overlay concernée aussi.

**Option B — alternative plus saine** : baisser .acim-bottom-nav à un z-index raisonnable (ex: 100) et masquer la nav quand le sheet est ouvert :

`css
/* acim-uber-eats.css ligne 343 */
z-index: 100;  /* au lieu de 10000010 */

/* Nouvelle règle à ajouter */
body:has(.acim-sheet.open) .acim-bottom-nav {
  pointer-events: none;
  opacity: 0.4;
}
`

L'Option A est plus sûre (1-digit change, pas de risque de régressions sur d'autres empilements) et débloque immédiatement le bouton Encaisser.

!!! note L'Option A seule rend le bouton tap-able, mais la bottom-nav reste visible derrière le sheet overlay transparent. OK visuellement car overlay a un fond semi-obscur.

## Top 5 corrections à prioriser

1. **pos.html — #acim-pos-checkout injoignable par tap (CRITIQUE, UX bloquant)**
   - Sélecteur : #acim-pos-checkout (dans #acim-sheet)
   - Bug : .acim-bottom-nav (z 10000010) intercepte les pointer events du bouton Encaisser à l'intérieur du sheet (z 2001). Overlap 519px sur les 2 devices.
   - Fix : cim-uber-eats.css:478 passer z-index: 2001 → 10000020, et cim-uber-eats.css:459 z-index: 2000 → 10000019. Identique sur cim-makolette.css:860 et son overlay.
   - Impact : débloque le flux d'encaissement sur mobile (tests E2E n'auraient plus à appeler onclick direkt).

2. **pos.html — tap targets trop petits sur les actions produit (CRITIQUE)**
   - Sélecteurs : .acim-product-delete (24x24px), .acim-product-camera (28x28px), #mk-search-voice (34x23px)
   - Bug : < 32px min recommandé mobile. Sur 30+ produits, compteur × 2 devices = ~80 occurrences.
   - Fix : CSS .acim-product-delete, .acim-product-camera, #mk-search-voice { min-width:32px; min-height:32px; padding:6px; }

3. **pos.html — débordement horizontal categories/cat-label (#acim-category-item > 0)**
   - Sélecteur : .acim-category-item / .acim-category-icon / .acim-category-label dépassent de 6 à 170px à droite
   - Bug : scroll horizontal non voulu sur la zone catégories (la barre des cats).
   - Fix : cim-uber-eats.css sur la barre des catégories : overflow-x:auto; flex-wrap:nowrap; min-width:0; (carousel intentionnel) ou lex-wrap:wrap; max-width:100vw.
   - Note : peut être intentionnel (carousel horizontal), mais alors le parent doit avoir overflow-x:auto (le test vérifiera qu'il ne crée pas de h-scroll).

4. **dashboard.html + barcode.html + codes-barres-kg.html — scroll horizontal global (~600px)**
   - Sélecteur : .container / .no-print / header / .section affichés à width:940-980px
   - Bug : scrollWidth=1034 sur clientWidth=980 sur iPhone 13. Layout pensé desktop (980px) sans media-query mobile.
   - Fix : ajouter @media (max-width: 600px) { .container, .no-print, header, .section, .bar-label, .row, h1, h2 { max-width:100%; width:100%; box-sizing:border-box; } }. Régénère l'usage mobile du dashboard.

5. **post-studio.html — scroll horizontal sévère (274px)**
   - Sélecteur : .flex-1, .relative, .absolute, .flex dépassent (right=664 vs vw=390)
   - Bug : scrollWidth=664 > clientWidth=390 — layout Tailwind-like (.flex, .flex-1, .shrink-0) cassé sur mobile, certainement un lex-1 sans min-width:0.
   - Fix : ajouter min-width:0 sur .flex-1 enfants de .flex, ou ody { overflow-x:hidden } combiné avec max-width:100vw sur le conteneur racine.

> **Note** : parmi les 671 bugs détectés, 419 concernent le contraste (catégorie très majoritaire — faux positifs fréquents car le calcul remonte la première couleur de fond opaque valeur calculée qui peut être du texte sur du texte). À considérer en 2e vague d'accessibilité : prioriser d'abord les vrais bugs critiques d'interaction (1 et 2) puis les layouts mobiles (4 et 5).
