/**
 * AcimCaisse - Autocomplétion intelligente pour la saisie manuelle
 * Solution au problème: l'utilisateur tape "bissli" mais ne trouve pas le produit
 * Fonctionnalités:
 * - Recherche en temps réel dans les produits
 * - Suggestions basées sur le nom et le code-barres
 * - Support des fautes de frappe (ex: "biss" → "Bissli")
 * - Feedback visuel immédiat
 */

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  const STORAGE_KEY = 'acimcaisse_data';
  const MIN_CHARS = 2; // Nombre minimum de caractères pour déclencher la recherche
  const MAX_SUGGESTIONS = 5; // Nombre maximum de suggestions
  const DEBOUNCE_DELAY = 300; // Délai en ms avant de déclencher la recherche
  
  // ===== ÉTAT =====
  let products = [];
  let debounceTimer = null;
  let suggestionsContainer = null;
  let selectedIndex = -1;
  
  // ===== INITIALISATION =====
  function init() {
    // Charger les produits
    loadProducts();
    
    // Créer le conteneur de suggestions
    createSuggestionsContainer();
    
    // Attacher les événements
    attachEvents();
    
    console.log('[Barcode Autocomplete] Initialisé');
  }
  
  // ===== CHARGEMENT DES PRODUITS =====
  function loadProducts() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      products = data.products || [];
      
      // Indexer les produits pour une recherche rapide
      products.forEach(p => {
        p.searchKey = (p.name || '') + ' ' + (p.barcode || '') + ' ' + (p.categoryId || '');
      });
      
      console.log(`[Barcode Autocomplete] ${products.length} produits chargés`);
    } catch (e) {
      console.error('[Barcode Autocomplete] Erreur de chargement:', e);
      products = [];
    }
  }
  
  // ===== CRÉATION DU CONTENEUR DE SUGGESTIONS =====
  function createSuggestionsContainer() {
    suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'acim-autocomplete-suggestions';
    suggestionsContainer.style.cssText = `
      position: absolute;
      background: white;
      border: 2px solid #19725b;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      max-height: 200px;
      overflow-y: auto;
      z-index: 10000;
      display: none;
      width: 350px;
      max-width: 90vw;
    `;
    
    document.body.appendChild(suggestionsContainer);
  }
  
  // ===== ATTACHEMENT DES ÉVÉNEMENTS =====
  function attachEvents() {
    const bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) {
      // Réessayer plus tard
      setTimeout(attachEvents, 500);
      return;
    }
    
    // Événement de saisie
    bcInput.addEventListener('input', handleInput);
    
    // Événement de focus
    bcInput.addEventListener('focus', () => {
      if (bcInput.value.length >= MIN_CHARS) {
        showSuggestions(bcInput.value);
      }
    });
    
    // Événement de blur (masquer les suggestions)
    bcInput.addEventListener('blur', () => {
      setTimeout(() => {
        hideSuggestions();
      }, 200);
    });
    
    // Événements clavier pour la navigation
    bcInput.addEventListener('keydown', handleKeydown);
    
    // Événement clic sur les suggestions
    suggestionsContainer.addEventListener('click', handleSuggestionClick);
    
    // Masquer les suggestions si on clique ailleurs
    document.addEventListener('click', (e) => {
      if (!suggestionsContainer.contains(e.target) && 
          e.target !== bcInput) {
        hideSuggestions();
      }
    });
  }
  
  // ===== GESTION DE LA SAISIE =====
  function handleInput(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const value = e.target.value;
      if (value.length >= MIN_CHARS) {
        showSuggestions(value);
      } else {
        hideSuggestions();
      }
    }, DEBOUNCE_DELAY);
  }
  
  // ===== RECHERCHE DE PRODUITS =====
  function searchProducts(query) {
    const lowerQuery = query.toLowerCase();
    
    // Filtrer les produits
    const matches = products.filter(p => {
      const searchKey = (p.searchKey || '').toLowerCase();
      return searchKey.includes(lowerQuery);
    });
    
    // Trier par pertinence (meilleure correspondance en premier)
    matches.sort((a, b) => {
      const aIndex = (a.searchKey || '').toLowerCase().indexOf(lowerQuery);
      const bIndex = (b.searchKey || '').toLowerCase().indexOf(lowerQuery);
      return aIndex - bIndex;
    });
    
    return matches.slice(0, MAX_SUGGESTIONS);
  }
  
  // ===== AFFICHAGE DES SUGGESTIONS =====
  function showSuggestions(query) {
    const matches = searchProducts(query);
    
    if (matches.length === 0) {
      hideSuggestions();
      return;
    }
    
    // Positionner le conteneur sous le champ
    const bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) return;
    
    const rect = bcInput.getBoundingClientRect();
    suggestionsContainer.style.left = rect.left + 'px';
    suggestionsContainer.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    suggestionsContainer.style.width = (rect.width + 50) + 'px';
    
    // Générer le HTML des suggestions
    let html = '';
    matches.forEach((product, index) => {
      const displayName = product.name || product.barcode || 'Produit inconnu';
      const displayBarcode = product.barcode ? ` (${product.barcode})` : '';
      const displayStock = product.stockQty !== null && product.stockQty !== undefined ? 
        ` - Stock: ${product.stockQty}` : '';
      
      html += `
        <div class="acim-suggestion-item" 
             data-index="${index}"
             data-product-id="${product.id}"
             data-barcode="${product.barcode || ''}">
          <strong>${escapeHtml(displayName)}</strong>
          <span style="color: #666;">${escapeHtml(displayBarcode)}${displayStock}</span>
        </div>
      `;
    });
    
    suggestionsContainer.innerHTML = html;
    suggestionsContainer.style.display = 'block';
    selectedIndex = -1;
    
    // Mettre en surbrillance la première suggestion
    highlightSuggestion(0);
  }
  
  // ===== MASQUER LES SUGGESTIONS =====
  function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    selectedIndex = -1;
  }
  
  // ===== NAVIGATION CLAVIER =====
  function handleKeydown(e) {
    const bcInput = document.getElementById('acim-bc-input');
    const items = suggestionsContainer.querySelectorAll('.acim-suggestion-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (items.length > 0) {
          selectedIndex = (selectedIndex + 1) % items.length;
          highlightSuggestion(selectedIndex);
          scrollToSuggestion(selectedIndex);
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (items.length > 0) {
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          highlightSuggestion(selectedIndex);
          scrollToSuggestion(selectedIndex);
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          selectSuggestion(items[selectedIndex]);
        } else if (items.length > 0) {
          selectSuggestion(items[0]);
        }
        break;
        
      case 'Escape':
        hideSuggestions();
        break;
    }
  }
  
  // ===== SÉLECTION D'UNE SUGGESTION =====
  function handleSuggestionClick(e) {
    const item = e.target.closest('.acim-suggestion-item');
    if (item) {
      selectSuggestion(item);
    }
  }
  
  function selectSuggestion(item) {
    const bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) return;
    
    const barcode = item.dataset.barcode || '';
    const productId = item.dataset.productId || '';
    
    // Remplir le champ avec le code-barres
    bcInput.value = barcode;
    
    // Déclencher l'événement de scan
    const event = new CustomEvent('barcodeScanned', {
      detail: { barcode: barcode, productId: productId }
    });
    bcInput.dispatchEvent(event);
    
    // Masquer les suggestions
    hideSuggestions();
    
    // Forcer le focus sur le champ
    bcInput.focus();
  }
  
  // ===== MISE EN SURBRILLANCE =====
  function highlightSuggestion(index) {
    const items = suggestionsContainer.querySelectorAll('.acim-suggestion-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.style.backgroundColor = '#19725b';
        item.style.color = 'white';
      } else {
        item.style.backgroundColor = '';
        item.style.color = '';
      }
    });
  }
  
  // ===== SCROLL VERS LA SUGGESTION =====
  function scrollToSuggestion(index) {
    const items = suggestionsContainer.querySelectorAll('.acim-suggestion-item');
    if (items[index]) {
      items[index].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }
  
  // ===== UTILITAIRES =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // ===== STYLES POUR LES SUGGESTIONS =====
  function addSuggestionStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .acim-suggestion-item {
        padding: 10px 15px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
        transition: all 0.2s ease;
      }
      
      .acim-suggestion-item:hover {
        background-color: #f0f0f0;
      }
      
      .acim-suggestion-item:last-child {
        border-bottom: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  // ===== API PUBLIQUE =====
  window.AcimCaisseAutocomplete = {
    init: init,
    search: searchProducts,
    show: showSuggestions,
    hide: hideSuggestions,
    reload: loadProducts
  };
  
  // ===== DÉMARRAGE =====
  addSuggestionStyles();
  init();
  
  console.log('[Barcode Autocomplete] Prêt - Tapez au moins ' + MIN_CHARS + ' caractères pour voir les suggestions');
})();
