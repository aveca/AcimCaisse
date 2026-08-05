// ─── AcimCaisse v37 — Bug fixes + catégorisation Yarden améliorée + photos ──
;(function(){
  "use strict";
  var _log=function(m){console.log("[Acim] "+m);};
  var _err=function(m,e){console.error("[Acim] "+m,e);};

  // ─── MULTI-TAB LOCK ──────────────────────────────────
  var _tabLockKey="acim-caisse-tab-lock";
  var _tabId=Date.now()+"-"+Math.floor(Math.random()*99999);
  var _isMainTab=true;
  function _acquireTabLock(){
    try{
      var prev=localStorage.getItem(_tabLockKey);
      var now=Date.now();
      if(prev){var parts=prev.split("|");var ts=parseInt(parts[0]);var id=parts[1];
        if(now-ts<5000&&id!==_tabId){_isMainTab=false;_log("Another tab is active — this tab is secondary");return false;}
      }
      localStorage.setItem(_tabLockKey,now+"|"+_tabId);
      return true;
    }catch(e){return true;}
  }
  function _refreshTabLock(){try{localStorage.setItem(_tabLockKey,Date.now()+"|"+_tabId);}catch(e){}}
  function _releaseTabLock(){try{var prev=localStorage.getItem(_tabLockKey);if(prev&&prev.indexOf(_tabId)>=0)localStorage.removeItem(_tabLockKey);}catch(e){}}
  window.addEventListener("beforeunload",_releaseTabLock);
  setInterval(_refreshTabLock,3000);

  // ─── AUTO-BARCODE ────────────────────────────────────
  var _bcSeq=2000;
  var _bcSeqKey="acim-bc-seq";
  function _nextBarcode(){return "ACIM-"+(_bcSeq++);}
  function _loadBcSeq(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_bcSeqKey);
        r.onsuccess=function(){if(r.result&&typeof r.result.value==="number")_bcSeq=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveBcSeq(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_bcSeqKey,value:_bcSeq});
    }).catch(function(){});
  }
  var _origNextBarcode=_nextBarcode;
  _nextBarcode=function(){var bc=_origNextBarcode();_saveBcSeq();return bc;};

  // ─── TICKET NUMBER ───────────────────────────────────
  var _ticketSeq=100;
  var _ticketSeqKey="acim-ticket-seq";
  function _nextTicket(){return _ticketSeq++;}
  function _loadTicketSeq(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_ticketSeqKey);
        r.onsuccess=function(){if(r.result&&typeof r.result.value==="number")_ticketSeq=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveTicketSeq(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_ticketSeqKey,value:_ticketSeq});
    }).catch(function(){});
  }

  // ─── STORE SETTINGS ──────────────────────────────────
  var _settings={storeName:"AcimCaisse",footer:"Merci de votre visite !"};
  var _settingsKey="acim-store-settings";
  function _loadSettings(){
    return _openMeta().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_settingsKey);
        r.onsuccess=function(){if(r.result&&r.result.value)_settings=r.result.value;ok();};
        r.onerror=function(){ok();};
      });
    }).catch(function(){});
  }
  function _saveSettings(){
    _openMeta().then(function(d){
      if(!d)return;var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:_settingsKey,value:_settings});
    }).catch(function(){});
  }

  // ─── META STORE ──────────────────────────────────────
  var _metaDb=null;
  function _openMeta(){
    if(_metaDb)return Promise.resolve(_metaDb);
    return new Promise(function(ok){
      try{var r=indexedDB.open("acim-meta",1);
        r.onupgradeneeded=function(e){var d=e.target.result;if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"key"});};
        r.onsuccess=function(e){_metaDb=e.target.result;ok(_metaDb);};r.onerror=function(){ok(null);};
      }catch(e){ok(null);}
    });
  }

  // ─── CATEGORIES ──────────────────────────────────────
  var CATS=[
    {id:"viande",ic:"🥩"}, {id:"volaille",ic:"🐔"}, {id:"laitier",ic:"🧀"}, {id:"epicerie",ic:"🏪"},
    {id:"boulangerie",ic:"🍞"}, {id:"boisson",ic:"🥤"}, {id:"surgelé",ic:"🧊"},
    {id:"snack",ic:"🍪"}, {id:"condiment",ic:"🧂"}, {id:"menager",ic:"🧴"},
    {id:"vin",ic:"🍷"}, {id:"autre",ic:"📦"}
  ];
  function _catIcon(id){
    for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i].ic;
    return "📦";
  }
  var _catBg={viande:"#fce4e4",volaille:"#fef0db",laitier:"#dbeafe",epicerie:"#dcfce7",boulangerie:"#fef9c3",boisson:"#ccfbf1",snack:"#fef3c7",condiment:"#f3f4f6",menager:"#ede9fe",surgelé:"#cffafe",vin:"#fce7f3",autre:"#f5f5f5"};


  // ─── CATALOGUE IndexedDB ─────────────────────────────
  var _db=null;
  function _openDB(){
    if(_db)return Promise.resolve(_db);
    return new Promise(function(ok){
      try{
        var r=indexedDB.open("acim-catalog",1);
        r.onupgradeneeded=function(e){
          _log("DB upgrade needed — creating stores");
          var d=e.target.result;
          if(!d.objectStoreNames.contains("products")){
            d.createObjectStore("products",{keyPath:"barcode"});
            _log("Created 'products' object store");
          }
        };
        r.onsuccess=function(e){
          _db=e.target.result;
          _log("DB opened successfully");
          ok(_db);
        };
        r.onerror=function(e){
          _err("DB open error:",e);
          ok(null);
        };
        r.onblocked=function(){
          _err("DB open blocked by another connection");
          ok(null);
        };
      }catch(e){
        _err("DB open exception:",e);
        ok(null);
      }
    });
  }
  function _dbGet(bc){return _openDB().then(function(d){if(!d)return null;
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").get(bc);r.onsuccess=function(){ok(r.result||null);};r.onerror=function(){ok(null);};});});}
  function _dbPut(p){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").put(p);tx.oncomplete=ok;tx.onerror=ok;});});}
  function _dbGetAll(){return _openDB().then(function(d){if(!d)return[];
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").getAll();r.onsuccess=function(){ok(r.result||[]);};r.onerror=function(){ok([]);};});});}
  function _dbDelete(bc){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").delete(bc);tx.oncomplete=ok;tx.onerror=ok;});});}
  function _dbDeleteAll(){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").clear();tx.oncomplete=ok;tx.onerror=ok;});});}

  // ─── SALES STORE ─────────────────────────────────────
  function _openSalesDB(){
    return new Promise(function(ok){
      try{var r=indexedDB.open("acim-sales",1);
        r.onupgradeneeded=function(e){var d=e.target.result;
          if(!d.objectStoreNames.contains("sales"))d.createObjectStore("sales",{keyPath:"id",autoIncrement:true});};
        r.onsuccess=function(e){ok(e.target.result);};r.onerror=function(){ok(null);};
      }catch(e){ok(null);}
    });
  }
  function _persistSale(ticketNumber,items,totalCents,discountCents,payments){
    return _openSalesDB().then(function(d){
      if(!d)return;return new Promise(function(ok){
        var tx=d.transaction("sales","readwrite");
        tx.objectStore("sales").put({
          ticketNumber:ticketNumber,
          timestamp:Date.now(),isoTime:new Date().toISOString(),
          items:items.map(function(it){return{
            name:it.name,price:it.priceCents,barcode:it.bc||"",cat:it.cat,
            weight:it.weight||null,unitType:it.unitType||null,pricePerUnit:it.pricePerUnit||null,
            discountCents:it.discountCents||0,qty:it.qty||1
          };}),
          totalCents:totalCents,
          discountCents:discountCents||0,
          payments:payments||[],
          itemCount:items.length
        });
        tx.oncomplete=function(){ok(true);};tx.onerror=function(){ok(false);};
      });
    }).catch(function(e){_err("Sale persist failed:",e);return Promise.resolve(false);});
  }
  function _getSalesHistory(){
    return _openSalesDB().then(function(d){
      if(!d)return[];
      return new Promise(function(ok){
        var r=d.transaction("sales","readonly").objectStore("sales").getAll();
        r.onsuccess=function(){ok(r.result||[]);};r.onerror=function(){ok([]);};
      });
    }).catch(function(){return[];});
  }

  // ─── STOCK HELPERS ───────────────────────────────────
  function _decrementStock(barcode,qty){
    if(!barcode)return;
    _dbGet(barcode).then(function(p){
      if(!p)return;
      var newQty=(p.stockQty||0)-(qty||1);
      p.stockQty=newQty;
      p.last_updated=Date.now();
      _dbPut(p);
    });
  }

  // ─── BACKUP IMPORT ───────────────────────────────────
  var _BACKUP_IMPORTED_KEY="acim-backup-imported-v1";
  var _BACKUP_DATA={"format":1,"categories":[{"id":"cat-frais","name":"Frais"},{"id":"cat-epicerie","name":"Epicerie"},{"id":"cat-surgele","name":"Surgelé"},{"id":"cat-viande","name":"Viande"},{"id":"cat-volaille","name":"Volaille"},{"id":"cat-boisson","name":"Boisson"},{"id":"cat-laitier","name":"Laitier"},{"id":"cat-condiment","name":"Condiment"},{"id":"cat-boulangerie","name":"Boulangerie"},{"id":"cat-alcool","name":"Alcool"},{"id":"cat-snack","name":"Snack"},{"id":"cat-autre","name":"Autre"}],"products":[{"b":"7ee5f838-8682-4a1b-8043-940a84a333dc","s":20,"n":"*blanc Dinde Poivre","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"6f30dd7c-cff2-4034-81ea-979662e73a69","s":20,"n":"*chiffonnade Dinde Fumée","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"cc82ef8e-7918-4162-8afc-904a514c80e6","s":20,"n":"*poitrine Dinde Rotie","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"INV-1785022716403-9041","s":0,"n":"1410 Lasagne sauce tomate et fromage 300 gr 10 € €","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"086785732046","s":0,"n":"2","c":"cat-boisson","u":"unit","p":2500,"pp":0},{"b":"4a2becd2-2ff6-4866-ad5d-68ed7127f465","s":0,"n":"a","c":"cat-autre","u":"unit","p":41000,"pp":0},{"b":"7290102992867","s":0,"n":"Adoucissant ultra concentré cool MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102992850","s":0,"n":"Adoucissant ultra concentré musk MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102992843","s":0,"n":"Adoucissant ultra concentré zen MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760057260075","s":0,"n":"Ahlalem SHIMON ARICHE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"2938615012522","s":0,"n":"Aiguillette de Poulet IQF","c":"cat-volaille","u":"unit","p":2500,"pp":0},{"b":"OFF012/I","s":0,"n":"AIGUILLETTES DE POULET IQF","c":"cat-volaille","u":"kg","p":1836,"pp":0},{"b":"5425007729122","s":255,"n":"AIL CONGELE","c":"cat-autre","u":"unit","p":500,"pp":0},{"b":"3423990000817","s":0,"n":"Ail en grains TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290012561054","s":0,"n":"Ail pilé en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290012561108","s":0,"n":"Ail pilé piquant en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290002862987","s":0,"n":"Ail pilé YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760187680316","s":0,"n":"Ailes de poulet bbq YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3760187680293","s":0,"n":"Ailes de poulet caramélisées YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"0791163371358","s":0,"n":"Aimé Arnoux Gigondas Vallée du rhône rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0791163371365","s":0,"n":"Aimé Arnoux Vacqueyras Vallée du rhône rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034626504","s":0,"n":"Amandes blanchies","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034626511","s":0,"n":"Amandes décortiquées 23-25 YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034627501","s":0,"n":"Amandes effilées YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034626535","s":0,"n":"Amandes en poudre YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034627525","s":0,"n":"Amandes grillées salées YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034627532","s":0,"n":"Amandes grillées sans sel YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760034626528","s":0,"n":"Amandes n p suprèmes YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290002862581","s":0,"n":"Amba mangue macérée épicée en seau YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290002862390","s":0,"n":"Amba mangue macérée épicée YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"MIGR-1785882429010-7","s":255,"n":"ANCHOIS","c":"cat-surgele","u":"unit","p":600,"pp":0},{"b":"BKR/S027","s":137,"n":"ANGUS STEAK HACHE BOEUF SKIN SURG","c":"cat-viande","u":"unit","p":0,"pp":0},{"b":"TOMA/A/S","s":49,"n":"ANGUS TOMAHAWOK MATURE SURGE","c":"cat-viande","u":"unit","p":0,"pp":0},{"b":"3299790211018","s":0,"n":"ANISETTE 1 L","c":"cat-alcool","u":"unit","p":3200,"pp":0},{"b":"3299791004732","s":0,"n":"Anisette 50 cl","c":"cat-alcool","u":"unit","p":2000,"pp":0},{"b":"78cfb79f-d0b3-4580-b154-c74e8f1306fc","s":10,"n":"Aop D P'tit Pays Vache P V","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"f401078b-5688-45e1-9fcc-93a36b6d4937","s":25,"n":"Août Chevre Tartiner Déc","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"6ec2bd30-52da-4494-b259-defcf0a7d9f1","s":6,"n":"Août Yaourt Sur Lit Abricot Ots","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"0077544006423","s":0,"n":"Apropo tubes OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034627518","s":0,"n":"Arachides coques YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034626542","s":0,"n":"Arachides décortiquées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034627549","s":0,"n":"Arachides rouges salées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8001598322026","s":0,"n":"ARTICHAUDS DU CHEF","c":"cat-epicerie","u":"unit","p":1100,"pp":0},{"b":"3760030145030","s":0,"n":"ARTICHAUTS","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"8001598022025","s":0,"n":"Artichauts du chef AMICI MIEI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8001598030914","s":0,"n":"Artichauts grillés AMICI MIEI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"22134320005730","s":0,"n":"ASSADO DE BOEUF","c":"cat-viande","u":"kg","p":2790,"pp":0},{"b":"BKR/S109","s":64,"n":"ASSADO DE BOEUF SURGELE","c":"cat-viande","u":"kg","p":3000,"pp":0},{"b":"3423990000848","s":0,"n":"Assaisonnement à la Toscane","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000916","s":0,"n":"Assaisonnement pour boulettes","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000763","s":0,"n":"Assaisonnement pour chawarma TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000886","s":0,"n":"Assaisonnement pour PDT","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000831","s":0,"n":"Assaisonnement pour pizza TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000756","s":0,"n":"Assaisonnement pour poulet au BBQ TA'AM VAREACH","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990000701","s":0,"n":"Assaisonnement zaatar TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423991000076","s":0,"n":"Assiettes argent YARDEN x16","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3700022338620","s":0,"n":"Assiettes noir et or YARDEN x16","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0838948004640","s":0,"n":"Assortiment de légumes grillés SHNEIDERS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"5060414910123","s":0,"n":"Assortiment dégustation italien GUSTOFINO","c":"cat-frais","u":"unit","p":1500,"pp":0},{"b":"7290005423161","s":0,"n":"Assouplissant bébé aloe vera MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102991419","s":0,"n":"Assouplissant bébé MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000292298","s":0,"n":"Assouplissant bio MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102991426","s":0,"n":"Assouplissant fleur bleue MAXIMA SANO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290012117558","s":0,"n":"Assouplissant musk MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102991433","s":0,"n":"Assouplissant soie MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290002358398","s":254,"n":"AUBERGINE","c":"cat-autre","u":"unit","p":500,"pp":0},{"b":"7290106572393","s":0,"n":"Aubergines à la grecque YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990006703","s":0,"n":"Aubergines à la sauce piquante YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990006727","s":0,"n":"Aubergines à la téhina YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290106572416","s":0,"n":"Aubergines braisées YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760030143616","s":0,"n":"Aubergines farcies au riz YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0838948004619","s":0,"n":"Aubergines grillées tranchées fines SHNEIDERS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0710069301429","s":0,"n":"Aubergines panées TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3423990006710","s":0,"n":"Aubergines thaï sauce chili douce YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"760059041450","s":22,"n":"Authentique","c":"cat-autre","u":"unit","p":600,"pp":0},{"b":"02c6b03e-f069-48e4-8c21-33adf1c633d9","s":12,"n":"Authentique Août Yaourt Nature Ots Juil","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"a6b9b37b-7b5e-4aed-9d9a-3d53f1dbbf9f","s":10,"n":"Auvergne C Brique Paysane P V","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7c3863d7-5e23-4685-918b-ed6b1b348b8f","s":12,"n":"Aux Pignons Juil Fromage Blanc Fruit Ots Juil","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423993900039","s":0,"n":"Baba ganoush to go avec pretzel YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290018237007","s":0,"n":"Bacon de dinde YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"073490125126","s":0,"n":"BALSAMIC","c":"cat-condiment","u":"unit","p":1000,"pp":0},{"b":"0077544181557","s":0,"n":"Bamba crème de noisette OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544000308","s":0,"n":"Bamba family pack OSEM x8","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544000797","s":0,"n":"Bamba OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290115721522","s":0,"n":"Barbe à papa acidulée GROSSLINE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290115721461","s":0,"n":"Barbe à papa fraise GROSSLINE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290115721492","s":0,"n":"Barbe à papa myrtille GROSSLINE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000025018","s":0,"n":"Barkan Argaman Merlot rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0087752008157","s":0,"n":"Barkan Ben Ami Cabernet Sauvignon rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0087752016251","s":0,"n":"Barkan Classic Cabernet Sauvignon rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000023977","s":0,"n":"Barkan Classic Merlot rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290000023830","s":0,"n":"Barkan Classic rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290000023960","s":0,"n":"Barkan Classic Shiraz rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000024264","s":0,"n":"Barkan Réserve Merlot rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3299791005609","s":0,"n":"Baron David rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760229761775","s":0,"n":"Baron de Valmy Blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760229761768","s":0,"n":"Baron de Valmy Rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760229761751","s":0,"n":"Baron de Valmy Rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108359114","s":0,"n":"Barquettes aluminium résistantes SANO X10","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"087752005644","s":0,"n":"BARTENURA","c":"cat-alcool","u":"unit","p":1490,"pp":0},{"b":"7290012561085","s":0,"n":"Basilic haché en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290019293507","s":0,"n":"Bâton squeeze glacé aux fruits NESTLÉ","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"R1305","s":117,"n":"Batonnet de Mozarella Garbo x","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7beb5ab0-98f5-46f7-ad86-b84dac018552","s":28,"n":"Bâtonnets Août","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3760371130184","s":0,"n":"Batônnets de poisson pané MELIS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290006895363","s":0,"n":"Bâtonnets de poulet au sésame YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"c1621ac1-6d4e-48d3-b9c9-7c20109d8f1e","s":36,"n":"Bavarois Mini Kabanos","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3760127801009","s":0,"n":"Beaune Aegerter 1er Cru Bourgogne rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290013454003","s":0,"n":"Bedikotes alef-alef adi zach x18","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"2377382c-7578-4af8-9ed9-32f6dab9b6a5","s":185,"n":"Beef Franckfort Juil Filet D'anchois Bocal","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"33339720000586","s":0,"n":"BENELI","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"3760127800606","s":0,"n":"Benjamin de la Tour de By Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290008464109","s":0,"n":"Bière bouteille GOLDSTAR","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290000135014","s":0,"n":"Bière bouteille MACCABEE","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"3029330069225","s":0,"n":"Biscottes JACQUET","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7622210137234","s":0,"n":"Biscuits double crème OREO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7622300772314","s":0,"n":"Biscuits l original individuel OREO x6","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380215843","s":0,"n":"Biscuits passion noisette LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380003723","s":0,"n":"Biscuits patisserie crème noisette LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544003194","s":0,"n":"Bissli bamba mix bbq OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544826120","s":0,"n":"Bissli bbq family pack OSEM x12","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544000933","s":0,"n":"Bissli bbq OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544825123","s":0,"n":"Bissli falafel family pack OSEM x12","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544825000","s":0,"n":"Bissli falafel OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544827004","s":0,"n":"Bissli oignon OSEM","c":"cat-snack","u":"unit","p":350,"pp":0},{"b":"0077544829121","s":0,"n":"Bissli pizza family pack OSEM x12","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544000957","s":0,"n":"Bissli pizza OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544843004","s":0,"n":"Bissli remix OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3215200003431","s":0,"n":"Blanc d oeuf pâtissier COCOTINE","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760059041962","s":0,"n":"BLANC DE DINDE","c":"cat-volaille","u":"unit","p":1000,"pp":0},{"b":"7290002371144","s":0,"n":"Blanc de dinde à la mexicaine YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290002371151","s":0,"n":"Blanc de dinde au miel YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290002371175","s":0,"n":"Blanc de dinde doré au four YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"ACIM-1001","s":0,"n":"BLANC DE POULET","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"7290000367453","s":0,"n":"Blanc de poulet braisé YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290000367484","s":0,"n":"Blanc de poulet fumé YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"10","s":0,"n":"Blanc de Poulet IQF STEIN PV","c":"cat-volaille","u":"kg","p":2000,"pp":0},{"b":"1c5d9d92-2a0b-4dc1-a858-64d5d1378ce7","s":12,"n":"Blanc Vanille Ots Juil","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"2273071000004","s":0,"n":"Blancs de poulet crus iqf YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"2134344008090","s":0,"n":"BLANQUETTE DE VEAU","c":"cat-viande","u":"unit","p":3200,"pp":0},{"b":"3423990000022","s":0,"n":"Blé entier YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000287607","s":0,"n":"Bloc eau bleue toilettes SANO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"0023632082213","s":0,"n":"Blumantti Moscato blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082268","s":0,"n":"Blumantti Moscato rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3770009835381","s":0,"n":"Boeuf à la provencale 7m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"1f2e750c-c814-4b19-8e9b-0e9443732d98","s":3,"n":"Bœuf Août Saucisson Sec Baton Août","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"bfb2336b-d2a3-444e-9f94-1a89cc423259","s":12,"n":"Bœuf Août Surimi Bâtonnets Août","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"3423992200024","s":0,"n":"Boeuf bourguignon YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290017888927","s":0,"n":"Boisson citron menthe TAPUZINA","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290008757164","s":0,"n":"Boisson pamplemousse TAPUZINA","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"5411188130031","s":0,"n":"Boisson protéines végétales ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188110835","s":0,"n":"Boisson végétale amande grillée ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188120742","s":0,"n":"Boisson végétale amande vanille ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188115366","s":0,"n":"Boisson végétale avoine original ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188116592","s":0,"n":"Boisson végétale chocolat noisette ALPRO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"5411188110842","s":0,"n":"Boisson végétale noisette ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188115687","s":0,"n":"Boisson végétale riz ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188116905","s":0,"n":"Boisson végétale soja banane ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188116882","s":0,"n":"Boisson végétale soja macchiato ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188115472","s":0,"n":"Boisson végétale soja original ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5411188115496","s":0,"n":"Boisson végétale soja sans sucre ALPRO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3277711010124","s":0,"n":"BOKHA","c":"cat-autre","u":"unit","p":3900,"pp":0},{"b":"0710069601093","s":0,"n":"Bol nouilles de riz saveur champignon GEFEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0710069601062","s":0,"n":"Bol nouilles de riz saveur poulet GEFEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"0194961003252","s":0,"n":"Bonbons cerises avec sucre CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069304802","s":0,"n":"Bonbons chocolat au lait fondant TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069304819","s":0,"n":"Bonbons chocolat au noir fondant TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069304826","s":0,"n":"Bonbons chocolat praliné fondant TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0194961003221","s":0,"n":"Bonbons coeurs pêche sucrées CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948000154","s":0,"n":"Bonbons cola sucrés CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948000895","s":0,"n":"Bonbons crocodiles CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948000055","s":0,"n":"Bonbons fraises CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290115721225","s":0,"n":"Bonbons gélifiés mini jellies GROSSLINE","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290111354939","s":0,"n":"Bonbons gelifiés oursons pessah YOGUETA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0042238830219","s":0,"n":"Bonbons goldbears HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290111357336","s":0,"n":"Bonbons gommes acidulés abricot YOGUETA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0042238830981","s":0,"n":"Bonbons happy cherry HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0042238832329","s":0,"n":"Bonbons happy cola HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0042238832657","s":0,"n":"Bonbons quaxi frog HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"9002975405768","s":0,"n":"Bonbons rainbow roll MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0194961003085","s":0,"n":"Bonbons réglisse mix CANDY PLANET","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0025675301184","s":0,"n":"Bonbons sour sticks cola PASKESZ","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"5412865024025","s":0,"n":"Bonbons sour sticks fruits des bois mix PASKESZ","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0025675301092","s":0,"n":"Bonbons sour sticks mix PASKESZ","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0025675301108","s":0,"n":"Bonbons sour sticks strawberry PASKESZ","c":"cat-snack","u":"unit","p":400,"pp":0},{"b":"9002975377560","s":0,"n":"Bonbons worms HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0042238837720","s":0,"n":"Bonbons wummis HARIBO","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290000238180","s":0,"n":"Borekas pomme de terre YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000060","s":12,"n":"Borekas Pomme de Terre YARDEN x16","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0706132115703","s":0,"n":"Bougie 24h NER MITZVAH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132115727","s":0,"n":"Bougie 48h NER MITZVAH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030146204","s":0,"n":"Bougie 7 jours","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132115734","s":0,"n":"Bougie 72h NER MITZVAH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132115802","s":0,"n":"Bougie 7j NER MITZVAH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143135","s":0,"n":"Bougie verre 48h","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143203","s":0,"n":"Bougie verre 72h","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143494","s":0,"n":"Bougies chauffe plats","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132280715","s":0,"n":"Bougies chauffe-palt refermables NER MITZVAH x50","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143166","s":0,"n":"Bougies du chabbat x12","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5060076436177","s":0,"n":"Bougies hanouka x44","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544528406","s":0,"n":"Bouillon de boeuf parvé OSEM","c":"cat-laitier","u":"unit","p":1000,"pp":0},{"b":"0077544527102","s":0,"n":"Bouillon de poulet parvé en sachet OSEM","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3277711010148","s":0,"n":"Boukha bokobsa eau de vie de figue","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"d25d424e-344f-4d26-8dff-dec7ccb2e955","s":20,"n":"Boule D'or","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3253880002382","s":0,"n":"Boulettes de boeuf BENELI","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990006949","s":0,"n":"Boulettes de viande YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3433990001172","s":0,"n":"Boulettes de volaille YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760057260037","s":0,"n":"Boulgour gros YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290012561191","s":0,"n":"Bouquet garni italien DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"ACIM-1002","s":0,"n":"BOURGUIGNON DE BOEUF","c":"cat-viande","u":"kg","p":2985,"pp":0},{"b":"3440432024040","s":0,"n":"BOUTARGUE 160G","c":"cat-frais","u":"unit","p":3900,"pp":0},{"b":"3423990002064","s":0,"n":"Boutargue de mulet sans cire YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990000138","s":0,"n":"Boutargue de mulet YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290110115869","s":0,"n":"Bouteille COCA COLA ZERO","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290110115845","s":0,"n":"Bouteille COCA-COLA","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290110115463","s":0,"n":"Bouteille FUZE TEA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770009835442","s":0,"n":"Brandade de saumon 7m YAEL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3770009835459","s":0,"n":"Brandade de saumon 9m YAEL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3324040207418","s":0,"n":"BRIE","c":"cat-laitier","u":"unit","p":700,"pp":0},{"b":"7290006578303","s":0,"n":"Brie aux truffes ISIGNY STE MERE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3254550033262","s":0,"n":"Brie ISIGNY STE MERE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3760066692492","s":0,"n":"Brioche tranchée traditionnelle KORCARZ","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006895301","s":0,"n":"Brochettes de poulet YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290012665042","s":0,"n":"Brocolis panés YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290013927323","s":0,"n":"Brownies chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3448270003173","s":0,"n":"BURGER DE POISSON","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"7290112969156","s":0,"n":"Burgers végétariens TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990006932","s":0,"n":"Burgers YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760059041900","s":254,"n":"CABANOS","c":"cat-frais","u":"unit","p":1000,"pp":0},{"b":"3760059041917","s":0,"n":"Cabanossi Gendarme","c":"cat-frais","u":"unit","p":1100,"pp":0},{"b":"3299791006309","s":6,"n":"Cabernet Sauvignon","c":"cat-epicerie","u":"unit","p":9900,"pp":0},{"b":"7290005855276","s":0,"n":"Cacahuètes grillées enrobé croustillant au sésame YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290005855009","s":0,"n":"Cacahuètes grillées enrobé croustillant YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3592860040809","s":0,"n":"CACAHUETTE APERO","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"0077245107795","s":0,"n":"Café granulé PLATINUM","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"0077245107870","s":0,"n":"Café moulu turc ELITE","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"0077245102530","s":0,"n":"Café soluble","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290010328789","s":0,"n":"Cake à la vanille ACHDUT","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290006775047","s":0,"n":"Cake au chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290006775078","s":0,"n":"Cake au miel ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006775030","s":0,"n":"Cake aux pépites de chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290010328680","s":0,"n":"Cake aux pépites de chocolat blanc et noir ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290006775795","s":0,"n":"Cake aux pommes ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006775085","s":0,"n":"Cake brioche au chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290006775337","s":0,"n":"Cake brioche aux graines de pavot ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990002132","s":0,"n":"Cake chocolat YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290006775054","s":0,"n":"Cake marbré ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290013927156","s":0,"n":"Cake sans sucre aux fruits rouges ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006775764","s":0,"n":"Cake sans sucre aux pépites de chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290013927101","s":0,"n":"Cake sans sucre aux pommes ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006775894","s":0,"n":"Cake sans sucre marbré ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3254550033279","s":0,"n":"Camembert ISIGNY STE MERE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3250550015567","s":16,"n":"CAMEMBERT Royal","c":"cat-laitier","u":"unit","p":800,"pp":0},{"b":"7290011017873","s":0,"n":"Canette COCA-COLA ZERO","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290001247723","s":0,"n":"Canette fraise banane SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247730","s":0,"n":"Canette mangue SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3592860018105","s":0,"n":"CAPRES 260G","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3423990000367","s":0,"n":"Capres YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"73705e1f-5711-468b-9d20-101d0f88bfe0","s":12,"n":"Carmel Harissa Juil Creme Dessert Vanille Ots Juil","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"3423990000404","s":0,"n":"Carottes à la marocaine YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990000107","s":0,"n":"Carreaux de pâte feuilletée YARDEN x20","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290006948229","s":0,"n":"CASTEL","c":"cat-boisson","u":"unit","p":12000,"pp":0},{"b":"3423990002088","s":0,"n":"Caviar d aubergine YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"8004996200033","s":0,"n":"CEPPES","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"3760034626597","s":0,"n":"Cernaux de noix claires YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3700604200635","s":0,"n":"Chakchouka AMILCAR","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3299791008716","s":0,"n":"Champagne Charles de Ponthieu 1er Cru","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"087752013472","s":0,"n":"CHAMPAGNE DRAPPIER","c":"cat-alcool","u":"unit","p":7900,"pp":0},{"b":"087752026366","s":0,"n":"CHAMPAGNE DRAPPIER ROSE","c":"cat-alcool","u":"unit","p":8900,"pp":0},{"b":"3760127801481","s":0,"n":"Champagne Jeeper Grand Réserve Blanc de blancs","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801498","s":0,"n":"Champagne Jeeper Grand Rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"084878169007","s":0,"n":"CHAMPAGNE LAURENT PERRIER","c":"cat-alcool","u":"unit","p":9900,"pp":0},{"b":"087752024652","s":0,"n":"CHAMPAGNE ROSE ROTHSCHILD","c":"cat-alcool","u":"unit","p":13900,"pp":0},{"b":"8711285141211","s":12,"n":"Champignons émincés","c":"cat-surgele","u":"unit","p":20,"pp":0},{"b":"6922841258942","s":0,"n":"Champignons shitake deshydratés","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"087752032312","s":0,"n":"CHANTEBISE","c":"cat-boisson","u":"unit","p":3000,"pp":0},{"b":"3423993800032","s":0,"n":"Chapelure fine en boite YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423993700035","s":0,"n":"Chapelure premium vrac YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000695","s":0,"n":"Chapelure sésame vrac YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000688","s":0,"n":"Chapelure vrac YARDEN","c":"cat-epicerie","u":"unit","p":600,"pp":0},{"b":"5060414910031","s":0,"n":"Charcuterie il campagnolo GUSTOFINO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"087752040386","s":0,"n":"CHATEAU ARNAUD","c":"cat-alcool","u":"unit","p":1790,"pp":0},{"b":"087752040409","s":0,"n":"CHATEAU ARNAUD MALBEC","c":"cat-alcool","u":"unit","p":1790,"pp":0},{"b":"3299791004053","s":0,"n":"Château Bel Air rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"087752040416","s":0,"n":"CHATEAU DES ARNAUDS VIN","c":"cat-alcool","u":"unit","p":1790,"pp":0},{"b":"0023632082688","s":0,"n":"Château Haut Philippon Bordeaux blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0791163371648","s":0,"n":"Château Haut Philippon Bordeaux moelleux blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0023632082671","s":0,"n":"Château Haut Philippon Bordeaux rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0023632082336","s":0,"n":"Château Haut Philippon Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0023632082497","s":0,"n":"Château Les Tuileries Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"087752033326","s":0,"n":"Chateau neuf du Pape","c":"cat-alcool","u":"unit","p":5900,"pp":0},{"b":"087752034576","s":0,"n":"CHATEAU ROUBINE","c":"cat-alcool","u":"unit","p":6900,"pp":0},{"b":"087752035023","s":0,"n":"CHATEAU ROYAUMONT","c":"cat-alcool","u":"unit","p":4900,"pp":0},{"b":"3760127801054","s":0,"n":"Château Tour du Barail Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800187","s":0,"n":"Château Tour du Bosquay Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"5034795005259","s":0,"n":"Cheddar vegan mature tranches SHEESE","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290019167105","s":0,"n":"Cheesecake vegan EDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290001817728","s":0,"n":"Cheetos kafa ELITE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"d423a39d-bb41-4af0-bd7c-d26b28786688","s":14,"n":"Chèque 27/05/26","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"087752034750","s":0,"n":"CHEVALIER DE LACOMBES","c":"cat-alcool","u":"unit","p":8900,"pp":0},{"b":"8413376034258","s":0,"n":"CHEVRE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"0000080790990","s":0,"n":"Chewing gum curve bubble fresh MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080773443","s":0,"n":"Chewing gum curve menthe verte MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080773429","s":0,"n":"Chewing gum curve strawberry MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8935001729228","s":0,"n":"Chewing gum fraise acidulé MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8935001729259","s":0,"n":"Chewing gum pomme acidulé MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8935001728047","s":0,"n":"Chewing gum vitaminé fruits rouges MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080913467","s":0,"n":"Chewing gum vitaminé orange MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8003440926079","s":0,"n":"Chewing gum white sans sucre menthe douce MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"9937401729128","s":0,"n":"Chewing gum white sans sucre menthe poivrée MENTOS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760059041986","s":0,"n":"CHIFFONADE DE DINDE","c":"cat-frais","u":"unit","p":1000,"pp":0},{"b":"7290003289530","s":0,"n":"Chiffonnade de blanc de poulet fumé YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290002371137","s":0,"n":"Chiffonnade de dinde au miel YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290003289547","s":0,"n":"Chiffonnade de dinde braisée YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290000367408","s":0,"n":"Chiffonnade de dinde dorée au four YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290000367781","s":0,"n":"Chiffonnade de salami de dinde fumée YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3339720000593","s":0,"n":"Chiffonnade pur boeuf BENELI","c":"cat-volaille","u":"unit","p":1200,"pp":0},{"b":"0710069303409","s":0,"n":"Chips à l huile d olive classic TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069303423","s":0,"n":"Chips à l huile d olive ondulées TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760174580100","s":0,"n":"Chips crips familial WORLD FOOD","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760174580056","s":0,"n":"Chips crips multipack WORLD FOOD x6","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069303416","s":0,"n":"Chips huile d olive et au romarin TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948007108","s":0,"n":"Choco Rolls SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0815871012546","s":0,"n":"Chocolat en poudre chocolit pesekzman ELITE","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3423990006192","s":0,"n":"Chorizo de boeuf YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3423991245699","s":0,"n":"Chou-fleur braisé YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3544800001609","s":0,"n":"Choucroute cuisinée au vin blanc en seau WAGNER","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3544800000350","s":0,"n":"Choucroute cuisinée au vin blanc WAGNER","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"5901008000403","s":255,"n":"Choucroute YARDEN","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"0731559136437","s":12,"n":"Choux fleurs vérifiés","c":"cat-surgele","u":"unit","p":22,"pp":0},{"b":"3423990006871","s":0,"n":"Choux rouge mayonnaise YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290012665011","s":0,"n":"Choux-fleurs panés YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0706132058222","s":0,"n":"Ciseaux de cuisine bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132058215","s":0,"n":"Ciseaux de cuisine halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132058239","s":0,"n":"Ciseaux de cuisine pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990006598","s":0,"n":"Citronnade YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000282","s":0,"n":"Citrons confits en rondelles YARDEN","c":"cat-epicerie","u":"unit","p":800,"pp":0},{"b":"3423990007304","s":0,"n":"Citrons confits frais YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990000381","s":0,"n":"Citrons confits YARDEN","c":"cat-snack","u":"unit","p":800,"pp":0},{"b":"3760127800910","s":0,"n":"Clos des Lunes Lune d Argent Bordeaux blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801412","s":0,"n":"Clos la Gaffelière St Émilion Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"087752036839","s":0,"n":"CLOS TRIGUEDINA","c":"cat-alcool","u":"unit","p":4900,"pp":0},{"b":"3423990000268","s":0,"n":"Cocktail d olives à l orientales YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"R0408","s":155,"n":"Coeur de dos de Colin PROMO X","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"3423990000602","s":0,"n":"Coleslaw YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290106572331","s":0,"n":"Coleslaw YARDEN 250g","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"2323644007708","s":0,"n":"COLLIER DAGNEAU TL","c":"cat-viande","u":"unit","p":3290,"pp":0},{"b":"3542862722111","s":0,"n":"Comté aop JURA FLORE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"0710069312111","s":0,"n":"Concentré de tomates en tube TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"5901008000168","s":0,"n":"Concombres aigres doux","c":"cat-condiment","u":"unit","p":1000,"pp":0},{"b":"3423990000374","s":0,"n":"Concombres au sel","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990007328","s":0,"n":"Concombres au sel YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3592860018051","s":0,"n":"CONFIT DE CORNICHON","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"0710069312708","s":0,"n":"Confiture abricot TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069312739","s":1,"n":"Confiture fraise TUSCANINI","c":"cat-snack","u":"unit","p":200,"pp":0},{"b":"0710069312753","s":0,"n":"Confiture framboises et groseilles rouges TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0710069312760","s":0,"n":"Confiture tomates TUSCANINI pessah","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948002271","s":0,"n":"Cookies chocolat SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948002257","s":0,"n":"Cookies nougatine SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"1b0cc372-fd25-40dc-aea0-b017e5954bd1","s":31,"n":"Coriandre Août Ravioli Tomate Mozza Arr","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"7290012561078","s":0,"n":"Coriandre hachée en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3102870004533","s":0,"n":"Coriandre moulue ESPIG","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3592860012189","s":0,"n":"CORNICHON RONDELLES","c":"cat-condiment","u":"unit","p":1000,"pp":0},{"b":"3423990002002","s":0,"n":"Cornichons aigres doux en quartiers","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000787","s":0,"n":"Cornichons aigres doux en tranches","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760013723231","s":0,"n":"Cornichons extra fins au vinaigre YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760013723224","s":0,"n":"Cornichons fins au vinaigre","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990002019","s":0,"n":"Cornichons pimentés","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"MIGR-1785882429013-17","s":0,"n":"COTE DE BOEUF  BABYLON","c":"cat-viande","u":"unit","p":4690,"pp":0},{"b":"0000080042563","s":1,"n":"Coulis de tomates passata MUTTI","c":"cat-epicerie","u":"unit","p":400,"pp":0},{"b":"COUL3324040112507","s":0,"n":"COULOMMIER","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"3770009835572","s":0,"n":"Couscous de légumes 9m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544155909","s":0,"n":"Couscous et légumes instantanés OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"6111094000228","s":0,"n":"Couscous fin DARI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3223920710133","s":0,"n":"Couscous fin FERRERO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"6111094000013","s":0,"n":"Couscous moyen DARI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3223920700127","s":0,"n":"Couscous moyen FERRERO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132042023","s":0,"n":"Couteau à lame lisse bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132042016","s":0,"n":"Couteau à lame lisse halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132042030","s":0,"n":"Couteau à lame lisse pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132041125","s":0,"n":"Couteau à légumes bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132041118","s":0,"n":"Couteau à légumes halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132041132","s":0,"n":"Couteau à légumes pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"077544004320","s":0,"n":"CRACKER FITNESS","c":"cat-snack","u":"unit","p":600,"pp":0},{"b":"0077544000919","s":0,"n":"Crackers campagne multigrains OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544131002","s":0,"n":"Crackers cream OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8710536000031","s":0,"n":"Crackers mini HOLLANDIA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544132009","s":0,"n":"Crackers sesame OSEM","c":"cat-snack","u":"unit","p":600,"pp":0},{"b":"0077544134003","s":0,"n":"Crackers son OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8024698131565","s":0,"n":"Crème au vinaigre balsamique CARLO MAGNO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3770009835596","s":0,"n":"Crème de butternut chataigne 7m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5411188120957","s":0,"n":"Crème de coco cuisine ALPRO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3423990007359","s":0,"n":"Crème de foie de volaille au poivre vert YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"5414149250212","s":0,"n":"Crème de foie de volaille YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5411188115410","s":0,"n":"Crème de soja cuisine ALPRO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"76a2c085-0c92-415e-adeb-0cb82dec85f0","s":50,"n":"Creme Fr Cuisine *stg Oct Edam Sept","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"3250550005223","s":12,"n":"Cremeux Rouge","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"7290002618256","s":0,"n":"CREVETTES 700G","c":"cat-surgele","u":"unit","p":2000,"pp":0},{"b":"7290006895240","s":0,"n":"Croustines de poulet YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990000664","s":0,"n":"Croûtons pour salade en boite YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544297807","s":0,"n":"Croutons soupe minis en flacon OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544297401","s":0,"n":"Croutons soupe minis en sachet OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132031317","s":0,"n":"Cuillère à glace halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132031331","s":0,"n":"Cuillère à glace pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057522","s":0,"n":"Cuillère en bois bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057515","s":0,"n":"Cuillère en bois halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057539","s":0,"n":"Cuillère en bois pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132059021","s":0,"n":"Cuillère en silicone bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132059014","s":0,"n":"Cuillère en silicone halvi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132059038","s":0,"n":"Cuillère en silicone pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"OFF004/I","s":0,"n":"CUISSE DE POULET IQF","c":"cat-volaille","u":"kg","p":5000,"pp":0},{"b":"2938626011040","s":0,"n":"CUISSE ENTIERE DE POULET","c":"cat-volaille","u":"kg","p":1432,"pp":0},{"b":"2273074000001","s":0,"n":"Cuisses de poulet crues iqf YARDEN x8","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"R0187","s":30,"n":"Cuisses de poulet IQF STEIN PV","c":"cat-volaille","u":"kg","p":0,"pp":0},{"b":"5aad160b-b432-42bf-ad60-9cf42fef5b2d","s":12,"n":"Cuites Août Crem Nature Ots","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3102870005226","s":0,"n":"Cumin ESPIG","c":"cat-epicerie","u":"unit","p":400,"pp":0},{"b":"3423990001098","s":0,"n":"Cumin oriental TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290012561184","s":0,"n":"Curcuma haché en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3102870005417","s":0,"n":"Curcuma moulu ESPIG","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000893","s":0,"n":"Curcuma moulu TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290004494100","s":0,"n":"Dalton Canaan rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290014503687","s":0,"n":"Dalton fumé blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290016607406","s":0,"n":"Dalton Réserve Cabernet Sauvignon rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290016607345","s":0,"n":"Dalton Réserve Shiraz rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290004494384","s":0,"n":"Dalton rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3423990045979","s":0,"n":"Dattes medjoul YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"2159200008342","s":0,"n":"DE BOEUF BR","c":"cat-surgele","u":"unit","p":3590,"pp":0},{"b":"3448270005245","s":0,"n":"DE DINDE BBQ","c":"cat-surgele","u":"unit","p":2500,"pp":0},{"b":"3448270001445","s":0,"n":"DE DINDE NATURE","c":"cat-surgele","u":"unit","p":2500,"pp":0},{"b":"3448270005238","s":0,"n":"DE DINDE PROVENCAL","c":"cat-surgele","u":"unit","p":2500,"pp":0},{"b":"3448270003241","s":0,"n":"DE DINDE SHAWARMA","c":"cat-surgele","u":"unit","p":2500,"pp":0},{"b":"ACIM-1003","s":0,"n":"DE PRINTEMPS","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"3423990006789","s":0,"n":"Délice de courgettes facon caviar YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290002862376","s":0,"n":"Délice de tomates séchées à tartiner YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"30a9040e-f527-4397-b7a6-ba5c8b053f32","s":23,"n":"Des Sources Août Fouetté Chevre Oct","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"7290102990931","s":0,"n":"Détachant SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770021861207","s":0,"n":"DINAUSAURES NUGGETS","c":"cat-surgele","u":"unit","p":1700,"pp":0},{"b":"90549285-cfb1-433a-90fe-708902638859","s":10,"n":"Dinde Août Saumon Mariné Fines Herbes Arr","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"689fb6a0-3d10-4ce4-8d36-e9ac0e4cdb38","s":3,"n":"Dinde Fumé Août Chorizo Skin","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"64ad051a-ca41-44fe-a4cc-82b58a622c64","s":3,"n":"Dinde Fumé Poivre Août Sauc Sec Skin Août","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"de931e16-f5db-484b-ad3d-d08298e9926a","s":10,"n":"Dinde Fumée Août Saumon Norvege Arr","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"7290018236369","s":0,"n":"Dinde fumée spéciale baguette YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990000961","s":0,"n":"Dinde fumée YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"5b3ee406-8057-4197-8fab-9cf89dc792d5","s":4,"n":"Dinde Glacée Miel Pickel's Août","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"ed245d6e-8879-439d-ae1a-c49146b19f02","s":4,"n":"Dinde Paprika Saucisse Knaks Veau Août","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"6e4b018d-2f6f-4aa0-a102-6054ee6169f3","s":10,"n":"Dinde Poivre Août Saumon Norvege Arr","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"0868fa85-8b36-4ea3-88f6-c486bc8f8058","s":10,"n":"Dinde Rotie Août Saumon Norvege Août","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"R0225","s":210,"n":"Dinosaures Dinde Panés Of Tov x","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423990002149","s":0,"n":"Doigts nature YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801160","s":0,"n":"Domaine de Chevalier Pessac Léognan Bordeaux blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801177","s":0,"n":"Domaine de Chevalier Pessac Léognan Bordeaux blanc XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801122","s":0,"n":"Domaine de Chevalier Pessac Léognan Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801139","s":0,"n":"Domaine de Chevalier Pessac Léognan Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3178530412703","s":0,"n":"Donuts marbrés chocolat ST MICHEL x6","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3178530417418","s":0,"n":"Donuts pépites de chocolat ST MICHEL x6","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290010117864","s":0,"n":"Doritos hot fire ELITE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290106528628","s":0,"n":"Doritos nature ELITE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0815871013840","s":0,"n":"Doritos smoky bbq ELITE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0815871013833","s":0,"n":"Doritos spicy sour ELITE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290110568559","s":0,"n":"Doritos spicy sour multipack ELITE x10","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8005110200007","s":0,"n":"Double concentré de tomates MUTTI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3228021080147","s":0,"n":"EDAM  250","c":"cat-laitier","u":"unit","p":1000,"pp":0},{"b":"3662444001462","s":0,"n":"Edam tranches LIEL","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5034795002197","s":0,"n":"Edam vegan bloc SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"087752035337","s":0,"n":"EDMOND ROTHSCHILD","c":"cat-alcool","u":"unit","p":3590,"pp":0},{"b":"3760127801450","s":0,"n":"Edmus St Émilion Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3299791003612","s":0,"n":"Elysée Palace Cabernet Sauvignon rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3299791003537","s":0,"n":"Elysée Palace Gris de Gris rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3060921349838","s":24,"n":"EMMENTAL Ermitage Portion","c":"cat-laitier","u":"unit","p":700,"pp":0},{"b":"3250551352005","s":64,"n":"EMMENTAL Ermitage Râpé","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3662444001486","s":0,"n":"Emmental rapé LIEL","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3662444001448","s":0,"n":"Emmental tranches LIEL","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"0706132051506","s":0,"n":"Emporte-pieces alphabet hebreux KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030146068","s":0,"n":"Endamamés fèves de soja MELIS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"ACIM-1000","s":0,"n":"ENTRECOTE","c":"cat-viande","u":"kg","p":3890,"pp":0},{"b":"BKR/S018","s":116,"n":"ENTRECOTE SECONDE SK SURGE","c":"cat-viande","u":"unit","p":0,"pp":0},{"b":"fdcabd1c-d204-4441-9b86-0625edcdd6d9","s":0,"n":"ENTRECOTE TAL","c":"cat-viande","u":"kg","p":2967,"pp":0},{"b":"3f6b8344-cc7a-4fb7-af14-e75335c25598","s":24,"n":"Epaisse Brik Blue Oct","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"ad062efe-22d5-4860-b94f-864eade56a36","s":2,"n":"Epaisse Seau Août Masdamer Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"12159270013673","s":0,"n":"EPAULE AGNEAU ROTI","c":"cat-viande","u":"kg","p":4290,"pp":0},{"b":"2147147018029","s":0,"n":"EPAULE DAGNEAU OS BR","c":"cat-viande","u":"unit","p":1490,"pp":0},{"b":"3090291123912","s":32,"n":"Epi Tranche","c":"cat-autre","u":"unit","p":700,"pp":0},{"b":"3102870056648","s":0,"n":"EPICE","c":"cat-condiment","u":"unit","p":400,"pp":0},{"b":"ae9f3166-d448-4d44-a12c-8cf904a14ae1","s":12,"n":"Épicées","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"5411963929539","s":12,"n":"Épinards hachés","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0706132058826","s":0,"n":"Éplucheur bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132058819","s":0,"n":"Éplucheur halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132058833","s":0,"n":"Éplucheur pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000286334","s":0,"n":"Éponges carrées tout usage SANO X3","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132020625","s":0,"n":"Éponges chabbatique bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132020618","s":0,"n":"Éponges chabbatique halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108359060","s":0,"n":"Éponges de chabbat SANO x4","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102991570","s":0,"n":"Éponges magiques SANO x2","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"1dc61922-d524-4a56-b3b6-d69a01c91fbb","s":30,"n":"Ermitage Août Sainte Maure Août","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"0a9184f3-985b-4166-aa32-14f13343cc90","s":40,"n":"Ermitage Portion","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"890b4d23-f58c-4555-a153-6a4d006177c5","s":120,"n":"Ermitage Râpé","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7290112969262","s":0,"n":"Escalope panée végétarienne TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290112969309","s":0,"n":"Escalope schnintzel mais végétarienne TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290006895219","s":0,"n":"Escalopes de poulet entières panées YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290006895417","s":0,"n":"Escalopes de poulet milanaises extra fines YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3760371130030","s":600,"n":"Escalopes de poulet panées MELIS","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290006895202","s":0,"n":"Escalopes de poulet reconstitué YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290006895233","s":0,"n":"Escalopes panées de dinde entière YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0706132054163","s":0,"n":"Étiquettes halavi bassari pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030144590","s":0,"n":"Facon crevettes loubavitch","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"8850524410074","s":0,"n":"Facon crevettes pannées","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"R0702","s":240,"n":"Façons Crevette Nature","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"3423990002057","s":0,"n":"Falafel épicé YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290012665103","s":0,"n":"Falafel fouré tehina YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990002033","s":0,"n":"Falafel nature YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3296740000630","s":0,"n":"Falafel surgeles YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"5903096000525","s":0,"n":"Fécule de pomme de terre MELIS","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3262240905003","s":0,"n":"Ferfels petites pâtes aux oeufs ROSINSKI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"6910191800287","s":0,"n":"Feuilles d algues x10","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990007083","s":0,"n":"Feuilles de brick","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990014180","s":0,"n":"Feuilles de brick YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3435630210012","s":0,"n":"Feuilles de filo JR","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"6936745600783","s":0,"n":"Feuilles de riz 16cm","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8934878081811","s":0,"n":"Feuilles de riz 22cm","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760371130658","s":0,"n":"Feuilles de vigne farcies au riz YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3448270004644","s":0,"n":"FEVE","c":"cat-surgele","u":"unit","p":600,"pp":0},{"b":"3760034628508","s":0,"n":"Fèves grillées salées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"R0553","s":216,"n":"Fèves sans peau Talia eu","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"R0402","s":154,"n":"Filet de cabillaud PROMO ,","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"33448270003166","s":0,"n":"FILET DE COLIN","c":"cat-surgele","u":"unit","p":1200,"pp":0},{"b":"3592860083509","s":0,"n":"FILET DE DINDE","c":"cat-volaille","u":"unit","p":1500,"pp":0},{"b":"2938621012127","s":0,"n":"FILET DE POULET","c":"cat-volaille","u":"kg","p":2815,"pp":0},{"b":"3760030143333","s":0,"n":"Filets d anchois à l huile en verrine","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990007427","s":0,"n":"Filets de perche du nil MELIS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290006895400","s":0,"n":"Filets de poulet au sesame YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"2273073000002","s":0,"n":"Filets de poulet crus iqf YARDEN x10","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3296740002474","s":0,"n":"Filets de poulet grillés YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"2938621012042","s":0,"n":"Filets de poulet KOSHER MEAT 4U","c":"cat-volaille","u":"unit","p":2500,"pp":0},{"b":"6194029101054","s":0,"n":"Filets de thon entier à l huile d olive en bocal EL MANAR","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"6194029101078","s":0,"n":"Filets de thon entiers à l huile d olive EL MANAR","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3272320012705","s":0,"n":"FIN FOU","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"3760030145993","s":0,"n":"Foie de morue fumé MELIS","c":"cat-epicerie","u":"unit","p":400,"pp":0},{"b":"R0556","s":144,"n":"Fond d'Arichauts POTAGER PROMO","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3432920023031","s":0,"n":"Fond de sauce blond","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3432920028067","s":0,"n":"Fond de sauce brun","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"35f6abea-e56f-4d13-94af-9fcb565a4000","s":25,"n":"Fondue Sept Pyramide Chèvre Nature Déc","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"7f089552-86f5-4755-a5eb-112e917f2eb1","s":27,"n":"Fou","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"58e7be34-00cf-42e4-b527-903b97fd7bab","s":20,"n":"Fraiche Pot *legall Août Ourmand Sept","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"5410376699404","s":0,"n":"Frites familiales POM STEAK","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5410376830258","s":0,"n":"Frites LUTOSA","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760371130634","s":0,"n":"Frites Pessah MELIS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3448270005542","s":0,"n":"FRITTES","c":"cat-autre","u":"unit","p":350,"pp":0},{"b":"5034795000216","s":0,"n":"Fromage vegan creamy ail et fines herbes à tartiner SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5034795000209","s":0,"n":"Fromage vegan creamy original à tartiner SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5034795005174","s":0,"n":"Fromage vegan greek style bloc SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"b930838e-9a45-48ff-a91e-e297eff7f058","s":10,"n":"Fumé Premium Long Slice","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7290010173037","s":0,"n":"Galil rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290013927996","s":0,"n":"Gâteau tressé au chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380205523","s":0,"n":"Gaufrettes beurre de cacahuètes classic LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380007264","s":0,"n":"Gaufrettes cremkakao classic LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290019939757","s":0,"n":"Gaufrettes croquantes chocolat CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290019939733","s":0,"n":"Gaufrettes croquantes noisettes CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380201600","s":0,"n":"Gaufrettes extra fine napolitaner LOACKERS","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8000380007219","s":0,"n":"Gaufrettes napolitaner classic LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456069","s":0,"n":"Gaufrettes nutchella enrobées CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456083","s":0,"n":"Gaufrettes pralinées enrobées chocolat noisettes CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080879190","s":0,"n":"Gaufrettes quadratini cremkakao LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080885559","s":0,"n":"Gaufrettes quadratini napolitaner LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380005949","s":0,"n":"Gaufrettes quadratini vanille LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8000380007240","s":0,"n":"Gaufrettes vanille classic LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0641061738459","s":0,"n":"Gavioli Moscato blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0641061738428","s":0,"n":"Gavioli Moscato rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290102992218","s":0,"n":"Gel lessive bébé MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102993192","s":0,"n":"Gel lessive fleur bleue MAXIMA SANO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290108356915","s":0,"n":"Gel lessive ultra concentré fleur bleue MAXIMA SANO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290102993277","s":0,"n":"Gel nettoyant tout usage SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8e125ab6-8a8c-4b52-8c21-c4e88acf28d7","s":12,"n":"Gendarme Saumon Royal Premuim Août","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"3760127801047","s":0,"n":"Gevrey Chambertin Aegerter 1er Cru Bourgogne rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127800620","s":0,"n":"Gewurztraminer Gustave Lorentz Grand Cru d Alsace blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290012561092","s":0,"n":"Gingembre broyé en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290015603584","s":0,"n":"Gingembre mariné","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001780800","s":0,"n":"Glace chocolat au lait cœur nougat CRUNCH","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290109355504","s":0,"n":"Glace chocolat blanc cœur nougat CRUNCH","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7613036576734","s":0,"n":"Glaces minies aux fruits NESTLE","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290004872250","s":0,"n":"Glaces pastèque NESTLÉ","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3700022306452","s":0,"n":"Gobelets en carton x50","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030146310","s":0,"n":"Gombos IDEAL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3662444001424","s":0,"n":"Gouda tranches LIEL","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"d4cbe0c6-eb7e-4b05-8fa3-a6741ed64202","s":12,"n":"Gourmet Juil Flan Nappé Caramel Ots Juil","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7290005855382","s":0,"n":"Graines de tournesol YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8003518101469","s":0,"n":"GRANA","c":"cat-autre","u":"unit","p":700,"pp":0},{"b":"0706132043020","s":0,"n":"Grand couteau à lame lisse bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132043013","s":0,"n":"Grand couteau à lame lisse halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132043037","s":0,"n":"Grand couteau à lame lisse pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132043228","s":0,"n":"Grand couteau dentelé bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132043211","s":0,"n":"Grand couteau dentelé halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132043235","s":0,"n":"Grand couteau dentelé pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082329","s":0,"n":"Grand Pontey Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0838948008198","s":0,"n":"Granino chocolat au lait SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0838948008181","s":0,"n":"Granino chocolat noir SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"79dd8e6c-a189-4061-af8d-7184220200d0","s":5,"n":"Grd Fermage Août Mozza Cosette Zuger Sept","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"5414149250205","s":0,"n":"Grillons de volaille YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000039","s":0,"n":"Gruau de blé YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290004915018","s":0,"n":"Guacamole crème d avocats YARDEN","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"1f659b7e-474f-4c69-bc8d-f224b8b65486","s":8,"n":"Guacamole Eden","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"7290112969385","s":0,"n":"Haché végétarien TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000053","s":0,"n":"Hallots YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"0721983100029","s":0,"n":"Halva dégustation 3 parfums ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290010328970","s":0,"n":"Halva gourmet amandes et miel ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290013927620","s":0,"n":"Halva gourmet marbré ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290010328468","s":0,"n":"Halva minis dégustation 3 parfums ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290010328505","s":0,"n":"Halva minis dégustation sans sucre ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0814968021102","s":0,"n":"Halva pâte à tartiner ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000572529","s":0,"n":"Halva pistaches ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000572628","s":0,"n":"Halva sans sucre ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000572536","s":0,"n":"Halva vanille ACHVA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3440430020006","s":255,"n":"HARGENG","c":"cat-autre","u":"unit","p":500,"pp":0},{"b":"042238830721","s":0,"n":"HARIBO PECHE","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3276650021031","s":0,"n":"Haricots blancs lingots LEGUMOR","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000183","s":0,"n":"Haricots blancs YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"03083681142983","s":10,"n":"Haricots verts extras fins G € 03083681142983","c":"cat-condiment","u":"unit","p":18,"pp":0},{"b":"5411963931037","s":0,"n":"Haricots verts fins","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3083681166200","s":1,"n":"Haricots verts plats coupés Haricots verts plats coupés G G € € 3083681166200 3083681166200","c":"cat-epicerie","u":"unit","p":180,"pp":0},{"b":"66191546003823","s":0,"n":"HARISSA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"6191546003823","s":0,"n":"Harissa seau","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3355040100003","s":0,"n":"Harissa SHIMON ARICHE","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290002862994","s":0,"n":"Harissa tradition YARDEN","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3433990001097","s":0,"n":"Harissa YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"OFF005/I","s":0,"n":"HAUT DE CUISSE DE POULET IQF","c":"cat-volaille","u":"unit","p":5500,"pp":0},{"b":"2489314010352","s":0,"n":"HAUT DE CUISSE POULET","c":"cat-volaille","u":"unit","p":1790,"pp":0},{"b":"2938631014586","s":0,"n":"HAUT DE CUISSES","c":"cat-volaille","u":"kg","p":1432,"pp":0},{"b":"R0186","s":30,"n":"Haut de cuisses IQF STEIN PV","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"3760127800644","s":0,"n":"Hautes Côtes de Nuits Bourgogne rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"2273072000003","s":0,"n":"Hauts de cuisses de poulet crus iqf YARDEN x8","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3102870009156","s":0,"n":"Herbes de provence ESPIG","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"1a6c4989-563b-4146-8e6d-f3a8124c629d","s":5,"n":"Hergo Juil","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3760127800491","s":0,"n":"Héritage Marc Pagès Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"HOUMOUS","s":0,"n":"HOUMOUS","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3423990000626","s":0,"n":"Houmous à la téhina YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290109352404","s":0,"n":"Houmous ail et paprika YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"9426ef18-bb8f-455b-a3c7-e5b3b1a292f4","s":31,"n":"Houmous Août Ravioli Epinard Ricotta Arr","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"3423990006840","s":0,"n":"Houmous classique YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290005307089","s":0,"n":"Houmous extra pignons et huile d olive YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290005307478","s":0,"n":"Houmous light YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990006734","s":0,"n":"Houmous masabacha sauce poivrons verts YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000619","s":0,"n":"Houmous plus sauce piquante YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990006857","s":0,"n":"Houmous prestige zaatar YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423994000035","s":0,"n":"Houmous to go avec pretzel YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423994100032","s":0,"n":"Houmous to go siracha avec pretzel YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290108359091","s":0,"n":"Housse en nylon avec élastique taille L SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108359084","s":0,"n":"Housse en nylon avec élastique taille M SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8018440003583","s":0,"n":"Huile d olive aromatisee a l ail LUGIO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8018440003156","s":0,"n":"Huile d olive aromatisee a la truffe LUGIO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8018440003125","s":0,"n":"Huile d olive pimentee LUGIO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3770027720089","s":0,"n":"Huile d olive vierge cuve prestige TERRA DI NOA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8018440000889","s":0,"n":"Huile d olive vierge extra LUGIO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3770016094375","s":0,"n":"Huile d olive vierge extra TERRA DI NOA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990002156","s":0,"n":"Huile d olive vierge extra YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990007335","s":0,"n":"Huile de tournesol YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"99d55a33-6d37-4095-86a1-2d14de23b675","s":17,"n":"I Tortillas Oignons Oct","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"R0185","s":21,"n":"iguillettes IQF STEIN PV","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"112470fb-7724-4a6b-a711-60b935e7febf","s":24,"n":"J R Avril Pâte Pizza","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"7290000367545","s":0,"n":"Jambon de dinde doré au four YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3770009835374","s":0,"n":"Jardinière de légumes 7m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3215200004568","s":0,"n":"Jaune d oeuf sucré COCOTINE","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"9eea8cb1-ba33-420b-9abd-e091f125fb77","s":12,"n":"Juil Café Latté Cappucino Déc","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"3423992300021","s":0,"n":"Jus de raisin blanc YARDEN","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"3423990020037","s":0,"n":"Jus de raisin YARDEN","c":"cat-epicerie","u":"unit","p":700,"pp":0},{"b":"2422607032273","s":0,"n":"KASLER DE DINDE","c":"cat-volaille","u":"unit","p":1000,"pp":0},{"b":"7290019403357","s":0,"n":"KATZRIN VIN","c":"cat-alcool","u":"unit","p":21900,"pp":0},{"b":"5414149251080","s":0,"n":"Kebab de boeuf YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290012665127","s":0,"n":"Kebbeh au soja YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0077544159617","s":0,"n":"Ketchup OSEM","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"22422607036011","s":0,"n":"KOSSLER","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"7290005875434","s":0,"n":"Krekalech crackers de pomme de terre au sel","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760127800699","s":0,"n":"L Esprit de Chevalier Péssac Léognan Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"5060414910079","s":0,"n":"La bresaola tranches GUSTOFINO","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760127801382","s":0,"n":"La Gaffelière St Émilion Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"087752033944","s":0,"n":"LA MAISON BLEU CABERNET SAUVIGNON","c":"cat-laitier","u":"unit","p":1490,"pp":0},{"b":"5060414910109","s":0,"n":"La rosetta saucisson sec tranches GUSTOFINO","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3760127800514","s":0,"n":"La Tour de By Cabernet Sauvignon Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800477","s":0,"n":"La Tour de By Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800484","s":0,"n":"La Tour de By Médoc Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800378","s":0,"n":"Labegorce Margaux Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800385","s":0,"n":"Labegorce Margaux Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800330","s":0,"n":"Lafon Rochet Saint Estephe Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800934","s":0,"n":"Lafon Rochet Saint Estephe Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290015603522","s":0,"n":"Lait de noix de coco","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5450168511576","s":0,"n":"Lait demi écrémé brique LUXLAIT","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3423990001265","s":0,"n":"Lamelles de poivrons rouges grillés YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0077544001299","s":0,"n":"Langues d oiseaux orzo OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127800408","s":0,"n":"Larrivaux Haut-Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0791163371525","s":0,"n":"Le Baron Réserve rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082206","s":0,"n":"Le Baron rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0791163371723","s":0,"n":"Le Baron Sélicate rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0791163371594","s":0,"n":"Le Baron Sélicate rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000190","s":0,"n":"Lentilles cuisinées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"087752036716","s":0,"n":"LES ROCHES YON","c":"cat-boisson","u":"unit","p":4900,"pp":0},{"b":"3516662010013","s":0,"n":"Levure de boulangerie HIRONDELLE","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760127801061","s":0,"n":"Leydet Valentin St Émilion Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290013269751","s":0,"n":"Lingettes nettoyantes sol boutique hotel SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290107280341","s":0,"n":"Lingettes nettoyantes sol pampering SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102993086","s":0,"n":"Lingettes sol humides et parfumées SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"450ddf3f-938d-4cc4-a3df-da1e27324a50","s":10,"n":"Liquide Oct Ouda Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"06cdb7c7-a9b0-4a4f-94f8-eb76a76c9e18","s":21,"n":"Lomont Mini Buche Chêvre Nature Sept","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"0706132030723","s":0,"n":"Louche bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132030716","s":0,"n":"Louche halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132030730","s":0,"n":"Louche pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000350","s":0,"n":"Lupins YARDEN","c":"cat-epicerie","u":"unit","p":700,"pp":0},{"b":"3259426040856","s":0,"n":"Madeleines coquilles nautres PATISSERIE TRADITION","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3259426039850","s":0,"n":"Madeleines longues natures PATISSERIE TRADITION","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990020129","s":0,"n":"Magret d oie","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"d90e90b3-9641-4093-b4fc-1d2f17857db4","s":40,"n":"Magret d'Oie","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3760030146211","s":0,"n":"Magret de canard séché en tranche","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3760034627594","s":0,"n":"Mais géant salé YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034627587","s":0,"n":"Mais grillé YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000131078","s":0,"n":"MALAWA","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"7290000238036","s":0,"n":"Malawah YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000084","s":0,"n":"Malawah YARDEN x6","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"077544003934","s":0,"n":"MARAKOF","c":"cat-condiment","u":"unit","p":1000,"pp":0},{"b":"7290000453866","s":0,"n":"Margarine à l huile de coco","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290000453897","s":0,"n":"Margarine goût beurre","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5430001167573","s":0,"n":"Margarine pâtisserie rouge goût beurre viennoiserie","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"5411188115557","s":0,"n":"Margarine pâtisserie verte tendre crème et pâtes levées","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290000453880","s":0,"n":"Margarine sans sel","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760127800965","s":0,"n":"Marquis d’Alesme Margaux Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800729","s":0,"n":"Marquis d’Alesme Margaux Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"bd6b2cdc-1fca-4e7a-9fdd-3f22e5e624de","s":16,"n":"Masbaha Juil Petits Suisses Fruits Ots Arr","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423990006765","s":0,"n":"Matboucha YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3177500000407","s":0,"n":"Matsot à l eau LA BIENFAISANTE","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"7290000130101","s":0,"n":"Matsot AVIV","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3226985083006","s":0,"n":"Matsot chemouroth HEUMANN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3226980005003","s":0,"n":"Matsot tradition extra fin HEUMANN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"ceb24222-e149-416e-a147-4175dc28a983","s":12,"n":"Maubert","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"R11208","s":180,"n":"Maxi Tendre Aciop","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3258831038403","s":0,"n":"Mayonnaise MARTIAL PICAT","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3662444004500","s":0,"n":"Mayonnaise squeez YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7610100034084","s":0,"n":"Mayonnaise tube THOMY","c":"cat-epicerie","u":"unit","p":600,"pp":0},{"b":"3423990001180","s":0,"n":"Mayonnaise YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290014874268","s":0,"n":"Meatballs boulettes végétariennes TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760034627563","s":0,"n":"Mélange grillé YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034626566","s":0,"n":"Mélange mendiant YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3700022723112","s":0,"n":"Ménagère couverts YARDEN 3x10","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423991000090","s":0,"n":"Ménagère couverts YARDEN 4x8","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5414149060187","s":0,"n":"Merguez de boeuf cuites YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"8435060301347","s":0,"n":"Miel de fleur squeeze SAN MIGUEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290002703419","s":0,"n":"Miel de fleurs en bocal","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290002703730","s":0,"n":"Miel de fleurs squeeze","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770009835343","s":0,"n":"Mijoté de légumes verts au poulet 7m YAEL","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3228021080154","s":0,"n":"MIMOLLETTE","c":"cat-laitier","u":"unit","p":800,"pp":0},{"b":"3073781199918","s":0,"n":"Mini BABYBEL x5","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290014218956","s":0,"n":"Mini borekas pomme de terre YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000077","s":0,"n":"Mini Borekas Pomme de Terre YARDEN x24","c":"cat-surgele","u":"unit","p":1200,"pp":0},{"b":"0fd2fe53-6d2c-4fa4-ab0c-b4058b3ad34a","s":21,"n":"Mini Buche Chèvre Ail Herbes","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"8722700202325","s":0,"n":"Mini cornichons MAILLE","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"91404100762","s":320,"n":"MIni Hulala ml € 91404100762","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"7290000367330","s":0,"n":"Mini kabanos de dinde fumée YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3178530407938","s":0,"n":"Mini madeleines aux pépites de chocolat ST MICHEL","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3178530402353","s":0,"n":"Mini madeleines ST MICHEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3448270003746","s":0,"n":"MINI PIZZA","c":"cat-autre","u":"unit","p":700,"pp":0},{"b":"91404100779","s":480,"n":"Mini Rockets ml € 91404100779","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"3423990001135","s":0,"n":"Minis croûtons pour soupe en boite YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990007069","s":0,"n":"Minis filets de harengs aux olives YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990007076","s":0,"n":"Minis filets de harengs facon tapas YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990007052","s":0,"n":"Minis filets de harengs YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"0194961001722","s":0,"n":"Minis granino chocolat SHNEIDERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456113","s":0,"n":"Mix balls chocolat CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456120","s":0,"n":"Mix balls chocolat duo CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456137","s":0,"n":"Mix bretzel au chocolat CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456106","s":0,"n":"Mix cornflakes chocolat CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0850047456038","s":0,"n":"Mix étoiles chocolat duo CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3423990020020","s":0,"n":"Mix sésames YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290112969224","s":0,"n":"Morceaux végétariens style boeuf TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"5060199311665","s":0,"n":"Mortadelle de dinde fumée PRIME CUT","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"5060199311641","s":0,"n":"Mortadelle de poulet PRIME CUT","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"e9cbb705-8a2a-4e4e-88b8-009fe39eccaf","s":20,"n":"Mortadelle Volaille","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3770009835411","s":0,"n":"Mouliné de patate douce à la dinde 9m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770009835510","s":0,"n":"Mousseline de panais 4m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290102304844","s":0,"n":"Moutarde à l ancienne MAILLE","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3592860012363","s":0,"n":"MOUTARDE A LANCIENNE","c":"cat-condiment","u":"unit","p":700,"pp":0},{"b":"3760030142725","s":0,"n":"Moutarde de dijon extra forte YARDEN","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3258831013431","s":0,"n":"Moutarde de dijon PICAT","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290102304837","s":0,"n":"Moutarde fine de dijon l originale MAILLE","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"8718114734484","s":0,"n":"Moutarde seau","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760059040842","s":8,"n":"Mozza Boule","c":"cat-laitier","u":"unit","p":400,"pp":0},{"b":"4d5c5e1f-d3f9-4f51-91ae-428c27bf0d61","s":10,"n":"Mozza Cosette","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"46edef89-fecb-47e7-a8b7-399f6c75c8ed","s":8,"n":"Mozza P P Pain Pain","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"8018843007010","s":0,"n":"MOZZARELA STIK","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"7640166790815","s":0,"n":"Mozzarella mini cerises ZUGER","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7640166792512","s":0,"n":"Mozzarella rapée ZUGER","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5034795005587","s":0,"n":"Mozzarella vegan rapée SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5034795003705","s":0,"n":"Mozzarella vegan tranches SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7640101090833","s":0,"n":"Mozzarella ZUGER","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"5411963040432","s":0,"n":"Msoki VERDI","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290006775405","s":0,"n":"Muffins à la vanille ACHVA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290006775306","s":0,"n":"Muffins fourrés à la fraise ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290006775191","s":0,"n":"Muffins fourrés au chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290108352894","s":0,"n":"Nappe XL à motifs SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108353662","s":0,"n":"Nappe XL en tissu SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108352887","s":0,"n":"Nappes en tissu blanches SANO x2","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8978e031-7942-456b-a8f8-69f9b1cdc101","s":3,"n":"Nature Août Tomme Danablu V__","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"54a1ebcc-bb9d-4e0b-b174-dfecb9d4e5c5","s":10,"n":"Nature Oct","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7290001247112","s":0,"n":"Nectar citron menthe brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247068","s":0,"n":"Nectar fraise banane brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290008757980","s":0,"n":"Nectar grenade brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247099","s":0,"n":"Nectar mangue brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247129","s":0,"n":"Nectar orange brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247105","s":0,"n":"Nectar pêche brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290001247143","s":0,"n":"Nectar pomme brick SPRING","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760187680248","s":1,"n":"Nems au poulet YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3296740000678","s":0,"n":"Nems aux légumes YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3760187680217","s":0,"n":"Nems aux légumes YELLO SUSHI","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290013268242","s":0,"n":"Nettoyant pour sol boutique hotel SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760059042013","s":18,"n":"Newyork's Pastrami Boeuf","c":"cat-frais","u":"unit","p":1100,"pp":0},{"b":"3760057260020","s":0,"n":"Nikitouches SHIMON ARICHE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034623800","s":0,"n":"Noisettes grillées YARDEN","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3760034628515","s":0,"n":"Noix de cajou grillées sans sel YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760034627556","s":0,"n":"Noix de cajou salées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034626559","s":0,"n":"Noix de coco rapée","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3102870011791","s":0,"n":"Nora concassée ESPIG","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770027398073","s":1,"n":"Nouilles au poulet YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290015603201","s":0,"n":"Nouilles aux blé complet EAST WEST","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290015603195","s":0,"n":"Nouilles aux épinards EAST WEST","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290015603188","s":0,"n":"Nouilles aux oeufs EAST WEST","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290015603218","s":0,"n":"Nouilles aux tomates EAST WEST","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0308910525058","s":0,"n":"Nouilles de riz","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770021861184","s":0,"n":"NUGGET TAL 500G","c":"cat-surgele","u":"unit","p":1700,"pp":0},{"b":"3760371130016","s":0,"n":"Nuggets de poulet MELIS","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3296740002887","s":600,"n":"Nuggets de poulet YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"R0224","s":210,"n":"Nuggets de volaille Of Tov","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3760127801030","s":0,"n":"Nuits Saint Georges Aegerter 1er Cru Bourgogne rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801023","s":0,"n":"Nuits Saint Georges Aegerter Bourgogne rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"80135876","s":0,"n":"NUTELLA","c":"cat-autre","u":"unit","p":700,"pp":0},{"b":"3215200004544","s":0,"n":"Oeufs entiers COCOTINE","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3332930920002","s":0,"n":"Oeufs moyens plateau x20","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"INV-1785022692802-7502","s":0,"n":"OFF002/I Kilogram FILET DE POULET IQF 0 0 3% 1 € V00","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"7290010548057","s":0,"n":"Oignons confits en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"5411381266292","s":12,"n":"Oignons émincés","c":"cat-surgele","u":"unit","p":23,"pp":0},{"b":"3102870003383","s":0,"n":"Oignons frits BADATZ PASKESZ","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8ed1bbb6-7954-408f-b9b6-a45bd3fc8da6","s":10,"n":"Oignons Oct","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3592860018082","s":0,"n":"OLIVES","c":"cat-condiment","u":"unit","p":700,"pp":0},{"b":"3423990000459","s":0,"n":"Olives andalouses pimentées YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000312","s":0,"n":"Olives cassées pimentées YARDEN","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"3423991000632","s":0,"n":"Olives géantes bella di cerignola YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423991000625","s":0,"n":"Olives géantes nocellara YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000220","s":0,"n":"Olives meski violettes YARDEN","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"3423990001586","s":0,"n":"Olives mixtes YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001654","s":0,"n":"Olives noires à la grecque dénoyautées YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290012899355","s":0,"n":"Olives noires dénoyautées PRI-CHEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000237","s":0,"n":"Olives noires facon grecque YARDEN","c":"cat-condiment","u":"unit","p":900,"pp":0},{"b":"3423990001470","s":0,"n":"Olives vertes à l ail YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000206","s":0,"n":"Olives vertes cassées au citron YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000244","s":0,"n":"Olives vertes dénoyautées bocal YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290002015222","s":0,"n":"Olives vertes dénoyautées boite YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7296107000453","s":0,"n":"Olives vertes en rondelles PRI-CHEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"950a88a1-c63f-426f-9723-e08202673b4a","s":6,"n":"Olives Vertes Juil Iegeois Chocolat Ots Août","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"3423990001593","s":0,"n":"Olives vertes piquantes YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000213","s":0,"n":"Olives vertes YARDEN","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"7290012665530","s":0,"n":"Onion rings YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000046","s":0,"n":"Orge perlé YARDEN","c":"cat-epicerie","u":"unit","p":600,"pp":0},{"b":"ff66c420-09c2-4f75-bf95-3b58ad0a6933","s":6,"n":"Oriental Août Creme Dessert Chocolat Ots","c":"cat-snack","u":"unit","p":0,"pp":0},{"b":"3423990001036","s":0,"n":"Origan TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"83ca1bab-4fd0-4b1a-8b75-1e56d4bc712a","s":0,"n":"p","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"3262240009015","s":0,"n":"Pain azyme gd ROSINSKI","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3262240004508","s":0,"n":"Pain azyme pt ROSINSKI","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3029330067016","s":0,"n":"Pain de mie JACQUET","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3029330069416","s":0,"n":"Pain hot dog max JACQUET x4","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3760081780037","s":0,"n":"PAIN MOZA","c":"cat-boulangerie","u":"unit","p":2500,"pp":0},{"b":"MIGR-1785882429013-19","s":0,"n":"PALERON","c":"cat-autre","u":"unit","p":2990,"pp":0},{"b":"0838948002165","s":0,"n":"Palmiers SHNEIDERS","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290013269850","s":0,"n":"Papier sulfurisé SANO x50","c":"cat-epicerie","u":"unit","p":400,"pp":0},{"b":"3770009835428","s":0,"n":"Papillote de poisson 7m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770009835435","s":0,"n":"Papillote de poisson 9m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000794","s":0,"n":"Paprika doux à l orientale 400g TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001128","s":0,"n":"Paprika doux moulu TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001043","s":0,"n":"Paprika fumé TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"2489289131137","s":0,"n":"PARGUIT DE POULET","c":"cat-volaille","u":"unit","p":2500,"pp":0},{"b":"2291165078067","s":0,"n":"Parguit iqf YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"2938646012140","s":0,"n":"Parguits de poulet KOSHER MEAT 4U","c":"cat-volaille","u":"kg","p":2000,"pp":0},{"b":"3770009835350","s":0,"n":"Parmentier de boeuf 7m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"5034795001374","s":0,"n":"Parmesan vegan hard italian style SHEESE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"33423990006208","s":0,"n":"PASTRAMI","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"5060199311535","s":0,"n":"Pastrami beef PRIME CUT","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3423990006208","s":253,"n":"Pastrami de boeuf au poivre YARDEN","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"3423990006185","s":0,"n":"Pastrami de boeuf YARDEN","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"5060199311566","s":0,"n":"Pastrami de dinde fumée PRIME CUT","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"7290002371168","s":0,"n":"Pastrami de dinde fumée YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"7291000367733","s":0,"n":"Pastrami de dinde poivrée fumée YARDEN","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"5060199311559","s":0,"n":"Pastrami de dinde PRIME CUT","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"7290000453408","s":0,"n":"Pâte à pizza","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"0838948000031","s":0,"n":"Pâte à tartiner delinut SHNEIDERS","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423993300037","s":0,"n":"Pate à tartiner NUTELLA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290003143146","s":0,"n":"Pâte de dattes","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290008304320","s":0,"n":"PATE FEUILLETE JACOB","c":"cat-surgele","u":"unit","p":800,"pp":0},{"b":"7290000453415","s":25,"n":"Pâte feuilletée","c":"cat-viande","u":"unit","p":42,"pp":0},{"b":"7290000238029","s":0,"n":"Pâte feuilletée rouleau YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"R0923","s":324,"n":"Pâte feuilletée x x","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423990000114","s":0,"n":"Pâte feuilletée YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3254550034993","s":0,"n":"Pavé ISIGNY STE MERE","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"d0d6f499-3261-4abe-92d1-6189f55b570f","s":10,"n":"Pepe Nero Sec Tr Thon Morcx Fumé V","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"0850047456144","s":0,"n":"Pépites chocolat noir 60% CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290019644903","s":0,"n":"Pépites de chocolat noir 50% CARMIT","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290012561061","s":0,"n":"Persil haché en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3423990000923","s":0,"n":"Persil TA'AM VAREACH","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990000909","s":0,"n":"Pétales de piment TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0706132041224","s":0,"n":"Petit couteau à lame lisse bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132041217","s":0,"n":"Petit couteau à lame lisse halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132041231","s":0,"n":"Petit couteau à lame lisse pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3178530423655","s":0,"n":"Petites madeleines au caramel ST MICHEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544001251","s":0,"n":"Petits plombs perles de couscous OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3083681143010","s":10,"n":"Petits pois doux \"Garden\" G € 3083681143010","c":"cat-epicerie","u":"unit","p":18,"pp":0},{"b":"5411381375291","s":12,"n":"Petits pois fins","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"6a2f8bbc-4d7b-4edd-94f7-594eaebdf24e","s":12,"n":"Picanti Juil Fromage Blanc Ots Juil","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423990006215","s":0,"n":"Pickel de boeuf YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990000954","s":0,"n":"Pickel de dinde","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423991800027","s":0,"n":"Pickel de veau YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760034628539","s":503,"n":"Pignons","c":"cat-epicerie","u":"unit","p":33,"pp":0},{"b":"2938651010124","s":0,"n":"PILON","c":"cat-volaille","u":"unit","p":1790,"pp":0},{"b":"1260280139","s":3,"n":"PILON DE POULET","c":"cat-volaille","u":"kg","p":1432,"pp":0},{"b":"2273070000005","s":0,"n":"Pilons de poulet crus iqf YARDEN x8","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"R0182","s":57,"n":"Pilons de Poulet IQF STEIN PV","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"3102870013269","s":0,"n":"Piment doux ESPIG","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290014217911","s":0,"n":"Piment doux séchés entier TA'AM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000411","s":0,"n":"Piment rouge fort YARDEN","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"3423990001678","s":0,"n":"Piments cerises YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0706132057621","s":0,"n":"Pinceau en silicone bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034627570","s":0,"n":"Pistaches grillées salées YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760059040149","s":0,"n":"PITA","c":"cat-boulangerie","u":"unit","p":400,"pp":0},{"b":"3760173350179","s":0,"n":"Pita PLUS","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3423990001401","s":0,"n":"Pita surgelé sachet YARDEN","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"3423990000329","s":0,"n":"Pita YARDEN","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"7290002603474","s":0,"n":"PIZZA","c":"cat-autre","u":"unit","p":400,"pp":0},{"b":"0710069301009","s":0,"n":"Pizza 4 fromages TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"R1319","s":162,"n":"Pizza Champignons Truffes","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"0710069301023","s":0,"n":"Pizza champignons TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"R1318","s":162,"n":"Pizza égumes grillés moza -","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"R1320","s":324,"n":"Pizza La FABULEUSE PROMO x","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"0710069301030","s":0,"n":"Pizza légumes grillés TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"R1323","s":135,"n":"Pizza MamaMia par grs","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"0710069301016","s":0,"n":"Pizza margarita TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"R1317","s":162,"n":"Pizza tomate pesto","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3432920017085","s":0,"n":"Pkaila YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132059328","s":0,"n":"Planche à découper bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132059311","s":0,"n":"Planche à découper halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3477320000909","s":0,"n":"PLATA","c":"cat-autre","u":"unit","p":5000,"pp":0},{"b":"3299791003599","s":0,"n":"Plaza Prestige rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3299791003544","s":0,"n":"Plaza Prestige rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082534","s":0,"n":"Plume de Paloumey Haut-Médoc Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3423990000176","s":0,"n":"Pois chiches cuisinés YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"4c662f55-faab-442f-8086-a7a7fddb3f19","s":12,"n":"Pois Chiches Juil Creme Dessert Choco Ots Juil","c":"cat-snack","u":"unit","p":0,"pp":0},{"b":"3276650041732","s":0,"n":"Pois chiches LEGUMOR","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760059041979","s":0,"n":"POITRINE DE DINDE","c":"cat-autre","u":"unit","p":1000,"pp":0},{"b":"7291000367702","s":0,"n":"Poitrine de dinde fumée YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990000879","s":0,"n":"Poivre noir concassé TAAM VAREACH","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990000732","s":0,"n":"Poivre noir moulu","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3102870015430","s":0,"n":"Poivre noir moulu ESPIG","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3592860012806","s":0,"n":"POIVRON ROUGE GRILLE","c":"cat-condiment","u":"unit","p":700,"pp":0},{"b":"3760030143623","s":0,"n":"Poivrons farcis au riz YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290002015666","s":0,"n":"Poivrons forts YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0838948004626","s":0,"n":"Poivrons rouges et jaunes grillées SHNEIDERS","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"5411963952339","s":0,"n":"Poivrons rouges et verts en lamelles","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001203","s":0,"n":"Poivrons rouges et verts grillés entiers YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001210","s":0,"n":"Poivrons rouges grillés entiers YARDEN","c":"cat-condiment","u":"unit","p":700,"pp":0},{"b":"3760030140318","s":0,"n":"Poivrons rouges grillés YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0077544001817","s":0,"n":"Pop corn caramel OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544332409","s":0,"n":"Potage aux légumes OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544529403","s":0,"n":"Potage consommé instantané parvé goût poulet OSEM","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290108357318","s":0,"n":"Poudre détachante pour linge blanc SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801016","s":0,"n":"Pouilly Fuissé Aegerter 1er Cru Saône et Loire blanc","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"2938001018923","s":0,"n":"POULET 4.800 kg","c":"cat-volaille","u":"unit","p":5760,"pp":0},{"b":"2422769028862","s":0,"n":"POULET DE DINDE","c":"cat-volaille","u":"unit","p":1000,"pp":0},{"b":"NU2317820013027","s":0,"n":"POULET ENTIER","c":"cat-volaille","u":"kg","p":1200,"pp":0},{"b":"3423990024196","s":0,"n":"Poulet entier congelé YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"OFF001","s":0,"n":"POULET PAC","c":"cat-volaille","u":"unit","p":1372,"pp":0},{"b":"7290000174723","s":0,"n":"Préparation chocolat instantané chocolit ELITE","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544505100","s":0,"n":"Préparation falafel OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0076937990417","s":0,"n":"Préparation matzah ball OSEM","c":"cat-boulangerie","u":"unit","p":500,"pp":0},{"b":"0077544152403","s":0,"n":"Préparation purée de pommes de terre OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290106720626","s":0,"n":"Présentoir assortiment chips à l huile d olive TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0856424000108","s":0,"n":"Pressels sésame DREAM PRETZELS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0856424000122","s":0,"n":"Pressels tout garni DREAM PRETZELS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544162327","s":0,"n":"Pretzel ronds sésame OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544162549","s":0,"n":"Pretzel sticks salés OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0077544162044","s":0,"n":"Pretzel twists ronds salés OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"3299791004893","s":0,"n":"Prince Georges rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3299791003629","s":0,"n":"Prince Georges rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"biss","s":0,"n":"Produit biss","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3226980000213","s":0,"n":"Ptites galettes froment nature pessah","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544003958","s":0,"n":"Pudding flan chocolat OSEM","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8005110170300","s":0,"n":"Pulpe de tomates MUTTI x3","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"80042556","s":0,"n":"PULPE FINE DE TOMATE","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"8005110171215","s":0,"n":"Pulpe rustica MUTTI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770009835367","s":0,"n":"Purée de courge au poulet 7m YAEL","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3770022226159","s":0,"n":"Purée de courge au poulet 9m YAEL","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3760127801436","s":0,"n":"Puyblanquet St Émilion Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"e56abbaa-2cf6-4942-afeb-565fae946a53","s":25,"n":"Pyramide Chèvre Ail Fherbes Déc","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"8f42a336-4dc6-4a84-893b-7722532b91ed","s":16,"n":"Q Rit Portions","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"0838948004633","s":0,"n":"Quartiers de pdt rôties au romarin SHNEIDERS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"ef1a368e-99cb-4ddd-8378-eebbbab51253","s":13250,"n":"R(0181 Parguit de Poulet IQF STEIN PV :","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"4761658f-88d3-4873-bbb1-509dc4eda127","s":54,"n":"R(0909 Pate feuilletée x x","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"7f420797-2c59-4e7f-8f7f-5b16dcc1a4f6","s":59,"n":"R(1313 Pizza Chefs olives vertes x","c":"cat-condiment","u":"unit","p":0,"pp":0},{"b":"bb4d754f-92a0-4996-bec1-1cc9fb7e4a54","s":54,"n":"R(1316 Pizza tomates cerise oignon -","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"7714eaf5-032f-4e80-9b59-b6d18286a9be","s":7,"n":"R{M Jambon Dinde Fumé Mortadelle Sept","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"db54205d-57c2-435c-8202-c9b1295b8a7f","s":2,"n":"R{M Pastram Poulet Fumé Charcuterie Strasb Buchinger","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"9f16fe3f-9235-4693-a006-62d80bc31a2b","s":20,"n":"R{Mamash Milano Salami","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"48b59686-0285-4cfd-aa97-e6dc55473c86","s":20,"n":"R{Mamash Napoli Salami","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3760059042099","s":14,"n":"R{Mamash Pepe Nero","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"fa489494-ae5a-417c-8061-ea1cf93db1c3","s":20,"n":"R{Mamash Roast Beff Mini","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"8ce31310-c643-4851-be2d-62fbdef270dd","s":12,"n":"R{VAL Saône Brie Pointe","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"2a97b80c-a69e-41fd-8bc3-da3111266f22","s":12,"n":"R{VAL Saône Coulommiers","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"3a9e9200-c381-411b-be5a-ae0313ee4acc","s":8,"n":"R*RAVIOLI Cèpes Truffe Noire","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"8004996200040","s":0,"n":"R*RAVIOLI Tomates Mozzarella","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"38b625cc-f466-4f8f-a4df-d99ad96a74f1","s":24,"n":"R#KD Tr Jambon Veau Pressé","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3423992000020","s":0,"n":"Raifort blanc YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990002125","s":0,"n":"Raifort rouge YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760034626573","s":0,"n":"Raisins secs golden jumbo YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3102870016192","s":0,"n":"Ras el hanout ESPIG","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3a9f8021-4188-42ed-b1c8-fc031e5056ef","s":31,"n":"Ras Hanout Août Ravioli Cépes Truffe Noire* Arr","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"3770009835565","s":0,"n":"Ratatouille aux légumes confits 9m YAEL","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030140295","s":0,"n":"Ravioli à la viande YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760187680231","s":0,"n":"Ravioli au poulet YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"8004618001789","s":0,"n":"Ravioli epinards ricotta Valentini YARDEN","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"0710069301610","s":0,"n":"Ravioli fromage TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"8004618001833","s":0,"n":"Ravioli truffe champignons Valentini YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"9aa5896b-b813-4234-ba52-cf8487c7c89a","s":3,"n":"RBushg.] Dinde Fumée Kassler **pv","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"6d4c9740-695e-45c6-b4d9-85c8f9508dad","s":1,"n":"RBushg.] Poulet Skin Kassler **pv","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"2b85e06a-b1b3-404d-82e2-39d62da59e01","s":2,"n":"RCAMB. Portion X Fermage Août Mozza Cosette *capitano","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"7290008670869","s":0,"n":"Recanati Yonathan Cabernet Sauvignon blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290008670289","s":0,"n":"Recanati Yonathan Cabernet Sauvignon rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290008670852","s":0,"n":"Recanati Yonathan Cabernet Sauvignon rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"7290019512318","s":0,"n":"RECANNATI","c":"cat-boisson","u":"unit","p":2500,"pp":0},{"b":"bedcd82f-47d9-48c9-a550-11919c584a0b","s":19,"n":"REMM. Ermitage Rapé Août Apero's Cubes Brebiac Oct","c":"cat-alcool","u":"unit","p":0,"pp":0},{"b":"3299791004145","s":0,"n":"Résidence Impériale rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"35e5b3ae-a641-43d5-8f39-aae6d3ca5e8a","s":24,"n":"RGRANA° Padano P_portion C Bb","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3760127800569","s":0,"n":"Riesling Gustave Lorentz Grand Cru d’Alsace blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990007366","s":0,"n":"Rillettes d oie YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3770027398080","s":0,"n":"Riz basmati poulet shop swey YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"m","s":0,"n":"Rj0180 Blanc de Poulet IQF STEIN PV","c":"cat-volaille","u":"unit","p":0,"pp":0},{"b":"17afbf5a-5742-4271-a1e6-8183b4fddcd0","s":38,"n":"Rjp910 Malouah Pâte Yéménite Ariel","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3456776721040","s":4,"n":"RLiegeois Choco","c":"cat-snack","u":"unit","p":700,"pp":0},{"b":"39bff357-5403-499f-b3f5-dd5894a62d85","s":12,"n":"RMini Kabanos Bavarois Nov Saumon Royal \"premuim Août","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"a97c582d-944a-4385-af86-eed08dc18f2a","s":10,"n":"Roast Beef Sec Tr Thon Morcx 'huile D'olive","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"0857531000425","s":0,"n":"Rogalach ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0814968020884","s":0,"n":"Rogalach vanille pépites de chocolat ACHVA","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290002780656","s":0,"n":"Rondelles olives noires YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3177890001008","s":0,"n":"Roquefort PAPILLON","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"3423990000770","s":0,"n":"Rôti de dinde spécial chawarma YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"3296740000944","s":0,"n":"Rôti de dinde YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"087752016190","s":0,"n":"ROTSHIELD","c":"cat-autre","u":"unit","p":3590,"pp":0},{"b":"7290115720518","s":0,"n":"Rouges à lèvres cylindre LICK STICK x70","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132031225","s":0,"n":"Roulette à pizza bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132031218","s":0,"n":"Roulette à pizza halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132031232","s":0,"n":"Roulette à pizza pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"847eaf54-6579-4687-982c-16ed046588c7","s":24,"n":"Royal","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"32ebeab9-46b8-40b5-8c87-409577cd81c7","s":12,"n":"Royal Juil Yaourt Nature Light Nova Ots Juil","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"1b0aeaeb-f3cd-40d1-8c48-e1b2660b10cf","s":16,"n":"RPastor] Bûche Chevre Frais Coque","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"855e766c-5f23-4474-a352-70de708375e4","s":12,"n":"RSalade Bettraves Août Crem Fruit Bois Ots Oct","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"6af7c734-087e-4887-8a98-86494f419b93","s":12,"n":"RSalade Turque Sept Crem Fraise Ots Oct","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"d6fa7a48-313d-44f8-a5ef-b8749eb08f07","s":10,"n":"RSoupe Aux Lentilles Sept","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"5bc459dc-0ce5-4818-84ff-0319adacc705","s":10,"n":"RSoupe Minestrone Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"c6d671e8-a07d-495b-97b4-ca18b5786bd8","s":48,"n":"RSURIMI","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"f0df3b61-6d9a-4ff0-8e54-abdcc863586c","s":10,"n":"RVelouté Aux Champignons Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"addc2be6-8fb5-416f-b079-cc2e33196669","s":10,"n":"RVelouté Carrottes Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3fcc89b2-b45f-4a0c-ba01-91693b3ed9e5","s":10,"n":"RVelouté Courge Butternut Sept","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"1ed5d4fc-174d-426d-8089-cd305ffb28ad","s":10,"n":"RVeloute Tomate Sept","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"6aa2575c-e4ec-4247-babd-753ceed207ba","s":6,"n":"RVerbosquet Emm Rapé Sept Vache Q Rit Portions","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"43f61cbb-1a35-4785-acb5-1e9450ff2020","s":12,"n":"RWhiptTop Chantilly Parvé","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"31401970-6d75-4dec-afc5-8a836be1b3b0","s":6,"n":"RYaourt Nature Ots","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"7290108359299","s":0,"n":"Sacs cuisson en coton SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801221","s":0,"n":"Sainte Marguerite Fantastique Côtes-de-Provence blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801634","s":0,"n":"Sainte Marguerite Fantastique Côtes-de-Provence rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801207","s":0,"n":"Sainte Marguerite Fantastique Côtes-de-Provence rosé XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127801115","s":0,"n":"Sainte Marguerite Fantastique Côtes-de-Provence rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127800316","s":0,"n":"Sainte Marguerite Symphonie Côtes-de-Provence blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801191","s":0,"n":"Sainte Marguerite Symphonie Côtes-de-Provence rosé","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"58b32f7d-8ca0-437f-a030-124615a30d5d","s":8,"n":"Saintois Août Mozza Pain *capitano","c":"cat-laitier","u":"unit","p":0,"pp":0},{"b":"3423990000633","s":0,"n":"Salade de betterave YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990000008","s":0,"n":"Salade de piments YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990006758","s":0,"n":"Salade de poivrons rouges olives et tomates YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"6191546002451","s":0,"n":"Salade méchouia douce AMILCAR","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3700604200598","s":0,"n":"Salade méchouia piquante AMILCAR","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760059042105","s":254,"n":"SALAMETTO PICCANTE","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"33760059042105","s":0,"n":"SALAMETTO PIQUANTE","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"2010d3c0-0883-4df2-8aa1-28cd2bf9c013","s":10,"n":"Salami Bœuf Août Sprats Fumés","c":"cat-frais","u":"unit","p":0,"pp":0},{"b":"3760059042112","s":0,"n":"SALAMI MILANO","c":"cat-frais","u":"unit","p":800,"pp":0},{"b":"5060414910017","s":254,"n":"Salami sec tranchÃ© il milano GUSTOFINO","c":"cat-frais","u":"unit","p":800,"pp":0},{"b":"5060199311504","s":0,"n":"Salt beef PRIME CUT","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"6194029101580","s":0,"n":"Sardines à l huile d olive EL MANAR","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"6194029101573","s":0,"n":"Sardines au piment de cayenne EL MANAR","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0027000001455","s":0,"n":"Sauce barbecue HUNTS","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0027000001127","s":0,"n":"Sauce barbecue miel moutarde HUNTS","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8858271004034","s":0,"n":"Sauce chili piquante MAXCHUP","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8858271004799","s":0,"n":"Sauce chili sucrée MAXCHUP","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290108530704","s":0,"n":"Sauce chili sucrée YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290005938016","s":0,"n":"Sauce pesto basilic YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290012894008","s":0,"n":"Sauce pesto en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"8005110551215","s":0,"n":"Sauce pizza MUTTI","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8858271003020","s":0,"n":"Sauce soja MAXCHUP","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8858271003075","s":0,"n":"Sauce soja sucrée MAXCHUP","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290016104622","s":0,"n":"Sauce soja sucrée YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290108530698","s":0,"n":"Sauce soja YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290108530681","s":0,"n":"Sauce teriyaki YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290012561207","s":0,"n":"Sauce tomate basilic en cubes DOROT","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"0710069312104","s":0,"n":"Sauce tomate en brique TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"33770027572220","s":0,"n":"SAUCISON SEC","c":"cat-autre","u":"unit","p":1400,"pp":0},{"b":"5060199311740","s":0,"n":"Saucisses beef cocktails PRIME CUT","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"5060199311771","s":0,"n":"Saucisses beef viennas PRIME CUT","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290018236147","s":0,"n":"Saucisses cervelas poulet YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423991559970","s":0,"n":"Saucisses cocktail de volaille YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290112969347","s":0,"n":"Saucisses cocktail végétariennes TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290018236154","s":0,"n":"Saucisses cocktails fr YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290115202083","s":0,"n":"Saucisses croknak végétariennes TIVALL","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"5060199311757","s":0,"n":"Saucisses de boeuf jumbo hot dog PRIME CUT","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3423990006048","s":0,"n":"Saucisses de boeuf YARDEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"3296740002559","s":0,"n":"Saucisses de volaille YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"7290000367767","s":0,"n":"Saucisses viennas poulet YARDEN","c":"cat-volaille","u":"unit","p":1000,"pp":0},{"b":"3700048101024","s":0,"n":"Saucisson cuit BELLEVILLOIS","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3252880813011","s":8,"n":"Saucisson Kasher","c":"cat-frais","u":"unit","p":1700,"pp":0},{"b":"3770027572039","s":0,"n":"Saucisson sec BENELI","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"3770027572220","s":0,"n":"SAUCISSON SEC PUR BOEUF","c":"cat-frais","u":"unit","p":1500,"pp":0},{"b":"5060414910369","s":0,"n":"Saucisson tranches sèches à l ail GUSTOFINO","c":"cat-frais","u":"unit","p":500,"pp":0},{"b":"5060414910376","s":0,"n":"Saucisson tranches sèches à la truffe GUSTOFINO","c":"cat-frais","u":"unit","p":1000,"pp":0},{"b":"7290006895370","s":0,"n":"Schnitzels dinosaures YARDEN","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"33760059041993","s":0,"n":"SCHORIZO","c":"cat-frais","u":"unit","p":900,"pp":0},{"b":"3760059041993","s":0,"n":"SCHORIZO DE BOEUF","c":"cat-frais","u":"unit","p":900,"pp":0},{"b":"8015565030654","s":0,"n":"SCROTCHI","c":"cat-autre","u":"unit","p":500,"pp":0},{"b":"0760412652470","s":0,"n":"Secret du Haut Vallon Côtes de Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3262240004201","s":0,"n":"Semoule ROSINSKI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760034628546","s":0,"n":"Sésame blanc YARDEN","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"3760034629741","s":0,"n":"Sésame doré YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"91404101721","s":5,"n":"Shuffle € 91404101721","c":"cat-epicerie","u":"unit","p":68,"pp":0},{"b":"7290019512417","s":0,"n":"SIRAH","c":"cat-alcool","u":"unit","p":3200,"pp":0},{"b":"7290003143337","s":0,"n":"Sirop silan 100% dattes naturel","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082428","s":0,"n":"Siviano Cabernet Sauvignon rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0023632082459","s":0,"n":"Siviano Chardonnay blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0023632082435","s":0,"n":"Siviano Merlot rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800743","s":0,"n":"Smith Haut Lafitte Pessac Léognan Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3760127800750","s":0,"n":"Smith Haut Lafitte Pessac Léognan Grand Cru Bordeaux rouge XL","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3448270004354","s":750,"n":"Sorbet Citron - Plein Fruit ml € 3448270004354","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"3448270005771","s":750,"n":"Sorbet Fraise - Plein Fruit ml € 3448270005771","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"3448270003302","s":750,"n":"Sorbet Fruits Passion - Plein Fruit ml € 3448270003302","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"3448270005788","s":750,"n":"Sorbet Mangue - Plein Fruit ml € 3448270005788","c":"cat-epicerie","u":"unit","p":1,"pp":0},{"b":"0077544489400","s":0,"n":"Soupe à l oignon OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0077544334403","s":0,"n":"Soupe aux champignons OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0710069061347","s":0,"n":"Soupe de nouilles instantanée saveur boeuf tomate GEFEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0710069061330","s":0,"n":"Soupe de nouilles instantanée saveur légumes GEFEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0710069061323","s":0,"n":"Soupe de nouilles instantanée saveur poulet GEFEN","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"0077544156302","s":0,"n":"Spaghetti bolognaise instantanées OSEM","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132030228","s":0,"n":"Spatule bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057720","s":0,"n":"Spatule en silicone bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057713","s":0,"n":"Spatule en silicone halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132057737","s":0,"n":"Spatule en silicone pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132030211","s":0,"n":"Spatule halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132030235","s":0,"n":"Spatule pareve KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7fed32ba-c328-4ded-8765-6e606f63012d","s":12,"n":"Spicy Juil Café Latté Expresso Oct","c":"cat-epicerie","u":"unit","p":0,"pp":0},{"b":"3102870019025","s":0,"n":"Spigol x14","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290011598211","s":0,"n":"Spray anticalcaire SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108351590","s":0,"n":"Spray d intérieur fleur bleue SANO","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290014397507","s":0,"n":"Spray d intérieur musk SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108351606","s":0,"n":"Spray d intérieur soie douce SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0665852814016","s":0,"n":"Spray dégraissant à froid WELL DONE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000289748","s":0,"n":"Spray dégraissant SANO","c":"cat-epicerie","u":"unit","p":1200,"pp":0},{"b":"7290005430602","s":0,"n":"Spray détachant SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290108357189","s":0,"n":"Spray linge floral MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290004731519","s":0,"n":"Spray linge sensitive MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290005423253","s":0,"n":"Spray linge ultra fresh MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290000286983","s":0,"n":"Spray nettoyant pour canapés et tissus SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290004731557","s":0,"n":"Spray tissus pour sèche-linge musk MAXIMA SANO","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"R1230","s":240,"n":"Steack Boeuf Rav Pewsner","c":"cat-viande","u":"unit","p":0,"pp":0},{"b":"2134380003004","s":0,"n":"STEACK HACHE X2 ANGUS","c":"cat-viande","u":"unit","p":1300,"pp":0},{"b":"3253880002153","s":0,"n":"Steaks hachés 15% BENELI x10","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3253880002399","s":0,"n":"Steaks hachés facon bouchère BENELI","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3423990006925","s":0,"n":"Steaks hachés glatt 100% pur boeuf YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"7290006895264","s":0,"n":"Steaks parguits de poulet YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"0706132066036","s":0,"n":"Stickers casher pour pessah KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132066029","s":0,"n":"Stickers hamets ne pas toucher KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0710069301405","s":0,"n":"Sticks de mozzarella TUSCANINI","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"9140410226","s":300,"n":"Sticks Zoooom ml € 9140410226","c":"cat-epicerie","u":"unit","p":2,"pp":0},{"b":"7290115721447","s":0,"n":"Sucettes bleues color langue GROSSLINE","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"7290115720037","s":0,"n":"Sucettes cerise double lek GROSSLINE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"7290115720044","s":0,"n":"Sucettes pêche double lek GROSSLINE","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"c1c09ed4-12b3-4ea0-b829-3af077c02984","s":0,"n":"SURIMI","c":"cat-surgele","u":"unit","p":1200,"pp":0},{"b":"3302745555102","s":0,"n":"SURIMI 500","c":"cat-surgele","u":"unit","p":1200,"pp":0},{"b":"0000080001980","s":0,"n":"Tablette de chocolat au lait croustillante fourrage lait LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0000080001256","s":0,"n":"Tablette de chocolat au lait croustillante napolitaner LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"7290019644583","s":0,"n":"Tablettes chocolat au lait CARMIT x2","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"0706132064421","s":0,"n":"Tablier bassari KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0706132064414","s":0,"n":"Tablier halavi KOSHERCOOK","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8004618001604","s":0,"n":"Tagliatelles truffe Valentini YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3592860018440","s":0,"n":"TAPENADE ARTICHAUD","c":"cat-condiment","u":"unit","p":800,"pp":0},{"b":"3423990001623","s":0,"n":"Tapenade d olives noires YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990002026","s":0,"n":"Tapenade d olives vertes YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001661","s":0,"n":"Tapenade de tomate YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001159","s":0,"n":"Tapenade olives noires YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3423990001142","s":0,"n":"Tapenade olives vertes YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"8015565030357","s":0,"n":"TARALLI","c":"cat-autre","u":"unit","p":500,"pp":0},{"b":"5018804900094","s":0,"n":"Tarama YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3592860018426","s":255,"n":"TARTINADE","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"3592860018419","s":0,"n":"TARTINADE DOLIVE","c":"cat-condiment","u":"unit","p":600,"pp":0},{"b":"0814968020945","s":0,"n":"TEHINA","c":"cat-condiment","u":"unit","p":1200,"pp":0},{"b":"0814968020204","s":0,"n":"Tehina au chocolat pâte à tartiner ACHVA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"0814968021195","s":0,"n":"Tehina au chocolat sans sucre pâte à tartiner ACHVA","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"7290000572130","s":0,"n":"Téhina naturelle ACHVA","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0814968020020","s":0,"n":"Téhina seau","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8149680212180","s":0,"n":"Téhina sésame squeeze ACHVA","c":"cat-epicerie","u":"unit","p":800,"pp":0},{"b":"7290106572256","s":0,"n":"Téhina YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3770021861191","s":0,"n":"TENDERS","c":"cat-surgele","u":"unit","p":1700,"pp":0},{"b":"3760371130047","s":0,"n":"Tenders de poulet MELIS","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"7290115720495","s":0,"n":"Tétines cylindre DUMMY LEX x50","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423994500030","s":0,"n":"THON 800G HUILE","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"6194029101030","s":0,"n":"Thon à l huile d olive EL MANAR","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760030143234","s":0,"n":"Thon en morceaux à l huile YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423990100067","s":0,"n":"Thon en morceaux à l’huile poche YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143258","s":0,"n":"Thon en morceaux au naturel YARDEN 800G","c":"cat-epicerie","u":"unit","p":1200,"pp":0},{"b":"6194029101047","s":0,"n":"Thon entier à l huile d olive EL MANAR","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"6191485000785","s":0,"n":"Thon entier à l huile KOSKAS","c":"cat-surgele","u":"unit","p":500,"pp":0},{"b":"33760030146129","s":0,"n":"THON HUILE X3","c":"cat-autre","u":"unit","p":1200,"pp":0},{"b":"3760030146112","s":0,"n":"THON X3 EAU","c":"cat-snack","u":"unit","p":1200,"pp":0},{"b":"3760030146129","s":0,"n":"THON X3 HUILE","c":"cat-snack","u":"unit","p":1200,"pp":0},{"b":"7290019167099","s":0,"n":"Tiramisu vegan EDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760127800323","s":0,"n":"Tokaj Hétszolo Muscat blanc","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"8005110005367","s":0,"n":"Tomates pelées MUTTI","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3592860018501","s":0,"n":"TOMATES SECHEES","c":"cat-autre","u":"unit","p":800,"pp":0},{"b":"MIGR-1785882429013-18","s":0,"n":"TOMAWACK ANGUS","c":"cat-viande","u":"unit","p":9000,"pp":0},{"b":"8004618001819","s":0,"n":"Tortelloni champignons Valentini YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"8004618001659","s":0,"n":"Tortelloni epinards ricotta Valentini YARDEN","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"8004618001925","s":0,"n":"Tortelloni mozzarella tomates Valentini YARDEN","c":"cat-laitier","u":"unit","p":500,"pp":0},{"b":"8000380106028","s":0,"n":"Tortina original LOACKERS","c":"cat-snack","u":"unit","p":500,"pp":0},{"b":"087752034873","s":0,"n":"TOUR SERAN","c":"cat-alcool","u":"unit","p":5900,"pp":0},{"b":"3339720000586","s":0,"n":"Tranches pur boeuf BENELI","c":"cat-frais","u":"unit","p":1200,"pp":0},{"b":"3760259570613","s":0,"n":"Trianon St Émilion Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3423990006888","s":0,"n":"Turkish salade YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3760127800637","s":0,"n":"Vacheron Grands Champs Sancerre Loire blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760127801085","s":0,"n":"Valois Pomerol Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"3423990000275","s":0,"n":"Variantes de légumes YARDEN","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3760030143142","s":0,"n":"Veilleuse timbale","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"6194029100965","s":0,"n":"Ventreche de thon à l huile d olive EL MANAR","c":"cat-surgele","u":"unit","p":1500,"pp":0},{"b":"3760034622698","s":0,"n":"VENTRECHE DE THON HUILE OLIVE","c":"cat-surgele","u":"unit","p":1200,"pp":0},{"b":"6912977000140","s":0,"n":"Vermicelles de haricots","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"8850122102043","s":0,"n":"Vermicelles de haricots EAST WEST","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"3423992100027","s":0,"n":"Viande hachée 100% YARDEN","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"3661019003733","s":0,"n":"VIANDE HACHEE 500G","c":"cat-autre","u":"unit","p":1500,"pp":0},{"b":"3253880002290","s":0,"n":"Viande hachée égrenée pur boeuf 15% BENELI","c":"cat-viande","u":"unit","p":500,"pp":0},{"b":"VIA200","s":302,"n":"VIANDE HACHEE SURG","c":"cat-surgele","u":"unit","p":0,"pp":0},{"b":"77290002603504","s":0,"n":"VIENNOISES","c":"cat-boulangerie","u":"unit","p":1000,"pp":0},{"b":"d3efe7b1-0274-4418-8b21-9895a6f403ad","s":80,"n":"Viennoisses Volaille Mron","c":"cat-boulangerie","u":"unit","p":0,"pp":0},{"b":"0791163371396","s":0,"n":"Vieux Clocher Côtes du Rhône blanc","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"0791163371389","s":0,"n":"Vieux Clocher Côtes du Rhône rouge","c":"cat-epicerie","u":"unit","p":500,"pp":0},{"b":"087752040447","s":0,"n":"VIN CHATEAU ARNAUD RESERVE","c":"cat-alcool","u":"unit","p":1900,"pp":0},{"b":"7290000520803","s":0,"n":"Vin de Kidouch Kinor","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"08775202463","s":0,"n":"VIN DOMAINE TERNYCK","c":"cat-alcool","u":"unit","p":3500,"pp":0},{"b":"087752033951","s":0,"n":"VIN LA MAISON BLEUE","c":"cat-laitier","u":"unit","p":1490,"pp":0},{"b":"087752042038","s":0,"n":"VIN LECOMPTE MALARTIC","c":"cat-alcool","u":"unit","p":6900,"pp":0},{"b":"087752041284","s":0,"n":"VIN ROSE VERAWANG","c":"cat-alcool","u":"unit","p":2500,"pp":0},{"b":"087752028933","s":0,"n":"VIN ROUBINE","c":"cat-alcool","u":"unit","p":2000,"pp":0},{"b":"087752021897","s":0,"n":"VIN SAINTE BEATRICE","c":"cat-alcool","u":"unit","p":2200,"pp":0},{"b":"8024698131558","s":0,"n":"Vinaigre balsamique de modena CARLO MAGNO","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"3760030142886","s":0,"n":"Vinaigre d alcool blanc YARDEN","c":"cat-epicerie","u":"unit","p":350,"pp":0},{"b":"8007178223516","s":0,"n":"Vinaigre de vin rouge","c":"cat-boisson","u":"unit","p":500,"pp":0},{"b":"3760030142916","s":0,"n":"Vinaigrette à la moutarde YARDEN","c":"cat-condiment","u":"unit","p":500,"pp":0},{"b":"33760030142916","s":0,"n":"VINEGRETTE","c":"cat-autre","u":"unit","p":400,"pp":0},{"b":"3760127801351","s":0,"n":"Virginie de Valandraud St Émilion Grand Cru Bordeaux rouge","c":"cat-alcool","u":"unit","p":500,"pp":0},{"b":"0e21c1af-6b77-44e0-85ec-d759af71e21e","s":3,"n":"Volaille Nov F10b Terrine F D'oie Cuit","c":"cat-autre","u":"unit","p":0,"pp":0},{"b":"3468882111745","s":0,"n":"VOLNAY","c":"cat-alcool","u":"unit","p":7900,"pp":0},{"b":"3448270004606","s":11,"n":"WhiptTop Chantilly Parvé","c":"cat-laitier","u":"unit","p":1000,"pp":0},{"b":"39215461300070","s":180,"n":"WINE EUROPE SAS, société au capital de Euros, SIRET 39215461300070, NAF : 4634Z, N° TVA intra. FR 30392154613, N° de AC FR E , N° enregistrement FDA 10836346018","c":"cat-boulangerie","u":"unit","p":1154,"pp":0},{"b":"3760187680224","s":0,"n":"Yakitori de poulet YELLO SUSHI","c":"cat-volaille","u":"unit","p":500,"pp":0},{"b":"fb0638e9-8bcf-4949-aa36-6391dc0f6171","s":0,"n":"za","c":"cat-autre","u":"unit","p":200,"pp":0},{"b":"add4be19-1e45-486d-8339-a1506df0ddc0","s":16,"n":"Zaatar Août Petits Suisses Nature Ots Juil","c":"cat-autre","u":"unit","p":0,"pp":0}]};;



  function _importBackupFromEmbedded(){
    return _openMeta().then(function(d){
      if(!d)return false;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_BACKUP_IMPORTED_KEY);
        r.onsuccess=function(){ok(!!(r.result&&r.result.value));};
        r.onerror=function(){ok(false);};
      });
    }).then(function(imported){
      if(imported){_log("Backup already imported");return false;}
      return _openDB().then(function(d){
        if(!d)return false;
        if(!d.objectStoreNames.contains("products")){
          _err("DB opened but 'products' store missing — retrying open");
          _db=null;
          return _openDB().then(function(d2){
            if(!d2)return false;
            return new Promise(function(ok){
              var r=d2.transaction("products","readonly").objectStore("products").count();
              r.onsuccess=function(){ok(r.result);};r.onerror=function(){ok(0);};
            });
          });
        }
        return new Promise(function(ok){
          var r=d.transaction("products","readonly").objectStore("products").count();
          r.onsuccess=function(){ok(r.result);};r.onerror=function(){ok(0);};
        });
      }).then(function(count){
        if(count>0){_log("IndexedDB already has "+count+" products, skipping import");return false;}
        var cats=_BACKUP_DATA.categories;
        var catMap={};
        for(var ci=0;ci<cats.length;ci++)catMap[cats[ci].id]=cats[ci].name;
        var prods=_BACKUP_DATA.products;
        var promises=[];
        for(var pi=0;pi<prods.length;pi++){
          var p=prods[pi];
          var barcode=p.b||("ACIM-DB-"+pi+"-"+Math.random().toString(36).substr(2,6));
          var catName=catMap[p.c]||"Divers";
          var mapped=catName.toLowerCase();
          if(mapped==="frais")mapped="viande";
          else if(mapped==="sec")mapped="snack";
          else if(mapped==="congele")mapped="surgelé";
          else if(mapped==="alcool")mapped="vin";else if(mapped==="divers")mapped="autre";else if(mapped==="epicerie")mapped="epicerie";
          promises.push(_dbPut({barcode:barcode,name:p.n,sale_price_cents:p.p,category:mapped,stockQty:p.s,unit:p.u||"unit",purchase_price_cents:p.pp||0,source:"backup-import",last_updated:Date.now()}));
        }
        return Promise.all(promises).then(function(){
          _openMeta().then(function(d){
            if(!d)return;var tx=d.transaction("meta","readwrite");
            tx.objectStore("meta").put({key:_BACKUP_IMPORTED_KEY,value:true});
          });
          _log("Imported "+prods.length+" products from backup");
          return true;
        });
      });
    }).catch(function(e){_err("Backup import error:",e);return false;});
  }

  var _YARDEN_IMPORTED_KEY="yarden-catalog-imported-v1";
  function _importYardenCatalog(){
    return _openMeta().then(function(d){
      if(!d)return false;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_YARDEN_IMPORTED_KEY);
        r.onsuccess=function(){
          if(r.result&&r.result.value){ok(false);return;}
          _doImportYarden().then(function(count){
            if(count>0){
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:_YARDEN_IMPORTED_KEY,value:true});
            }
            ok(count);
          }).catch(function(){ok(0);});
        };
        r.onerror=function(){_doImportYarden().then(function(c){ok(c);}).catch(function(){ok(0);});};
      });
    }).catch(function(e){_err("Yarden import error:",e);return 0;});
  }
  function _doImportYarden(){
    return fetch("./assets/assets/catalog/supplier_catalog.json").then(function(resp){
      if(!resp.ok)throw new Error("Fetch failed: "+resp.status);
      return resp.json();
    }).then(function(data){
      var products=data.products||[];
      if(!Array.isArray(products)||products.length===0)return 0;
      // Normalize supplier catalog for matching
      _supplierCatalog=products.map(function(p){
        return{
          barcode:p.ean||"",name:p.name||"",code:p.code||"",
          category:p.category||"",ean:p.ean||""
        };
      });
      var catMap={"Congele":"surgelé","Frais":"viande","Sec":"snack","Divers":"epicerie"};
      // ── FRAIS keywords ──
      var volailleKw=["poulet","poule","dinde","canard","oeuf","œuf","blanc poulet","cuisse","aiguillette","filet poulet","magret","foie gras","coq","parmelet","paupiette","pilon","pilori"];
      var viandeKw=["boeuf","bœuf","veau","agneau","porc","steak","côte","cotelette","entrecôte","bavette","haché","hache","rôti","roti","saucisse","jambon","lard","merguez","chipolata","boudin","salami","viande","poitrine","andouillette","rosette","saucisson"];
      var laitierKw=["lait","fromage","yaourt","yogurt","crème","beurre","emmental","gruyère","mozzarella","ricotta","parmesan","mascarpone","reblochon","camembert","brie","roquefort","chèvre","morbier","raclette","tome","comté"];
      // ── SEC keywords (alimentaire) ──
      var boissonAlcoolKw=["vin ","vin de","champagne","cidre","rhum","whisky","whiskey","vodka","gin ","grappa","armagnac","cognac","酒","saké","porto","marsala","madeira"];
      var boissonKw=["eau ","eau minérale","eau de source","jus ","jus de","soda","bière","biere","limonade","coca","sprite","perrier","boisson","thé ","thé de","café ","café de","tisane","infusion","ice tea","oranga"];
      var condimentKw=["vinaigre","moutarde","ketchup","mayonnaise","sauce ","sauces","huile d","huile de","sel ","poivre","épice","epice","herbe","basilic","thym","romarin","curry","paprika","cumin","safran","cannelle","vanille","exhausteur","exhausteurs","assafoetida","haldi","cumin","methi"];
      var snackKw=["chips","biscuit","biscuits","gâteau","gateau","cookie","céréales","cereales","barre ","snack","nooty","nutella","amande","noisette","cacahuète","fruits secs","muesli","chocolat","bonbon","bonbons","cracker","grignotage"];
      var epicerieSecKw=["riz ","pâtes","pates","lentilles","pois ","haricots","farine","sucre ","confiture","miel","café","the ","cacao","céréales","conserve","soupe","bouillon","nutella","pâte ","pâtes "];
      // ── DIVERS keywords ──
      var menagerKw=["lessive","détergent","detergent","nettoyant","savon","shampooing","dentifrice","papier toilette","mouchoir","couche","hygiène","menager","éponge","assouplissant","adoucissant","lingette","détachant","detachant","séche-linge","bougie","candle"];
      var menagerKw2=["éponges","eponges","papier sulfurisé","sacs cuisson","barquette","assiette","gobelet","nappe","ciseaux","couteau","spatule","cuillère","louche","roulette","tablier","éplucheur","planche"];
      var cuisineKw=["ciseaux","couteau","spatule","cuillère","louche","roulette","tablier","éplucheur","planche","manchon","gant","torchon","râpe","mixeur","balance","thermomètre"];
      // ── ALCOOL: vin category ──
      var vinKw=["vin ","vin de","champagne","cava","prosecc","crémant","sparkling","brut ","demi-sec","doux","rosé","rouge ","blanc ","mousseux","grappa","armagnac","cognac","porto","saké"];

      function _betterYardenCat(yardenCat,name){
        var n=(name||"").toLowerCase();
        // ── FRAIS ──
        if(yardenCat==="Frais"){
          for(var i=0;i<volailleKw.length;i++){if(n.indexOf(volailleKw[i])!==-1)return"volaille";}
          for(var i=0;i<viandeKw.length;i++){if(n.indexOf(viandeKw[i])!==-1)return"viande";}
          for(var i=0;i<laitierKw.length;i++){if(n.indexOf(laitierKw[i])!==-1)return"laitier";}
          if(n.indexOf("choucroute")!==-1||n.indexOf("cuisiné")!==-1||n.indexOf("plat ")!==-1)return"epicerie";
          return"viande";
        }
        // ── CONGELE ──
        if(yardenCat==="Congele")return"surgelé";
        // ── SEC (dry goods — needs thorough sub-categorization) ──
        if(yardenCat==="Sec"){
          // Vin/alcool d'abord (avant boisson non-alcool)
          for(var i=0;i<vinKw.length;i++){if(n.indexOf(vinKw[i])!==-1)return"vin";}
          for(var i=0;i<boissonAlcoolKw.length;i++){if(n.indexOf(boissonAlcoolKw[i])!==-1)return"vin";}
          // Boisson non-alcool
          for(var i=0;i<boissonKw.length;i++){if(n.indexOf(boissonKw[i])!==-1)return"boisson";}
          // Condiment
          for(var i=0;i<condimentKw.length;i++){if(n.indexOf(condimentKw[i])!==-1)return"condiment";}
          // Snack
          for(var i=0;i<snackKw.length;i++){if(n.indexOf(snackKw[i])!==-1)return"snack";}
          // Epicerie
          for(var i=0;i<epicerieSecKw.length;i++){if(n.indexOf(epicerieSecKw[i])!==-1)return"epicerie";}
          // Cornichon, olives, conserves
          if(n.indexOf("cornichon")!==-1||n.indexOf("olive")!==-1||n.indexOf("conserve")!==-1||n.indexOf("sauce")!==-1)return"epicerie";
          return"epicerie";
        }
        // ── DIVERS (cleaning, utensils, candles) ──
        if(yardenCat==="Divers"){
          for(var i=0;i<menagerKw.length;i++){if(n.indexOf(menagerKw[i])!==-1)return"menager";}
          for(var i=0;i<menagerKw2.length;i++){if(n.indexOf(menagerKw2[i])!==-1)return"menager";}
          for(var i=0;i<cuisineKw.length;i++){if(n.indexOf(cuisineKw[i])!==-1)return"menager"};
          if(n.indexOf("bougie")!==-1||n.indexOf("chabbat")!==-1||n.indexOf("hanouka")!==-1||n.indexOf("pessah")!==-1||n.indexOf("hametz")!==-1||n.indexOf("sticker")!==-1)return"menager";
          if(n.indexOf("assiette")!==-1||n.indexOf("gobelet")!==-1||n.indexOf("nappe")!==-1||n.indexOf("sac ")!==-1||n.indexOf("aluminium")!==-1)return"menager";
          return"epicerie";
        }
        return catMap[yardenCat]||"epicerie";
      }
      var chain=Promise.resolve();
      var count=0;
      for(var i=0;i<_supplierCatalog.length;i++){
        (function(p){
          chain=chain.then(function(){
            var bc=p.ean||"";
            var name=p.name||"";
            var cat=_betterYardenCat(p.category||p.cat||"",name);
            if(!bc||!name)return;
            return _dbPut({barcode:bc,name:name,sale_price_cents:0,category:cat,stockQty:0,low_stock_threshold:5,source:"yarden-catalog",last_updated:Date.now()}).then(function(){count++;});
          });
        })(_supplierCatalog[i]);
      }
      return chain.then(function(){
        // Save normalized catalog to meta for reload on startup
        _openMeta().then(function(d){
          if(!d)return;
          var tx=d.transaction("meta","readwrite");
          tx.objectStore("meta").put({key:"supplier-catalog",value:_supplierCatalog});
        });
        return count;
      });
    });
  }

  var _SUPCAT_META_KEY="supplier-catalog";
  var _PDFCAT_META_KEY="catalog-from-pdf";
  function _importSupplierCatalogFromMeta(){
    return _openMeta().then(function(d){
      if(!d)return 0;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_SUPCAT_META_KEY);
        r.onsuccess=function(){
          var cat=r.result&&r.result.value;
          // Also check for catalog-from-pdf
          var r2=d.transaction("meta","readonly").objectStore("meta").get(_PDFCAT_META_KEY);
          r2.onsuccess=function(){
            var pdfCat=r2.result&&r2.result.value;
            // Merge both catalogs, preferring supplier catalog
            var merged=cat||[];
            if(pdfCat&&Array.isArray(pdfCat)){
              var existingBcs={};
              for(var mi=0;mi<merged.length;mi++){if(merged[mi].barcode)existingBcs[merged[mi].barcode]=true;}
              for(var pj=0;pj<pdfCat.length;pj++){
                if(pdfCat[pj].barcode&&!existingBcs[pdfCat[pj].barcode]){merged.push(pdfCat[pj]);existingBcs[pdfCat[pj].barcode]=true;}
              }
            }
            if(!Array.isArray(merged)||merged.length===0){ok(0);return;}
            _supplierCatalog=merged;
            _openDB().then(function(d){
              if(!d){ok(0);return;}
              var tx=d.transaction("products","readonly");
              var store=tx.objectStore("products");
              var countReq=store.count();
              countReq.onsuccess=function(){
                if(countReq.result>0){ok(0);return;}
                var promises=[];
                for(var i=0;i<merged.length;i++){
                  var p=merged[i];
                  if(!p.barcode)continue;
                  // sale_price (supplier cat, in cents if >100) OR unitPrice (PDF import, in euros)
                  var salePrice=0;
                  if(p.sale_price>0)salePrice=p.sale_price>100?p.sale_price:Math.round(p.sale_price*100);
                  else if(p.unitPrice>0)salePrice=Math.round(p.unitPrice*100);
                  else if(p.sale_price_cents>0)salePrice=p.sale_price_cents;
                  var purchasePrice=p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100);
                  var catName=_guessCategory(p.name)||"epicerie";
                  promises.push(_dbPut({
                    barcode:p.barcode,name:p.name,
                    sale_price_cents:salePrice,
                    purchase_price_cents:purchasePrice,
                    category:catName,stockQty:p.qty||p.stockQty||0,low_stock_threshold:5,
                    source:"supplier-catalog",last_updated:Date.now()
                  }));
                }
                Promise.all(promises).then(function(){ok(promises.length);});
              };
              countReq.onerror=function(){ok(0);};
            });
          };
          r2.onerror=function(){
            if(!Array.isArray(cat)||cat.length===0){ok(0);return;}
            _supplierCatalog=cat;
            _openDB().then(function(d){
              if(!d){ok(0);return;}
              var tx=d.transaction("products","readonly");
              var store=tx.objectStore("products");
              var countReq=store.count();
              countReq.onsuccess=function(){
                if(countReq.result>0){ok(0);return;}
                var promises=[];
                for(var i=0;i<cat.length;i++){
                  var p=cat[i];
                  if(!p.barcode)continue;
                  var salePrice=p.sale_price>100?p.sale_price:Math.round((p.sale_price||0)*100);
                  var purchasePrice=p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100);
                  var catName=_guessCategory(p.name)||"epicerie";
                  promises.push(_dbPut({
                    barcode:p.barcode,name:p.name,
                    sale_price_cents:salePrice>0?salePrice:0,
                    purchase_price_cents:purchasePrice,
                    category:catName,stockQty:0,low_stock_threshold:5,
                    source:"supplier-catalog",last_updated:Date.now()
                  }));
                }
                Promise.all(promises).then(function(){ok(promises.length);});
              };
              countReq.onerror=function(){ok(0);};
            });
          };
        };
        r.onerror=function(){ok(0);};
      });
    }).catch(function(e){_err("Supplier catalog import error:",e);return 0;});
  }

  // ─── CART ────────────────────────────────────────────
  var _myCart=[];
  var _realBcMap={};
  var _cartDiscountCents=0;

  function _addToCart(name,priceCents,barcode,categoryId,weight,unitType,pricePerUnit){
    if(!name){_toast("Nom manquant");return false;}
    var myId="M"+Date.now()+Math.floor(Math.random()*9999);
    _myCart.push({myId:myId,name:name,priceCents:priceCents||0,bc:barcode||"",cat:categoryId||"autre",
      weight:weight||null,unitType:unitType||null,pricePerUnit:pricePerUnit||null,
      discountCents:0,qty:1});
    _realBcMap[myId]=barcode||"";
    try{document.dispatchEvent(new CustomEvent("acim:add",{detail:{name:name,price:priceCents,barcode:barcode,cat:categoryId}}));}catch(e){}
    _renderPOS();return true;
  }
  function _cartInfo(){
    var info=[];
    for(var i=0;i<_myCart.length;i++){var e=_myCart[i];
      info.push({idx:i,myId:e.myId,name:e.name,price:e.priceCents,bc:_realBcMap[e.myId]||e.bc,cat:e.cat,
        weight:e.weight,unitType:e.unitType,pricePerUnit:e.pricePerUnit,discountCents:e.discountCents||0,qty:e.qty||1});
    }return info;
  }
  function _removeFromCart(idx){_myCart.splice(idx,1);_renderPOS();}
  function _cartSubtotal(){
    var t=0;for(var i=0;i<_myCart.length;i++)t+=_myCart[i].priceCents;return t;
  }
  function _cartTotal(){return Math.max(0,_cartSubtotal()-_cartDiscountCents);}

  // ─── WEIGHT HELPERS ──────────────────────────────────
  function _isWeightProduct(item){return item.weight!=null&&item.unitType!=null&&item.pricePerUnit!=null;}
  function _formatWeight(w,unit){
    if(w==null||!unit)return "";
    if(unit==="kg")return w.toFixed(3)+" kg";
    if(unit==="g")return w.toFixed(0)+" g";
    if(unit==="L")return w.toFixed(2)+" L";
    if(unit==="pc")return w.toFixed(0)+" pc";
    return w+" "+unit;
  }
  function _formatPricePerUnit(ppu,unit){
    if(!ppu||!unit)return "";
    var p=(ppu/100).toFixed(2);
    if(unit==="kg")return p+"€/kg";
    if(unit==="g")return p+"€/kg";
    if(unit==="L")return p+"€/L";
    if(unit==="pc")return p+"€/pc";
    return p+"€/u";
  }
  function _calcWeightPrice(weight,unit,ppu){
    if(!weight||!unit||!ppu)return 0;
    if(unit==="g")return Math.round(ppu*(weight/1000));
    return Math.round(ppu*weight);
  }

  // ─── BROADCAST (écran client) ────────────────────────
  var _custBc=null;
  try{_custBc=new BroadcastChannel("acim-customer-display");}catch(e){}
  function _broadcastCart(){
    if(!_custBc)return;var info=_cartInfo();var total=0;
    for(var i=0;i<info.length;i++)total+=info[i].price;
    _custBc.postMessage({type:"cart-update",lines:info,total:total,discount:_cartDiscountCents});}
  function _broadcastClear(){
    if(!_custBc)return;_custBc.postMessage({type:"cart-clear"});}

  // ─────────────────────────────────────────────────────
  //  POS UI
  // ─────────────────────────────────────────────────────
  var _pos=null,_posSearch=null,_posCats=null,_posGrid=null,_posCart=null,_posTotal=null,_posItems=null,_posCheckout=null;
  var _allProducts=[],_filteredProducts=[],_activeCat="";

  // ─── TOGGLE POS / FLUTTER ──────────────────────────────
  var _reopenBtn=null;
  function _togglePOS(show){
    if(!_pos)_createPOS();
    if(show){
      _pos.style.display="flex";
      if(_reopenBtn)_reopenBtn.style.display="none";
      document.documentElement.style.setProperty("--acim-flutter-opacity","0");
      document.documentElement.style.setProperty("--acim-flutter-pointer","none");
      setTimeout(function(){_posSearch.focus();},100);
    }else{
      _pos.style.display="none";
      if(!_reopenBtn){
        _reopenBtn=document.createElement("div");_reopenBtn.id="acim-reopen-btn";
        _reopenBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#e65100;color:#fff;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;z-index:999998;box-shadow:0 4px 16px rgba(230,81,0,0.4);font-family:Segoe UI,Arial,sans-serif;";
        _reopenBtn.textContent="🛒 Ouvrir la caisse";
        _reopenBtn.onclick=function(){_togglePOS(true);};
        document.body.appendChild(_reopenBtn);
      }
      _reopenBtn.style.display="flex";
      document.documentElement.style.setProperty("--acim-flutter-opacity","1");
      document.documentElement.style.setProperty("--acim-flutter-pointer","auto");
    }
  }

  function _createPOS(){
    if(_pos)return;
    _pos=document.createElement("div");_pos.id="acim-pos";
    _pos.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;display:flex;flex-direction:column;background:#f0f2f5;font-family:Segoe UI,Arial,sans-serif;";

    // ── TOP BAR ──
    var topBar=document.createElement("div");
    topBar.style.cssText="display:flex;align-items:center;padding:8px 12px;background:#1a1a2e;gap:8px;flex-shrink:0;";
    var logo=document.createElement("span");
    logo.textContent="🏪 AcimCaisse";logo.style.cssText="color:#fff;font-size:20px;font-weight:700;margin-right:4px;flex-shrink:0;cursor:pointer;";
    logo.onclick=function(){_showMainMenu();};
    topBar.appendChild(logo);

    _posSearch=document.createElement("input");_posSearch.id="acim-pos-search";
    _posSearch.type="text";_posSearch.placeholder="Rechercher un produit (nom ou code-barres)...";
        _posSearch.style.cssText="flex:1;padding:8px 14px;border:none;border-radius:8px;font-size:17px;outline:none;background:#2a2a4e;color:#fff;min-width:0;";
    _posSearch.addEventListener("input",function(){
      if(_allProducts.length===0){_refreshAndFilter();return;}
      _filterProducts();
    });
    _posSearch.addEventListener("keydown",function(e){
      if(e.key==="Enter"){var v=this.value.trim();if(v.length>=2){_processBarcode(v);this.value="";this.focus();}}
      if(e.key==="Escape"){this.value="";_filterProducts();this.blur();}
    });
    topBar.appendChild(_posSearch);

    var newBtn=document.createElement("button");
    newBtn.textContent="➕";newBtn.title="Nouveau produit (Ctrl+N)";
    newBtn.style.cssText="padding:6px 10px;border:none;border-radius:6px;background:#2a2a4e;color:#fff;font-size:20px;cursor:pointer;flex-shrink:0;";
    newBtn.onclick=function(){_quickCreate("",0);};
    topBar.appendChild(newBtn);

    var testScanBtn=document.createElement("button");
    testScanBtn.textContent="🧪";testScanBtn.title="Simuler un scan de barcode inconnu";
    testScanBtn.style.cssText="padding:6px 10px;border:none;border-radius:6px;background:#2a2a4e;color:#fff;font-size:20px;cursor:pointer;flex-shrink:0;";
    testScanBtn.onclick=function(){
      var testBc="TEST-"+Date.now()+"-"+Math.floor(Math.random()*9999);
      _processBarcode(testBc);
    };
    topBar.appendChild(testScanBtn);

    var closeBtn=document.createElement("button");
    closeBtn.textContent="✕ Factures";closeBtn.title="Fermer la caisse — accéder aux factures Flutter";
    closeBtn.style.cssText="padding:6px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:6px;background:transparent;color:#fff;font-size:15px;cursor:pointer;flex-shrink:0;white-space:nowrap;";
    closeBtn.onmouseenter=function(){this.style.background="rgba(255,255,255,0.1)";};
    closeBtn.onmouseleave=function(){this.style.background="transparent";};
    closeBtn.onclick=function(){_togglePOS(false);};
    topBar.appendChild(closeBtn);

    _pos.appendChild(topBar);

    // ── BODY: left (products) + right (cart) ──
    var body=document.createElement("div");
    body.style.cssText="flex:1;display:flex;overflow:hidden;";

    // LEFT PANEL
    var left=document.createElement("div");
    left.style.cssText="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:8px;";

    _posCats=document.createElement("div");
    _posCats.id="acim-pos-cats";
    _posCats.style.cssText="display:flex;gap:4px;padding:4px 0 8px;overflow-x:auto;flex-shrink:0;";
    _buildCatPills();
    left.appendChild(_posCats);

    _posGrid=document.createElement("div");
    _posGrid.id="acim-pos-grid";
    _posGrid.style.cssText="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;align-content:start;padding:4px 0;";
    left.appendChild(_posGrid);
    body.appendChild(left);

    // RIGHT PANEL — Cart
    var right=document.createElement("div");
    right.id="acim-pos-right";
    right.style.cssText="width:320px;display:flex;flex-direction:column;background:#fff;border-left:2px solid #e0e0e0;flex-shrink:0;";

    var cartHd=document.createElement("div");
    cartHd.style.cssText="padding:10px 14px;background:#1a1a2e;color:#fff;font-size:16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;";
    cartHd.innerHTML='<span>🛒 Ticket</span><span id="acim-pos-count">0 article</span>';
    right.appendChild(cartHd);

    _posItems=document.createElement("div");
    _posItems.id="acim-pos-items";
    _posItems.style.cssText="flex:1;overflow-y:auto;padding:4px 0;";
    right.appendChild(_posItems);

    var cartFoot=document.createElement("div");
    cartFoot.style.cssText="padding:10px 14px;border-top:2px solid #e65100;background:#fff3e0;flex-shrink:0;";

    // Discount row
    var discRow=document.createElement("div");
    discRow.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:15px;color:#666;";
    discRow.innerHTML='<span>Remise ticket</span>';
    var discBtn=document.createElement("button");
    discBtn.textContent="Appliquer";discBtn.style.cssText="padding:3px 8px;border:1px solid #e0e0e0;border-radius:4px;background:#fff;font-size:14px;cursor:pointer;";
    discBtn.onclick=function(){_applyTicketDiscount();};
    discRow.appendChild(discBtn);
    cartFoot.appendChild(discRow);

    var totalRow=document.createElement("div");
    totalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;";
    var totalLabel=document.createElement("span");
    totalLabel.style.cssText="font-size:17px;color:#1a1a2e;";totalLabel.textContent="Sous-total";
    _posSubtotal=document.createElement("span");
    _posSubtotal.style.cssText="font-size:17px;color:#666;";_posSubtotal.textContent="0,00 €";
    totalRow.appendChild(totalLabel);totalRow.appendChild(_posSubtotal);
    cartFoot.appendChild(totalRow);

    var discTotalRow=document.createElement("div");
    discTotalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;display:none;";
    discTotalRow.id="acim-disc-row";
    var discLabel=document.createElement("span");
    discLabel.style.cssText="font-size:15px;color:#2e7d32;";discLabel.textContent="Remise";
    _posDiscount=document.createElement("span");
    _posDiscount.style.cssText="font-size:15px;color:#2e7d32;font-weight:700;";_posDiscount.textContent="-0,00 €";
    discTotalRow.appendChild(discLabel);discTotalRow.appendChild(_posDiscount);
    cartFoot.appendChild(discTotalRow);

    var finalTotalRow=document.createElement("div");
    finalTotalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";
    var finalLabel=document.createElement("span");
    finalLabel.style.cssText="font-size:20px;font-weight:700;color:#1a1a2e;";finalLabel.textContent="TOTAL";
    _posTotal=document.createElement("span");
    _posTotal.id="acim-pos-total";
    _posTotal.style.cssText="font-size:28px;font-weight:700;color:#e65100;";_posTotal.textContent="0,00 €";
    finalTotalRow.appendChild(finalLabel);finalTotalRow.appendChild(_posTotal);
    cartFoot.appendChild(finalTotalRow);

    _posCheckout=document.createElement("button");
    _posCheckout.id="acim-pos-checkout";
    _posCheckout.textContent="💰 Encaisser";
    _posCheckout.style.cssText="width:100%;padding:14px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:20px;font-weight:700;cursor:pointer;transition:background .15s;";
    _posCheckout.onmouseenter=function(){this.style.background="#c43e00";};
    _posCheckout.onmouseleave=function(){this.style.background="#e65100";};
    _posCheckout.onclick=function(){_startPayment();};
    cartFoot.appendChild(_posCheckout);
    right.appendChild(cartFoot);

    body.appendChild(right);
    _pos.appendChild(body);
    document.body.appendChild(_pos);
  }

  var _posSubtotal,_posDiscount;

  function _buildCatPills(){
    _posCats.innerHTML="";
    var all=document.createElement("button");
    all.textContent="Tous";all.style.cssText="padding:5px 12px;border:2px solid #e65100;border-radius:16px;background:#fff3e0;font-size:15px;cursor:pointer;font-weight:700;flex-shrink:0;";
    all.onclick=function(){_activeCat="";_refreshCatPills();_filterProducts();};
    _posCats.appendChild(all);
    CATS.forEach(function(cat){
      var b=document.createElement("button");
      b.textContent=cat.ic+" "+cat.id;b.style.cssText="padding:5px 12px;border:2px solid #e0e0e0;border-radius:16px;background:#fff;font-size:15px;cursor:pointer;flex-shrink:0;transition:all .15s;";
      b.onmouseenter=function(){this.style.borderColor="#e65100";};
      b.onmouseleave=function(){this.style.borderColor=_activeCat===cat.id?"#e65100":"#e0e0e0";};
      b.onclick=function(){_activeCat=(_activeCat===cat.id)?"":cat.id;_refreshCatPills();_filterProducts();};
      _posCats.appendChild(b);
    });
  }
  function _refreshCatPills(){
    var btns=_posCats.querySelectorAll("button");
    btns[0].style.borderColor=_activeCat?"#e0e0e0":"#e65100";
    btns[0].style.background=_activeCat?"#fff":"#fff3e0";
    btns[0].style.fontWeight=_activeCat?"normal":"700";
    for(var i=1;i<btns.length;i++){
      var cid=CATS[i-1].id;
      btns[i].style.borderColor=_activeCat===cid?"#e65100":"#e0e0e0";
      btns[i].style.background=_activeCat===cid?"#fff3e0":"#fff";
      btns[i].style.fontWeight=_activeCat===cid?"700":"normal";
    }
  }

  function _filterProducts(){
    var q=(_posSearch.value||"").toLowerCase();
    _filteredProducts=_allProducts.filter(function(p){
      if(_activeCat&&(p.category||"")!==_activeCat)return false;
      if(q){var s=((p.name||"")+" "+(p.barcode||"")).toLowerCase();if(s.indexOf(q)<0)return false;}
      return true;
    });
    _filteredProducts.sort(function(a,b){return(a.name||"").localeCompare(b.name||"");});
    _renderGrid();
  }
  function _refreshAndFilter(){
    _dbGetAll().then(function(all){_allProducts=all||[];_filterProducts();});
  }

  function _renderGrid(){
    _posGrid.innerHTML="";
    if(_filteredProducts.length===0){
      _posGrid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;font-size:17px;">Aucun produit trouvé</div>';
      return;
    }
    _filteredProducts.forEach(function(p){
      var card=document.createElement("div");
      var hasPrice=p.sale_price_cents>0;
      var isWeighable=p.pricePerUnit>0&&p.unitType;
      card.style.cssText="position:relative;background:#fff;border-radius:10px;padding:10px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:2px solid "+(hasPrice||isWeighable?"transparent":"#ffe082")+";transition:all .15s;display:flex;flex-direction:column;align-items:center;text-align:center;";
      var _cardP=p,_cardHP=hasPrice,_cardW=isWeighable;
      card.onmouseenter=function(){this.style.boxShadow="0 3px 12px rgba(0,0,0,0.15)";this.style.borderColor="#e65100";};
      card.onmouseleave=function(){this.style.boxShadow="0 1px 3px rgba(0,0,0,0.08)";this.style.borderColor=(_cardHP||_cardW)?"transparent":"#ffe082";};

      var delBtn=document.createElement("span");
      delBtn.textContent="✕";delBtn.title="Supprimer ce produit";
      delBtn.style.cssText="position:absolute;top:2px;right:2px;font-size:18px;color:#c62828;cursor:pointer;opacity:1;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.95);z-index:5;border:1px solid #ffcdd2;box-shadow:0 1px 4px rgba(0,0,0,0.15);";
      delBtn.onclick=function(e){e.stopPropagation();_confirmDeleteProduct(_cardP);};
      card.appendChild(delBtn);

      var cat=(p.category||"autre").toLowerCase();
      var bg=_catBg[cat]||"#f5f5f5";
      var ic=document.createElement("div");
      ic.style.cssText="position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;overflow:hidden;border-radius:8px;background:"+bg+";flex-shrink:0;";
      var icBg=document.createElement("div");
      icBg.style.cssText="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:8px;background:"+bg+";";
      icBg.innerHTML='<span style="opacity:0.5;font-size:28px">'+_catIcon(cat)+'</span>';
      ic.appendChild(icBg);
      var icImg=document.createElement("img");
      icImg.style.cssText="position:absolute;inset:0;width:64px;height:64px;object-fit:contain;border-radius:6px;display:none;background:"+bg+";";
      ic.appendChild(icImg);
      (function(bc,im,bgEl){
        _getCachedImage(bc).then(function(url){
          if(url){im.src=url;im.style.display="block";bgEl.style.display="none";}
          else _enqueueImage(bc,function(url){if(url){im.src=url;im.style.display="block";bgEl.style.display="none";}});
        });
      })(p.barcode,icImg,icBg);
      var ub=document.createElement("button");
      ub.innerHTML='<span style="opacity:0.7">📷</span>';ub.title="Ajouter / changer la photo";
      ub.style.cssText="position:absolute;bottom:0;right:0;width:20px;height:20px;border:none;border-radius:4px 0 6px 0;background:rgba(0,0,0,0.35);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;z-index:1;";
      ub.onclick=function(e){
        e.stopPropagation();
        var inp=document.createElement("input");inp.type="file";inp.accept="image/*";
        inp.onchange=function(ev){
          var f=ev.target.files[0];if(!f)return;
          var rd=new FileReader();
          rd.onload=function(ev2){
            var du=ev2.target.result;
            _cacheImage(p.barcode,du);
            icImg.src=du;icImg.style.display="block";icBg.style.display="none";
          };
          rd.readAsDataURL(f);
        };
        inp.click();
      };
      ic.appendChild(ub);
      card.appendChild(ic);

      var nm=document.createElement("div");
      nm.style.cssText="font-size:15px;font-weight:600;color:#1a1a2e;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;";
      nm.textContent=p.name||"?";card.appendChild(nm);

      if(isWeighable){
        var badge=document.createElement("div");
        badge.style.cssText="font-size:13px;color:#fff;background:#2196f3;border-radius:8px;padding:2px 6px;margin-top:4px;font-weight:600;";
        badge.textContent="⚖️ Au poids";card.appendChild(badge);
        var ppu=document.createElement("div");
        ppu.style.cssText="font-size:16px;font-weight:700;color:#e65100;margin-top:4px;";
        ppu.textContent=_formatPricePerUnit(p.pricePerUnit,p.unitType);card.appendChild(ppu);
      }else if(hasPrice){
        var pr=document.createElement("div");
        pr.style.cssText="font-size:20px;font-weight:700;color:#e65100;margin-top:4px;";
        pr.textContent=(p.sale_price_cents/100).toFixed(2)+"€";card.appendChild(pr);
      }else{
        var noPr=document.createElement("div");
        noPr.style.cssText="font-size:14px;color:#e65100;margin-top:4px;font-weight:600;";
        noPr.textContent="✏️ Sans prix";card.appendChild(noPr);
      }

      // Stock badge
      if(p.stockQty!=null&&p.stockQty!==0){
        var threshold=p.low_stock_threshold||5;
        var isLow=p.stockQty<=threshold;
        var isExpired=p.expiry_date&&new Date(p.expiry_date)<new Date();
        var stBadge=document.createElement("div");
        var stColor=isExpired?"#c62828":isLow?"#e65100":"#666";
        stBadge.style.cssText="font-size:13px;color:"+stColor+";margin-top:2px;font-weight:"+(isLow||isExpired?"700":"normal")+";";
        stBadge.textContent=(isExpired?"⚠️ Périmé!":isLow?"⚠️ Stock bas!":"Stock: ")+p.stockQty;
        if(isExpired&&p.expiry_date)stBadge.textContent+=" (DLC: "+p.expiry_date+")";
        card.appendChild(stBadge);
      }

      card.onclick=function(){
        if(isWeighable){_weighProduct(p);}
        else if(hasPrice){_addToCart(p.name,p.sale_price_cents,p.barcode,p.category);_toast("✅ "+p.name);}
        else{_addToCart(p.name,0,p.barcode,p.category);_toast("✏️ "+p.name+" — cliquez dans le ticket pour le prix");}
      };
      _posGrid.appendChild(card);
    });
  }

  function _renderCart(){
    var info=_cartInfo();var subtotal=_cartSubtotal();var total=_cartTotal();
    document.getElementById("acim-pos-count").textContent=info.length+" article"+(info.length!==1?"s":"");
    _posSubtotal.textContent=(subtotal/100).toFixed(2).replace(".",",")+" €";
    _posTotal.textContent=(total/100).toFixed(2).replace(".",",")+" €";
    var discRow=document.getElementById("acim-disc-row");
    if(_cartDiscountCents>0){
      discRow.style.display="flex";
      _posDiscount.textContent="-"+(_cartDiscountCents/100).toFixed(2).replace(".",",")+" €";
    }else{discRow.style.display="none";}

    _posItems.innerHTML="";
    if(info.length===0){
      _posItems.innerHTML='<div style="text-align:center;padding:40px;color:#999;font-size:16px;">Aucun produit dans le ticket</div>';
      _posCheckout.textContent="💰 Encaisser (0,00 €)";
      _posCheckout.style.opacity="0.5";
      return;
    }
    _posCheckout.textContent="💰 Encaisser "+(total/100).toFixed(2).replace(".",",")+" €";
    _posCheckout.style.opacity="1";
    info.forEach(function(item){
      var row=document.createElement("div");
      var isZero=item.price===0;
      var isWeighed=_isWeightProduct(item);
      row.style.cssText="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid #f0f0f0;transition:background .15s;cursor:pointer;";
      row.onclick=function(){_inlineEdit(item.idx,50,50);};
      row.onmouseenter=function(){this.style.background="#fafafa";};
      row.onmouseleave=function(){this.style.background="transparent";};

      var icon=document.createElement("span");
      icon.textContent=isWeighed?"⚖️":_catIcon(item.cat||"autre");
      icon.style.cssText="font-size:16px;margin-right:8px;flex-shrink:0;";
      row.appendChild(icon);

      var infoDiv=document.createElement("div");
      infoDiv.style.cssText="flex:1;min-width:0;";
      var nm=document.createElement("div");
      nm.style.cssText="font-size:15px;font-weight:600;color:"+(isZero?"#e65100":"#1a1a2e")+";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      nm.textContent=isZero?"✏️ "+item.name:item.name;
      infoDiv.appendChild(nm);

      if(isWeighed&&item.weight!=null){
        var wLine=document.createElement("div");
        wLine.style.cssText="font-size:14px;color:#666;";
        wLine.textContent=_formatWeight(item.weight,item.unitType)+" × "+_formatPricePerUnit(item.pricePerUnit,item.unitType);
        infoDiv.appendChild(wLine);
      }

      if(item.price>0){
        var pr=document.createElement("div");
        pr.style.cssText="font-size:16px;font-weight:700;color:#e65100;";
        pr.textContent=(item.price/100).toFixed(2).replace(".",",")+" €";
        infoDiv.appendChild(pr);
      }
      row.appendChild(infoDiv);

      // Action buttons
      var actions=document.createElement("div");
      actions.style.cssText="display:flex;gap:2px;flex-shrink:0;margin-left:6px;";

      var dupBtn=document.createElement("span");
      dupBtn.textContent="⟳";dupBtn.title="Ajouter encore";
      dupBtn.style.cssText="font-size:16px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#1a1a2e;opacity:0.4;";
      dupBtn.onmouseenter=function(){this.style.opacity="1";this.style.background="#f0f0f0";};
      dupBtn.onmouseleave=function(){this.style.opacity="0.4";this.style.background="transparent";};
      dupBtn.onclick=function(e){e.stopPropagation();_addToCart(item.name,item.price,item.bc,item.cat,item.weight,item.unitType,item.pricePerUnit);};
      actions.appendChild(dupBtn);

      var editBtn=document.createElement("span");
      editBtn.textContent="✏️";editBtn.title="Modifier";
      editBtn.style.cssText="font-size:15px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#1a1a2e;opacity:0.4;";
      editBtn.onmouseenter=function(){this.style.opacity="1";this.style.background="#f0f0f0";};
      editBtn.onmouseleave=function(){this.style.opacity="0.4";this.style.background="transparent";};
      editBtn.onclick=function(e){e.stopPropagation();_inlineEdit(item.idx,50,50);};
      actions.appendChild(editBtn);

      var delBtn=document.createElement("span");
      delBtn.textContent="✕";delBtn.title="Supprimer";
      delBtn.style.cssText="font-size:16px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#c62828;opacity:0.4;";
      delBtn.onmouseenter=function(){this.style.opacity="1";this.style.background="#ffebee";};
      delBtn.onmouseleave=function(){this.style.opacity="0.4";this.style.background="transparent";};
      delBtn.onclick=function(e){e.stopPropagation();_removeFromCart(item.idx);_toast("Supprimé");};
      actions.appendChild(delBtn);

      row.appendChild(actions);
      _posItems.appendChild(row);
    });
  }

  function _renderPOS(){
    if(!_pos)return;
    _filterProducts();
    _renderCart();
    _broadcastCart();
  }

  // ─── SCANNER BUFFER ──────────────────────────────────
  var _scanBuf="",_scanTimer=null,_scanning=false;
  document.addEventListener("keydown",function(e){
    // Scan toujours prioritaire, quel que soit le focus
    if(/^[0-9]$/.test(e.key)){
      _scanning=true;
      _scanBuf+=e.key;
      if(_pos&&_pos.style.display!=="none"&&_posSearch){
        _posSearch.value=_scanBuf;
        _filterProducts();
      }
      clearTimeout(_scanTimer);_scanTimer=setTimeout(function(){
        var bc=_scanBuf;
        _scanning=false;
        if(bc.length>=4){
          if(_pos&&_pos.style.display!=="none"&&_posSearch)_posSearch.value="";
          _processBarcode(bc);
          if(!_pos||_pos.style.display==="none")_togglePOS(true);
        }else{
          if(_pos&&_pos.style.display!=="none"&&_posSearch)_posSearch.value="";
        }
        _scanBuf="";
      },150);
    }
    if(/^[a-zA-ZÀ-ÿ]$/.test(e.key)){
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if(!_pos||_pos.style.display==="none")_togglePOS(true);
      if(_posSearch){
        _posSearch.value+=e.key;
        _posSearch.focus();
        _filterProducts();
      }
    }
    if(e.key==="Backspace"&&_posSearch&&_posSearch.value.length>0){
      var tag2=document.activeElement?document.activeElement.tagName:"";
      if(tag2!=="INPUT"&&tag2!=="TEXTAREA"){
        _posSearch.value=_posSearch.value.slice(0,-1);
        _filterProducts();
        e.preventDefault();
      }
    }
    if(e.key==="Escape"&&_posSearch){
      _posSearch.value="";_filterProducts();_posSearch.blur();
    }
  },true);

  // ─── PROCESS BARCODE ─────────────────────────────────
  function _processBarcode(bc){
    _log("Scanner: "+bc);
    try{document.dispatchEvent(new CustomEvent("acim:scan",{detail:{barcode:bc}}));}catch(e){}
    _dbGet(bc).then(function(local){
      if(local&&local.pricePerUnit>0&&local.unitType){
        _weighProduct({name:local.name,barcode:bc,category:local.category,pricePerUnit:local.pricePerUnit,unitType:local.unitType,sale_price_cents:local.sale_price_cents});
        return;
      }
      if(local&&local.sale_price_cents>0){
        _addToCart(local.name,local.sale_price_cents,bc,local.category);
        _toast("✅ "+local.name+" "+(local.sale_price_cents/100).toFixed(2)+"€");return;
      }
      if(local&&local.name){
        _addToCart(local.name,0,bc,local.category);
        _toast("✏️ "+local.name+" — cliquez dans le ticket pour le prix");return;
      }
      _quickCreate("",0,bc,"");
      _toast("🆕 Nouveau produit — code: "+bc);
    });
  }

  // ─────────────────────────────────────────────────────
  //  PAIEMENT — flux complet Espèces / CB / Mixte
  // ─────────────────────────────────────────────────────
  function _startPayment(){
    if(_myCart.length===0){_toast("Panier vide");return;}
    var subtotal=_cartSubtotal();
    var total=_cartTotal();
    if(total<=0){_toast("Total à 0€");return;}
    var old=document.getElementById("acim-payment");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-payment";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";

    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;text-align:center;";
    ti.textContent="💰 Paiement";card.appendChild(ti);
    var totalLine=document.createElement("div");
    totalLine.style.cssText="font-size:36px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;";
    totalLine.textContent=(total/100).toFixed(2).replace(".",",")+" €";card.appendChild(totalLine);

    // Mode selector
    var modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:6px;margin-bottom:16px;";
    var modes=[{id:"especes",label:"💵 Espèces"},{id:"cb",label:"💳 CB"},{id:"mixte",label:"🔀 Mixte"}];
    var selectedMode="especes";
    var modeBtns=[];
    modes.forEach(function(m){
      var b=document.createElement("button");b.textContent=m.label;
      b.style.cssText="flex:1;padding:12px;border:2px solid "+(m.id==="especes"?"#e65100":"#e0e0e0")+";border-radius:8px;background:"+(m.id==="especes"?"#fff3e0":"#fff")+";font-size:16px;cursor:pointer;font-weight:"+(m.id==="especes"?"700":"normal")+";";
      b.onclick=function(){
        selectedMode=m.id;
        modeBtns.forEach(function(x,i){x.style.borderColor=modes[i].id===m.id?"#e65100":"#e0e0e0";x.style.background=modes[i].id===m.id?"#fff3e0":"#fff";x.style.fontWeight=modes[i].id===m.id?"700":"normal";});
        _updatePaymentFields();
      };
      modeBtns.push(b);modeRow.appendChild(b);
    });
    card.appendChild(modeRow);

    // Cash section
    var cashSection=document.createElement("div");cashSection.id="acim-cash-section";
    var cashLabel=document.createElement("div");cashLabel.style.cssText="font-size:15px;color:#666;margin-bottom:4px;";
    cashLabel.textContent="Montant reçu:";cashSection.appendChild(cashLabel);
    var cashInput=document.createElement("input");cashInput.type="number";cashInput.step="0.01";cashInput.min="0";
    cashInput.placeholder="0,00";cashInput.style.cssText="width:100%;font-size:28px;font-weight:700;padding:12px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;box-sizing:border-box;";
    cashInput.onfocus=function(){this.select();};
    cashSection.appendChild(cashInput);

    // Quick buttons
    var quickRow=document.createElement("div");quickRow.style.cssText="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;";
    var quickAmounts=[{label:"Exact",val:total},{label:"5€",val:500},{label:"10€",val:1000},{label:"20€",val:2000},{label:"50€",val:5000},{label:"100€",val:10000}];
    quickAmounts.forEach(function(qa){
      var qb=document.createElement("button");qb.textContent=qa.label;
      qb.style.cssText="padding:8px 12px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:15px;cursor:pointer;";
      qb.onclick=function(){cashInput.value=(qa.val/100).toFixed(2);_updateChange();};
      quickRow.appendChild(qb);
    });
    cashSection.appendChild(quickRow);
    card.appendChild(cashSection);

    // Change display
    var changeLine=document.createElement("div");changeLine.style.cssText="font-size:20px;font-weight:700;color:#2e7d32;text-align:center;margin:12px 0;min-height:24px;";
    changeLine.id="acim-change-line";card.appendChild(changeLine);

    // Split section (hidden by default)
    var splitSection=document.createElement("div");splitSection.id="acim-split-section";splitSection.style.cssText="display:none;";
    var splitLabel=document.createElement("div");splitLabel.style.cssText="font-size:15px;color:#666;margin-bottom:4px;";
    splitLabel.textContent="Part espèces:";splitSection.appendChild(splitLabel);
    var splitInput=document.createElement("input");splitInput.type="number";splitInput.step="0.01";splitInput.min="0";
    splitInput.placeholder="0,00";splitInput.style.cssText="width:100%;font-size:22px;font-weight:700;padding:10px;border:3px solid #e0e0e0;border-radius:8px;outline:none;text-align:center;box-sizing:border-box;";
    splitSection.appendChild(splitInput);
    var splitRemainder=document.createElement("div");splitRemainder.style.cssText="font-size:17px;color:#1565c0;text-align:center;margin-top:6px;min-height:20px;";
    splitSection.appendChild(splitRemainder);
    card.appendChild(splitSection);

    // Error line
    var errorLine=document.createElement("div");errorLine.style.cssText="font-size:16px;color:#c62828;text-align:center;min-height:20px;margin-bottom:8px;";
    card.appendChild(errorLine);

    function _updatePaymentFields(){
      cashSection.style.display=selectedMode==="especes"?"block":"none";
      splitSection.style.display=selectedMode==="mixte"?"block":"none";
      changeLine.textContent="";
      errorLine.textContent="";
      if(selectedMode==="especes"){cashInput.focus();}
      else if(selectedMode==="cb"){cashInput.value="";}
      else if(selectedMode==="mixte"){splitInput.focus();}
    }
    function _updateChange(){
      if(selectedMode!=="especes")return;
      var received=parseFloat(cashInput.value)||0;
      var receivedCents=Math.round(received*100);
      var change=receivedCents-total;
      if(receivedCents>=total){
        changeLine.style.color="#2e7d32";
        changeLine.textContent="Monnaie: "+(change/100).toFixed(2).replace(".",",")+" €";
      }else{
        changeLine.style.color="#c62828";
        changeLine.textContent="Manque: "+((total-receivedCents)/100).toFixed(2).replace(".",",")+" €";
      }
    }
    cashInput.addEventListener("input",_updateChange);
    splitInput.addEventListener("input",function(){
      var partCash=parseFloat(splitInput.value)||0;
      var partCashCents=Math.round(partCash*100);
      var remainder=total-partCashCents;
      if(remainder>=0){
        splitRemainder.textContent="Reste CB: "+(remainder/100).toFixed(2).replace(".",",")+" €";
        splitRemainder.style.color="#1565c0";
      }else{
        splitRemainder.textContent="Trop!";
        splitRemainder.style.color="#c62828";
      }
    });

    // Buttons
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Valider le paiement";
    bOk.style.cssText="flex:2;padding:12px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var payments=[];
      if(selectedMode==="especes"){
        var received=parseFloat(cashInput.value)||0;
        var receivedCents=Math.round(received*100);
        if(receivedCents<total){errorLine.textContent="Montant reçu insuffisant!";return;}
        payments.push({method:"especes",amountCents:total,tenderedCents:receivedCents,changeCents:receivedCents-total});
      }else if(selectedMode==="cb"){
        payments.push({method:"cb",amountCents:total,tenderedCents:total,changeCents:0});
      }else if(selectedMode==="mixte"){
        var partCash=parseFloat(splitInput.value)||0;
        var partCashCents=Math.round(partCash*100);
        var remainder=total-partCashCents;
        if(partCashCents<0||remainder<0){errorLine.textContent="Montant invalide!";return;}
        if(partCashCents>0)payments.push({method:"especes",amountCents:partCashCents,tenderedCents:partCashCents,changeCents:0});
        if(remainder>0)payments.push({method:"cb",amountCents:remainder,tenderedCents:remainder,changeCents:0});
      }
      ov.remove();
      _finalizeSale(payments);
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){if(selectedMode==="especes")cashInput.focus();},100);
  }

  function _finalizeSale(payments){
    var total=_cartTotal();
    var ticketNum=_nextTicket();
    _saveTicketSeq();
    var saleItems=_myCart.slice();
    _persistSale(ticketNum,saleItems,total,_cartDiscountCents,payments).then(function(){
      // Decrement stock
      for(var i=0;i<saleItems.length;i++){
        var it=saleItems[i];
        if(it.bc)_decrementStock(it.bc,it.qty||1);
      }
      // Show receipt
      _showReceipt(ticketNum,saleItems,total,_cartDiscountCents,payments);
      _broadcastClear();
      _myCart=[];_realBcMap={};_cartDiscountCents=0;
      _renderPOS();
    });
  }

  // ─── RECEIPT ─────────────────────────────────────────
  function _showReceipt(ticketNum,items,total,discountCents,payments){
    var old=document.getElementById("acim-receipt");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-receipt";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var receipt=document.createElement("div");
    receipt.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:'Courier New',monospace;font-size:13px;";
    var html=[];
    html.push('<div class="r-header">'+(_settings.storeName||'Magasin')+'</div>');
    html.push('<div class="r-sub">Ticket n°'+ticketNum+' &nbsp;|&nbsp; '+new Date().toLocaleDateString("fr-FR")+' '+new Date().toLocaleTimeString("fr-FR",{hour:'2-digit',minute:'2-digit'})+'</div>');
    html.push('<div class="r-div"></div>');
    items.forEach(function(it){
      var line=it.name||"?";
      if(it.qty&&it.qty>1)line=it.qty+"× "+line;
      html.push('<div class="r-line"><span>'+line+'</span><span class="r-price">'+((it.priceCents||it.price||0)/100).toFixed(2).replace(".",",")+'</span></div>');
    });
    html.push('<div class="r-div"></div>');
    if(discountCents>0){
      html.push('<div class="r-line" style="color:#2e7d32;"><span>Remise</span><span class="r-price">-'+(discountCents/100).toFixed(2).replace(".",",")+'</span></div>');
    }
    html.push('<div class="r-total"><span>TOTAL</span><span class="r-price">'+(total/100).toFixed(2).replace(".",",")+'</span></div>');
    if(payments&&payments.length>0){
      html.push('<div class="r-div"></div>');
      payments.forEach(function(pay){
        var label=pay.method==="especes"?"Espèces":pay.method==="cb"?"Carte":"Mixte";
        html.push('<div class="r-line"><span>'+label+'</span><span class="r-price">'+(pay.amountCents/100).toFixed(2).replace(".",",")+'</span></div>');
        if(pay.changeCents>0){
          html.push('<div class="r-line" style="color:#2e7d32;"><span>Rendu</span><span class="r-price">'+(pay.changeCents/100).toFixed(2).replace(".",",")+'</span></div>');
        }
      });
    }
    html.push('<div class="r-div"></div>');
    html.push('<div class="r-footer">'+(_settings.footer||'')+'</div>');
    receipt.innerHTML=html.join("");
    var btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bPrint=document.createElement("button");bPrint.textContent="🖨️ Imprimer";
    bPrint.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#1a1a2e;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bPrint.onclick=function(){
      // Store receipt HTML for print
      var pr=document.getElementById("acim-print-receipt");
      if(!pr){
        pr=document.createElement("div");pr.id="acim-print-receipt";
        document.body.appendChild(pr);
      }
      pr.innerHTML=_buildPrintReceipt(ticketNum,items,total,discountCents,payments);
      window.print();
    };
    btnRow.appendChild(bClose);btnRow.appendChild(bPrint);
    receipt.appendChild(btnRow);
    ov.appendChild(receipt);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  function _buildPrintReceipt(ticketNum,items,total,discountCents,payments){
    var store=_settings.storeName||"Magasin";
    var footer=_settings.footer||"";
    var lines=[];
    lines.push('<div class="r-header">'+store+'</div>');
    lines.push('<div class="r-sub">Ticket n°'+ticketNum+' &nbsp;|&nbsp; '+new Date().toLocaleDateString("fr-FR")+' '+new Date().toLocaleTimeString("fr-FR",{hour:'2-digit',minute:'2-digit'})+'</div>');
    lines.push('<div class="r-div"></div>');
    items.forEach(function(it){
      var line=it.name||"?";
      if(it.qty&&it.qty>1)line=it.qty+"× "+line;
      lines.push('<div class="r-line"><span>'+line+'</span><span class="r-price">'+((it.priceCents||it.price||0)/100).toFixed(2).replace(".",",")+'</span></div>');
    });
    lines.push('<div class="r-div"></div>');
    if(discountCents>0){
      lines.push('<div class="r-line" style="color:#2e7d32;"><span>Remise</span><span class="r-price">-'+(discountCents/100).toFixed(2).replace(".",",")+'</span></div>');
    }
    lines.push('<div class="r-total"><span>TOTAL</span><span class="r-price">'+(total/100).toFixed(2).replace(".",",")+'</span></div>');
    if(payments&&payments.length>0){
      lines.push('<div class="r-div"></div>');
      payments.forEach(function(pay){
        var label=pay.method==="especes"?"Espèces":pay.method==="cb"?"Carte":"Mixte";
        lines.push('<div class="r-line"><span>'+label+'</span><span class="r-price">'+(pay.amountCents/100).toFixed(2).replace(".",",")+'</span></div>');
        if(pay.changeCents>0){
          lines.push('<div class="r-line" style="color:#2e7d32;"><span>Rendu</span><span class="r-price">'+(pay.changeCents/100).toFixed(2).replace(".",",")+'</span></div>');
        }
      });
    }
    lines.push('<div class="r-div"></div>');
    lines.push('<div class="r-footer">'+footer+'</div>');
    return lines.join("")+_getPrintStyles();
  }
  function _getPrintStyles(){
    return '<style>'
      +'@page{size:80mm auto;margin:0;}'
      +'@media print{'
      +'body *{visibility:hidden;}'
      +'#acim-print-receipt,#acim-print-receipt *{visibility:visible;}'
      +'#acim-print-receipt{position:fixed;top:0;left:0;width:80mm;padding:2mm 3mm;font-family:"Courier New",monospace;font-size:3.2mm;color:#000;background:#fff;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'
      +'.r-header{font-size:4mm;font-weight:700;text-align:center;margin-bottom:2mm;}'
      +'.r-sub{font-size:2.8mm;text-align:center;color:#333;margin-bottom:2mm;}'
      +'.r-div{border-top:0.3mm dashed #000;margin:1.5mm 0;}'
      +'.r-line{display:flex;justify-content:space-between;font-size:3mm;margin:0.5mm 0;}'
      +'.r-price{font-weight:700;white-space:nowrap;}'
      +'.r-total{display:flex;justify-content:space-between;font-weight:700;font-size:4mm;margin-top:1.5mm;}'
      +'.r-footer{text-align:center;font-size:2.5mm;color:#555;margin-top:2mm;}'
      +'}</style>';
  }

  // ─── WEIGH PRODUCT MODAL ─────────────────────────────
  function _weighProduct(product){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-weigh";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="⚖️ Peser — "+product.name;card.appendChild(ti);
    var unitLabel=document.createElement("div");
    unitLabel.style.cssText="font-size:16px;color:#666;margin-bottom:12px;";
    unitLabel.textContent="Prix unitaire: "+_formatPricePerUnit(product.pricePerUnit,product.unitType);
    card.appendChild(unitLabel);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:12px;";
    var wi=document.createElement("input");wi.type="number";wi.step="0.001";wi.min="0";
    wi.placeholder="Poids";wi.style.cssText="flex:1;font-size:28px;font-weight:700;padding:12px 14px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;";
    wi.onfocus=function(){this.select();};
    var unitSpan=document.createElement("span");
    unitSpan.style.cssText="font-size:22px;font-weight:700;color:#e65100;min-width:40px;";
    unitSpan.textContent=product.unitType||"kg";
    row.appendChild(wi);row.appendChild(unitSpan);card.appendChild(row);

    var pricePreview=document.createElement("div");
    pricePreview.style.cssText="font-size:36px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;min-height:40px;";
    pricePreview.textContent="0,00 €";
    card.appendChild(pricePreview);

    wi.addEventListener("input",function(){
      var w=parseFloat(wi.value);
      if(isNaN(w)||w<=0){pricePreview.textContent="0,00 €";return;}
      var total=_calcWeightPrice(w,product.unitType,product.pricePerUnit);
      pricePreview.textContent=(total/100).toFixed(2).replace(".",",")+" €";
    });

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Ajouter au ticket";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var w=parseFloat(wi.value);
      if(isNaN(w)||w<=0){wi.style.borderColor="#c62828";wi.focus();return;}
      var total=_calcWeightPrice(w,product.unitType,product.pricePerUnit);
      var displayName=product.name+" "+_formatWeight(w,product.unitType);
      _addToCart(displayName,total,product.barcode,product.category,w,product.unitType,product.pricePerUnit);
      ov.remove();_toast("✅ "+displayName+" = "+(total/100).toFixed(2)+"€");
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){wi.focus();},100);
  }

  // ─── TICKET DISCOUNT ─────────────────────────────────
  function _applyTicketDiscount(){
    if(_myCart.length===0){_toast("Panier vide");return;}
    var old=document.getElementById("acim-disc-dialog");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-disc-dialog";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:300px;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="🏷️ Remise sur ticket";card.appendChild(ti);
    var subtotal=_cartSubtotal();
    var info=document.createElement("div");info.style.cssText="font-size:12px;color:#666;margin-bottom:8px;";
    info.textContent="Sous-total: "+(subtotal/100).toFixed(2).replace(".",",")+" €";card.appendChild(info);

    // % or € toggle
    var modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:6px;margin-bottom:8px;";
    var pctBtn=document.createElement("button");pctBtn.textContent="%";
    pctBtn.style.cssText="flex:1;padding:6px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-weight:700;cursor:pointer;";
    var eurBtn=document.createElement("button");eurBtn.textContent="€";
    eurBtn.style.cssText="flex:1;padding:6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;cursor:pointer;";
    var modeIsPct=true;
    pctBtn.onclick=function(){modeIsPct=true;pctBtn.style.borderColor="#e65100";pctBtn.style.background="#fff3e0";pctBtn.style.fontWeight="700";eurBtn.style.borderColor="#e0e0e0";eurBtn.style.background="#fff";eurBtn.style.fontWeight="normal";};
    eurBtn.onclick=function(){modeIsPct=false;eurBtn.style.borderColor="#e65100";eurBtn.style.background="#fff3e0";eurBtn.style.fontWeight="700";pctBtn.style.borderColor="#e0e0e0";pctBtn.style.background="#fff";pctBtn.style.fontWeight="normal";};
    modeRow.appendChild(pctBtn);modeRow.appendChild(eurBtn);card.appendChild(modeRow);

    var valInput=document.createElement("input");valInput.type="number";valInput.step="0.01";valInput.min="0";
    valInput.placeholder="Montant";valInput.style.cssText="width:100%;font-size:18px;font-weight:700;padding:10px;border:3px solid #e65100;border-radius:8px;outline:none;text-align:center;box-sizing:border-box;margin-bottom:8px;";
    card.appendChild(valInput);
    var preview=document.createElement("div");preview.style.cssText="font-size:13px;color:#2e7d32;text-align:center;min-height:20px;margin-bottom:8px;";
    card.appendChild(preview);
    valInput.addEventListener("input",function(){
      var v=parseFloat(valInput.value)||0;
      if(modeIsPct){
        var disc=Math.round(subtotal*v/100);
        preview.textContent="Remise: -"+(disc/100).toFixed(2).replace(".",",")+" €";
      }else{
        var disc=Math.round(v*100);
        if(disc>subtotal)disc=subtotal;
        preview.textContent="Remise: -"+(disc/100).toFixed(2).replace(".",",")+" €";
      }
    });
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:8px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓ Appliquer";
    bOk.style.cssText="flex:1;padding:8px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var v=parseFloat(valInput.value)||0;
      if(v<=0){valInput.style.borderColor="#c62828";return;}
      if(modeIsPct){_cartDiscountCents=Math.round(subtotal*v/100);}
      else{_cartDiscountCents=Math.round(v*100);if(_cartDiscountCents>subtotal)_cartDiscountCents=subtotal;}
      ov.remove();_renderPOS();
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){valInput.focus();},100);
  }

  // ─── MAIN MENU (history, settings, invoices, barcodes) ──
  function _showMainMenu(){
    var old=document.getElementById("acim-menu");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-menu";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:16px;color:#1a1a2e;text-align:center;";
    ti.textContent="🏪 Menu";card.appendChild(ti);

    var btns=[
      {label:"📋 Historique des ventes",fn:function(){ov.remove();_showHistory();}},
      {label:"📊 Rapport de fin de journée",fn:function(){ov.remove();_showDayReport();}},
      {label:"↩️ Annuler la dernière vente",fn:function(){ov.remove();_undoLastSale();}},
      {label:"🔍 Vérifier / Nettoyer le catalogue",fn:function(){ov.remove();_showProductAudit();}},
      {label:"📄 Importer facture fournisseur",fn:function(){ov.remove();_showInvoiceImport();}},
      {label:"📒 Catalogue fournisseur",fn:function(){ov.remove();_showSupplierCatalog();}},
      {label:"🏷️ Imprimer codes-barres",fn:function(){window.open("barcode.html","_blank");}},
      {label:"📤 Exporter mes données",fn:function(){ov.remove();_showExportDialog();}},
      {label:"📦 Réinitialiser depuis un JSON maître",fn:function(){ov.remove();_showResetFromJson();}},
      {label:"📥 Importer des données (JSON)",fn:function(){ov.remove();_showImportDialog();}},
      {label:"🖥️ Écran client (2e écran)",fn:function(){window.open("customer-display.html","_blank");}},
      {label:"⬇️ Télécharger la version bureau (.exe)",fn:function(){window.open("https://github.com/aveca/AcimCaisse/releases/latest","_blank");}},
      {label:"🔄 Migrer depuis l'ancienne version",fn:function(){window.open("migration.html","_blank");}},
      {label:"⚙️ Paramètres",fn:function(){ov.remove();_showSettings();}},
    ];
    btns.forEach(function(b){
      var btn=document.createElement("button");btn.textContent=b.label;
      btn.style.cssText="width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;text-align:left;margin-bottom:8px;";
      btn.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
      btn.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
      btn.onclick=b.fn;card.appendChild(btn);
    });
    var bClose=document.createElement("button");bClose.textContent="✕ Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:none;border-radius:8px;background:#f5f5f5;font-size:16px;cursor:pointer;margin-top:4px;";
    bClose.onclick=function(){ov.remove();};card.appendChild(bClose);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── HISTORY ─────────────────────────────────────────
  function _showHistory(){
    var old=document.getElementById("acim-history");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-history";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:500px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📋 Historique des ventes";card.appendChild(ti);

    var listDiv=document.createElement("div");listDiv.style.cssText="max-height:50vh;overflow-y:auto;";
    listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Chargement...</div>';
    card.appendChild(listDiv);

    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};card.appendChild(bClose);

    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    _getSalesHistory().then(function(sales){
      listDiv.innerHTML="";
      if(sales.length===0){listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Aucune vente enregistrée</div>';return;}
      sales.sort(function(a,b){return(b.timestamp||0)-(a.timestamp||0);});
      sales.forEach(function(s){
        var row=document.createElement("div");
        row.style.cssText="padding:8px;border-bottom:1px solid #f0f0f0;cursor:pointer;";
        row.onmouseenter=function(){this.style.background="#fafafa";};
        row.onmouseleave=function(){this.style.background="transparent";};
        var date=new Date(s.timestamp);
        row.innerHTML='<div style="display:flex;justify-content:space-between;"><span style="font-weight:700;">Ticket #'+(s.ticketNumber||"?")+'</span><span style="font-weight:700;color:#e65100;">'+(s.totalCents/100).toFixed(2).replace(".",",")+' €</span></div>'
          +'<div style="font-size:11px;color:#666;">'+date.toLocaleDateString("fr-FR")+" "+date.toLocaleTimeString("fr-FR")+' — '+(s.itemCount||0)+' article(s)</div>';
        if(s.discountCents>0)row.innerHTML+='<div style="font-size:11px;color:#2e7d32;">Remise: -'+(s.discountCents/100).toFixed(2).replace(".",",")+' €</div>';
        if(s.payments&&s.payments.length>0){
          var payLines=s.payments.map(function(p){return(p.method==="especes"?"💵":"💳")+" "+(p.amountCents/100).toFixed(2).replace(".",",")+"€";}).join(" + ");
          row.innerHTML+='<div style="font-size:11px;color:#666;">'+payLines+'</div>';
        }
        row.onclick=function(){_showReceipt(s.ticketNumber||0,s.items||[],s.totalCents||0,s.discountCents||0,s.payments||[]);};
        listDiv.appendChild(row);
      });
      // Show total
      var totalSales=sales.reduce(function(sum,s){return sum+(s.totalCents||0);},0);
      var totalDiv=document.createElement("div");
      totalDiv.style.cssText="padding:10px;border-top:2px solid #e65100;font-weight:700;font-size:14px;display:flex;justify-content:space-between;";
      totalDiv.innerHTML='<span>Total général ('+sales.length+' ventes)</span><span style="color:#e65100;">'+(totalSales/100).toFixed(2).replace(".",",")+' €</span>';
      listDiv.appendChild(totalDiv);
    });
  }

  // ─── INVOICE IMPORT ──────────────────────────────────
  function _showInvoiceImport(){
    var old=document.getElementById("acim-invoice");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-invoice";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📄 Importer une facture fournisseur";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:12px;";
    desc.textContent="Sélectionnez un fichier PDF de facture fournisseur. Le texte sera extrait (OCR si nécessaire) puis vérifiable avant import.";
    card.appendChild(desc);

    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".pdf,.json";fileInput.multiple=true;
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);

    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);

    // Preview area for extracted text
    var previewArea=document.createElement("div");previewArea.style.cssText="display:none;margin-bottom:12px;";
    var previewLabel=document.createElement("div");previewLabel.style.cssText="font-size:11px;color:#888;margin-bottom:4px;";
    previewLabel.textContent="Texte extrait (vérifiable) :";previewArea.appendChild(previewLabel);
    var previewTA=document.createElement("textarea");previewTA.rows=6;
    previewTA.style.cssText="width:100%;font-size:11px;font-family:monospace;padding:8px;border:1px solid #e0e0e0;border-radius:6px;resize:vertical;box-sizing:border-box;";
    previewArea.appendChild(previewTA);
    card.appendChild(previewArea);

    // Product count preview
    var countDiv=document.createElement("div");countDiv.style.cssText="font-size:13px;font-weight:700;color:#e65100;min-height:20px;margin-bottom:8px;";
    card.appendChild(countDiv);

    var allParsedProducts=[];
    var totalFiles=0;

    fileInput.onchange=function(e){
      var files=e.target.files;
      if(!files||files.length===0)return;
      allParsedProducts=[];
      totalFiles=files.length;
      statusDiv.textContent="⏳ Traitement de "+files.length+" fichier(s)...";
      previewArea.style.display="none";
      countDiv.textContent="";
      var fileChain=Promise.resolve();
      for(var fi=0;fi<files.length;fi++){
        (function(file){
          fileChain=fileChain.then(function(){return _processInvoiceFile(file,statusDiv,previewTA,previewArea).then(function(prods){
            if(prods&&prods.length>0){
              // Before adding, try to find real EAN from supplier catalog
              var enriched=[];
              for(var pi=0;pi<prods.length;pi++){
                var pp=prods[pi];
                // If no real barcode (made-up INV-...), try to find in supplier catalog
                if(!pp.barcode||pp.barcode.indexOf("INV-")===0){
                  var found=_findInSupplierCatalog(pp.name,pp.barcode);
                  if(found&&found.ean){
                    pp.barcode=found.ean;
                  }
                }
                enriched.push(pp);
              }
              allParsedProducts=allParsedProducts.concat(enriched);
            }
          });});
        })(files[fi]);
      }
      fileChain.then(function(){
        if(allParsedProducts.length>0){
          statusDiv.textContent="✅ "+totalFiles+" fichier(s) traités: "+allParsedProducts.length+" produit(s) extraits";
          countDiv.textContent=allParsedProducts.length+" produit(s) détecté(s)";
          window._acimParsedProducts=allParsedProducts;
        }else{
          statusDiv.textContent="❌ Aucun produit extrait des fichiers sélectionnés.";
        }
      });
    };

    function _findInSupplierCatalog(name,barcode){
      if(!_supplierCatalog||!_supplierCatalog.length)return null;
      // First try exact barcode match
      if(barcode){
        for(var si=0;si<_supplierCatalog.length;si++){
          if(_supplierCatalog[si].ean===barcode||_supplierCatalog[si].code===barcode)return _supplierCatalog[si];
        }
      }
      // Then try name match
      if(name){
        var best=null,bestScore=0;
        var nLower=name.toLowerCase();
        for(var si2=0;si2<_supplierCatalog.length;si2++){
          var cn=(_supplierCatalog[si2].name||"").toLowerCase();
          var score=_fuzzyNameScore(nLower,cn);
          if(score>bestScore&&score>=60){bestScore=score;best=_supplierCatalog[si2];}
        }
        if(best)return best;
      }
      return null;
    }
    function _fuzzyNameScore(a,b){
      if(a===b)return 100;
      // Word overlap
      var wa=a.split(/\s+/),wb=b.split(/\s+/);
      var common=0;
      for(var i=0;i<wa.length;i++){
        for(var j=0;j<wb.length;j++){
          if(wa[i].length>2&&wa[i]===wb[j]){common++;break;}
        }
      }
      var maxLen=Math.max(wa.length,wb.length);
      var wordScore=maxLen>0?Math.round(common/maxLen*100):0;
      // Levenshtein
      var lev=_levenshtein(a,b);
      var max=Math.max(a.length,b.length);
      var levScore=max>0?Math.round((1-lev/max)*100):0;
      return Math.max(wordScore,levScore);
    }
    function _levenshtein(a,b){
      if(a.length===0)return b.length;if(b.length===0)return a.length;
      var m=[];for(var i=0;i<=b.length;i++)m[i]=[i];for(var j=0;j<=a.length;j++)m[0][j]=j;
      for(i=1;i<=b.length;i++){for(j=1;j<=a.length;j++){m[i][j]=a[j-1]===b[i-1]?m[i-1][j-1]:Math.min(m[i-1][j-1],m[i-1][j],m[i][j-1])+1;}}
      return m[b.length][a.length];
    }
    function _processInvoiceFile(file,statusDiv,previewTA,previewArea){
      return new Promise(function(resolve){
        var lowerName=file.name.toLowerCase();
        if(lowerName.endsWith(".json")){
          var reader=new FileReader();
          reader.onload=function(ev){
            try{
              var data=JSON.parse(ev.target.result);
              var products=data.products||data;
              if(!Array.isArray(products)){resolve([]);return;}
              var result=[];
              products.forEach(function(p){
                var name=p.name||p.n||p.designation||"";
                var price=p.sale_price_cents||p.p||p.price_cents||0;
                var barcode=p.barcode||p.bc||"INV-"+Date.now()+"-"+Math.floor(Math.random()*9999);
                var qty=p.qty||p.quantity||1;
                var stock=p.stockQty||p.s||0;
                result.push({barcode:barcode,name:name,unitPrice:price/100,qty:qty,stockQty:stock,totalCents:Math.round(price*qty)});
              });
              resolve(result);
            }catch(ex){resolve([]);}
          };
          reader.readAsText(file);
        }else if(lowerName.endsWith(".pdf")){
          if(!window.acimExtractPdfText){statusDiv.textContent="❌ Module PDF non chargé.";resolve([]);return;}
          var reader2=new FileReader();
          reader2.onload=function(ev){
            statusDiv.textContent="⏳ Extraction PDF: "+file.name+"...";
            var bytes=new Uint8Array(ev.target.result);
            window.acimExtractPdfText(bytes).then(function(rawText){
              if(!rawText||!rawText.trim()){resolve([]);return;}
              previewArea.style.display="block";
              previewTA.value+=rawText+"\n\n--- "+file.name+" ---\n\n";
              var products=_parseInvoiceText(rawText);
              resolve(products);
            }).catch(function(){resolve([]);});
          };
          reader2.readAsArrayBuffer(file);
        }else{
          resolve([]);
        }
      });
    }

    // Parse invoice text into products (flexible parser)
    function _parseInvoiceText(text){
      var lines=text.split("\n");
      var products=[];
      var seen={};
      for(var i=0;i<lines.length;i++){
        var line=lines[i].trim();
        if(!line||line.length<5)continue;
        var lower=line.toLowerCase();
        // Skip obvious headers/footers
        if(/^(total|tva|facture|conditions|escompte|acompte|net a payer|port ht|montant ht|base ht|designation|adresse|tel|fax|email|code client|numero|date|ref|bon de|livraison|avoir)/.test(lower))continue;
        if(/(total\s*:?\s*\d|tva\s*:?\s*\d|merci|bonne|journee|caissier|vendeur)/i.test(line))continue;

        // Strategy 1: strict pattern "NNN CODE NAME QTY PRICE TOTAL"
        var m=line.match(/^(\d{3})\s+(\S+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/);
        if(m){
          var barcode=m[2].replace(/[|\\\/]/g,"");
          var name=m[3].trim();
          var qty=parseFloat(m[4].replace(",","."))||1;
          var unitPrice=parseFloat(m[5].replace(",","."))||0;
          var total=parseFloat(m[6].replace(",","."))||0;
          if(name&&total>0&&!seen[barcode]){
            products.push({barcode:barcode,name:name,qty:qty,unitPrice:unitPrice,totalCents:Math.round(total*100)});
            seen[barcode]=true;
          }
          continue;
        }

        // Strategy 2: line with barcode pattern (EAN13, EAN8, or alphanumeric code)
        var bcMatch=line.match(/\b(\d{8,14}|[A-Z]{2,5}[-.]?\d{4,10})\b/);
        // Strategy 3: find ALL numbers in the line
        var allNums=[];
        var numRegex=/(\d+[.,]\d{1,2})\b/g;
        var nm;
        while((nm=numRegex.exec(line))!==null){
          var v=parseFloat(nm[1].replace(",","."));
          if(!isNaN(v)&&v>0) allNums.push({val:v,idx:nm.index,end:nm.index+nm[0].length});
        }
        // Also find integers that could be quantities
        var intRegex=/\b(\d{1,5})\b/g;
        while((nm=intRegex.exec(line))!==null){
          var iv=parseInt(nm[1]);
          if(iv>0&&iv<100000){
            var already=false;
            for(var ai=0;ai<allNums.length;ai++){if(Math.abs(allNums[ai].idx-nm.index)<3)already=true;}
            if(!already) allNums.push({val:iv,idx:nm.index,end:nm.index+nm[0].length,intOnly:true});
          }
        }
        allNums.sort(function(a,b){return a.idx-b.idx;});

        if(allNums.length<2)continue;

        // The last meaningful number is usually the line total
        var totalVal=allNums[allNums.length-1].val;
        if(totalVal<=0||totalVal>50000)continue;

        // Extract name: everything that's not a number
        var namePart=line.replace(/\d+[.,]\d{1,2}\b/g," ").replace(/\b\d{1,5}\b/g," ").replace(/\s+/g," ").trim();
        // Remove common non-product tokens
        namePart=namePart.replace(/^[\s\-–—:;/#,.*]+/,"").replace(/[\s\-–—:;/#,.*]+$/,"");
        if(namePart.length<2)continue;

        // Try to find barcode from the line
        var barcode="";
        if(bcMatch) barcode=bcMatch[1];
        else barcode="INV-"+Date.now()+"-"+i;

        // Deduce unit price: second-to-last number, or total if only 2 numbers
        var unitPrice=totalVal;
        var qty=1;
        if(allNums.length>=3){
          // Could be: qty price total
          var candidate=allNums[allNums.length-2];
          if(!candidate.intOnly&&candidate.val>0&&candidate.val<=5000){
            unitPrice=candidate.val;
            qty=Math.round(totalVal/unitPrice);
            if(qty<=0||qty>10000){qty=1;unitPrice=totalVal;}
          }else{
            // Second-to-last is integer => likely qty
            qty=candidate.val;
            unitPrice=Math.round((totalVal/qty)*100)/100;
          }
        }else if(allNums.length===2){
          // Two numbers: could be price total or qty total
          var n1=allNums[0].val;
          var n2=allNums[1].val;
          if(n1<n2&&n1<=5000){
            unitPrice=n1;
            qty=Math.round(n2/n1);
            if(qty<=0||qty>10000){qty=1;unitPrice=n2;}
          }
        }

        if(!seen[barcode]&&namePart.length>=2){
          products.push({barcode:barcode,name:namePart,qty:qty,unitPrice:unitPrice,totalCents:Math.round(totalVal*100)});
          seen[barcode]=true;
        }
      }
      return products;
    }

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bImport=document.createElement("button");bImport.textContent="📥 Importer dans le catalogue";
    bImport.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bImport.onclick=function(){
      var products=window._acimParsedProducts;
      if(!products||products.length===0){statusDiv.textContent="❌ Aucun produit à importer.";return;}
      // Load all existing products for fuzzy matching
      _dbGetAll().then(function(existingProducts){
        var matched=0,created=0,details=[];
        var chain=Promise.resolve();
        products.forEach(function(p){
          chain=chain.then(function(){
            // 1. Try exact barcode match
            return _dbGet(p.barcode).then(function(existing){
              if(existing){
                existing.stockQty=(existing.stockQty||0)+(p.qty||0);
                existing.last_updated=Date.now();
                return _dbPut(existing).then(function(){matched++;details.push({name:p.name,status:"⬆️ stock mis à jour (+"+p.qty+")",match:true});});
              }
              // 2. Try fuzzy name match against existing catalog
              var best=_findBestMatch(p.name,existingProducts,65);
              if(best){
                var ep=best.product;
                ep.stockQty=(ep.stockQty||0)+(p.qty||0);
                // Update price if the invoice price is valid and different
                var newPrice=Math.round(p.unitPrice*100);
                if(newPrice>0&&newPrice!==ep.sale_price_cents){
                  ep.sale_price_cents=newPrice;
                }
                ep.last_updated=Date.now();
                return _dbPut(ep).then(function(){matched++;details.push({name:p.name,status:"🔗 fusionné → \""+ep.name+"\" ("+best.score+"%) +stock",match:true});});
              }
              // 3. No match → create new with auto-category
              var cat=_guessCategory(p.name)||"epicerie";
              return _dbPut({barcode:p.barcode,name:p.name,sale_price_cents:Math.round(p.unitPrice*100)||0,category:cat,stockQty:p.qty||0,source:"invoice-import",last_updated:Date.now()}).then(function(){
                created++;
                details.push({name:p.name,status:"🆕 créé ("+_catIcon(cat)+" "+cat+")",match:false});
              });
            });
          });
        });
        chain.then(function(){
          var summary="✅ Import terminé: "+matched+" fusionné(s), "+created+" nouveau(x)";
          if(matched>0||created>0){
            summary+="\n\n";
            details.forEach(function(d){summary+=d.status+" "+d.name+"\n";});
            // Save imported products to meta for auto-restore on startup
            _openMeta().then(function(d){
              if(!d)return;
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:"catalog-from-pdf",value:products});
            });
          }
          statusDiv.textContent=summary;
          statusDiv.style.whiteSpace="pre-wrap";
          window._acimParsedProducts=null;
          _refreshAndFilter();
        });
      });
    };
    br.appendChild(bClose);br.appendChild(bImport);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── DELETE PRODUCT CONFIRM ────────────────────────────
  function _confirmDeleteProduct(product){
    var old=document.getElementById("acim-del-confirm");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-del-confirm";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000003;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#c62828;";
    ti.textContent="🗑️ Supprimer ce produit ?";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:13px;color:#666;margin-bottom:16px;";
    info.innerHTML="<strong>"+esc(product.name)+"</strong><br>Code: "+esc(product.barcode)+"<br>Stock: "+(product.stockQty||0);
    card.appendChild(info);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bDel=document.createElement("button");bDel.textContent="🗑️ Supprimer";
    bDel.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bDel.onclick=function(){
      _dbDelete(product.barcode).then(function(){
        ov.remove();_toast("🗑️ "+product.name+" supprimé");
        _refreshAndFilter();
      });
    };
    br.appendChild(bCancel);br.appendChild(bDel);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _confirmDeleteAll(){
    var old=document.getElementById("acim-delall");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-delall";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000003;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#c62828;";
    ti.textContent="🗑️ Supprimer TOUS les produits ?";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:13px;color:#666;margin-bottom:16px;";
    info.textContent="Cette action est irréversible. Tous les produits du catalogue seront supprimés.";
    card.appendChild(info);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bDel=document.createElement("button");bDel.textContent="🗑️ Tout supprimer";
    bDel.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bDel.onclick=function(){
      _dbDeleteAll().then(function(){
        ov.remove();_toast("🗑️ Tous les produits supprimés");
        _allProducts=[];_filterProducts();
      });
    };
    br.appendChild(bCancel);br.appendChild(bDel);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

  // ─── SETTINGS ────────────────────────────────────────
  function _showSettings(){
    var old=document.getElementById("acim-settings");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-settings";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="⚙️ Paramètres";card.appendChild(ti);

    var nameInput=document.createElement("input");nameInput.type="text";nameInput.value=_settings.storeName;
    nameInput.placeholder="Nom du magasin";nameInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    card.appendChild(nameInput);
    var footerInput=document.createElement("input");footerInput.type="text";footerInput.value=_settings.footer;
    footerInput.placeholder="Footer ticket";footerInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:12px;";
    card.appendChild(footerInput);

    var dangerBtn=document.createElement("button");dangerBtn.textContent="🗑️ Supprimer tous les produits";
    dangerBtn.style.cssText="width:100%;padding:10px;border:2px solid #ffcdd2;border-radius:8px;background:#fff;color:#c62828;font-size:13px;cursor:pointer;margin-bottom:12px;font-weight:600;";
    dangerBtn.onclick=function(){ov.remove();_confirmDeleteAll();};
    card.appendChild(dangerBtn);

    var downloadLink=document.createElement("a");
    downloadLink.href="https://github.com/aveca/AcimCaisse/releases/download/v1.0/AcimCaisse-win32-lowspec.zip";
    downloadLink.textContent="📥 Télécharger la version Win32 (low spec)";
    downloadLink.style.cssText="display:block;width:100%;padding:10px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:13px;cursor:pointer;margin-bottom:12px;font-weight:600;text-align:center;text-decoration:none;";
    card.appendChild(downloadLink);

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="Enregistrer";
    bOk.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      _settings.storeName=nameInput.value.trim()||"AcimCaisse";
      _settings.footer=footerInput.value.trim()||"Merci de votre visite !";
      _saveSettings();ov.remove();_toast("✅ Paramètres enregistrés");
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── INLINE EDIT ─────────────────────────────────────
  function _inlineEdit(idx,clickX,clickY){
    if(!_myCart[idx])return;
    var item=_myCart[idx];
    var oldCard=document.getElementById("acim-inline-edit");if(oldCard)oldCard.remove();
    var card=document.createElement("div");card.id="acim-inline-edit";
    var left=Math.max(10,(window.innerWidth-320)/2);
    var top=Math.max(10,(window.innerHeight-500)/2);
    card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:320px;max-height:80vh;overflow-y:auto;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000003;font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a2e;";ti.textContent=_catIcon(item.cat||"autre")+" Modifier";card.appendChild(ti);
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:17px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.priceCents>0?(item.priceCents/100).toFixed(2):"";pi.placeholder="Prix fixe";
    pi.style.cssText="flex:1;font-size:20px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:20px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);

    // Weight section - more prominent
    var poidsLabel=document.createElement("div");
    poidsLabel.style.cssText="font-size:14px;font-weight:700;color:#e65100;margin:10px 0 6px 0;";
    poidsLabel.textContent="⚖️ Poids (kg)";
    card.appendChild(poidsLabel);

    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=item.weight!=null?item.weight:"";poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:24px;padding:10px 12px;border:3px solid #e65100;border-radius:8px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";this.select();};poidsIn.onblur=function(){this.style.borderColor="#e65100";};
    var unitSel=document.createElement("select");    unitSel.style.cssText="font-size:16px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    unitSel.innerHTML="";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(item.unitType&&u[0]===item.unitType)o.selected=true;
      unitSel.appendChild(o);
    });

    var ppuRow=document.createElement("div");ppuRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var ppuIn=document.createElement("input");ppuIn.type="number";ppuIn.step="0.01";ppuIn.min="0";
    ppuIn.value=item.pricePerUnit!=null?(item.pricePerUnit/100).toFixed(2):"";ppuIn.placeholder="Prix unitaire (€/kg)";
    ppuIn.style.cssText="flex:1;font-size:16px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    ppuIn.onfocus=function(){this.style.borderColor="#e65100";};ppuIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var ppuUnit=document.createElement("span");ppuUnit.style.cssText="font-size:11px;color:#666;min-width:40px;";
    ppuUnit.textContent="/"+(item.unitType||"kg");
    ppuRow.appendChild(ppuIn);ppuRow.appendChild(ppuUnit);card.appendChild(ppuRow);

    unitSel.onchange=function(){ppuUnit.textContent="/"+unitSel.value;};
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);

    var preview=document.createElement("div");preview.style.cssText="font-size:20px;font-weight:700;color:#fff;background:#e65100;border-radius:8px;padding:10px;text-align:center;margin-bottom:10px;min-height:28px;display:none;";
    card.appendChild(preview);

    function _updatePreview(){
      var w=parseFloat(poidsIn.value);
      var ppu=parseFloat(ppuIn.value);
      var u=unitSel.value;
      if(!isNaN(w)&&w>0&&!isNaN(ppu)&&ppu>0){
        var ppuCents=Math.round(ppu*100);
        var total=_calcWeightPrice(w,u,ppuCents);
        preview.textContent="⚖️ "+_formatWeight(w,u)+" × "+_formatPricePerUnit(ppuCents,u)+" = "+(total/100).toFixed(2)+"€";
        preview.style.display="block";
        pi.value=(total/100).toFixed(2);
      }else{preview.textContent="";preview.style.display="none";}
    }
    poidsIn.addEventListener("input",_updatePreview);
    ppuIn.addEventListener("input",_updatePreview);
    unitSel.addEventListener("change",_updatePreview);

    // Category
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:18px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);

    // Barcode + print button
    if(item.bc){
      var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:11px;color:#888;";
      bcRow.textContent="📊 "+item.bc;
      var printBtn=document.createElement("button");printBtn.textContent="🖨️ Étiquette";
      printBtn.style.cssText="margin-left:auto;padding:2px 6px;border:1px solid #e0e0e0;border-radius:4px;background:#fff;font-size:10px;cursor:pointer;";
      printBtn.onclick=function(){window.open("barcode.html?nom="+encodeURIComponent(item.name)+"&code="+encodeURIComponent(item.bc),"_blank");};
      bcRow.appendChild(printBtn);card.appendChild(bcRow);
    }

    var br=document.createElement("div");br.style.cssText="display:flex;gap:6px;";
    var bDel=document.createElement("button");bDel.textContent="🗑️";
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:16px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){card.remove();_removeFromCart(idx);};
    var bCancel=document.createElement("button");bCancel.textContent="×";
    bCancel.style.cssText="padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;background:#f5f5f5;font-size:16px;cursor:pointer;";
    bCancel.onclick=function(){card.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓";
    bOk.style.cssText="flex:1;padding:6px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:17px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      var ppu=parseFloat(ppuIn.value);
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?_myCart[idx].priceCents:Math.round(np*100);
      var weight=null,unitType=null,pricePerUnit=null;
      if(!isNaN(pv)&&pv>0&&u){
        weight=pv;unitType=u;
        if(!isNaN(ppu)&&ppu>0)pricePerUnit=Math.round(ppu*100);
        if(!pricePerUnit&&item.pricePerUnit)pricePerUnit=item.pricePerUnit;
        if(weight&&unitType&&pricePerUnit){
          pc=_calcWeightPrice(weight,unitType,pricePerUnit);
          nn=ni.value.trim()+" "+_formatWeight(weight,unitType);
        }
      }
      card.remove();
      _myCart[idx].name=nn;_myCart[idx].priceCents=pc;_myCart[idx].cat=selCat;
      _myCart[idx].weight=weight;_myCart[idx].unitType=unitType;_myCart[idx].pricePerUnit=pricePerUnit;
      if(item.bc){
        _dbGet(item.bc).then(function(existing){
          if(existing){
            existing.name=nn;
            if(pc>0)existing.sale_price_cents=pc;
            existing.category=selCat;
            if(weight!=null)existing.pricePerUnit=pricePerUnit;
            if(unitType)existing.unitType=unitType;
            existing.last_updated=Date.now();
            _dbPut(existing).then(function(){_refreshAndFilter();});
          }
        });
      }
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      _renderPOS();
    };
    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);

    // Auto-fill pricePerUnit from IndexedDB if product has barcode
    if(item.bc){
      _dbGet(item.bc).then(function(existing){
        if(existing && existing.pricePerUnit && !item.pricePerUnit){
          ppuIn.value=(existing.pricePerUnit/100).toFixed(2);
          if(existing.unitType){
            unitSel.value=existing.unitType;
            ppuUnit.textContent="/"+existing.unitType;
          }
          // Trigger preview update
          if(poidsIn.value)_updatePreview();
        }
      });
    }

    // Auto-focus on weight input
    setTimeout(function(){poidsIn.focus();poidsIn.select();},100);
  }

  // ─── QUICK CREATE ────────────────────────────────────
  function _quickCreate(name,priceCents,barcode,category){
    if(_dialogOpen())return;
    var providedBc=barcode||"";
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent=providedBc?"➕ Nouveau produit (scanné)":"➕ Nouveau produit";card.appendChild(ti);

    if(providedBc){
      var bcBadge=document.createElement("div");
      bcBadge.style.cssText="background:#e3f2fd;color:#1565c0;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;margin-bottom:8px;font-family:monospace;";
      bcBadge.textContent="📊 Code-barres: "+providedBc;
      card.appendChild(bcBadge);
    }
    var ni=document.createElement("input");ni.type="text";ni.placeholder="Nom du produit";ni.value=name||"";
    ni.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);

    var toggleRow=document.createElement("div");toggleRow.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px;";
    var toggleLabel=document.createElement("label");toggleLabel.style.cssText="font-size:13px;color:#1a1a2e;cursor:pointer;display:flex;align-items:center;gap:6px;";
    var toggle=document.createElement("input");toggle.type="checkbox";
    toggle.style.cssText="width:18px;height:18px;accent-color:#e65100;cursor:pointer;";
    toggleLabel.appendChild(toggle);toggleLabel.appendChild(document.createTextNode("⚖️ Produit au poids"));toggleRow.appendChild(toggleLabel);
    card.appendChild(toggleRow);

    var fixedRow=document.createElement("div");fixedRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";pi.value=priceCents>0?(priceCents/100).toFixed(2):"";
    pi.placeholder="Prix de vente";pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    fixedRow.appendChild(pi);fixedRow.appendChild(eu);card.appendChild(fixedRow);

    var weighSection=document.createElement("div");weighSection.style.cssText="display:none;";
    var ppuRow=document.createElement("div");ppuRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var ppuIn=document.createElement("input");ppuIn.type="number";ppuIn.step="0.01";ppuIn.min="0";
    ppuIn.placeholder="Prix unitaire (ex: 25,00€/kg)";ppuIn.style.cssText="flex:1;font-size:16px;font-weight:700;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;";
    ppuIn.onfocus=function(){this.style.borderColor="#e65100";};ppuIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var ppuUnitSel=document.createElement("select");ppuUnitSel.style.cssText="font-size:14px;padding:8px;border:3px solid #e0e0e0;border-radius:10px;outline:none;background:#fff;";
    [["kg","€/kg"],["g","€/kg (g)"],["L","€/L"],["pc","€/pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];ppuUnitSel.appendChild(o);});
    ppuRow.appendChild(ppuIn);ppuRow.appendChild(ppuUnitSel);weighSection.appendChild(ppuRow);
    card.appendChild(weighSection);

    toggle.onchange=function(){
      if(toggle.checked){fixedRow.style.display="none";weighSection.style.display="block";ppuIn.focus();}
      else{fixedRow.style.display="flex";weighSection.style.display="none";pi.focus();}
    };

    // Stock input
    var stockRow=document.createElement("div");stockRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var stockLabel=document.createElement("span");stockLabel.style.cssText="font-size:12px;color:#666;";stockLabel.textContent="Stock:";
    var stockIn=document.createElement("input");stockIn.type="number";stockIn.step="1";stockIn.min="0";stockIn.value="0";
    stockIn.style.cssText="flex:1;font-size:14px;padding:8px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    stockRow.appendChild(stockLabel);stockRow.appendChild(stockIn);card.appendChild(stockRow);

    // Purchase price + threshold row
    var ppRow=document.createElement("div");ppRow.style.cssText="display:flex;gap:4px;margin-bottom:8px;";
    var ppIn=document.createElement("input");ppIn.type="number";ppIn.step="0.01";ppIn.min="0";
    ppIn.placeholder="Prix d'achat";ppIn.style.cssText="flex:1;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    var thIn=document.createElement("input");thIn.type="number";thIn.step="1";thIn.min="0";thIn.value="5";
    thIn.placeholder="Seuil stock";thIn.style.cssText="width:70px;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    ppRow.appendChild(ppIn);ppRow.appendChild(thIn);card.appendChild(ppRow);

    // Expiry date
    var expRow=document.createElement("div");expRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var expLabel=document.createElement("span");expLabel.style.cssText="font-size:12px;color:#666;";expLabel.textContent="DLC:";
    var expIn=document.createElement("input");expIn.type="date";
    expIn.style.cssText="flex:1;font-size:13px;padding:6px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    expRow.appendChild(expLabel);expRow.appendChild(expIn);card.appendChild(expRow);

    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;";
    var selCat=category||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic+" "+cat.id;
      b.style.cssText="padding:5px 10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:12px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="Ajouter au ticket";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim();
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var useBc=providedBc||_nextBarcode();
      var stockQty=parseInt(stockIn.value)||0;
      if(toggle.checked){
        var ppu=parseFloat(ppuIn.value);
        var unitType=ppuUnitSel.value;
        if(isNaN(ppu)||ppu<=0){ppuIn.style.borderColor="#c62828";ppuIn.focus();return;}
        var ppuCents=Math.round(ppu*100);
        _addToCart(nn,0,useBc,selCat,null,unitType,ppuCents);
        _dbPut({barcode:useBc,name:nn,sale_price_cents:0,category:selCat,stockQty:stockQty,pricePerUnit:ppuCents,unitType:unitType,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual-weight",last_updated:Date.now()}).then(function(){ov.remove();_refreshAndFilter();_toast("⚖️ "+nn+" — "+_formatPricePerUnit(ppuCents,unitType));});
      }else{
        var np=parseFloat(pi.value);
        var pc=isNaN(np)?0:Math.round(np*100);
        _addToCart(nn,pc,useBc,selCat);
        _dbPut({barcode:useBc,name:nn,sale_price_cents:pc,category:selCat,stockQty:stockQty,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual",last_updated:Date.now()}).then(function(){ov.remove();_refreshAndFilter();_toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));});
      }
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){ni.focus();},100);
  }

  function _dialogOpen(){return!!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick")||!!document.getElementById("acim-weigh")||!!document.getElementById("acim-payment")||!!document.getElementById("acim-receipt")||!!document.getElementById("acim-history")||!!document.getElementById("acim-menu")||!!document.getElementById("acim-settings")||!!document.getElementById("acim-invoice")||!!document.getElementById("acim-disc-dialog");}

  // ─── EXPORT / IMPORT JSON ─────────────────────────────
  function _exportAllData(){
    return Promise.all([_dbGetAll(),_getSalesHistory(),_openMeta().then(function(d){
      if(!d)return{};return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").getAll();
        r.onsuccess=function(){var obj={};(r.result||[]).forEach(function(e){obj[e.key]=e.value;});ok(obj);};
        r.onerror=function(){ok({});};
      });
    }).catch(function(){return{};})]).then(function(results){
      return{
        version:1,
        exportDate:new Date().toISOString(),
        source:"acim-caisse-v34",
        products:results[0]||[],
        sales:results[1]||[],
        meta:results[2]||{}
      };
    });
  }
  function _downloadJSON(data,filename){
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=filename;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function _exportDartFormat(){
    return _dbGetAll().then(function(products){
      var catMap={"frais":"Frais","epicerie":"Sec","surgele":"Congele","autre":"Divers","vin":"Vin","alcool":"Alcool"};
      var catIds={};var cats=[];
      ["frais","epicerie","surgele","autre","vin","alcool"].forEach(function(c){
        var id="cat-"+c;catIds[c]=id;
        cats.push({id:id,createdAt:Date.now(),updatedAt:Date.now(),deletedAt:null,isDirty:true,syncVersion:0,name:catMap[c]||"Divers",color:null});
      });
      var dartProducts=(products||[]).map(function(p){
        return {
          id:"p-"+(p.barcode||"").replace(/[^a-zA-Z0-9]/g,""),
          createdAt:p.last_updated||Date.now(),updatedAt:p.last_updated||Date.now(),
          deletedAt:null,isDirty:true,syncVersion:0,
          barcode:p.barcode||null,name:p.name||"Sans nom",
          categoryId:catIds[p.category]||catIds["autre"],
          purchasePriceCents:p.purchase_price_cents||0,
          salePriceCents:p.sale_price_cents||0,
          stockQty:p.stockQty||0,unit:p.unitType||"pc",
          lowStockThreshold:p.low_stock_threshold||5,
          expiryDate:p.expiry_date||null,vatRateBp:2000,lastSoldAt:null
        };
      });
      return {
        format:1,schemaVersion:3,exportedAt:new Date().toISOString(),
        categories:cats,products:dartProducts,sales:[],saleItems:[],
        payments:[],stockMovements:[],
        users:[{id:"u-admin",createdAt:Date.now(),updatedAt:Date.now(),deletedAt:null,isDirty:true,syncVersion:0,name:"Administrateur",role:"admin",pinHash:null,pinSalt:null}],
        settings:[{id:"default",storeName:"Mon magasin",address:null,phone:null,logoPath:null,currency:"EUR",defaultVatRateBp:2000,ticketHeader:null,ticketFooter:null,registerId:""+Date.now(),nextTicketNumber:1,updatedAt:Date.now()}],
        orders:[]
      };
    });
  }
  function _showExportDialog(){
    var old=document.getElementById("acim-export");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-export";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="📤 Exporter mes données";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:16px;text-align:center;";
    desc.textContent="Télécharge un fichier JSON contenant tous vos produits, ventes et paramètres.";
    card.appendChild(desc);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:13px;color:#666;min-height:20px;margin-bottom:12px;text-align:center;";
    card.appendChild(statusDiv);

    var bExportJS=document.createElement("button");bExportJS.textContent="📤 Format JS (caisse)";
    bExportJS.style.cssText="width:100%;padding:10px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bExportJS.onclick=function(){
      statusDiv.textContent="⏳ Préparation de l'export JS...";
      bExportJS.disabled=true;bExportJS.style.opacity="0.5";
      _exportAllData().then(function(data){
        var dateStr=new Date().toISOString().slice(0,10);
        var filename="acimcaisse-backup-js-"+dateStr+".json";
        _downloadJSON(data,filename);
        statusDiv.textContent="✅ Fichier téléchargé: "+filename;
        statusDiv.style.color="#2e7d32";
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
      }).then(function(){bExportJS.disabled=false;bExportJS.style.opacity="1";});
    };
    card.appendChild(bExportJS);

    var bExportDart=document.createElement("button");bExportDart.textContent="📤 Format Flutter (version B)";
    bExportDart.style.cssText="width:100%;padding:10px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bExportDart.onclick=function(){
      statusDiv.textContent="⏳ Préparation de l'export Flutter...";
      bExportDart.disabled=true;bExportDart.style.opacity="0.5";
      _exportDartFormat().then(function(data){
        var dateStr=new Date().toISOString().slice(0,10);
        var filename="acimcaisse-backup-flutter-"+dateStr+".json";
        _downloadJSON(data,filename);
        statusDiv.textContent="✅ Fichier téléchargé: "+filename;
        statusDiv.style.color="#2e7d32";
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
      }).then(function(){bExportDart.disabled=false;bExportDart.style.opacity="1";});
    };
    card.appendChild(bExportDart);

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    br.appendChild(bClose);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _showImportDialog(){
    var old=document.getElementById("acim-import");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-import";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;max-height:80vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="📥 Importer des données";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:12px;text-align:center;";
    desc.textContent="Importe un fichier JSON exporté depuis AcimCaisse. Les doublons (même code-barres) sont écrasés.";
    card.appendChild(desc);
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);
    var previewDiv=document.createElement("div");previewDiv.style.cssText="display:none;margin-bottom:12px;";
    card.appendChild(previewDiv);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bImport=document.createElement("button");bImport.textContent="📥 Importer";
    bImport.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px;cursor:pointer;font-weight:700;display:none;";
    card.appendChild(br);card.appendChild(bImport);
    var parsedData=null;
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Lecture de "+file.name+"...";
      previewDiv.style.display="none";bImport.style.display="none";parsedData=null;
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          parsedData=JSON.parse(ev.target.result);
          var prodCount=(parsedData.products||[]).length;
          var salesCount=(parsedData.sales||[]).length;
          var hasMeta=!!parsedData.meta&&Object.keys(parsedData.meta).length>0;
          previewDiv.style.display="block";
          previewDiv.innerHTML='<div style="background:#f5f5f5;border-radius:8px;padding:12px;font-size:13px;">'
            +'<div style="font-weight:700;margin-bottom:6px;">📊 Aperçu:</div>'
            +'<div>📦 '+prodCount+' produit(s)</div>'
            +'<div>💰 '+salesCount+' vente(s)</div>'
            +'<div>⚙️ Paramètres: '+(hasMeta?"Oui":"Non")+'</div>'
            +(parsedData.exportDate?'<div style="color:#888;font-size:11px;margin-top:4px;">Exporté le: '+new Date(parsedData.exportDate).toLocaleString("fr-FR")+'</div>':"")
            +(parsedData.source?'<div style="color:#888;font-size:11px;">Source: '+parsedData.source+'</div>':"")
            +'</div>';
          statusDiv.textContent="✅ Fichier valide! Cliquez sur Importer.";
          statusDiv.style.color="#2e7d32";
          bImport.style.display="block";
        }catch(ex){
          statusDiv.textContent="❌ Fichier invalide: "+ex.message;
          statusDiv.style.color="#c62828";
        }
      };
      reader.readAsText(file);
    };
    bImport.onclick=function(){
      if(!parsedData)return;
      bImport.disabled=true;bImport.style.opacity="0.5";
      statusDiv.textContent="⏳ Importation en cours...";

      // Converter: Flutter format → JS format
      if(parsedData.schemaVersion&&parsedData.format){
        var catMap={};
        (parsedData.categories||[]).forEach(function(c){
          var catName=(c.name||"divers").toLowerCase().replace(/[^a-z]/g,"");
          var mapped="autre";
          if(catName.indexOf("frais")>=0)mapped="frais";
          else if(catName.indexOf("sec")>=0)mapped="epicerie";
          else if(catName.indexOf("congel")>=0)mapped="surgele";
          else if(catName.indexOf("vin")>=0)mapped="vin";
          else if(catName.indexOf("alcool")>=0)mapped="alcool";
          else if(catName.indexOf("divers")>=0)mapped="autre";
          catMap[c.id]=mapped;
        });
        (parsedData.products||[]).forEach(function(p){
          if(!p.barcode&&p.barcode!==0)return;
          p.category=catMap[p.categoryId]||p.category||"autre";
          if(p.salePriceCents!==undefined)p.sale_price_cents=p.salePriceCents;
          if(p.purchasePriceCents!==undefined)p.purchase_price_cents=p.purchasePriceCents;
          if(p.stockQty!==undefined)p.stockQty=p.stockQty;
          if(p.lowStockThreshold!==undefined)p.low_stock_threshold=p.lowStockThreshold;
        });
      }

      var products=parsedData.products||[];
      var sales=parsedData.sales||[];
      var meta=parsedData.meta||{};
      var prodPromises=[];
      var prodCount=0;
      var salesCount=0;
      products.forEach(function(p){
        if(!p.barcode)return;
        prodPromises.push(_dbGet(p.barcode).then(function(existing){
          _dbPut({
            barcode:p.barcode,
            name:p.name||"Sans nom",
            sale_price_cents:p.sale_price_cents||0,
            category:p.category||"autre",
            stockQty:p.stockQty||0,
            pricePerUnit:p.pricePerUnit||null,
            unitType:p.unitType||null,
            source:p.source||"json-import",
            last_updated:p.last_updated||Date.now()
          });
          prodCount++;
        }));
      });
      Promise.all(prodPromises).then(function(){
        var salesPromises=[];
        return _openSalesDB().then(function(d){
          if(!d||sales.length===0)return;
          return new Promise(function(ok){
            var tx=d.transaction("sales","readwrite");
            var store=tx.objectStore("sales");
            sales.forEach(function(s){
              if(!s)return;
              store.put({
                ticketNumber:s.ticketNumber||0,
                timestamp:s.timestamp||Date.now(),
                isoTime:s.isoTime||new Date(s.timestamp||Date.now()).toISOString(),
                items:s.items||[],
                totalCents:s.totalCents||0,
                discountCents:s.discountCents||0,
                payments:s.payments||[],
                itemCount:s.itemCount||(s.items?s.items.length:0)
              });
              salesCount++;
            });
            tx.oncomplete=function(){ok();};tx.onerror=function(){ok();};
          });
        });
      }).then(function(){
        return _openMeta().then(function(d){
          if(!d)return;
          return new Promise(function(ok){
            var tx=d.transaction("meta","readwrite");
            var store=tx.objectStore("meta");
            Object.keys(meta).forEach(function(k){
              store.put({key:k,value:meta[k]});
            });
            tx.oncomplete=function(){ok();};tx.onerror=function(){ok();};
          });
        });
      }).then(function(){
        statusDiv.textContent="✅ Import terminé: "+prodCount+" produits, "+salesCount+" ventes importés!";
        statusDiv.style.color="#2e7d32";
        _refreshAndFilter();
        _loadTicketSeq();
        _loadSettings();
        _loadBcSeq();
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur import: "+err.message;
        statusDiv.style.color="#c62828";
        bImport.disabled=false;bImport.style.opacity="1";
      });
    };
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── RESET FROM MASTER JSON ───────────────────────────
  function _showResetFromJson(){
    var old=document.getElementById("acim-reset-json");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-reset-json";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:420px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#c62828;text-align:center;";
    ti.textContent="⚠️ Réinitialisation totale";card.appendChild(ti);
    var warning=document.createElement("div");
    warning.style.cssText="background:#fff3e0;border-left:4px solid #e65100;padding:12px;font-size:13px;color:#333;margin-bottom:16px;border-radius:4px;line-height:1.5;";
    warning.innerHTML='<strong>Cette opération va TOUT effacer :</strong><br>🗑️ Tous les produits<br>🗑️ Tout l\'historique des ventes<br>🗑️ Tous les paramètres (nom magasin, séquences)<br><br>Ensuite, vous importez un fichier JSON <strong>maître</strong> contenant uniquement vos vrais produits (bons EAN, prix, stocks, catégories).<br><br><span style="color:#e65100;">💡 Astuce : exportez d\'abord vos données actuelles via le menu si vous voulez les conserver.</span>';
    card.appendChild(warning);
    var step1=document.createElement("div");step1.style.cssText="margin-bottom:12px;";
    var bTemplate=document.createElement("button");bTemplate.textContent="📄 Télécharger un template JSON vierge";
    bTemplate.style.cssText="width:100%;padding:12px;border:2px solid #1565c0;border-radius:8px;background:#e3f2fd;color:#1565c0;font-size:14px;cursor:pointer;font-weight:700;margin-bottom:8px;";
    bTemplate.onclick=function(){
      var template={
        version:1,exportDate:new Date().toISOString(),source:"acim-caisse-template",
        products:[
          {barcode:"3017620422003",name:"Nutella 750g",sale_price_cents:499,category:"epicerie",stockQty:10,low_stock_threshold:3,source:"master",last_updated:Date.now()},
          {barcode:"3274080005003",name:"Cristaline 50cl",sale_price_cents:50,category:"boisson",stockQty:48,low_stock_threshold:12,source:"master",last_updated:Date.now()},
          {barcode:"ACIM-001",name:"Poulet fermier 1kg",sale_price_cents:1290,category:"volaille",stockQty:6,low_stock_threshold:2,source:"master",last_updated:Date.now()},
          {barcode:"ACIM-002",name:"Steak haché 250g",sale_price_cents:450,category:"viande",stockQty:20,low_stock_threshold:5,source:"master",last_updated:Date.now()}
        ],
        sales:[],meta:{}
      };
      _downloadJSON(template,"acimcaisse-template.json");
      _toast("✅ Template JSON téléchargé — éditez-le dans un tableur");
    };
    step1.appendChild(bTemplate);
    var descTemplate=document.createElement("div");descTemplate.style.cssText="font-size:11px;color:#888;margin-bottom:12px;text-align:center;";
    descTemplate.textContent="Ouvrez le fichier dans Excel/LibreOffice, modifiez les lignes, puis importez-le ci-dessous.";
    step1.appendChild(descTemplate);
    card.appendChild(step1);
    var fileLabel=document.createElement("div");fileLabel.style.cssText="font-size:14px;font-weight:700;margin-bottom:6px;color:#1a1a2e;";
    fileLabel.textContent="2. Sélectionnez votre fichier JSON maître :";
    card.appendChild(fileLabel);
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;box-sizing:border-box;";
    card.appendChild(fileInput);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;margin-bottom:8px;";
    card.appendChild(statusDiv);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bReset=document.createElement("button");bReset.textContent="⚠️ TOUT EFFACER & IMPORTER";
    bReset.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;display:none;";
    bReset.onclick=function(){
      bReset.disabled=true;bReset.style.opacity="0.5";
      statusDiv.textContent="⏳ Effacement de toutes les données...";
      _clearAllStores().then(function(){
        statusDiv.textContent="⏳ Importation des produits...";
        return _importMasterJson(parsedData);
      }).then(function(result){
        statusDiv.textContent="✅ Terminé! "+result.prods+" produits importés.";
        statusDiv.style.color="#2e7d32";
        _toast("✅ Réinitialisation terminée — "+result.prods+" produits chargés");
        setTimeout(function(){ov.remove();},1500);
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
        bReset.disabled=false;bReset.style.opacity="1";
      });
    };
    var parsedData=null;
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Lecture de "+file.name+"...";
      bReset.style.display="none";parsedData=null;
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          parsedData=JSON.parse(ev.target.result);
          var prods=(parsedData.products||[]);
          if(!Array.isArray(prods)||prods.length===0){statusDiv.textContent="❌ Le fichier ne contient aucun produit valide.";statusDiv.style.color="#c62828";return;}
          var valid=prods.filter(function(p){return p.barcode&&p.name;}).length;
          if(valid===0){statusDiv.textContent="❌ Aucun produit avec code-barres ET nom trouvé.";statusDiv.style.color="#c62828";return;}
          statusDiv.innerHTML="✅ Fichier valide: <strong>"+prods.length+"</strong> produit(s) trouvés (dont "+valid+" valides)<br>💰 "+(parsedData.sales||[]).length+" vente(s) dans le fichier (ignorées)";
          statusDiv.style.color="#2e7d32";
          bReset.style.display="block";
        }catch(ex){
          statusDiv.textContent="❌ Fichier invalide: "+ex.message;
          statusDiv.style.color="#c62828";
        }
      };
      reader.readAsText(file);
    };
    br.appendChild(bCancel);br.appendChild(bReset);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }
  function _clearAllStores(){
    return Promise.all([
      _dbDeleteAll(),
      _openSalesDB().then(function(d){if(!d)return;return new Promise(function(ok){var tx=d.transaction("sales","readwrite");tx.objectStore("sales").clear();tx.oncomplete=ok;tx.onerror=ok;});}),
      _openMeta().then(function(d){if(!d)return;return new Promise(function(ok){var tx=d.transaction("meta","readwrite");tx.objectStore("meta").clear();tx.oncomplete=ok;tx.onerror=ok;});})
    ]);
  }
  function _importMasterJson(data){
    var prods=data.products||[];
    var count=0;
    var chain=Promise.resolve();
    prods.forEach(function(p){
      if(!p.barcode||!p.name)return;
      chain=chain.then(function(){
        return _dbPut({
          barcode:p.barcode,
          name:p.name,
          sale_price_cents:p.sale_price_cents||0,
          category:p.category||"epicerie",
          stockQty:typeof p.stockQty==="number"?p.stockQty:0,
          low_stock_threshold:typeof p.low_stock_threshold==="number"?p.low_stock_threshold:5,
          source:"master",
          last_updated:Date.now()
        }).then(function(){count++;});
      });
    });
    return chain.then(function(){
      // Reset critical meta so startup chain re-runs properly
      return _openMeta().then(function(d){
        if(!d)return;
        return new Promise(function(ok){
          var tx=d.transaction("meta","readwrite");
          var s=tx.objectStore("meta");
          s.put({key:_BACKUP_IMPORTED_KEY,value:true});
          s.put({key:_YARDEN_IMPORTED_KEY,value:true});
          s.put({key:_INVOICE_MATCHED_KEY,value:true});
          s.put({key:_bcSeqKey,value:1000});
          s.put({key:_ticketSeqKey,value:1});
          s.put({key:_settingsKey,value:{storeName:"AcimCaisse",footer:"Merci de votre visite !"}});
          tx.oncomplete=function(){_log("Meta reset for master JSON");ok();};
          tx.onerror=function(){ok();};
        });
      }).then(function(){
        // Reload sequences and settings
        return Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]);
      }).then(function(){
        // Reload products in memory and re-render
        return _dbGetAll().then(function(all){
          _allProducts=all||[];
          _filterProducts();
          _renderCart();
          _broadcastCart();
        });
      }).then(function(){
        return{prods:count};
      });
    });
  }

  // ─── AUTO-CATEGORIZE DICTIONARY ─────────────────────
  var _CAT_RULES=[
    // VOLAILLE
    {kw:["poulet","poule","dinde","dinde","canard","oie","parmelet","paupiette","aiguillette","filet poulet","cuisse poulet","pilon","pilori","blanc poulet","magret","foie gras","chapon","coq"],cat:"volaille",name:null},
    // VIANDE
    {kw:["boeuf","bœuf","veau","agneau","porc","steak","côte","cotelette","entrecôte","bavette","hampe","paleron","rumsteck","rôti","roti","haché","hache","saucisse","saucisson","jambon","lard","poitrine","merguez","chipolata","andouillette","boudin","rosette","salami","viande"],cat:"viande",name:null},
    // LAITIER
    {kw:["lait","fromage","yaourt","yogurt","crème","beurre","emmental","gruyère","comté","reblochon","camembert","brie","roquefort","chèvre","mozzarella","ricotta","parmesan","mascarpone","morbier","raclette","tome","cheese"],cat:"laitier",name:null},
    // BOULANGERIE
    {kw:["pain","baguette","croissant","brioche","challah","pain maison","fougasse","focaccia","pizza","tarte","quiche","galette","crepe","crêpe","muffin","donut","beignet"],cat:"boulangerie",name:null},
    // EPICERIE
    {kw:["riz","pâtes","pates","lentilles","pois","haricots","huile","vinaigre","sel","poivre","sucre","farine","oeuf","œuf","conserve","sauce","soupe","bouillon","moutarde","ketchup","mayonnaise","nutella","confiture","miel","café","the","thé","cacao","céréales","biscuit","chips","chocolat","bonbon","bonbons"],cat:"epicerie",name:null},
    // BOISSON
    {kw:["eau","jus","soda","bière","biere","limonade","coca","sprite","perrier","san pellegrino","boisson","lait","café","the","thé","vin","champagne","cidre","rhum","whisky","vodka","gin","tonic"],cat:"boisson",name:null},
    // SURGELE
    {kw:["surgelé","surgelé","congelé","glace","pizza surgelé","légume surgelé","frites surgelé","poisson surgelé"],cat:"surgelé",name:null},
    // SNACK
    {kw:["chips","biscuit","gâteau","gateau","cookie","céréales","barre","snack","nooty","nutella","amande","noisette","cacahuète","fruits secs","muesli"],cat:"snack",name:null},
    // CONDIMENT
    {kw:["épice","epice","herbe","basilic","thym","romarin","curry","paprika","cumin","safran","cannelle","vanille"],cat:"condiment",name:null},
    // MENAGER
    {kw:["nettoyant","détergent","lessive","savon","shampooing","dentifrice","papier toilette","mouchoir","couche","hygiène","menager","éponge"],cat:"menager",name:null}
  ];

  function _guessCategory(name){
    var n=(name||"").toLowerCase();
    for(var i=0;i<_CAT_RULES.length;i++){
      var r=_CAT_RULES[i];
      for(var j=0;j<r.kw.length;j++){
        if(n.indexOf(r.kw[j])!==-1)return r.cat;
      }
    }
    return null;
  }

  // ─── FUZZY NAME MATCHING ─────────────────────────────
  function _normalizeText(s){
    return (s||"").toLowerCase()
      .replace(/[àâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[ïîì]/g,"i")
      .replace(/[ôöò]/g,"o").replace(/[ùûüú]/g,"u").replace(/[ÿ]/g,"y")
      .replace(/[ç]/g,"c").replace(/[^a-z0-9\s]/g,"")
      .replace(/\s+/g," ").trim();
  }

  function _fuzzyScore(a,b){
    var na=_normalizeText(a),nb=_normalizeText(b);
    if(!na||!nb)return 0;
    if(na===nb)return 100;
    // Containment check
    if(na.indexOf(nb)!==-1||nb.indexOf(na)!==-1)return 85;
    // Word overlap
    var wa=na.split(" "),wb=nb.split(" ");
    var matches=0;
    wa.forEach(function(w){if(w.length>2&&wb.indexOf(w)!==-1)matches++;});
    var score=matches/Math.max(wa.length,wb.length)*100;
    if(score>=60)return Math.round(score);
    // Levenshtein for short names
    if(na.length<20&&nb.length<20){
      var d=[];
      for(var i=0;i<=na.length;i++){d[i]=[i];for(var j=1;j<=nb.length;j++)d[i][j]=0;}
      for(var j=1;j<=nb.length;j++)d[0][j]=j;
      for(var i=1;i<=na.length;i++)for(var j=1;j<=nb.length;j++){
        var cost=na[i-1]===nb[j-1]?0:1;
        d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      }
      var maxLen=Math.max(na.length,nb.length);
      var lev=1-d[na.length][nb.length]/maxLen;
      if(lev>0.7)return Math.round(lev*100);
    }
    return score>0?Math.round(score):0;
  }

  function _findBestMatch(name,products,threshold){
    threshold=threshold||60;
    var best=null,bestScore=0;
    for(var i=0;i<products.length;i++){
      var sc=_fuzzyScore(name,products[i].name);
      if(sc>bestScore&&sc>=threshold){bestScore=sc;best=products[i];}
    }
    return best?{product:best,score:bestScore}:null;
  }

  // ─── UNDO LAST SALE ─────────────────────────────────
  function _undoLastSale(){
    _openSalesDB().then(function(d){
      if(!d){_toast("❌ Base inaccessible");return;}
      return new Promise(function(ok){
        var tx=d.transaction("sales","readwrite");
        var store=tx.objectStore("sales");
        var r=store.openCursor(null,"prev");
        r.onsuccess=function(e){
          var cursor=e.target.result;
          if(!cursor){_toast("❌ Aucune vente à annuler");ok();return;}
          var sale=cursor.value;
          // Show confirmation
          var old=document.getElementById("acim-undo");if(old)old.remove();
          var ov=document.createElement("div");ov.id="acim-undo";
          ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000004;display:flex;align-items:center;justify-content:center;";
          var card=document.createElement("div");
          card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
          var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#c62828;text-align:center;";
          ti.textContent="↩️ Annuler cette vente ?";card.appendChild(ti);
          var info=document.createElement("div");info.style.cssText="font-size:15px;color:#666;margin-bottom:12px;text-align:center;";
          var saleDate=sale.isoTime?new Date(sale.isoTime).toLocaleString("fr-FR"):(sale.timestamp?new Date(sale.timestamp).toLocaleString("fr-FR"):"?");
          info.innerHTML='<strong>Ticket n°'+(sale.ticketNumber||"?")+'</strong><br>'+saleDate+'<br>'+(sale.itemCount||0)+' article(s) — '+(sale.totalCents/100).toFixed(2).replace(".",",")+' €';
          card.appendChild(info);
          var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
          var bCancel=document.createElement("button");bCancel.textContent="Non, garder";
          bCancel.style.cssText="flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
          bCancel.onclick=function(){ov.remove();};
          var bUndo=document.createElement("button");bUndo.textContent="↩️ Oui, annuler";
          bUndo.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#c62828;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
          bUndo.onclick=function(){
            // Restore stock for each item
            var stockChain=Promise.resolve();
            if(sale.items){
              sale.items.forEach(function(item){
                stockChain=stockChain.then(function(){
                  if(item.barcode){
                    return _dbGet(item.barcode).then(function(p){
                      if(p){
                        p.stockQty=(p.stockQty||0)+(item.qty||1);
                        p.last_updated=Date.now();
                        return _dbPut(p);
                      }
                    });
                  }
                });
              });
            }
            stockChain.then(function(){
              cursor.delete();
              ov.remove();
              _toast("↩️ Vente n°"+(sale.ticketNumber||"?")+" annulée");
              _refreshAndFilter();
              ok();
            });
          };
          br.appendChild(bCancel);br.appendChild(bUndo);card.appendChild(br);
          ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
          document.body.appendChild(ov);
        };
        r.onerror=function(){ok();};
      });
    });
  }

  // ─── SUPPLIER CATALOG ────────────────────────────────
  var _supplierCatalog=null;
  function _showSupplierCatalog(){
    var old=document.getElementById("acim-supcat");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-supcat";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:550px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="📒 Catalogue fournisseur";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:15px;color:#666;margin-bottom:12px;";
    desc.textContent="Chargez un fichier JSON du catalogue fournisseur pour rechercher par code-barres.";card.appendChild(desc);

    // File input
    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".json";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);

    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:14px;color:#666;min-height:20px;margin-bottom:12px;";
    card.appendChild(statusDiv);

    // Search bar
    var searchRow=document.createElement("div");searchRow.style.cssText="display:none;margin-bottom:12px;";
    var searchIn=document.createElement("input");searchIn.type="text";searchIn.placeholder="🔍 Scanner ou taper un code-barres...";
    searchIn.style.cssText="width:100%;font-size:18px;font-weight:700;padding:12px;border:3px solid #e65100;border-radius:10px;outline:none;box-sizing:border-box;";
    searchRow.appendChild(searchIn);card.appendChild(searchRow);

    // Results
    var resultsDiv=document.createElement("div");resultsDiv.style.cssText="min-height:60px;";
    card.appendChild(resultsDiv);

    // Close
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);

    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // File load handler
    fileInput.onchange=function(e){
      var file=e.target.files[0];if(!file)return;
      statusDiv.textContent="⏳ Chargement de "+file.name+"...";
      var reader=new FileReader();
      reader.onload=function(ev){
        try{
          var data=JSON.parse(ev.target.result);
          var products=data.products||data.items||data;
          if(!Array.isArray(products)){statusDiv.textContent="❌ Format JSON invalide (tableau attendu)";return;}
          // Normalize
          _supplierCatalog=products.map(function(p){
            return{
              barcode:p.barcode||p.code_barres||p.bc||"",
              name:p.name||p.nom||p.designation||"",
              purchase_price:p.purchase_price_cents||p.prix_achat||p.prixHT||0,
              sale_price:p.sale_price_cents||p.prix_vente||0,
              unit:p.unit||p.unite||"pc",
              category:p.category||p.categorie||""
            };
          }).filter(function(p){return p.barcode||p.name;});
          statusDiv.textContent="✅ "+_supplierCatalog.length+" produits chargés";
          searchRow.style.display="block";
          searchIn.focus();
          _openMeta().then(function(d){if(!d)return;var tx=d.transaction("meta","readwrite");tx.objectStore("meta").put({key:"supplier-catalog",value:_supplierCatalog});});
        }catch(ex){statusDiv.textContent="❌ Erreur JSON: "+ex.message;}
      };
      reader.readAsText(file);
    };

    // Search handler
    searchIn.addEventListener("input",function(){
      var q=(searchIn.value||"").trim().toLowerCase();
      if(q.length<2){resultsDiv.innerHTML="";return;}
      if(!_supplierCatalog){resultsDiv.innerHTML='<div style="color:#999;text-align:center;padding:10px;">Chargez d\'abord un catalogue</div>';return;}
      var matches=_supplierCatalog.filter(function(p){
        return(p.barcode&&p.barcode.toLowerCase().indexOf(q)!==-1)||(p.name&&p.name.toLowerCase().indexOf(q)!==-1);
      }).slice(0,10);

      resultsDiv.innerHTML="";
      if(matches.length===0){
        resultsDiv.innerHTML='<div style="text-align:center;padding:10px;color:#999;">Aucun résultat pour "'+q+'"</div>';
        return;
      }
      matches.forEach(function(p){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all .15s;";
        row.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
        row.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
        var nm=document.createElement("span");nm.textContent=p.name||"?";nm.style.cssText="flex:1;font-size:15px;font-weight:600;";
        var bc=document.createElement("span");bc.textContent=p.barcode||"no bc";bc.style.cssText="font-size:12px;color:#999;font-family:monospace;";
        var pr=document.createElement("span");
        var pp=p.purchase_price;
        if(pp>0){
          if(pp>100)pp=pp;
          else pp=Math.round(pp*100);
          pr.textContent="Achat: "+(pp/100).toFixed(2)+"€";
        }else{pr.textContent="";}
        pr.style.cssText="font-size:14px;color:#2e7d32;font-weight:700;white-space:nowrap;";
        row.appendChild(nm);row.appendChild(bc);row.appendChild(pr);
        // If barcode matches an existing product, show stock
        if(p.barcode){
          _dbGet(p.barcode).then(function(existing){
            if(existing){
              var st=document.createElement("span");
              st.textContent="Stock: "+(existing.stockQty||0);
              st.style.cssText="font-size:13px;color:"+(existing.stockQty<=5?"#c62828":"#666")+";font-weight:700;";
              row.appendChild(st);
            }else{
              var newBtn=document.createElement("button");newBtn.textContent="➕ Ajouter";
              newBtn.style.cssText="padding:4px 8px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-size:13px;cursor:pointer;font-weight:600;color:#e65100;white-space:nowrap;";
              newBtn.onclick=function(e){
                e.stopPropagation();
                var cat=_guessCategory(p.name)||"epicerie";
                _dbPut({
                  barcode:p.barcode,name:p.name,
                  sale_price_cents:p.sale_price>100?p.sale_price:Math.round((p.sale_price||0)*100),
                  purchase_price_cents:p.purchase_price>100?p.purchase_price:Math.round((p.purchase_price||0)*100),
                  category:cat,stockQty:0,low_stock_threshold:5,
                  source:"supplier-catalog",last_updated:Date.now()
                }).then(function(){
                  newBtn.textContent="✅ Ajouté";newBtn.disabled=true;newBtn.style.opacity="0.5";
                  _toast("➕ "+p.name+" ajouté au catalogue");
                  _refreshAndFilter();
                });
              };
              row.appendChild(newBtn);
            }
          });
        }
        resultsDiv.appendChild(row);
      });
    });
  }

  // ─── DAY REPORT ──────────────────────────────────────
  function _showDayReport(){
    var old=document.getElementById("acim-dayreport");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-dayreport";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:450px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;text-align:center;";
    ti.textContent="📊 Rapport du jour";card.appendChild(ti);
    var today=new Date().toLocaleDateString("fr-FR");
    var sub=document.createElement("div");sub.style.cssText="font-size:16px;color:#666;margin-bottom:16px;text-align:center;";
    sub.textContent=today;card.appendChild(sub);

    var content=document.createElement("div");content.style.cssText="min-height:80px;";
    content.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Chargement...</div>';
    card.appendChild(content);

    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:12px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // Load today's sales
    _openSalesDB().then(function(d){
      if(!d){content.innerHTML='<div style="text-align:center;color:#c62828;">❌ Base de ventes inaccessible</div>';return;}
      return new Promise(function(ok){
        var r=d.transaction("sales","readonly").objectStore("sales").getAll();
        r.onsuccess=function(){ok(r.result||[]);};
        r.onerror=function(){ok([]);};
      });
    }).then(function(sales){
      if(!sales){content.innerHTML='<div style="text-align:center;color:#c62828;">Aucune donnée</div>';return;}
      // Filter today's sales
      var todayStr=new Date().toISOString().slice(0,10);
      var todaySales=sales.filter(function(s){
        var iso=s.isoTime||"";if(!iso&&s.timestamp)iso=new Date(s.timestamp).toISOString();
        if(!iso)return false;
        return iso.slice(0,10)===todayStr;
      });

      if(todaySales.length===0){
        content.innerHTML='<div style="text-align:center;padding:20px;color:#999;font-size:16px;">Aucune vente aujourd\'hui</div>';
        return;
      }

      // Calculate totals
      var totalAll=0,totalCash=0,totalCb=0,totalMixte=0,totalDiscount=0;
      var totalItems=0;
      var salesCount=todaySales.length;
      var paymentCounts={especes:0,cb:0,mixte:0};

      todaySales.forEach(function(s){
        totalAll+=(s.totalCents||0);
        totalDiscount+=(s.discountCents||0);
        totalItems+=(s.itemCount||0);
        if(s.payments){
          s.payments.forEach(function(p){
            if(p.method==="especes"){totalCash+=(p.amountCents||p.amount||0);paymentCounts.especes++;}
            else if(p.method==="cb"){totalCb+=(p.amountCents||p.amount||0);paymentCounts.cb++;}
            else{totalMixte+=(p.amountCents||p.amount||0);paymentCounts.mixte++;}
          });
        }else{
          totalCash+=(s.totalCents||0);
          paymentCounts.especes++;
        }
      });

      // Top products
      var productCount={};
      todaySales.forEach(function(s){
        if(s.items){
          s.items.forEach(function(item){
            var n=item.name||"?";
            if(!productCount[n])productCount[n]={name:n,qty:0,total:0};
            productCount[n].qty+=(item.qty||1);
            productCount[n].total+=((item.priceCents||item.price||0))*(item.qty||1);
          });
        }
      });
      var topProducts=Object.keys(productCount).map(function(k){return productCount[k];});
      topProducts.sort(function(a,b){return b.total-a.total;});
      topProducts=topProducts.slice(0,5);

      // Render
      var h='';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
      h+='<div style="background:#e8f5e9;padding:14px;border-radius:10px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#2e7d32;">'+(totalAll/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:13px;color:#666;">Total ventes</div></div>';
      h+='<div style="background:#e3f2fd;padding:14px;border-radius:10px;text-align:center;"><div style="font-size:28px;font-weight:700;color:#1565c0;">'+salesCount+'</div><div style="font-size:13px;color:#666;">Transactions</div></div>';
      h+='</div>';

      h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">';
      h+='<div style="background:#fff3e0;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#e65100;">'+(totalCash/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:12px;color:#666;">💵 Espèces ('+paymentCounts.especes+')</div></div>';
      h+='<div style="background:#f3e5f5;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#7b1fa2;">'+(totalCb/100).toFixed(2).replace(".",",")+' €</div><div style="font-size:12px;color:#666;">💳 CB ('+paymentCounts.cb+')</div></div>';
      h+='<div style="background:#e0f7fa;padding:10px;border-radius:8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#00838f;">'+totalItems+'</div><div style="font-size:12px;color:#666;">📦 Articles</div></div>';
      h+='</div>';

      if(totalDiscount>0){
        h+='<div style="padding:8px 12px;background:#fce4ec;border-radius:8px;margin-bottom:12px;font-size:14px;color:#c62828;text-align:center;"> remises accordées : -'+(totalDiscount/100).toFixed(2).replace(".",",")+' €</div>';
      }

      if(topProducts.length>0){
        h+='<div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a2e;">🏆 Top produits</div>';
        topProducts.forEach(function(p,i){
          h+='<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:4px;">';
          h+='<span style="font-size:16px;">'+(i===0?"🥇":i===1?"🥈":i===2?"🥉":"  ")+'</span>';
          h+='<span style="flex:1;font-size:14px;font-weight:600;">'+p.name+'</span>';
          h+='<span style="font-size:13px;color:#666;">x'+p.qty+'</span>';
          h+='<span style="font-size:14px;font-weight:700;color:#e65100;">'+(p.total/100).toFixed(2).replace(".",",")+' €</span>';
          h+='</div>';
        });
      }

      content.innerHTML=h;
    });
  }

  // ─── PRODUCT AUDIT ──────────────────────────────────
  function _showProductAudit(){
    var old=document.getElementById("acim-audit");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-audit";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:600px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:4px;color:#1a1a2e;";
    ti.textContent="🔍 Vérification du catalogue";card.appendChild(ti);
    var sub=document.createElement("div");sub.style.cssText="font-size:15px;color:#666;margin-bottom:16px;";
    sub.textContent="Analyse de vos produits — doublons, erreurs, suggestions";card.appendChild(sub);

    var listDiv=document.createElement("div");listDiv.id="acim-audit-list";
    listDiv.style.cssText="min-height:60px;";listDiv.innerHTML='<div style="text-align:center;padding:20px;color:#999;">Analyse en cours...</div>';
    card.appendChild(listDiv);

    var btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;";
    var bAutoFix=document.createElement("button");bAutoFix.textContent="🤖 Auto-corriger tout";
    bAutoFix.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bAutoFix.onclick=function(){_auditAutoFix(listDiv,bAutoFix);};
    var bAutoMerge=document.createElement("button");bAutoMerge.textContent="🔗 Auto-fusionner doublons";
    bAutoMerge.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#6a1b9a;color:#fff;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bAutoMerge.onclick=function(){_auditAutoMerge(listDiv,bAutoMerge);};
    var bSetPrices=document.createElement("button");bSetPrices.textContent="💰 Fixer tous les prix";
    bSetPrices.style.cssText="flex:1;padding:12px;border:2px solid #2e7d32;border-radius:8px;background:#e8f5e9;color:#2e7d32;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bSetPrices.onclick=function(){_auditBulkSetPrice();};
    var bMatchInvoice=document.createElement("button");bMatchInvoice.textContent="🔗 Lier produits facture → catalogue";
    bMatchInvoice.style.cssText="flex:1;padding:12px;border:none;border-radius:8px;background:#00695c;color:#fff;font-size:15px;cursor:pointer;font-weight:700;min-width:160px;";
    bMatchInvoice.onclick=function(){_auditMatchInvoiceProducts(listDiv,bMatchInvoice);};
    var bFixNames=document.createElement("button");bFixNames.textContent="🏷️ Fixer tous les noms";
    bFixNames.style.cssText="flex:1;padding:12px;border:2px solid #e65100;border-radius:8px;background:#fff3e0;color:#e65100;font-size:17px;cursor:pointer;font-weight:700;min-width:140px;";
    bFixNames.onclick=function(){_auditBulkFixNames(listDiv,bFixNames);};
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:0 0 100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:17px;cursor:pointer;margin-top:4px;";
    bClose.onclick=function(){ov.remove();};
    btnRow.appendChild(bAutoFix);btnRow.appendChild(bAutoMerge);btnRow.appendChild(bMatchInvoice);btnRow.appendChild(bSetPrices);btnRow.appendChild(bFixNames);btnRow.appendChild(bClose);card.appendChild(btnRow);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // Run audit async
    setTimeout(function(){_runAudit(listDiv);},100);
  }

  function _runAudit(container){
    _dbGetAll().then(function(products){
      var issues=[];

      // 1. Check duplicates (same name or same barcode)
      var byName={};var byBc={};
      products.forEach(function(p){
        var n=(p.name||"").toLowerCase().trim();
        var b=(p.barcode||"").trim();
        if(n){if(!byName[n])byName[n]=[];byName[n].push(p);}
        if(b){if(!byBc[b])byBc[b]=[];byBc[b].push(p);}
      });
      Object.keys(byName).forEach(function(n){
        if(byName[n].length>1){
          issues.push({type:"duplicate-name",label:'Doublon nom: "'+byName[n][0].name+'"',items:byName[n],icon:"👥"});
        }
      });
      Object.keys(byBc).forEach(function(b){
        if(byBc[b].length>1){
          issues.push({type:"duplicate-bc",label:'Doublon code-barres: '+b,items:byBc[b],icon:"👥"});
        }
      });

      // 2. No price
      products.forEach(function(p){
        if(!p.sale_price_cents||p.sale_price_cents<=0){
          issues.push({type:"no-price",label:'Sans prix: '+(p.name||p.barcode),items:[p],icon:"💰"});
        }
      });

      // 3. Wrong category (can be guessed)
      products.forEach(function(p){
        var guessed=_guessCategory(p.name);
        if(guessed&&p.category!==guessed){
          issues.push({type:"wrong-cat",label:'Mauvaise catégorie: "'+p.name+'" → '+_catIcon(guessed)+' '+guessed,items:[p],icon:"📂",suggestedCat:guessed});
        }
      });

      // 4. No category
      products.forEach(function(p){
        if(!p.category||p.category==="autre"){
          var guessed=_guessCategory(p.name);
          if(guessed){
            issues.push({type:"no-cat",label:'Catégorie suggérée: "'+p.name+'" → '+_catIcon(guessed)+' '+guessed,items:[p],icon:"📂",suggestedCat:guessed});
          }
        }
      });

      // 5. Weird names (too short, just numbers, etc.)
      products.forEach(function(p){
        var n=(p.name||"").trim();
        if(n.length<2){issues.push({type:"bad-name",label:'Nom invalide: "'+n+'" ('+p.barcode+')',items:[p],icon:"⚠️"});}
        if(/^\d+$/.test(n)){issues.push({type:"bad-name",label:'Nom numérique: "'+n+'" ('+p.barcode+')',items:[p],icon:"⚠️"});}
      });

      // 6. Zero stock with sales history? (potential issue)
      // Skip for now

      // Render
      container.innerHTML="";
      if(issues.length===0){
        container.innerHTML='<div style="text-align:center;padding:30px;color:#2e7d32;font-size:18px;">✅ Aucun problème détecté !<br><span style="font-size:14px;color:#666;">'+products.length+' produits analysés</span></div>';
        return;
      }

      var summary=document.createElement("div");
      summary.style.cssText="padding:10px;background:#fff3e0;border-radius:8px;margin-bottom:12px;font-size:15px;color:#e65100;";
      summary.textContent="⚠️ "+issues.length+" anomalie(s) trouvée(s) sur "+products.length+" produits";
      container.appendChild(summary);

      issues.forEach(function(issue,idx){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:6px;";
        var icon=document.createElement("span");icon.textContent=issue.icon;
        icon.style.cssText="font-size:20px;flex-shrink:0;";
        var label=document.createElement("span");label.textContent=issue.label;
        label.style.cssText="flex:1;font-size:15px;color:#1a1a2e;";
        row.appendChild(icon);row.appendChild(label);

        if(issue.type==="wrong-cat"||issue.type==="no-cat"){
          var fixBtn=document.createElement("button");fixBtn.textContent="→ "+_catIcon(issue.suggestedCat)+" "+issue.suggestedCat;
          fixBtn.style.cssText="padding:6px 12px;border:2px solid #1565c0;border-radius:6px;background:#e3f2fd;font-size:14px;cursor:pointer;font-weight:600;color:#1565c0;white-space:nowrap;";
          fixBtn.onclick=function(){
            var p=issue.items[0];
            p.category=issue.suggestedCat;
            _dbPut(p).then(function(){
              row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
              fixBtn.textContent="✅ Fait";fixBtn.disabled=true;fixBtn.style.opacity="0.5";
              _toast("📂 "+p.name+" → "+issue.suggestedCat);
            });
          };
          row.appendChild(fixBtn);
        }

        if(issue.type==="duplicate-name"||issue.type==="duplicate-bc"){
          var mergeBtn=document.createElement("button");mergeBtn.textContent="🔄 Fusionner";
          mergeBtn.style.cssText="padding:6px 12px;border:2px solid #e65100;border-radius:6px;background:#fff3e0;font-size:14px;cursor:pointer;font-weight:600;color:#e65100;white-space:nowrap;";
          mergeBtn.onclick=function(){
            _auditMergeDialog(issue.items);row.style.background="#e8f5e9";
            mergeBtn.textContent="✅";mergeBtn.disabled=true;mergeBtn.style.opacity="0.5";
          };
          row.appendChild(mergeBtn);

          var delBtn=document.createElement("button");delBtn.textContent="🗑️";
          delBtn.style.cssText="padding:6px 8px;border:2px solid #c62828;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;color:#c62828;";
          delBtn.onclick=function(){
            if(issue.items.length>1){
              _auditDeleteDuplicates(issue.items,row,delBtn);
            }
          };
          row.appendChild(delBtn);
        }

        if(issue.type==="no-price"){
          var editBtn=document.createElement("button");editBtn.textContent="✏️ Prix";
          editBtn.style.cssText="padding:6px 12px;border:2px solid #2e7d32;border-radius:6px;background:#e8f5e9;font-size:14px;cursor:pointer;font-weight:600;color:#2e7d32;white-space:nowrap;";
          editBtn.onclick=function(){
            _auditSetPrice(issue.items[0],row,editBtn);
          };
          row.appendChild(editBtn);
        }

        if(issue.type==="bad-name"){
          var delBtn2=document.createElement("button");delBtn2.textContent="🗑️ Supprimer";
          delBtn2.style.cssText="padding:6px 12px;border:2px solid #c62828;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;color:#c62828;font-weight:600;";
          delBtn2.onclick=function(){
            _dbDelete(issue.items[0].barcode).then(function(){
              row.style.background="#ffebee";row.style.borderColor="#c62828";
              delBtn2.textContent="✅ Supprimé";delBtn2.disabled=true;delBtn2.style.opacity="0.5";
              _toast("🗑️ Produit supprimé");
            });
          };
          row.appendChild(delBtn2);
        }

        container.appendChild(row);
      });
    });
  }

  function _auditAutoMerge(container,btn){
    btn.textContent="⏳ Fusion...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var byName={},byBc={};
      products.forEach(function(p){
        var n=(p.name||"").toLowerCase().trim();
        var b=(p.barcode||"").trim();
        if(n){if(!byName[n])byName[n]=[];byName[n].push(p);}
        if(b){if(!byBc[b])byBc[b]=[];byBc[b].push(p);}
      });
      var toDelete=[];
      // Merge duplicate names: keep the best one
      Object.keys(byName).forEach(function(n){
        var group=byName[n];
        if(group.length<2)return;
        var best=_pickBest(group);
        group.forEach(function(p){
          if(p.barcode!==best.barcode)toDelete.push(p);
        });
      });
      // Merge duplicate barcodes: keep the best one
      Object.keys(byBc).forEach(function(b){
        var group=byBc[b];
        if(group.length<2)return;
        var best=_pickBest(group);
        group.forEach(function(p){
          if(p.barcode!==best.barcode)toDelete.push(p);
        });
      });
      // Deduplicate delete list
      var seen={};
      toDelete=toDelete.filter(function(p){
        var k=p.barcode||"";
        if(seen[k])return false;
        seen[k]=true;return true;
      });
      // Delete all at once
      var chain=Promise.resolve();
      toDelete.forEach(function(p){
        chain=chain.then(function(){
          return _dbDelete(p.barcode);
        });
      });
      chain.then(function(){
        _toast("🔗 "+toDelete.length+" doublon(s) supprimé(s)");
        btn.textContent="🔗 Auto-fusionner doublons";btn.disabled=false;btn.style.opacity="1";
        _runAudit(container);
      });
    });
  }
  function _pickBest(group){
    var best=group[0];
    for(var i=1;i<group.length;i++){
      var p=group[i];
      var bestScore=(best.sale_price_cents||0)+(best.stockQty||0)*0.1;
      var pScore=(p.sale_price_cents||0)+(p.stockQty||0)*0.1;
      if(p.barcode&&!best.barcode){best=p;continue;}
      if(pScore>bestScore)best=p;
    }
    return best;
  }

  function _auditMergeDialog(products){
    var ov=document.createElement("div");ov.id="acim-merge";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000004;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:400px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:20px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="🔄 Fusionner les doublons";card.appendChild(ti);
    var info=document.createElement("div");info.style.cssText="font-size:15px;color:#666;margin-bottom:12px;";
    info.textContent=products.length+" produits avec le même nom. Choisissez lequel garder :";
    card.appendChild(info);

    products.forEach(function(p){
      var row=document.createElement("div");
      row.style.cssText="display:flex;align-items:center;gap:8px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:all .15s;";
      row.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
      row.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
      var ic=document.createElement("span");ic.textContent=_catIcon(p.category);ic.style.cssText="font-size:20px;";
      var nm=document.createElement("span");nm.textContent=p.name||"?";nm.style.cssText="flex:1;font-size:15px;font-weight:600;";
      var pr=document.createElement("span");pr.textContent=(p.sale_price_cents/100).toFixed(2)+"€";
      pr.style.cssText="font-size:15px;color:#e65100;font-weight:700;";
      var bc=document.createElement("span");bc.textContent=p.barcode||"no bc";bc.style.cssText="font-size:12px;color:#999;";
      row.appendChild(ic);row.appendChild(nm);row.appendChild(pr);row.appendChild(bc);
      row.onclick=function(){
        // Keep this one, delete the rest
        var others=products.filter(function(x){return x.barcode!==p.barcode;});
        var chain=Promise.resolve();
        others.forEach(function(x){chain=chain.then(function(){return _dbDelete(x.barcode);});});
        chain.then(function(){
          ov.remove();
          _toast("✅ Gardé: "+p.name+" ("+others.length+" supprimé(s))");
          _showProductAudit();
        });
      };
      card.appendChild(row);
    });

    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="width:100%;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;margin-top:8px;";
    bClose.onclick=function(){ov.remove();};
    card.appendChild(bClose);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  function _auditDeleteDuplicates(products,row,btn){
    // Keep first, delete rest
    var keep=products[0];
    var toDelete=products.slice(1);
    var chain=Promise.resolve();
    toDelete.forEach(function(p){chain=chain.then(function(){return _dbDelete(p.barcode);});});
    chain.then(function(){
      row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
      btn.textContent="✅ "+toDelete.length+" supprimé(s)";btn.disabled=true;btn.style.opacity="0.5";
      _toast("🗑️ "+toDelete.length+" doublon(s) supprimé(s), gardé: "+keep.name);
    });
  }

  function _auditSetPrice(product,row,btn){
    var price=prompt('Prix pour "'+product.name+'" (en €, ex: 5.50):');
    if(price===null)return;
    var cents=Math.round(parseFloat(price)*100);
    if(isNaN(cents)||cents<=0){_toast("❌ Prix invalide");return;}
    product.sale_price_cents=cents;
    _dbPut(product).then(function(){
      row.style.background="#e8f5e9";row.style.borderColor="#2e7d32";
      btn.textContent="✅ "+(cents/100).toFixed(2)+"€";btn.disabled=true;btn.style.opacity="0.5";
      _toast("💰 Prix mis à jour: "+product.name+" → "+(cents/100).toFixed(2)+"€");
    });
  }

  function _auditAutoFix(container,btn){
    btn.textContent="⏳ Correction en cours...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var fixed=0;
      var chain=Promise.resolve();
      products.forEach(function(p){
        chain=chain.then(function(){
          var changed=false;
          // Auto-fix wrong category
          if(!p.category||p.category==="autre"){
            var guessed=_guessCategory(p.name);
            if(guessed){p.category=guessed;changed=true;}
          }
          // Also fix if category doesn't match anymore
          var guessed2=_guessCategory(p.name);
          if(guessed2&&p.category!==guessed2){
            // Only override "autre", don't force if user chose something specific
            if(p.category==="autre"||!p.category){p.category=guessed2;changed=true;}
          }
          // Fix bad names (too short or numeric only)
          var n=(p.name||"").trim();
          if(n.length<2||/^\d+$/.test(n)){
            p.name=p.barcode||"Produit "+Date.now();
            changed=true;
          }
          if(changed){fixed++;return _dbPut(p);}
        });
      });
      chain.then(function(){
        _toast("🤖 "+fixed+" produit(s) auto-corrigé(s)");
        _runAudit(container);
        btn.textContent="🤖 Auto-corriger tout";btn.disabled=false;btn.style.opacity="1";
      });
    });
  }

  function _auditBulkSetPrice(){
    var price=prompt("Prix par défaut pour tous les produits sans prix (en €, ex: 5.00):");
    if(price===null)return;
    var cents=Math.round(parseFloat(price)*100);
    if(isNaN(cents)||cents<=0){_toast("❌ Prix invalide");return;}
    _dbGetAll().then(function(products){
      var fixed=0,chain=Promise.resolve();
      products.forEach(function(p){
        if(!p.sale_price_cents||p.sale_price_cents<=0){
          chain=chain.then(function(){
            p.sale_price_cents=cents;p.last_updated=Date.now();
            return _dbPut(p).then(function(){fixed++;});
          });
        }
      });
      chain.then(function(){
        _toast("💰 "+fixed+" produit(s) mis à "+(cents/100).toFixed(2)+"€");
        var auditList=document.getElementById("acim-audit-list");
        if(auditList)_runAudit(auditList);
      });
    });
  }
  function _auditBulkFixNames(container,btn){
    btn.textContent="⏳ Correction...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var fixed=0,chain=Promise.resolve();
      products.forEach(function(p){
        var n=(p.name||"").trim();
        var bad=n.length<2||/^\d+$/.test(n);
        if(bad){
          chain=chain.then(function(){
            p.name=p.barcode||"Produit "+Date.now();
            p.last_updated=Date.now();
            return _dbPut(p).then(function(){fixed++;});
          });
        }
      });
      chain.then(function(){
        _toast("🏷️ "+fixed+" nom(s) corrigé(s)");
        btn.textContent="🏷️ Fixer tous les noms";btn.disabled=false;btn.style.opacity="1";
        _runAudit(container);
      });
    });
  }

  // ─── MATCH INVOICE PRODUCTS TO YARDEN ────────────────
  function _cleanInvoiceName(name){
    var n=(name||"").trim();
    // Remove encoding artifacts
    n=n.replace(/[�ǸǮǼǽǾǵ]/g,"");
    // Remove garbage suffixes from BKR/OFF/VIA format: ", , % € V00", ", , € V01"
    n=n.replace(/, ,\s*%\s*[€']\s*V\d{2}/g,"");
    n=n.replace(/, ,\s*[€']\s*V\d{2}/g,"");
    // Remove unit prefixes like "Kilogram "
    n=n.replace(/\b(Kilogram|Litres?|Portions?|Pièces?)\s+/gi,"");
    // Remove trailing units and prices: "G '€", "grs '€", "g '€", "ml '€", "kg '€"
    n=n.replace(/(?:\s+(?:g(?:rs?)?|ml|kg|L)\s*['€]+\s*['€]*)\s*$/,"");
    n=n.replace(/\s*['][€]\s*$/,"");
    n=n.replace(/\s*['][€]['][€]\s*$/,"");
    // Remove status flags
    n=n.replace(/\s*(?:PRIX\s+NET|PROMO|RUPTURE|BAISSE|PRIX\s+EN)\s*/gi,"");
    // Remove date suffixes (months)
    n=n.replace(/\s+(?:Janvier|Février|Mars|Avril|Mai|Juin|Juil(?:let)?|Août|Sept(?:embre)?|Oct(?:obre)?|Nov(?:embre)?|Déc(?:embre)?)\s*/gi,"");
    // Remove "R" prefix (product code prefix used by supplier)
    n=n.replace(/^R(?=[A-Z])/,"");
    // Remove leading codes like "BKR/S018 ", "OFF001 ", "VIA200 ", "TOMA/A/S "
    n=n.replace(/^[A-Z0-9]{2,}\/[A-Z0-9]+\s+/,"");
    n=n.replace(/^[A-Z]{2,}\d+\s+/,"");
    // Collapse multiple spaces
    n=n.replace(/\s+/g," ").trim();
    return n;
  }

  function _isGarbageName(name){
    var n=(name||"").trim().toLowerCase();
    // All numeric
    if(/^\d+$/.test(n))return true;
    // IBAN / bank
    if(/^fr\d{2}/i.test(n))return true;
    if(/iban|bic|siret|tva/i.test(n))return true;
    // Legal clauses
    if(n.indexOf("marchandises faisant l'objet")>=0)return true;
    if(n.indexOf("société au capital")>=0)return true;
    // Invoice references
    if(/^fas\d{6}/i.test(n))return true;
    if(/^n[°]?\s*bc\s*\/\s*date/i.test(n))return true;
    if(/^bc\d{4,}/i.test(n))return true;
    // Shipping/port fees
    if(/^z?port\s+.*frais/i.test(n))return true;
    // Pure garbage codes
    if(/^v\d{2}\s*['€%]\s*['€%]\s*$/.test(n))return true;
    // Tariff change headers
    if(/changement de tarif|nouveau tarif|applicable au/i.test(n))return true;
    // Company info lines
    if(/royal wine europe/i.test(n))return true;
    // Invoices numbers only
    if(/^\d{6,10}$/.test(n)&&parseInt(n)>100000)return true;
    // Partial dates
    if(/^au\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*$/i.test(n))return true;
    return false;
  }

  function _auditMatchInvoiceProducts(container,btn){
    btn.textContent="⏳ Analyse...";btn.disabled=true;btn.style.opacity="0.5";
    _dbGetAll().then(function(products){
      var invProducts=products.filter(function(p){return p.source==="invoice-import";});
      var yardenProducts=products.filter(function(p){return p.source==="yarden-catalog"||!p.source;});
      var matched=0,garbage=0,unmatched=0,transferred=0;
      var report=[];
      var chain=Promise.resolve();

      invProducts.forEach(function(p){
        chain=chain.then(function(){
          // Delete garbage entries
          if(_isGarbageName(p.name)){
            garbage++;
            report.push({action:"🗑️ Supprimé (garbage): "+p.name+" ("+p.barcode+")"});
            return _dbDelete(p.barcode);
          }
          // Clean name and try fuzzy match
          var cleanName=_cleanInvoiceName(p.name);
          if(!cleanName||cleanName.length<2){
            garbage++;
            report.push({action:"🗑️ Supprimé (nom vide): "+p.name+" ("+p.barcode+")"});
            return _dbDelete(p.barcode);
          }
          var best=null,bestScore=0;
          for(var yi=0;yi<yardenProducts.length;yi++){
            var sc=_fuzzyScore(cleanName,yardenProducts[yi].name);
            if(sc>bestScore&&sc>=60){bestScore=sc;best=yardenProducts[yi];}
          }
          if(best){
            var changed=false;
            // Transfer stock
            if(p.stockQty>0&&(!best.stockQty||best.stockQty===0)){best.stockQty=p.stockQty;changed=true;}
            // Transfer price (keep max)
            if(p.sale_price_cents>0&&(!best.sale_price_cents||best.sale_price_cents===0)){best.sale_price_cents=p.sale_price_cents;changed=true;}
            else if(p.sale_price_cents>0&&best.sale_price_cents>0&&p.sale_price_cents!==best.sale_price_cents){
              best.sale_price_cents=Math.max(p.sale_price_cents,best.sale_price_cents);changed=true;
            }
            if(changed){
              best.last_updated=Date.now();
              return _dbPut(best).then(function(){
                return _dbDelete(p.barcode).then(function(){
                  matched++;transferred++;
                  report.push({action:"✅ "+best.name+" ← stock="+p.stockQty+" prix="+(p.sale_price_cents/100).toFixed(2)+"€ (score:"+bestScore+"%)"});
                });
              });
            }else{
              return _dbDelete(p.barcode).then(function(){
                matched++;
                report.push({action:"✅ "+best.name+" (déjà à jour, doublon supprimé)"});
              });
            }
          }else{
            unmatched++;
            report.push({action:"❌ Non matché: "+p.name+" → net: "+cleanName+" ("+p.barcode+")"});
          }
        });
      });

      chain.then(function(){
        var msg="✅ "+matched+" matché(s) dont "+transferred+" transfert(s), "+garbage+" garbage supprimé(s), "+unmatched+" non matché(s)";
        _toast(msg);
        container.innerHTML="<div style='padding:10px;background:#e8f5e9;border-radius:8px;margin-bottom:12px;font-size:15px;color:#2e7d32;font-weight:700;'>"+msg+"</div>";
        var list=document.createElement("div");
        list.style.cssText="max-height:250px;overflow-y:auto;font-size:13px;";
        report.forEach(function(r){
          var row=document.createElement("div");row.style.cssText="padding:3px 6px;border-bottom:1px solid #f0f0f0;";
          row.textContent=r.action;list.appendChild(row);
        });
        container.appendChild(list);
        btn.textContent="🔗 Lier produits facture → catalogue";btn.disabled=false;btn.style.opacity="1";
      });
    });
  }

  // ─── TOAST ────────────────────────────────────────────
  function _toast(msg){
    if(!msg)return;var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";t.textContent=msg;
    t.style.cssText="position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},2500);
  }

  // ─── AUTO-MATCH INVOICE PRODUCTS ON STARTUP ────────
  var _INVOICE_MATCHED_KEY="acim-invoice-matched-v1";
  function _autoMatchInvoiceProducts(){
    _log("Checking invoice products...");
    return _openMeta().then(function(d){
      if(!d)return 0;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get(_INVOICE_MATCHED_KEY);
        r.onsuccess=function(){
          if(r.result&&r.result.value){ok(0);return;}
          // Run the matching silently
          _dbGetAll().then(function(products){
            var invProducts=products.filter(function(p){return p.source==="invoice-import";});
            var yardenProducts=products.filter(function(p){return p.source==="yarden-catalog"||!p.source;});
            if(invProducts.length===0){ok(0);return;}
            var matched=0,garbage=0,unmatched=0;
            var chain=Promise.resolve();
            invProducts.forEach(function(p){
              chain=chain.then(function(){
                if(_isGarbageName(p.name)){garbage++;return _dbDelete(p.barcode);}
                var cleanName=_cleanInvoiceName(p.name);
                if(!cleanName||cleanName.length<2){garbage++;return _dbDelete(p.barcode);}
                var best=null,bestScore=0;
                for(var yi=0;yi<yardenProducts.length;yi++){
                  var sc=_fuzzyScore(cleanName,yardenProducts[yi].name);
                  if(sc>bestScore&&sc>=60){bestScore=sc;best=yardenProducts[yi];}
                }
                if(best){
                  var changed=false;
                  if(p.stockQty>0&&(!best.stockQty||best.stockQty===0)){best.stockQty=p.stockQty;changed=true;}
                  if(p.sale_price_cents>0&&(!best.sale_price_cents||best.sale_price_cents===0)){best.sale_price_cents=p.sale_price_cents;changed=true;}
                  else if(p.sale_price_cents>0&&best.sale_price_cents>0&&p.sale_price_cents!==best.sale_price_cents){
                    best.sale_price_cents=Math.max(p.sale_price_cents,best.sale_price_cents);changed=true;
                  }
                  if(changed){best.last_updated=Date.now();return _dbPut(best).then(function(){return _dbDelete(p.barcode).then(function(){matched++;});});}
                  else {return _dbDelete(p.barcode).then(function(){matched++;});}
                }else{unmatched++;}
              });
            });
            chain.then(function(){
              _log("Auto-match: "+matched+" matché(s), "+garbage+" garbage, "+unmatched+" non matché(s)");
              // Mark as done
              var tx=d.transaction("meta","readwrite");
              tx.objectStore("meta").put({key:_INVOICE_MATCHED_KEY,value:true});
              ok(matched+garbage);
            });
          });
        };
        r.onerror=function(){ok(0);};
      });
    }).catch(function(){return 0;});
  }

  // ─── PRODUCT IMAGES (Open Food Facts) ────────────────
  var _imgCache={};
  var _imgQueue=[];
  var _imgProcessing=false;
  var _imgTotalFetched=0;

  function _getCachedImage(bc){
    if(_imgCache[bc]!==undefined)return Promise.resolve(_imgCache[bc]);
    return _openMeta().then(function(d){
      if(!d)return null;
      return new Promise(function(ok){
        var r=d.transaction("meta","readonly").objectStore("meta").get("img-"+bc);
        r.onsuccess=function(){var v=r.result?r.result.value:null;_imgCache[bc]=v;ok(v);};
        r.onerror=function(){ok(null);};
      });
    });
  }
  function _cacheImage(bc,url){
    _imgCache[bc]=url;
    _openMeta().then(function(d){
      if(!d)return;
      var tx=d.transaction("meta","readwrite");
      tx.objectStore("meta").put({key:"img-"+bc,value:url});
    });
  }
  function _fetchImageFromApi(bc){
    if(!/^\d{8,13}$/.test(bc))return Promise.resolve(null);
    return fetch("https://world.openfoodfacts.org/api/v0/product/"+bc+".json",{headers:{"User-Agent":"AcimCaisse/1.0"}}).then(function(r){
      if(!r.ok)return null;
      return r.json();
    }).then(function(d){
      if(!d||!d.product)return null;
      var u=d.product.image_front_small_url||d.product.image_front_url||d.product.image_url;
      if(!u)return null;
      return fetch(u).then(function(ir){
        if(!ir.ok)return null;
        return ir.blob();
      }).then(function(b){
        if(!b)return null;
        return new Promise(function(ok){
          var rd=new FileReader();
          rd.onload=function(){ok(rd.result);};
          rd.onerror=function(){ok(null);};
          rd.readAsDataURL(b);
        });
      });
    }).catch(function(){return null;});
  }
  function _enqueueImage(bc,cb){
    if(!bc||_imgCache[bc]!==undefined)return;
    _imgQueue.push({bc:bc,cb:cb});
    _processImageQueue();
  }
  function _processImageQueue(){
    if(_imgProcessing||_imgQueue.length===0)return;
    _imgProcessing=true;
    var item=_imgQueue.shift();
    _fetchImageFromApi(item.bc).then(function(dataUrl){
      if(dataUrl){_cacheImage(item.bc,dataUrl);_imgTotalFetched++;}else{_imgCache[item.bc]=null;}
      if(item.cb)item.cb(dataUrl);
      _imgProcessing=false;
      _processImageQueue();
    }).catch(function(){_imgProcessing=false;_processImageQueue();});
  }

  // ─── INIT ────────────────────────────────────────────
  function init(){
    if(!_acquireTabLock()){_toast("⚠ Caisse déjà ouverte dans un autre onglet");return;}
    Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]).then(function(){
      _log("v37 — bug fixes + catégorisation + photos");
      _importBackupFromEmbedded().then(function(imported){
        if(imported)_toast("✅ Catalogue importé (38 produits)");
        return _importSupplierCatalogFromMeta();
      }).then(function(imported){
        if(imported>0)_toast("✅ "+imported+" produits catalogue fournisseur importés");
        return _importYardenCatalog();
      }).then(function(yardenCount){
        if(yardenCount>0)_toast("✅ "+yardenCount+" produits Yarden importés");
        return _autoMatchInvoiceProducts();
      }).then(function(cleaned){
        if(cleaned>0)_toast("🔗 "+cleaned+" produit(s) facture synchronisé(s)");
        return _dbGetAll();
      }).then(function(all){
        _allProducts=all||[];
        _log("Produits chargés: "+_allProducts.length);
        _createPOS();
        _renderPOS();
      }).catch(function(e){
        _err("Init error:",e);
        _allProducts=[];
        _createPOS();
        _renderPOS();
      });
    });
    document.addEventListener("keydown",function(e){
      if(e.ctrlKey&&e.key==="k"){e.preventDefault();if(_posSearch)_posSearch.focus();}
      if(e.ctrlKey&&e.key==="n"){e.preventDefault();_quickCreate("",0);}
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();

  window._acimGetCartInfo=_cartInfo;
  window._acimDebug=function(){return{cart:_myCart.length,ticket:_ticketSeq};};
  window._acimProcessBarcode=_processBarcode;
  window._acimAddToCart=function(name,price,cat){_addToCart(name,price,"",cat);};
  window._acimWeighProduct=_weighProduct;
})();
