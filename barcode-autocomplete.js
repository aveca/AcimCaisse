/**
 * AcimCaisse - Autocomplete for manual barcode input
 * v2: IndexedDB-based (acim-catalog store)
 */

(function() {
  'use strict';

  var MIN_CHARS = 2;
  var MAX_SUGGESTIONS = 5;
  var DEBOUNCE_DELAY = 300;
  var db = null;

  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise(function(ok) {
      try {
        var r = indexedDB.open("acim-catalog", 1);
        r.onupgradeneeded = function(e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains("products"))
            d.createObjectStore("products", { keyPath: "barcode" });
        };
        r.onsuccess = function(e) { db = e.target.result; ok(db); };
        r.onerror = function() { ok(null); };
      } catch(e) { ok(null); }
    });
  }

  function getAllProducts() {
    return openDB().then(function(d) {
      if (!d) return [];
      return new Promise(function(ok) {
        var r = d.transaction("products", "readonly").objectStore("products").getAll();
        r.onsuccess = function() { ok(r.result || []); };
        r.onerror = function() { ok([]); };
      });
    });
  }

  var products = [];
  var debounceTimer = null;
  var suggestionsContainer = null;
  var selectedIndex = -1;

  function init() {
    loadProducts();
    createSuggestionsContainer();
    attachEvents();
  }

  function loadProducts() {
    getAllProducts().then(function(list) {
      products = list;
      products.forEach(function(p) {
        p.searchKey = (p.name || '') + ' ' + (p.barcode || '') + ' ' + (p.category || '');
      });
      console.log('[Barcode Autocomplete] ' + products.length + ' products loaded from IndexedDB');
    });
  }

  function createSuggestionsContainer() {
    suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'acim-autocomplete-suggestions';
    suggestionsContainer.style.cssText = 'position:absolute;background:#fff;border:2px solid #19725b;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);max-height:200px;overflow-y:auto;z-index:10000;display:none;width:350px;max-width:90vw;';
    document.body.appendChild(suggestionsContainer);
  }

  function attachEvents() {
    var bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) { setTimeout(attachEvents, 500); return; }

    bcInput.addEventListener('input', function(e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var v = e.target.value;
        if (v.length >= MIN_CHARS) showSuggestions(v);
        else hideSuggestions();
      }, DEBOUNCE_DELAY);
    });

    bcInput.addEventListener('focus', function() {
      if (bcInput.value.length >= MIN_CHARS) showSuggestions(bcInput.value);
    });

    bcInput.addEventListener('blur', function() {
      setTimeout(hideSuggestions, 200);
    });

    bcInput.addEventListener('keydown', handleKeydown);
    suggestionsContainer.addEventListener('click', function(e) {
      var item = e.target.closest('.acim-suggestion-item');
      if (item) selectSuggestion(item);
    });
  }

  function searchProducts(query) {
    var q = query.toLowerCase();
    var matches = products.filter(function(p) {
      return (p.searchKey || '').toLowerCase().indexOf(q) >= 0;
    });
    matches.sort(function(a, b) {
      return (a.searchKey || '').toLowerCase().indexOf(q) - (b.searchKey || '').toLowerCase().indexOf(q);
    });
    return matches.slice(0, MAX_SUGGESTIONS);
  }

  function showSuggestions(query) {
    var matches = searchProducts(query);
    if (matches.length === 0) { hideSuggestions(); return; }
    var bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) return;
    var rect = bcInput.getBoundingClientRect();
    suggestionsContainer.style.left = rect.left + 'px';
    suggestionsContainer.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    suggestionsContainer.style.width = (rect.width + 50) + 'px';

    var html = '';
    matches.forEach(function(product, index) {
      var name = product.name || product.barcode || '?';
      var bc = product.barcode ? ' (' + product.barcode + ')' : '';
      var stock = (product.stockQty != null) ? ' - Stock: ' + product.stockQty : '';
      html += '<div class="acim-suggestion-item" data-index="' + index + '" data-barcode="' + (product.barcode || '') + '">'
        + '<strong>' + esc(name) + '</strong>'
        + '<span style="color:#666;">' + esc(bc) + stock + '</span></div>';
    });
    suggestionsContainer.innerHTML = html;
    suggestionsContainer.style.display = 'block';
    selectedIndex = -1;
    highlightSuggestion(0);
  }

  function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    selectedIndex = -1;
  }

  function handleKeydown(e) {
    var items = suggestionsContainer.querySelectorAll('.acim-suggestion-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { selectedIndex = (selectedIndex + 1) % items.length; highlightSuggestion(selectedIndex); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { selectedIndex = (selectedIndex - 1 + items.length) % items.length; highlightSuggestion(selectedIndex); } }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) selectSuggestion(items[selectedIndex]);
      else if (items.length > 0) selectSuggestion(items[0]);
    }
    else if (e.key === 'Escape') hideSuggestions();
  }

  function selectSuggestion(item) {
    var bcInput = document.getElementById('acim-bc-input');
    if (!bcInput) return;
    var barcode = item.dataset.barcode || '';
    bcInput.value = '';
    hideSuggestions();
    bcInput.focus();
    // Directly add to cart via acim-caisse.js API
    if (window._acimProcessBarcode) {
      window._acimProcessBarcode(barcode);
    } else if (barcode) {
      bcInput.value = barcode;
      bcInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
  }

  function highlightSuggestion(index) {
    var items = suggestionsContainer.querySelectorAll('.acim-suggestion-item');
    items.forEach(function(el, i) {
      el.style.backgroundColor = i === index ? '#19725b' : '';
      el.style.color = i === index ? '#fff' : '';
    });
  }

  function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  // Styles
  var s = document.createElement('style');
  s.textContent = '.acim-suggestion-item{padding:10px 15px;cursor:pointer;border-bottom:1px solid #eee;transition:all .2s}.acim-suggestion-item:hover{background:#f0f0f0}.acim-suggestion-item:last-child{border-bottom:none}';
  document.head.appendChild(s);

  window.AcimCaisseAutocomplete = { init: init, search: searchProducts, show: showSuggestions, hide: hideSuggestions, reload: loadProducts };
  init();
})();
