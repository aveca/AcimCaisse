/**
 * AcimCaisse - Correction des stocks négatifs
 * Ce script corrige automatiquement les produits avec stockQty < 0
 * À exécuter avant l'ouverture de la caisse
 */

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  const STORAGE_KEY = 'acimcaisse_data';
  const MIN_STOCK = 0; // Stock minimum autorisé
  
  // ===== FONCTION PRINCIPALE =====
  function fixNegativeStocks() {
    try {
      // Récupérer les données depuis localStorage
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      
      if (!data.products || !Array.isArray(data.products)) {
        console.log('[Stock Fix] Aucune donnée de produits trouvée');
        return { fixed: 0, total: 0 };
      }
      
      let fixedCount = 0;
      const products = data.products;
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        // Vérifier si le stock est négatif
        if (product.stockQty !== null && product.stockQty !== undefined && product.stockQty < MIN_STOCK) {
          console.log(`[Stock Fix] Correction: ${product.name} (${product.barcode}) - Stock: ${product.stockQty} → 0`);
          product.stockQty = MIN_STOCK;
          fixedCount++;
        }
      }
      
      // Sauvegarder les corrections
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      console.log(`[Stock Fix] ${fixedCount} produits corrigés sur ${products.length} total`);
      
      return { fixed: fixedCount, total: products.length };
    } catch (e) {
      console.error('[Stock Fix] Erreur:', e);
      return { fixed: 0, total: 0, error: e.message };
    }
  }

  // ===== EXÉCUTION AUTOMATIQUE =====
  // Exécuter au chargement de la page
  if (typeof window !== 'undefined') {
    // Attendre que Flutter soit prêt (si présent)
    let retryCount = 0;
    const maxRetries = 10;
    
    function tryFix() {
      retryCount++;
      const result = fixNegativeStocks();
      
      // Afficher une notification si des corrections ont été faites
      if (result.fixed > 0) {
        showNotification(`✅ ${result.fixed} stocks négatifs corrigés`);
      }
      
      if (retryCount < maxRetries) {
        setTimeout(tryFix, 1000);
      }
    }
    
    // Démarrer après 2 secondes (laisser le temps à Flutter de charger)
    setTimeout(tryFix, 2000);
  }

  // ===== NOTIFICATION VISUELLE =====
  function showNotification(message) {
    if (!document.body) return;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #19725b;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) notification.remove();
      }, 300);
    }, 5000);
  }

  // ===== API PUBLIQUE =====
  window.AcimCaisseStockFix = {
    fix: fixNegativeStocks,
    check: function() {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      if (!data.products) return { negative: 0, total: 0 };
      
      const negative = data.products.filter(p => 
        p.stockQty !== null && p.stockQty !== undefined && p.stockQty < 0
      ).length;
      
      return { negative: negative, total: data.products.length };
    }
  };

  // ===== EXPORT POUR NODE.JS (setup.js) =====
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fixNegativeStocks };
  }

  console.log('[AcimCaisse Stock Fix] Chargé - Exécutez AcimCaisseStockFix.fix() pour corriger');
})();
