# AcimCaisse — CHANGELOG

Toutes les modifications documentées ici. Sync FTP/local/GitHub à chaque modif.

## 2026-08-06

### Feature: Rôle manager vs cashier
- **Ajout**: `_isManager()` helper pour vérifier le rôle de l'opérateur.
- **Restrictions cashier** (masqués dans le menu):
  - Vérifier / Nettoyer le catalogue
  - Importer facture fournisseur
  - Exporter mes données
  - Réinitialiser depuis JSON maître
  - Importer des données (JSON)
  - Paramètres
- **Manager** accès complet.
- **Commit**: `à venir`

### Fix: Duplication des lettres dans la barre de recherche
- **Problème**: Chaque lettre tapée apparaissait en double (ppooouuuleeett).
- **Cause**: Handler global keydown (ligne 1533) ajoutait chaque lettre à `_posSearch.value` manuellement, en plus de l'ajout naturel par le navigateur.
- **Solution**: Ne pas appending quand `document.activeElement === _posSearch`.
- **Commit**: `76c0e88`

### Fix: Login opérateur (PIN 1234)
- **Problème**: "PIN incorrect" même avec 1234.
- **Solution**: `_seedDefaultUser()` now stores admin directly via transaction readwrite, always resets u-admin with PIN 1234.
- **Commit**: `2deabeb`, `01ee6be`

### Fix: Images cassées (404) remplacées par URLs vérifiées
- **Problème**: 148 URLs "pattern-guess" retournaient 404.
- **Solution**: Testé chaque URL. Gardé 18 URLs vérifiées (200 status).
- **Commit**: `eabc874`, `0c23653`

### Fix: Panier idéal persisté en IndexedDB
- **Problème**: L'assistant vocal ne trouvait pas les produits (cherche IndexedDB, pas memory).
- **Solution**: `_showIdealCart()` maintenant `_dbPut(prodObj)` pour chaque produit.
- **Commit**: `eabc874`

### Fix: Auto-login au démarrage
- **Solution**: `_getCurrentActor()` + setTimeout 5s.
- **Commit**: `eabc874`, `e9b63de`

### Feature: Utilisateur admin par défaut
- **Ajout**: `_seedDefaultUser()` crée "u-admin" avec PIN 1234, rôle "manager".
- **Commit**: `09629e7`

### Feature: Base d'images locales + Panier idéal 200€
- **Ajout**: `_LOCAL_IMAGES` (18 URLs vérifiées), 44 articles panier idéal.
- **Commits**: `b6cd8c0`, `25e9035`

### Feature: sync.ps1 script
- **Usage**: `.\sync.ps1 "fix: description"`
- **Effectue**: syntax check → tests Playwright → commit → push GitHub Pages
- **Commit**: `406b406`

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
# Sync rapide (test + commit + push)
.\sync.ps1 "fix: description du changement"

# Tests
node test-user-paths.js

# Syntax check
node -c acim-caisse.js

# Status
git status; git log --oneline -5
```

