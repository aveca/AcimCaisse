/**
 * AcimCaisse User Tracker
 * Track clics, mouvements souris, erreurs pour analyse UX
 * Fonctionne sur web (GitHub Pages) et local (.exe)
 * Stockage local via IndexedDB, export manuel vers GitHub Issues
 */

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  const TRACKER_DB = 'AcimCaisseUserLogs';
  const TRACKER_STORE = 'userActions';
  const MAX_LOGS = 200; // Max logs avant export automatique
  const SAMPLE_RATE = 0.2; // 20% des mouvements souris (pour éviter la surcharge)
  
  // ===== INITIALISATION =====
  let dbPromise = null;
  let sessionId = generateSessionId();
  
  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  }

  function getDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(TRACKER_DB, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(TRACKER_STORE)) {
            db.createObjectStore(TRACKER_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });
    }
    return dbPromise;
  }

  // ===== LOGGING =====
  async function logAction(type, data = {}) {
    try {
      const db = await getDb();
      const tx = db.transaction(TRACKER_STORE, 'readwrite');
      const store = tx.objectStore(TRACKER_STORE);
      
      const logEntry = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        sessionId: sessionId,
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        isLocal: window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      };
      
      store.add(logEntry);
      
      tx.oncomplete = () => {
        // Vérifier si on doit exporter
        checkAndExportLogs();
      };
    } catch (e) {
      console.error('[Tracker] Error:', e);
    }
  }

  // ===== TRACKERS AUTOMATIQUES =====
  
  // Track clics
  document.addEventListener('click', (e) => {
    const target = e.target;
    const selector = getCssSelector(target);
    
    logAction('click', {
      selector: selector,
      tagName: target.tagName,
      id: target.id || null,
      className: target.className ? target.className.toString() : null,
      text: target.innerText?.trim().substring(0, 100) || null,
      x: e.clientX,
      y: e.clientY,
      button: e.button
    });
  });

  // Track mouvements souris (sampled)
  document.addEventListener('mousemove', (e) => {
    if (Math.random() < SAMPLE_RATE) {
      logAction('mousemove', {
        x: e.clientX,
        y: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY
      });
    }
  });

  // Track scroll
  document.addEventListener('scroll', () => {
    logAction('scroll', {
      x: window.scrollX,
      y: window.scrollY,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  });

  // Track erreurs JavaScript
  window.addEventListener('error', (e) => {
    logAction('js_error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack || null
    });
  });

  // Track changements de page (SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      logAction('page_change', {
        from: lastUrl,
        to: window.location.href
      });
      lastUrl = window.location.href;
    }
  }, 1000);

  // Track focus/blur sur les inputs
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      logAction('focus', {
        selector: getCssSelector(e.target),
        type: e.target.type,
        name: e.target.name,
        id: e.target.id
      });
    }
  });

  // Track appui sur les touches (pour le scanner)
  document.addEventListener('keydown', (e) => {
    logAction('keydown', {
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      target: getCssSelector(e.target)
    });
  });

  // ===== UTILITAIRES =====
  
  function getCssSelector(element) {
    if (!(element instanceof Element)) return '';
    
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.nodeName.toLowerCase();
      
      if (element.id) {
        selector += '#' + element.id;
        path.unshift(selector);
        break;
      } else if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\s+/);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Ajouter l'index si nécessaire
      const siblings = element.parentNode ? element.parentNode.children : [];
      if (siblings.length > 1) {
        let index = 1;
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i] === element) {
            selector += ':nth-child(' + (i + 1) + ')';
            break;
          }
        }
      }
      
      path.unshift(selector);
      element = element.parentNode;
    }
    
    return path.join(' > ');
  }

  // ===== EXPORT DES LOGS =====
  
  async function checkAndExportLogs() {
    try {
      const db = await getDb();
      const tx = db.transaction(TRACKER_STORE, 'readonly');
      const store = tx.objectStore(TRACKER_STORE);
      const request = store.getAll();
      
      request.onsuccess = async () => {
        const logs = request.result;
        
        // Si trop de logs, exporter
        if (logs.length >= MAX_LOGS) {
          await exportLogs(logs);
          await clearLogs();
        }
      };
    } catch (e) {
      console.error('[Tracker] Export check failed:', e);
    }
  }

  async function exportLogs(logs) {
    // Générer un rapport
    const report = generateReport(logs);
    
    // Afficher dans la console (pour copier-coller)
    console.log('=== ACIMCAISSE UX REPORT ===');
    console.log(report);
    console.log('=== END REPORT ===');
    
    // Sauvegarder dans un fichier (pour le .exe)
    saveReportToFile(report);
    
    // Afficher une notification à l'utilisateur
    showExportNotification();
  }

  function generateReport(logs) {
    const sessionGroups = {};
    logs.forEach(log => {
      if (!sessionGroups[log.sessionId]) {
        sessionGroups[log.sessionId] = [];
      }
      sessionGroups[log.sessionId].push(log);
    });

    let report = `## AcimCaisse UX Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Logs:** ${logs.length}\n`;
    report += `**Sessions:** ${Object.keys(sessionGroups).length}\n\n`;

    // Statistiques
    const stats = {
      clicks: logs.filter(l => l.type === 'click').length,
      mousemove: logs.filter(l => l.type === 'mousemove').length,
      scroll: logs.filter(l => l.type === 'scroll').length,
      errors: logs.filter(l => l.type === 'js_error').length,
      keydown: logs.filter(l => l.type === 'keydown').length
    };

    report += `### Statistics\n`;
    report += `- Clics: ${stats.clicks}\n`;
    report += `- Mouvements souris: ${stats.mousemove}\n`;
    report += `- Scrolls: ${stats.scroll}\n`;
    report += `- Erreurs JS: ${stats.errors}\n`;
    report += `- Touches clavier: ${stats.keydown}\n\n`;

    // Top clics
    const clickTargets = {};
    logs.filter(l => l.type === 'click').forEach(log => {
      const selector = log.data.selector || 'unknown';
      clickTargets[selector] = (clickTargets[selector] || 0) + 1;
    });
    
    report += `### Top Clics\n`;
    Object.entries(clickTargets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([selector, count]) => {
        report += `- **${selector}**: ${count} clics\n`;
      });

    report += `\n### Erreurs JavaScript\n`;
    logs.filter(l => l.type === 'js_error').forEach(log => {
      report += `- **${log.data.message}** (${log.data.filename}:${log.data.lineno})\n`;
    });

    report += `\n### Détails des logs\n\n`;
    report += '<details><summary>Voir tous les logs (JSON)</summary>\n\n';
    report += '\`\`\`json\n';
    report += JSON.stringify(logs, null, 2);
    report += '\n\`\`\`\n\n';
    report += '</details>\n';

    return report;
  }

  function saveReportToFile(report) {
    // Pour le .exe (Electron), sauvegarder dans un fichier
    if (window.electronAPI) {
      try {
        window.electronAPI.saveLogsToFile(report);
      } catch (e) {
        console.log('[Tracker] Electron API not available');
      }
    }
    
    // Pour le web, proposer le téléchargement
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acimcaisse-ux-report-${new Date().toISOString().split('T')[0]}.md`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showExportNotification() {
    // Créer une notification visuelle
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
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
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    notification.innerHTML = `
      <strong>✓ Logs exportés</strong><br>
      <small>Rapport UX généré (console + téléchargement)</small>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  async function clearLogs() {
    try {
      const db = await getDb();
      const tx = db.transaction(TRACKER_STORE, 'readwrite');
      tx.objectStore(TRACKER_STORE).clear();
    } catch (e) {
      console.error('[Tracker] Clear failed:', e);
    }
  }

  // ===== API PUBLIQUE =====
  window.AcimCaisseTracker = {
    log: logAction,
    export: exportLogs,
    clear: clearLogs,
    getLogs: async function() {
      const db = await getDb();
      const tx = db.transaction(TRACKER_STORE, 'readonly');
      return new Promise((resolve, reject) => {
        const request = tx.objectStore(TRACKER_STORE).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });
    }
  };

  // ===== INITIALISATION =====
  console.log('[AcimCaisse Tracker] Initialisé - Session:', sessionId);
  
  // Ajouter un bouton de debug (optionnel)
  if (window.location.search.includes('debug=tracker')) {
    const debugBtn = document.createElement('button');
    debugBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: #e65100;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      z-index: 999999;
      font-family: Arial, sans-serif;
    `;
    debugBtn.textContent = '📊 Export Logs';
    debugBtn.onclick = () => {
      window.AcimCaisseTracker.export();
    };
    document.body.appendChild(debugBtn);
  }

})();
