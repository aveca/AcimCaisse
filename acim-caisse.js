// ─── AcimCaisse v34 — POS complet: paiement + remise + historique + stocks + factures + barcodes ──
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
  var _bcSeq=1000;
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
  var _ticketSeq=1;
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
    {id:"viande",ic:"🥩"}, {id:"laitier",ic:"🧀"}, {id:"epicerie",ic:"🏪"},
    {id:"boulangerie",ic:"🍞"}, {id:"boisson",ic:"🥤"}, {id:"surgelé",ic:"🧊"},
    {id:"snack",ic:"🍪"}, {id:"condiment",ic:"🧂"}, {id:"menager",ic:"🧴"},
    {id:"vin",ic:"🍷"}, {id:"autre",ic:"📦"}
  ];
  function _catIcon(id){
    for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i].ic;
    return "📦";
  }

  // ─── CATALOGUE IndexedDB ─────────────────────────────
  var _db=null;
  function _openDB(){
    if(_db)return Promise.resolve(_db);
    return new Promise(function(ok){try{var r=indexedDB.open("acim-catalog",1);
      r.onupgradeneeded=function(e){var d=e.target.result;if(!d.objectStoreNames.contains("products"))d.createObjectStore("products",{keyPath:"barcode"});};
      r.onsuccess=function(e){_db=e.target.result;ok(_db);};r.onerror=function(){ok(null);};}catch(e){ok(null);}});}
  function _dbGet(bc){return _openDB().then(function(d){if(!d)return null;
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").get(bc);r.onsuccess=function(){ok(r.result||null);};r.onerror=function(){ok(null);};});});}
  function _dbPut(p){return _openDB().then(function(d){if(!d)return;
    return new Promise(function(ok){var tx=d.transaction("products","readwrite");tx.objectStore("products").put(p);tx.oncomplete=ok;tx.onerror=ok;});});}
  function _dbGetAll(){return _openDB().then(function(d){if(!d)return[];
    return new Promise(function(ok){var r=d.transaction("products","readonly").objectStore("products").getAll();r.onsuccess=function(){ok(r.result||[]);};r.onerror=function(){ok([]);};});});}

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
  var _BACKUP_DATA={"format":1,"categories":[{"id":"13b06477","name":"Frais"},{"id":"562843c7","name":"Sec"},{"id":"adb67835","name":"Congele"},{"id":"0bfc0834","name":"Divers"},{"id":"a7a910fe","name":"Vin"},{"id":"16a4e603","name":"Alcool"}],"products":[{"n":"R#E_Gourmet# Viennoisses Volaille Mron","c":"0bfc0834","p":0,"s":80},{"n":"R[Guli] Mortadelle Volaille","c":"0bfc0834","p":0,"s":20},{"n":"R[Guli] Cabanossi Gendarme","c":"0bfc0834","p":0,"s":12},{"n":"R[Guli] Bavarois Mini Kabanos","c":"0bfc0834","p":0,"s":36},{"n":"R[Guli] Panais Entier","c":"0bfc0834","p":0,"s":60},{"n":"Bissli Falafel OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Grill OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Boulgar OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Hot OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bamba OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bamba OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Tapouk OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Tapouk OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Cracotte OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Cracotte OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Krembo OSEM Vanille","c":"16a4e603","p":500,"s":0},{"n":"Krembo OSEM Chocolat","c":"16a4e603","p":500,"s":0},{"n":"Aigle Noir Fumoir Saumon 200g","c":"13b06477","p":1200,"s":0},{"n":"Aigle Noir Fumoir Thon 200g","c":"13b06477","p":1000,"s":0},{"n":"Steak Hach\u00e9 5% 1kg","c":"13b06477","p":800,"s":0},{"n":"Steak Hach\u00e9 15% 1kg","c":"13b06477","p":750,"s":0},{"n":"Poulet Entier Frais","c":"13b06477","p":500,"s":0},{"n":"Cuisses de Poulet Frais 1kg","c":"13b06477","p":600,"s":0},{"n":"Blanc de Poulet Frais 1kg","c":"13b06477","p":900,"s":0},{"n":"Merguez Frais 1kg","c":"13b06477","p":700,"s":0},{"n":"Saucisse Frais 1kg","c":"13b06477","p":650,"s":0},{"n":"Escalope de Dinde Frais 1kg","c":"13b06477","p":1100,"s":0},{"n":"Agneau Hach\u00e9 1kg","c":"13b06477","p":1400,"s":0},{"n":"C\u00f4tes de Porc Frais 1kg","c":"13b06477","p":900,"s":0},{"n":"Lardons Fum\u00e9s 1kg","c":"13b06477","p":800,"s":0},{"n":"Jambon Bayonne 1kg","c":"13b06477","p":1200,"s":0},{"n":"Saumon Frais 1kg","c":"13b06477","p":1500,"s":0},{"n":"Crevettes 1kg","c":"13b06477","p":1800,"s":0},{"n":"Thon Frais 1kg","c":"13b06477","p":1600,"s":0},{"n":"Boeuf Hach\u00e9 1kg","c":"13b06477","p":1000,"s":0},{"n":"Veau Hach\u00e9 1kg","c":"13b06477","p":1200,"s":0},{"n":"Pain de Mie Complet","c":"562843c7","p":350,"s":0},{"n":"Baguette Tradition","c":"562843c7","p":120,"s":0}],"nextAutoId":38};
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
          var barcode="ACIM-DB-"+pi+"-"+Math.random().toString(36).substr(2,6);
          var catName=catMap[p.c]||"Divers";
          var mapped=catName.toLowerCase();
          if(mapped==="frais")mapped="viande";
          else if(mapped==="sec")mapped="snack";
          else if(mapped==="congele")mapped="surgelé";
          else if(mapped==="alcool")mapped="vin";
          promises.push(_dbPut({barcode:barcode,name:p.n,sale_price_cents:p.p,category:mapped,stockQty:p.s,source:"backup-import",last_updated:Date.now()}));
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
  function _cartTotal(){return _cartSubtotal()-_cartDiscountCents;}

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
    logo.textContent="🏪 AcimCaisse";logo.style.cssText="color:#fff;font-size:15px;font-weight:700;margin-right:4px;flex-shrink:0;cursor:pointer;";
    logo.onclick=function(){_showMainMenu();};
    topBar.appendChild(logo);

    _posSearch=document.createElement("input");_posSearch.id="acim-pos-search";
    _posSearch.type="text";_posSearch.placeholder="Rechercher un produit (nom ou code-barres)...";
    _posSearch.style.cssText="flex:1;padding:8px 14px;border:none;border-radius:8px;font-size:14px;outline:none;background:#2a2a4e;color:#fff;min-width:0;";
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
    newBtn.style.cssText="padding:6px 10px;border:none;border-radius:6px;background:#2a2a4e;color:#fff;font-size:16px;cursor:pointer;flex-shrink:0;";
    newBtn.onclick=function(){_quickCreate("",0);};
    topBar.appendChild(newBtn);

    var closeBtn=document.createElement("button");
    closeBtn.textContent="✕ Factures";closeBtn.title="Fermer la caisse — accéder aux factures Flutter";
    closeBtn.style.cssText="padding:6px 12px;border:1px solid rgba(255,255,255,0.3);border-radius:6px;background:transparent;color:#fff;font-size:12px;cursor:pointer;flex-shrink:0;white-space:nowrap;";
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
    cartHd.style.cssText="padding:10px 14px;background:#1a1a2e;color:#fff;font-size:13px;font-weight:700;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;";
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
    discRow.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:12px;color:#666;";
    discRow.innerHTML='<span>Remise ticket</span>';
    var discBtn=document.createElement("button");
    discBtn.textContent="Appliquer";discBtn.style.cssText="padding:3px 8px;border:1px solid #e0e0e0;border-radius:4px;background:#fff;font-size:11px;cursor:pointer;";
    discBtn.onclick=function(){_applyTicketDiscount();};
    discRow.appendChild(discBtn);
    cartFoot.appendChild(discRow);

    var totalRow=document.createElement("div");
    totalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;";
    var totalLabel=document.createElement("span");
    totalLabel.style.cssText="font-size:14px;color:#1a1a2e;";totalLabel.textContent="Sous-total";
    _posSubtotal=document.createElement("span");
    _posSubtotal.style.cssText="font-size:14px;color:#666;";_posSubtotal.textContent="0,00 €";
    totalRow.appendChild(totalLabel);totalRow.appendChild(_posSubtotal);
    cartFoot.appendChild(totalRow);

    var discTotalRow=document.createElement("div");
    discTotalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;display:none;";
    discTotalRow.id="acim-disc-row";
    var discLabel=document.createElement("span");
    discLabel.style.cssText="font-size:12px;color:#2e7d32;";discLabel.textContent="Remise";
    _posDiscount=document.createElement("span");
    _posDiscount.style.cssText="font-size:12px;color:#2e7d32;font-weight:700;";_posDiscount.textContent="-0,00 €";
    discTotalRow.appendChild(discLabel);discTotalRow.appendChild(_posDiscount);
    cartFoot.appendChild(discTotalRow);

    var finalTotalRow=document.createElement("div");
    finalTotalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";
    var finalLabel=document.createElement("span");
    finalLabel.style.cssText="font-size:16px;font-weight:700;color:#1a1a2e;";finalLabel.textContent="TOTAL";
    _posTotal=document.createElement("span");
    _posTotal.id="acim-pos-total";
    _posTotal.style.cssText="font-size:22px;font-weight:700;color:#e65100;";_posTotal.textContent="0,00 €";
    finalTotalRow.appendChild(finalLabel);finalTotalRow.appendChild(_posTotal);
    cartFoot.appendChild(finalTotalRow);

    _posCheckout=document.createElement("button");
    _posCheckout.id="acim-pos-checkout";
    _posCheckout.textContent="💰 Encaisser";
    _posCheckout.style.cssText="width:100%;padding:12px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:background .15s;";
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
    all.textContent="Tous";all.style.cssText="padding:5px 12px;border:2px solid #e65100;border-radius:16px;background:#fff3e0;font-size:12px;cursor:pointer;font-weight:700;flex-shrink:0;";
    all.onclick=function(){_activeCat="";_refreshCatPills();_filterProducts();};
    _posCats.appendChild(all);
    CATS.forEach(function(cat){
      var b=document.createElement("button");
      b.textContent=cat.ic+" "+cat.id;b.style.cssText="padding:5px 12px;border:2px solid #e0e0e0;border-radius:16px;background:#fff;font-size:12px;cursor:pointer;flex-shrink:0;transition:all .15s;";
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
      _posGrid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;font-size:14px;">Aucun produit trouvé</div>';
      return;
    }
    _filteredProducts.forEach(function(p){
      var card=document.createElement("div");
      var hasPrice=p.sale_price_cents>0;
      var isWeighable=p.pricePerUnit>0&&p.unitType;
      card.style.cssText="background:#fff;border-radius:10px;padding:10px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:2px solid "+(hasPrice||isWeighable?"transparent":"#ffe082")+";transition:all .15s;display:flex;flex-direction:column;align-items:center;text-align:center;";
      card.onmouseenter=function(){this.style.boxShadow="0 3px 12px rgba(0,0,0,0.15)";this.style.borderColor="#e65100";};
      card.onmouseleave=function(){this.style.boxShadow="0 1px 3px rgba(0,0,0,0.08)";this.style.borderColor=(hasPrice||isWeighable)?"transparent":"#ffe082";};

      var ic=document.createElement("span");
      ic.textContent=_catIcon(p.category||"autre");
      ic.style.cssText="font-size:28px;margin-bottom:4px;";
      card.appendChild(ic);

      var nm=document.createElement("div");
      nm.style.cssText="font-size:12px;font-weight:600;color:#1a1a2e;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;";
      nm.textContent=p.name||"?";card.appendChild(nm);

      if(isWeighable){
        var badge=document.createElement("div");
        badge.style.cssText="font-size:10px;color:#fff;background:#2196f3;border-radius:8px;padding:2px 6px;margin-top:4px;font-weight:600;";
        badge.textContent="⚖️ Au poids";card.appendChild(badge);
        var ppu=document.createElement("div");
        ppu.style.cssText="font-size:13px;font-weight:700;color:#e65100;margin-top:4px;";
        ppu.textContent=_formatPricePerUnit(p.pricePerUnit,p.unitType);card.appendChild(ppu);
      }else if(hasPrice){
        var pr=document.createElement("div");
        pr.style.cssText="font-size:15px;font-weight:700;color:#e65100;margin-top:4px;";
        pr.textContent=(p.sale_price_cents/100).toFixed(2)+"€";card.appendChild(pr);
      }else{
        var noPr=document.createElement("div");
        noPr.style.cssText="font-size:11px;color:#e65100;margin-top:4px;font-weight:600;";
        noPr.textContent="✏️ Sans prix";card.appendChild(noPr);
      }

      // Stock badge
      if(p.stockQty!=null&&p.stockQty!==0){
        var stBadge=document.createElement("div");
        stBadge.style.cssText="font-size:10px;color:"+(p.stockQty<5?"#c62828":"#666")+";margin-top:2px;";
        stBadge.textContent="Stock: "+p.stockQty;card.appendChild(stBadge);
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
      _posItems.innerHTML='<div style="text-align:center;padding:40px;color:#999;font-size:13px;">Aucun produit dans le ticket</div>';
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
      row.style.cssText="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid #f0f0f0;transition:background .15s;";
      row.onmouseenter=function(){this.style.background="#fafafa";};
      row.onmouseleave=function(){this.style.background="transparent";};

      var icon=document.createElement("span");
      icon.textContent=isWeighed?"⚖️":_catIcon(item.cat||"autre");
      icon.style.cssText="font-size:16px;margin-right:8px;flex-shrink:0;";
      row.appendChild(icon);

      var infoDiv=document.createElement("div");
      infoDiv.style.cssText="flex:1;min-width:0;";
      var nm=document.createElement("div");
      nm.style.cssText="font-size:12px;font-weight:600;color:"+(isZero?"#e65100":"#1a1a2e")+";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      nm.textContent=isZero?"✏️ "+item.name:item.name;
      infoDiv.appendChild(nm);

      if(isWeighed&&item.weight!=null){
        var wLine=document.createElement("div");
        wLine.style.cssText="font-size:11px;color:#666;";
        wLine.textContent=_formatWeight(item.weight,item.unitType)+" × "+_formatPricePerUnit(item.pricePerUnit,item.unitType);
        infoDiv.appendChild(wLine);
      }

      if(item.price>0){
        var pr=document.createElement("div");
        pr.style.cssText="font-size:13px;font-weight:700;color:#e65100;";
        pr.textContent=(item.price/100).toFixed(2).replace(".",",")+" €";
        infoDiv.appendChild(pr);
      }
      row.appendChild(infoDiv);

      // Action buttons
      var actions=document.createElement("div");
      actions.style.cssText="display:flex;gap:2px;flex-shrink:0;margin-left:6px;";

      var dupBtn=document.createElement("span");
      dupBtn.textContent="⟳";dupBtn.title="Ajouter encore";
      dupBtn.style.cssText="font-size:14px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#1a1a2e;opacity:0.4;";
      dupBtn.onmouseenter=function(){this.style.opacity="1";this.style.background="#f0f0f0";};
      dupBtn.onmouseleave=function(){this.style.opacity="0.4";this.style.background="transparent";};
      dupBtn.onclick=function(e){e.stopPropagation();_addToCart(item.name,item.price,item.bc,item.cat,item.weight,item.unitType,item.pricePerUnit);};
      actions.appendChild(dupBtn);

      var editBtn=document.createElement("span");
      editBtn.textContent="✏️";editBtn.title="Modifier";
      editBtn.style.cssText="font-size:12px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#1a1a2e;opacity:0.4;";
      editBtn.onmouseenter=function(){this.style.opacity="1";this.style.background="#f0f0f0";};
      editBtn.onmouseleave=function(){this.style.opacity="0.4";this.style.background="transparent";};
      editBtn.onclick=function(e){e.stopPropagation();_inlineEdit(item.idx,50,50);};
      actions.appendChild(editBtn);

      var delBtn=document.createElement("span");
      delBtn.textContent="✕";delBtn.title="Supprimer";
      delBtn.style.cssText="font-size:13px;cursor:pointer;padding:4px 6px;border-radius:4px;color:#c62828;opacity:0.4;";
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
  var _scanBuf="",_scanTimer=null;
  document.addEventListener("keydown",function(e){
    if(!_pos||_pos.style.display==="none")return;
    var tag=document.activeElement?document.activeElement.tagName:"";
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
    if(/^[0-9]$/.test(e.key)){
      _scanBuf+=e.key;
      _posSearch.value=_scanBuf;_posSearch.focus();
      _filterProducts();
      clearTimeout(_scanTimer);_scanTimer=setTimeout(function(){
        var bc=_scanBuf;
        if(bc.length>=4){_posSearch.value="";_processBarcode(bc);}
        else{_posSearch.value="";}
        _scanBuf="";
      },150);
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
      _toast("❌ Produit inconnu: "+bc);
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
    ov.style.cssText="position:fixed;top:0;left:0;right:0;0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";

    var ti=document.createElement("div");ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:4px;color:#1a1a2e;text-align:center;";
    ti.textContent="💰 Paiement";card.appendChild(ti);
    var totalLine=document.createElement("div");
    totalLine.style.cssText="font-size:28px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;";
    totalLine.textContent=(total/100).toFixed(2).replace(".",",")+" €";card.appendChild(totalLine);

    // Mode selector
    var modeRow=document.createElement("div");modeRow.style.cssText="display:flex;gap:6px;margin-bottom:16px;";
    var modes=[{id:"especes",label:"💵 Espèces"},{id:"cb",label:"💳 CB"},{id:"mixte",label:"🔀 Mixte"}];
    var selectedMode="especes";
    var modeBtns=[];
    modes.forEach(function(m){
      var b=document.createElement("button");b.textContent=m.label;
      b.style.cssText="flex:1;padding:10px;border:2px solid "+(m.id==="especes"?"#e65100":"#e0e0e0")+";border-radius:8px;background:"+(m.id==="especes"?"#fff3e0":"#fff")+";font-size:13px;cursor:pointer;font-weight:"+(m.id==="especes"?"700":"normal")+";";
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
    var cashLabel=document.createElement("div");cashLabel.style.cssText="font-size:12px;color:#666;margin-bottom:4px;";
    cashLabel.textContent="Montant reçu:";cashSection.appendChild(cashLabel);
    var cashInput=document.createElement("input");cashInput.type="number";cashInput.step="0.01";cashInput.min="0";
    cashInput.placeholder="0,00";cashInput.style.cssText="width:100%;font-size:22px;font-weight:700;padding:12px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;box-sizing:border-box;";
    cashInput.onfocus=function(){this.select();};
    cashSection.appendChild(cashInput);

    // Quick buttons
    var quickRow=document.createElement("div");quickRow.style.cssText="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;";
    var quickAmounts=[{label:"Exact",val:total},{label:"5€",val:500},{label:"10€",val:1000},{label:"20€",val:2000},{label:"50€",val:5000},{label:"100€",val:10000}];
    quickAmounts.forEach(function(qa){
      var qb=document.createElement("button");qb.textContent=qa.label;
      qb.style.cssText="padding:6px 10px;border:1px solid #e0e0e0;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;";
      qb.onclick=function(){cashInput.value=(qa.val/100).toFixed(2);_updateChange();};
      quickRow.appendChild(qb);
    });
    cashSection.appendChild(quickRow);
    card.appendChild(cashSection);

    // Change display
    var changeLine=document.createElement("div");changeLine.style.cssText="font-size:16px;font-weight:700;color:#2e7d32;text-align:center;margin:12px 0;min-height:24px;";
    changeLine.id="acim-change-line";card.appendChild(changeLine);

    // Split section (hidden by default)
    var splitSection=document.createElement("div");splitSection.id="acim-split-section";splitSection.style.cssText="display:none;";
    var splitLabel=document.createElement("div");splitLabel.style.cssText="font-size:12px;color:#666;margin-bottom:4px;";
    splitLabel.textContent="Part espèces:";splitSection.appendChild(splitLabel);
    var splitInput=document.createElement("input");splitInput.type="number";splitInput.step="0.01";splitInput.min="0";
    splitInput.placeholder="0,00";splitInput.style.cssText="width:100%;font-size:18px;font-weight:700;padding:10px;border:3px solid #e0e0e0;border-radius:8px;outline:none;text-align:center;box-sizing:border-box;";
    splitSection.appendChild(splitInput);
    var splitRemainder=document.createElement("div");splitRemainder.style.cssText="font-size:14px;color:#1565c0;text-align:center;margin-top:6px;min-height:20px;";
    splitSection.appendChild(splitRemainder);
    card.appendChild(splitSection);

    // Error line
    var errorLine=document.createElement("div");errorLine.style.cssText="font-size:13px;color:#c62828;text-align:center;min-height:20px;margin-bottom:8px;";
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
    bCancel.style.cssText="flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Valider le paiement";
    bOk.style.cssText="flex:2;padding:12px;border:none;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
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
    var lines=[];
    lines.push('<div style="text-align:center;margin-bottom:8px;font-size:16px;font-weight:700;">'+_settings.storeName+'</div>');
    lines.push('<div style="text-align:center;color:#666;font-size:11px;">Ticket n°'+ticketNum+'</div>');
    lines.push('<div style="text-align:center;color:#666;font-size:11px;">'+new Date().toLocaleString("fr-FR")+'</div>');
    lines.push('<hr style="border:none;border-top:1px dashed #ccc;margin:8px 0;">');
    items.forEach(function(it){
      var line=(it.name||"?");
      if(it.qty&&it.qty>1)line=it.qty+"× "+line;
      lines.push('<div style="display:flex;justify-content:space-between;"><span>'+line+'</span><span>'+(it.priceCents/100).toFixed(2).replace(".",",")+' €</span></div>');
    });
    lines.push('<hr style="border:none;border-top:1px dashed #ccc;margin:8px 0;">');
    if(discountCents>0){
      lines.push('<div style="display:flex;justify-content:space-between;color:#2e7d32;"><span>Remise</span><span>-'+(discountCents/100).toFixed(2).replace(".",",")+' €</span></div>');
    }
    lines.push('<div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;margin-top:8px;"><span>TOTAL</span><span>'+(total/100).toFixed(2).replace(".",",")+' €</span></div>');
    if(payments&&payments.length>0){
      lines.push('<hr style="border:none;border-top:1px dashed #ccc;margin:8px 0;">');
      payments.forEach(function(pay){
        var label=pay.method==="especes"?"💵 Espèces":pay.method==="cb"?"💳 CB":"🔀 Mixte";
        lines.push('<div style="display:flex;justify-content:space-between;"><span>'+label+'</span><span>'+(pay.amountCents/100).toFixed(2).replace(".",",")+' €</span></div>');
        if(pay.changeCents>0){
          lines.push('<div style="display:flex;justify-content:space-between;color:#2e7d32;"><span>Rendu</span><span>'+(pay.changeCents/100).toFixed(2).replace(".",",")+' €</span></div>');
        }
      });
    }
    lines.push('<hr style="border:none;border-top:1px dashed #ccc;margin:8px 0;">');
    lines.push('<div style="text-align:center;color:#666;font-size:11px;margin-top:8px;">'+_settings.footer+'</div>');
    receipt.innerHTML=lines.join("");
    var btnRow=document.createElement("div");btnRow.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bPrint=document.createElement("button");bPrint.textContent="🖨️ Imprimer";
    bPrint.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#1a1a2e;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bPrint.onclick=function(){window.print();};
    btnRow.appendChild(bClose);btnRow.appendChild(bPrint);
    receipt.appendChild(btnRow);
    ov.appendChild(receipt);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
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
    unitLabel.style.cssText="font-size:12px;color:#666;margin-bottom:12px;";
    unitLabel.textContent="Prix unitaire: "+_formatPricePerUnit(product.pricePerUnit,product.unitType);
    card.appendChild(unitLabel);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:12px;";
    var wi=document.createElement("input");wi.type="number";wi.step="0.001";wi.min="0";
    wi.placeholder="Poids";wi.style.cssText="flex:1;font-size:24px;font-weight:700;padding:12px 14px;border:3px solid #e65100;border-radius:10px;outline:none;text-align:center;";
    wi.onfocus=function(){this.select();};
    var unitSpan=document.createElement("span");
    unitSpan.style.cssText="font-size:18px;font-weight:700;color:#e65100;min-width:40px;";
    unitSpan.textContent=product.unitType||"kg";
    row.appendChild(wi);row.appendChild(unitSpan);card.appendChild(row);

    var pricePreview=document.createElement("div");
    pricePreview.style.cssText="font-size:28px;font-weight:700;color:#e65100;text-align:center;margin-bottom:16px;min-height:40px;";
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
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✅ Ajouter au ticket";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
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
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
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
    bCancel.style.cssText="flex:1;padding:8px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:13px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓ Appliquer";
    bOk.style.cssText="flex:1;padding:8px;border:none;border-radius:6px;background:#2e7d32;color:#fff;font-size:13px;cursor:pointer;font-weight:700;";
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
    var ti=document.createElement("div");ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:16px;color:#1a1a2e;text-align:center;";
    ti.textContent="🏪 Menu";card.appendChild(ti);

    var btns=[
      {label:"📋 Historique des ventes",fn:function(){ov.remove();_showHistory();}},
      {label:"📄 Importer facture fournisseur",fn:function(){ov.remove();_showInvoiceImport();}},
      {label:"🏷️ Imprimer codes-barres",fn:function(){window.open("barcode.html","_blank");}},
      {label:"⚙️ Paramètres",fn:function(){ov.remove();_showSettings();}},
    ];
    btns.forEach(function(b){
      var btn=document.createElement("button");btn.textContent=b.label;
      btn.style.cssText="width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;text-align:left;margin-bottom:8px;";
      btn.onmouseenter=function(){this.style.borderColor="#e65100";this.style.background="#fff3e0";};
      btn.onmouseleave=function(){this.style.borderColor="#e0e0e0";this.style.background="#fff";};
      btn.onclick=b.fn;card.appendChild(btn);
    });
    var bClose=document.createElement("button");bClose.textContent="✕ Fermer";
    bClose.style.cssText="width:100%;padding:10px;border:none;border-radius:8px;background:#f5f5f5;font-size:13px;cursor:pointer;margin-top:4px;";
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
    var ti=document.createElement("div");ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
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
    });
  }

  // ─── INVOICE IMPORT ──────────────────────────────────
  function _showInvoiceImport(){
    var old=document.getElementById("acim-invoice");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-invoice";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:400px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📄 Importer une facture fournisseur";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:12px;";
    desc.textContent="Sélectionnez un fichier PDF de facture fournisseur pour importer les produits dans le catalogue.";
    card.appendChild(desc);

    var fileInput=document.createElement("input");fileInput.type="file";fileInput.accept=".pdf,.json,.csv";
    fileInput.style.cssText="width:100%;padding:10px;border:2px dashed #e0e0e0;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:12px;";
    card.appendChild(fileInput);

    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:12px;color:#666;min-height:20px;";
    card.appendChild(statusDiv);

    fileInput.onchange=function(e){
      var file=e.target.files[0];
      if(!file)return;
      statusDiv.textContent="⏳ Lecture de "+file.name+"...";
      var reader=new FileReader();
      reader.onload=function(ev){
        var content=ev.target.result;
        if(file.name.endsWith(".json")){
          try{
            var data=JSON.parse(content);
            var products=data.products||data;
            var count=0;
            if(Array.isArray(products)){
              products.forEach(function(p){
                var name=p.name||p.n||p.designation||"";
                var price=p.sale_price_cents||p.p||p.price_cents||0;
                var barcode=p.barcode||p.bc||"INV-"+Date.now()+"-"+Math.floor(Math.random()*9999);
                if(name){
                  _dbPut({barcode:barcode,name:name,sale_price_cents:price,category:"epicerie",source:"invoice-import",last_updated:Date.now()});
                  count++;
                }
              });
            }
            statusDiv.textContent="✅ "+count+" produits importés!";
            _refreshAndFilter();
          }catch(ex){statusDiv.textContent="❌ Erreur JSON: "+ex.message;}
        }else{
          statusDiv.textContent="ℹ️ Format non supporté directement. Utilisez le fichier JSON du catalogue.";
        }
      };
      reader.readAsText(file);
    };

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;margin-top:12px;";
    var bClose=document.createElement("button");bClose.textContent="Fermer";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    br.appendChild(bClose);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ─── SETTINGS ────────────────────────────────────────
  function _showSettings(){
    var old=document.getElementById("acim-settings");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-settings";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:340px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:18px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="⚙️ Paramètres";card.appendChild(ti);

    var nameInput=document.createElement("input");nameInput.type="text";nameInput.value=_settings.storeName;
    nameInput.placeholder="Nom du magasin";nameInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    card.appendChild(nameInput);
    var footerInput=document.createElement("input");footerInput.type="text";footerInput.value=_settings.footer;
    footerInput.placeholder="Footer ticket";footerInput.style.cssText="width:100%;font-size:14px;padding:10px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:12px;";
    card.appendChild(footerInput);

    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="Enregistrer";
    bOk.style.cssText="flex:1;padding:10px;border:none;border-radius:8px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
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
    var left=Math.max(10,(window.innerWidth-280)/2);
    var top=Math.max(10,(window.innerHeight-450)/2);
    card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:280px;max-height:80vh;overflow-y:auto;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000003;font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:13px;font-weight:700;margin-bottom:8px;color:#1a1a2e;";ti.textContent=_catIcon(item.cat||"autre")+" Modifier";card.appendChild(ti);
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);

    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.priceCents>0?(item.priceCents/100).toFixed(2):"";pi.placeholder="Prix fixe";
    pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:16px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);

    // Weight section
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=item.weight!=null?item.weight:"";poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:12px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");unitSel.style.cssText="font-size:12px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    unitSel.innerHTML="";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(item.unitType&&u[0]===item.unitType)o.selected=true;
      unitSel.appendChild(o);
    });

    var ppuRow=document.createElement("div");ppuRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var ppuIn=document.createElement("input");ppuIn.type="number";ppuIn.step="0.01";ppuIn.min="0";
    ppuIn.value=item.pricePerUnit!=null?(item.pricePerUnit/100).toFixed(2):"";ppuIn.placeholder="Prix unitaire (€/kg)";
    ppuIn.style.cssText="flex:1;font-size:12px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    ppuIn.onfocus=function(){this.style.borderColor="#e65100";};ppuIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var ppuUnit=document.createElement("span");ppuUnit.style.cssText="font-size:11px;color:#666;min-width:40px;";
    ppuUnit.textContent="/"+(item.unitType||"kg");
    ppuRow.appendChild(ppuIn);ppuRow.appendChild(ppuUnit);card.appendChild(ppuRow);

    unitSel.onchange=function(){ppuUnit.textContent="/"+unitSel.value;};
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);

    var preview=document.createElement("div");preview.style.cssText="font-size:14px;font-weight:700;color:#e65100;text-align:center;margin-bottom:8px;min-height:20px;";
    card.appendChild(preview);

    function _updatePreview(){
      var w=parseFloat(poidsIn.value);
      var ppu=parseFloat(ppuIn.value);
      var u=unitSel.value;
      if(!isNaN(w)&&w>0&&!isNaN(ppu)&&ppu>0){
        var ppuCents=Math.round(ppu*100);
        var total=_calcWeightPrice(w,u,ppuCents);
        preview.textContent="⚖️ "+_formatWeight(w,u)+" × "+_formatPricePerUnit(ppuCents,u)+" = "+(total/100).toFixed(2)+"€";
        pi.value=(total/100).toFixed(2);
      }else{preview.textContent="";}
    }
    poidsIn.addEventListener("input",_updatePreview);
    ppuIn.addEventListener("input",_updatePreview);
    unitSel.addEventListener("change",_updatePreview);

    // Category
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
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
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){card.remove();_removeFromCart(idx);};
    var bCancel=document.createElement("button");bCancel.textContent="×";
    bCancel.style.cssText="padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;background:#f5f5f5;font-size:12px;cursor:pointer;";
    bCancel.onclick=function(){card.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓";
    bOk.style.cssText="flex:1;padding:6px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
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
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      _renderPOS();
    };
    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);
  }

  // ─── QUICK CREATE ────────────────────────────────────
  function _quickCreate(name,priceCents,barcode,category){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:320px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";ti.textContent="➕ Nouveau produit";card.appendChild(ti);
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
      var autoBc=_nextBarcode();
      var stockQty=parseInt(stockIn.value)||0;
      if(toggle.checked){
        var ppu=parseFloat(ppuIn.value);
        var unitType=ppuUnitSel.value;
        if(isNaN(ppu)||ppu<=0){ppuIn.style.borderColor="#c62828";ppuIn.focus();return;}
        var ppuCents=Math.round(ppu*100);
        _addToCart(nn,0,autoBc,selCat,null,unitType,ppuCents);
        _dbPut({barcode:autoBc,name:nn,sale_price_cents:0,category:selCat,stockQty:stockQty,pricePerUnit:ppuCents,unitType:unitType,source:"manual-weight",last_updated:Date.now()});
        ov.remove();_toast("⚖️ "+nn+" — "+_formatPricePerUnit(ppuCents,unitType));
      }else{
        var np=parseFloat(pi.value);
        var pc=isNaN(np)?0:Math.round(np*100);
        _addToCart(nn,pc,autoBc,selCat);
        _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,stockQty:stockQty,source:"manual",last_updated:Date.now()});
        ov.remove();_toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      }
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){ni.focus();},100);
  }

  function _dialogOpen(){return!!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick")||!!document.getElementById("acim-weigh")||!!document.getElementById("acim-payment")||!!document.getElementById("acim-receipt")||!!document.getElementById("acim-history")||!!document.getElementById("acim-menu")||!!document.getElementById("acim-settings")||!!document.getElementById("acim-invoice")||!!document.getElementById("acim-disc-dialog");}

  // ─── TOAST ────────────────────────────────────────────
  function _toast(msg){
    if(!msg)return;var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";t.textContent=msg;
    t.style.cssText="position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},2500);
  }

  // ─── INIT ────────────────────────────────────────────
  function init(){
    if(!_acquireTabLock()){_toast("⚠ Caisse déjà ouverte dans un autre onglet");return;}
    Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]).then(function(){
      _log("v34 — POS complet: paiement + remise + historique + stocks");
      _importBackupFromEmbedded().then(function(imported){
        if(imported)_toast("✅ Catalogue importé (38 produits)");
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
// ─── FIN AcimCaisse v34 ───
