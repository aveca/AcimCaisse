# AcimCaisse — CHANGELOG

Toutes les modifications documentées ici. Sync FTP/local/GitHub à chaque modif.

## 2026-08-07

### Feature: Landing funnel de conversion (`landing.html`)
- **Nouveau** : page d'accueil marketing style Uber Eats (hero, USP 3 blocs, carousel restaurants, CTA "Commander" sticky). Hero CTA + sticky CTA ouvrent `post-system.html` = funnel top → checkout.
- **Pos** : footer copyright + liens Caisse/Post Studio/Source sur toutes les pages (`post-system.html`, `landing.html`).

### Funnel & UX: sous-minimum guidé + checkout validé
- **Bug (agent Playwright)** : bouton "💰 Encaisser" désactivé sous le minimum de commande SANS feedback actif → funnel bloqué.
- **Fix** : bouton reste **activé** sous le minimum, libellé dynamique "💰 Encore X € pour commander", onclick=scroll vers les produits + toast guidé (au lieu d'un bouton mort). Le funnel ne hard-clean plus : conversion réelle validée (add → Encaisser → Espèces → Exact → ✅ Valider → Ticket n° + reçu + cart remis à 0).
- **Tests** : `node tests/run-funnel.js` = 20 assertions, 0 erreur console (landing → POS → checkout → receipt, desktop + mobile).

### Feature: Post Studio — système de publications multi-restaurants (`post-studio.html`)
- **Nouveau** : app React 19 + Vite + Tailwind (build single-file 388 kB, zéro requête externe) déployée sur GitHub Pages depuis le projet `post-studio/`. Style copycat Uber Eats (sidebar sombre, cartes arrondies, accent émeraude).
- **Base** : fusion des 2 zips fournis (`uber-eats-restaurant-post-system` + `initial-user-greeting`) — le studio de publications de l'un, l'esprit dashboard de l'autre.
- **5 vues fonctionnelles** (nav sidebar desktop + pills mobiles) : Dashboard (hero + composer + live preview + activité), Publications (bibliothèque persistée, filtres Tous/Brouillon/Programmé/Publié, Reprendre/Supprimer), Calendrier (groupement par jour des diffusions), Campagnes (3 modèles types → composer en 1 clic), Statistiques (par restaurant + canaux utilisés).
- **Composer** : 3 modèles, titre/message, upload visuel (preview live), audiences, canaux, programmation, boutons « Enregistrer le brouillon » et « Publier maintenant » (statut Programmé si date future, sinon Publié).
- **Persistence** : publications stockées en localStorage (`post-studio-publications`), conservées après rechargement.
- **Robustesse** : validation titre/message avec toast d'erreur, toast auto-dismiss 3,2 s, statut repassé à « Brouillon » à toute édition (bug corrigé), attribution d'object URL nettoyée, `package.json` racine débarrassé d'un BOM qui cassait le build PostCSS.
- **Validé** : suite Playwright dédiée `node tests/run-poststudio.js` — 28/28 vert, 0 erreur console, 6 screenshots (desktop + mobile).

### Feature: PostSystem — POS restaurant style Uber Eats (`post-system.html`)
- **Nouveau** : page autonome (HTML/CSS/JS inline, zéro dépendance) calquée sur le design Uber Eats pour les restaurants.
- **Multi-restaurants** : sélecteur dans le header (3 restaurants démo : Chez Mario, Le Bistrot du Port, Sushi Wok) — chaque restaurant a son menu, ses catégories, sa livraison et son minimum.
- **Menu** : bannière restaurant (note, délai, frais), recherche instantanée (nom + description + catégorie), chips de catégories, grille de produits avec badge « Populaire », steppers de quantité sur les cartes.
- **Panier** : colonne fixe desktop (380px) + barre flottante mobile avec bottom sheet. Sous-total, livraison (gratuite dès 25 €), minimum de commande, total.
- **Encaissement** : modal 3 modes (Espèces / Carte / Mixte), boutons rapides (Exact, 5/10/20/50 €), calcul du rendu en direct, garde montant insuffisant.
- **Post-vente** : écran succès avec ticket n°, reçu imprimable (print CSS dédié), historique persistant (localStorage) consultable et redétaillable.
- **Persistence** : panier + historique + séquence tickets dans localStorage.
- **Validé** : parcours complet testé Playwright (ajout, steppers, checkout, paiement, succès, historique, switch restaurant, mobile) — 0 erreur console.

---

## 2026-08-07

### Fix: App bloquée — erreur de syntaxe JS (Makolette refactor)
- **Problème**: Acollade en trop dans `_renderCart` (`buildRow`) → `SyntaxError` → tout le POS ne chargeait plus (`node --check` échouait).
- **Solution**: Suppression de l'accolade dupliquée (ligne ~1492).

### Fix: Boutons +/− du ticket (quantité) plantaient (ReferenceError)
- **Problème**: Les boutons +/− ajoutés par le refactor appelaient `_incrementCartItem`/`_decrementCartItem` qui n'existaient pas.
- **Solution**: Ajout des deux fonctions avec gestion cohérente du prix (`unitCents` stocké, `priceCents = unit × qty`). Le total, le sous-total et le reçu restent cohérents.

### Fix: Boutons "Trier" (⇅) et "🎤" (recherche vocale) morts
- **Problème**: `_toggleSort` et `_toggleVoiceSearch` étaient appelés mais jamais définis (ReferenceError au clic).
- **Solution**: Implémentation des deux. Tri à 3 modes (pertinence / A→Z / prix). Recherche vocale via `SpeechRecognition` (fr-FR) avec état visuel `--listening` sur le bouton et fallback propre si non supporté.

### Fix: FAB panier cassait le rendu du ticket (TypeError)
- **Problème**: `_updateCartFAB` écrivait dans `#acim-cart-fab-total` qui n'existait pas dans le DOM → toute vente/ajout au panier levait une TypeError et le ticket ne se rendait plus.
- **Solution**: Ajout du span total dans le FAB + gardes null + classe CSS `.mk-cart-fab__total`.

### Fix: Stock insuffisant n'abortait pas la vente (invariant P0)
- **Problème**: Le contrôle se faisait ligne par ligne : avec stock=2 et 5 lignes de 1, la vente passait (stock ramené à 0) et 5 `STOCK_DECREMENT` étaient émis, y compris à stock nul.
- **Solution**: Pré-vérification du total demandé par code-barres (`demandMap`) → `tx.abort()` si `stock - totalDemand < 0` (all-or-nothing). `STOCK_DECREMENT` n'est plus émis quand rien n'est décrémenté.

### Fix: Recherche vocale ne trouvait jamais le produit
- **Problème**: Matcher `n.indexOf(q)>=0 || q.indexOf(n)>=0` — un produit court ("p", "u"…) matche dans quasiment toute requête → "plusieurs matchs" → jamais d'ajout.
- **Solution**: Scoring (exact=100 / contient=60 / contenu-dans-requête=20), meilleur match si score ≥ 60 et strictement supérieur, sinon liste des 3 meilleurs.

### UI: Compteur produits + état checkout + header ticket
- `#mk-products-count` (nombre de produits affichés) était créé mais jamais mis à jour → affiché maintenant dans `_renderGrid`.
- Bouton "Encaisser" désactivé (au lieu d'un simple opacity) quand le panier est vide — CSS `:disabled` existant utilisé.
- Header du ticket desktop mis à jour via `textContent` au lieu d'un `innerHTML` reconstruit à chaque rendu.

### Tests: suites Playwright remises au vert (173/173)
- `run-e2e.js` + `run-e2e-sprint3.js`: auto-login PIN (1234) requis par la feature Sprint 4.1 (le modal `#acim-login` interceptait les clics).
- Extraction du nom produit dans le test voix via `.mk-product__name` (sélecteur stable) au lieu du `textContent` brut (qui contient boutons 🗑️📷 + prix sur une ligne).
- Résultat: 13/13, 20/20, 8/8, 35/35, 28/28, 69/69.

---

## 2026-08-06

### Fix: Scanner USB/BT fonctionne sans cliquer dans le champ
- **Problème**: Le scanner ne fonctionnait que si l'utilisateur cliquait d'abord dans le champ de recherche.
- **Cause**: Handler global keydown désactivé quand `_posSearch` était focused.
- **Solution**: Distingue scanner (frappes rapides <50ms) vs saisie manuelle (lente).
  - Scanner: capture les chiffres + Enter, même si le champ est focused
  - Saisie manuelle: laisse le navigateur gérer normalement (pas de duplication)
  - Si champ focused + scanner: le navigateur tape les chiffres, Enter du `_posSearch` déclenche `_processBarcode`
- **Variable**: `_SCAN_SPEED_MS=50` (seuil de vitesse entre touches)
- **Commit**: `à venir`

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

