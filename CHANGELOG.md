# AcimCaisse — CHANGELOG

Toutes les modifications documentées ici. Sync FTP/local/GitHub à chaque modif.

## 2026-08-06

### Fix: Duplication des lettres dans la barre de recherche
- **Problème**: Quand l'utilisateur tape dans la barre de recherche, chaque lettre apparaît en double (ppooouuuleeett).
- **Cause**: Handler global `document.addEventListener("keydown", ...)` (ligne 1533) qui ajoutait chaque lettre à `_posSearch.value` manuellement, en PLUS de l'ajout naturel par le navigateur quand l'input est focused.
- **Solution**: Ne pas appending quand `document.activeElement === _posSearch`.
- **Commit**: `76c0e88`

### Fix: Login opérateur (PIN 1234)
- **Problème**: Impossible de se connecter — "PIN incorrect" même avec 1234.
- **Cause**: `_seedDefaultUser()` ne créait pas l'utilisateur admin (problème de chaîne de Promises).
- **Solution**: `_seedDefaultUser()` maintenant appelle `_hashPin("1234")` puis store directement dans IndexedDB via transaction readwrite. Always resets u-admin with PIN 1234.
- **Commit**: `2deabeb`, `01ee6be`

### Fix: Images cassées (404) remplacées par URLs vérifiées
- **Problème**: 148 URLs dans `_LOCAL_IMAGES` étaient des "pattern-guess" (303/371/003/...) qui retournaient 404.
- **Solution**: Testé chaque URL. Gardé seulement 15 URLs vérifiées (200 status) pour produits emballés (spaghetti, huile olive, thon, lait, beurre, fromage, yaourt, eau, café, sucre, farine, moutarde, lait coco, poulet, bavette).
- **Commit**: `eabc874`

### Fix: Panier idéal persisté en IndexedDB
- **Problème**: L'assistant vocal ne trouvait pas les produits du panier idéal car `_acimAddToCartByVoice` cherche dans IndexedDB, pas dans `_allProducts` (memory).
- **Solution**: `_showIdealCart()` maintenant `_dbPut(prodObj)` pour chaque produit → voix trouve les produits.
- **Commit**: `eabc874`

### Fix: Auto-login au démarrage
- **Problème**: Badge "Connexion" visible mais dialog de login ne s'affichait pas automatiquement.
- **Cause**: `window.getCurrentActor` (fonction inexistante) au lieu de `_getCurrentActor`.
- **Solution**: Utilisé `_getCurrentActor()` + setTimeout 5s (catalog load prend ~6s).
- **Commit**: `eabc874`, `e9b63de`

### Feature: Utilisateur admin par défaut
- **Ajout**: `_seedDefaultUser()` crée utilisateur "u-admin" avec PIN 1234 si aucun user existe.
- **Rôle**: "manager"
- **Commit**: `09629e7`

### Feature: Base d'images locales
- **Ajout**: `_LOCAL_IMAGES` avec URLs OFF vérifiées pour lookup instantané (pas d'API call).
- **Commit**: `b6cd8c0`

### Feature: Panier idéal 200€
- **Ajout**: 44 articles avec prix répartis sur 9 catégories (viande, poisson, épicerie, laitier, fruits, légumes, boisson, boulangerie, surgelé).
- **Bouton**: "Panier 200€" dans la bottom nav.
- **Commit**: `25e9035`

---

## Workflow Sync

1. **Local edit** → `acim-cisse.js` (ou autre fichier)
2. **Test**: `node test-user-paths.js` (11 tests Playwright)
3. **Commit**: `git commit -m "fix: description"`
4. **Push**: `git push origin gh-pages` (auto-deploy GitHub Pages)
5. **Verify live**: `https://aveca.github.io/AcimCaisse/pos.html`
6. **Document**: Ajouter entrée CHANGELOG ci-dessus

### Commandes utiles
```powershell
# Tests
node test-user-paths.js

# Syntax check
node -c acim-caisse.js

# Status
git status; git log --oneline -5

# Push
git add acim-caisse.js; git commit -m "fix: ..."; git push origin gh-pages
```
