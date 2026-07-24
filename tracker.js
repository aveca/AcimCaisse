/**
 * AcimCaisse Smart Tracker
 * Lightweight UX tracker for debugging and interface building.
 * 
 * Logs: clicks, JS errors, cart operations (custom events)
 * Does NOT log: mousemove, scroll, every keystroke
 * Does NOT auto-download files
 * Export: manual via window.AcimCaisseTracker.export()
 * 
 * To enable verbose mode: ?debug=tracker in URL
 */

(function() {
  'use strict';

  var TRACKER_DB = 'AcimCaisseUserLogs';
  var TRACKER_STORE = 'userActions';
  var MAX_LOGS = 500;
  var VERBOSE = window.location.search.indexOf('debug=tracker') >= 0;

  var dbPromise = null;
  var sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);

  function getDb() {
    if (!dbPromise) {
      dbPromise = new Promise(function(resolve, reject) {
        var request = indexedDB.open(TRACKER_DB, 1);
        request.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(TRACKER_STORE)) {
            db.createObjectStore(TRACKER_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = function() { resolve(request.result); };
        request.onerror = reject;
      });
    }
    return dbPromise;
  }

  function log(type, data) {
    getDb().then(function(db) {
      if (!db) return;
      var tx = db.transaction(TRACKER_STORE, 'readwrite');
      tx.objectStore(TRACKER_STORE).add({
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        sessionId: sessionId,
        type: type,
        data: data || {},
        timestamp: new Date().toISOString(),
        url: window.location.href,
        isLocal: window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
      });
    }).catch(function() {});
  }

  // ── WHAT WE TRACK ──

  // 1. Clicks (only meaningful ones)
  document.addEventListener('click', function(e) {
    var t = e.target;
    var tag = t.tagName;
    var id = t.id || '';
    var text = (t.textContent || '').trim().substring(0, 60);

    // Skip noise (empty body clicks, flutter canvas)
    if (tag === 'HTML' || tag === 'BODY' || tag === 'FLUTTER-VIEW') return;

    log('click', { tag: tag, id: id, text: text });
  }, { passive: true });

  // 2. JS errors
  window.addEventListener('error', function(e) {
    log('js_error', {
      message: e.message,
      source: (e.filename || '').replace(/^.*[\\/]/, ''),
      line: e.lineno
    });
  });

  // 3. Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    log('promise_rejection', {
      reason: String(e.reason || '').substring(0, 200)
    });
  });

  // 4. Cart operations — listen for custom events from acim-caisse.js
  //    acim-caisse.js dispatches: acim:add, acim:checkout, acim:scan, acim:edit
  document.addEventListener('acim:add', function(e) {
    log('cart_add', e.detail || {});
  });
  document.addEventListener('acim:checkout', function(e) {
    log('cart_checkout', e.detail || {});
  });
  document.addEventListener('acim:scan', function(e) {
    log('scan', e.detail || {});
  });

  // 5. Console errors (catch Angular/Dart errors)
  var origError = console.error;
  console.error = function() {
    var msg = Array.prototype.slice.call(arguments).map(String).join(' ').substring(0, 300);
    log('console_error', { message: msg });
    origError.apply(console, arguments);
  };

  // ── VERBOSE MODE (only with ?debug=tracker) ──
  if (VERBOSE) {
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      log('keydown', { key: e.key, ctrl: e.ctrlKey });
    });

    window.addEventListener('resize', function() {
      log('resize', { w: window.innerWidth, h: window.innerHeight });
    });

    console.log('[Tracker] Verbose mode ON');
  }

  // ── PUBLIC API ──
  window.AcimCaisseTracker = {
    log: log,
    getLogs: function() {
      return getDb().then(function(db) {
        if (!db) return [];
        return new Promise(function(resolve) {
          var r = db.transaction(TRACKER_STORE, 'readonly')
                    .objectStore(TRACKER_STORE).getAll();
          r.onsuccess = function() { resolve(r.result || []); };
          r.onerror = function() { resolve([]); };
        });
      });
    },
    export: function() {
      return this.getLogs().then(function(logs) {
        if (!logs.length) { console.log('[Tracker] No logs'); return; }
        var report = '## AcimCaisse UX Report\n';
        report += 'Generated: ' + new Date().toISOString() + '\n';
        report += 'Total: ' + logs.length + ' events\n\n';

        var counts = {};
        logs.forEach(function(l) { counts[l.type] = (counts[l.type] || 0) + 1; });
        Object.keys(counts).sort().forEach(function(k) {
          report += '- ' + k + ': ' + counts[k] + '\n';
        });

        report += '\n```\n' + JSON.stringify(logs.slice(-50), null, 2) + '\n```\n';
        console.log(report);
        return report;
      });
    },
    clear: function() {
      return getDb().then(function(db) {
        if (!db) return;
        db.transaction(TRACKER_STORE, 'readwrite')
           .objectStore(TRACKER_STORE).clear();
      });
    },
    count: function() {
      return this.getLogs().then(function(logs) { return logs.length; });
    }
  };

  // ── INIT ──
  log('session_start', {
    screen: window.innerWidth + 'x' + window.innerHeight,
    ua: navigator.userAgent.substring(0, 100)
  });
})();
