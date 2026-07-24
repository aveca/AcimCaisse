# AcimCaisse v29 - Instructions d'Utilisation et de Déploiement

## 📌 Sommaire
1. [Nouveautés v29](#nouveautés-v29)
2. [Corrections Critiques](#corrections-critiques)
3. [Installation](#installation)
4. [Utilisation](#utilisation)
5. [Résolution des Problèmes](#résolution-des-problèmes)
6. [Déploiement](#déploiement)

---

## 🆕 Nouveautés v29

### 1. **Autocomplétion Intelligente**
- **Fonctionnalité**: Suggestions de produits lors de la saisie manuelle
- **Déclenchement**: Après 2 caractères tapés
- **Navigation**: Flèches ↑↓ pour sélectionner, Entrée pour valider
- **Fichier**: `barcode-autocomplete.js`

### 2. **Correction Automatique des Stocks Négatifs**
- **Fonctionnalité**: Détection et correction des produits avec stock < 0
- **Exécution**: Automatique au chargement de l'application
- **Commande manuelle**: `window.AcimCaisseStockFix.fix()`
- **Fichier**: `fix-negative-stock.js`

### 3. **Feedback Visuel Amélioré**
- Animation pulse orange sur le champ code-barres
- Message "🔍 Recherche en cours..." lors de la saisie
- Bouton Valider visible à côté du champ
- Tooltips sur tous les boutons

### 4. **Tracker UX Amélioré**
- Enregistrement des clics, mouvements souris, erreurs
- Export automatique après 200 actions
- Mode debug: `?debug=tracker`

---

## ✅ Corrections Critiques

### 1. **Panier Toujours Visible** ⭐
**Problème**: Le panier disparaissait après scan

**Solutions**:
- Injection des styles dans le shadow DOM de Flutter
- Position fixe en bas de l'écran
- Z-index élevé pour éviter le masquage

**Fichiers modifiés**:
- `index.html` (injection shadow DOM)
- `acimcaisse-ux-fix.css` (styles du panier)

### 2. **Autofocus Fonctionnel** ⭐
**Problème**: "Autofocus processing was blocked"

**Solution**:
- Focus forcé toutes les 2 secondes
- Floutage des éléments Flutter avant le focus

**Fichier**: `index.html` (fonction `forceFocusOnBarcodeInput`)

### 3. **Panier Unique** ⭐
**Problème**: Duplicata du panier à cause de `product_catalog.js`

**Solution**:
- Suppression complète de `product_catalog.js`
- Suppression des références dans `setup.js`

---

## 💻 Installation

### Prérequis
- Windows 10/11 (compatible LTSB 1607)
- Navigateur moderne (Chrome, Edge, Firefox)
- Connexion internet pour le premier téléchargement

### Installation Desktop
1. Télécharger `setup.js` depuis [GitHub Releases](https://github.com/aveca/AcimCaisse/releases)
2. Exécuter `setup.js` en tant qu'administrateur
3. Suivre les instructions à l'écran
4. L'application sera installée dans `C:\Program Files\AcimCaisse`

### Installation Web
1. Ouvrir [https://aveca.github.io/AcimCaisse/](https://aveca.github.io/AcimCaisse/) dans un navigateur
2. Ajouter à l'écran d'accueil (PWA)
3. Utiliser hors ligne après le premier chargement

---

## 🎯 Utilisation

### Premier Démarrage
1. **Lancer l'application**
   - Desktop: Double-cliquer sur `AcimCaisse.exe`
   - Web: Ouvrir le raccourci PWA

2. **Configuration initiale**
   - Le premier démarrage crée une base de données vide
   - Ajouter des produits via l'interface d'administration

### Saisie des Produits

#### Méthode 1: Scanner le Code-Barres
1. Placer le curseur dans le champ code-barres (focus automatique)
2. Scanner le produit avec une douchette
3. Le produit apparaît dans le panier
4. Appuyer sur Entrée ou cliquer sur ✓ Valider

#### Méthode 2: Saisie Manuelle
1. Taper le nom ou le code-barres du produit
2. **Nouveau**: Des suggestions apparaissent après 2 caractères
3. Sélectionner avec les flèches ↑↓
4. Valider avec Entrée

#### Méthode 3: Recherche par Catégorie
1. Cliquer sur le bouton 📊 (Scanner)
2. Sélectionner une catégorie
3. Choisir un produit dans la liste

### Gestion du Panier
- **Ajouter**: Scanner ou saisir un produit
- **Supprimer**: Cliquer sur le bouton 🗑️ à côté du produit
- **Modifier quantité**: Cliquer sur le produit dans le panier
- **Valider**: Appuyer sur Entrée ou cliquer sur ✓ Valider

### Finalisation de la Vente
1. Vérifier les produits dans le panier
2. Cliquer sur **Payer**
3. Sélectionner le mode de paiement (Espèces, CB, etc.)
4. Saisir le montant reçu
5. Le ticket est imprimé ou sauvegardé

---

## 🔧 Résolution des Problèmes

### Problème 1: Le panier n'est pas visible
**Cause**: Problème d'injection dans le shadow DOM

**Solutions**:
1. Vérifier que `index.html` contient bien le script d'injection
2. Ouvrir la console (F12) et vérifier le message:
   ```
   [AcimCaisse] Styles injectés dans le shadow DOM de Flutter
   ```
3. Si le message n'apparaît pas, rafraîchir la page

**Test**:
```javascript
// Dans la console
const flutterView = document.querySelector('flutter-view');
flutterView.shadowRoot.querySelector('#acim-ux-fix-style') !== null
// Doit retourner true
```

### Problème 2: Le champ code-barres n'a pas le focus
**Cause**: Conflit avec Flutter

**Solutions**:
1. Vérifier que `forceFocusOnBarcodeInput()` est appelé
2. Tester manuellement:
```javascript
// Dans la console
document.getElementById('acim-bc-input').focus()
```

### Problème 3: Les produits n'apparaissent pas après scan
**Causes possibles**:
1. Stock négatif → Exécuter la correction:
```javascript
window.AcimCaisseStockFix.fix()
```
2. Produit non dans la base → Vérifier l'import des produits
3. Problème de panier → Vérifier l'injection shadow DOM

### Problème 4: L'autocomplétion ne fonctionne pas
**Solutions**:
1. Vérifier que `barcode-autocomplete.js` est chargé
2. Tester la recherche manuelle:
```javascript
// Dans la console
window.AcimCaisseAutocomplete.search('biss')
// Doit retourner une liste de produits
```
3. Vérifier que les produits sont chargés:
```javascript
window.AcimCaisseAutocomplete.products.length
// Doit retourner > 0
```

### Problème 5: Installation échoue sur Win10 LTSB 1607
**Cause**: `timeout /t` non disponible

**Solution**: Utiliser `ping` comme fallback (déjà implémenté dans `setup.js`)

**Test**:
```cmd
ping -n 2 127.0.0.1 >nul
```

---

## 🚀 Déploiement

### Déploiement Web (GitHub Pages)
1. Commiter les modifications sur la branche `gh-pages`
2. Pousser vers GitHub:
```bash
git add .
git commit -m "v29: Corrections critiques + autocomplétion"
git push origin gh-pages
```
3. Le déploiement est automatique via GitHub Actions
4. Vérifier: [https://aveca.github.io/AcimCaisse/](https://aveca.github.io/AcimCaisse/)

### Déploiement Desktop
1. Construire l'application Flutter:
```bash
flutter build windows
```
2. Créer le package d'installation:
```bash
node setup.js
```
3. Tester l'installation sur une machine propre
4. Créer une release GitHub avec:
   - `setup.js`
   - `AcimCaisse.exe`
   - `README.md`

### Déploiement Mobile (PWA)
1. Vérifier le `manifest.json`
2. Tester avec Lighthouse:
```bash
npx lighthouse https://aveca.github.io/AcimCaisse/
```
3. Vérifier l'installation PWA:
   - Chrome: Menu → Installer
   - Edge: Menu → Applications → Installer

---

## 📊 Vérification des Corrections

### Test Rapide
1. Ouvrir [TEST_V29_FIXES.html](./TEST_V29_FIXES.html) dans un navigateur
2. Suivre les instructions pour chaque test
3. Vérifier que tous les tests passent

### Checklist de Déploiement
- [ ] Panier visible après scan
- [ ] Autofocus sur le champ code-barres
- [ ] Aucun stock négatif
- [ ] Autocomplétion fonctionnelle
- [ ] Feedback visuel présent
- [ ] Tracker UX fonctionnel
- [ ] Installation réussie sur Win10 LTSB 1607
- [ ] Déploiement GitHub Pages réussi

---

## 📞 Support

### Signaler un Problème
1. Ouvrir une issue sur [GitHub Issues](https://github.com/aveca/AcimCaisse/issues)
2. Inclure:
   - Description du problème
   - Étapes pour reproduire
   - Capture d'écran si possible
   - Logs du tracker UX (si disponible)

### Obtenir les Logs UX
1. Ouvrir [https://aveca.github.io/AcimCaisse/?debug=tracker](https://aveca.github.io/AcimCaisse/?debug=tracker)
2. Reproduire le problème
3. Cliquer sur le bouton "📁 Export Logs" en bas à gauche
4. Joindre le fichier téléchargé à l'issue

---

## 📝 Changelog v29

### v29.1.0 (2025-07-24)
- ✅ Correction des stocks négatifs (automatique)
- ✅ Autocomplétion pour la saisie manuelle
- ✅ Feedback visuel amélioré
- ✅ Injection shadow DOM robuste
- ✅ Compatibilité Win10 LTSB 1607

### v29.0.0 (2025-07-23)
- ✅ Panier toujours visible
- ✅ Autofocus fonctionnel
- ✅ Panier unique (suppression product_catalog.js)
- ✅ Tracker UX intégré

---

**Documentation mise à jour**: 2025-07-24  
**Version**: v29.1.0  
**Auteur**: Vibe Code (Agent IA)
