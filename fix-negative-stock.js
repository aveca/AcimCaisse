/**
 * AcimCaisse - Fix negative stock values
 * v2: IndexedDB-based (acim-catalog store)
 */

(function() {
  'use strict';

  var MIN_STOCK = 0;

  function openDB() {
    return new Promise(function(ok) {
      try {
        var r = indexedDB.open("acim-catalog", 1);
        r.onupgradeneeded = function(e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains("products"))
            d.createObjectStore("products", { keyPath: "barcode" });
        };
        r.onsuccess = function(e) { ok(e.target.result); };
        r.onerror = function() { ok(null); };
      } catch(e) { ok(null); }
    });
  }

  function fixNegativeStocks() {
    return openDB().then(function(d) {
      if (!d) return { fixed: 0, total: 0 };
      return new Promise(function(ok) {
        var tx = d.transaction("products", "readwrite");
        var store = tx.objectStore("products");
        var getAll = store.getAll();
        getAll.onsuccess = function() {
          var products = getAll.result || [];
          var fixedCount = 0;
          products.forEach(function(p) {
            if (p.stockQty != null && p.stockQty < MIN_STOCK) {
              p.stockQty = MIN_STOCK;
              store.put(p);
              fixedCount++;
            }
          });
          tx.oncomplete = function() {
            if (fixedCount > 0) console.log('[Stock Fix] ' + fixedCount + ' products fixed');
            ok({ fixed: fixedCount, total: products.length });
          };
        };
        getAll.onerror = function() { ok({ fixed: 0, total: 0 }); };
      });
    }).catch(function() { return { fixed: 0, total: 0 }; });
  }

  function tryFix() {
    fixNegativeStocks().then(function(result) {
      if (result.fixed > 0) console.log('[Stock Fix] ' + result.fixed + ' negative stocks corrected');
    });
  }

  setTimeout(tryFix, 3000);

  window.AcimCaisseStockFix = {
    fix: fixNegativeStocks,
    check: function() {
      return openDB().then(function(d) {
        if (!d) return { negative: 0, total: 0 };
        return new Promise(function(ok) {
          var r = d.transaction("products", "readonly").objectStore("products").getAll();
          r.onsuccess = function() {
            var prods = r.result || [];
            var neg = prods.filter(function(p) { return p.stockQty != null && p.stockQty < 0; }).length;
            ok({ negative: neg, total: prods.length });
          };
          r.onerror = function() { ok({ negative: 0, total: 0 }); };
        });
      });
    }
  };

  console.log('[AcimCaisse Stock Fix] Loaded (IndexedDB)');
})();
