// ─── AcimCaisse v32 — POS UI complète ──
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
  function _refreshTabLock(){
    try{localStorage.setItem(_tabLockKey,Date.now()+"|"+_tabId);}catch(e){}
  }
  function _releaseTabLock(){
    try{var prev=localStorage.getItem(_tabLockKey);
      if(prev&&prev.indexOf(_tabId)>=0)localStorage.removeItem(_tabLockKey);}catch(e){}
  }
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
  function _persistSale(items,totalCents){
    _openSalesDB().then(function(d){
      if(!d)return;var tx=d.transaction("sales","readwrite");
      tx.objectStore("sales").put({
        timestamp:Date.now(),isoTime:new Date().toISOString(),
        items:items.map(function(it){return{name:it.name,price:it.priceCents,barcode:it.bc||"",cat:it.cat};}),
        totalCents:totalCents,itemCount:items.length
      });
    }).catch(function(e){_err("Sale persist failed:",e);});
  }

  // ─── BACKUP IMPORT ───────────────────────────────────
  var _BACKUP_IMPORTED_KEY="acim-backup-imported-v1";
  var _BACKUP_DATA={"format":1,"categories":[{"id":"13b06477","name":"Frais"},{"id":"562843c7","name":"Sec"},{"id":"adb67835","name":"Congele"},{"id":"0bfc0834","name":"Divers"},{"id":"a7a910fe","name":"Vin"},{"id":"16a4e603","name":"Alcool"}],"products":[{"n":"R#E_Gourmet# Viennoisses Volaille Mron","c":"0bfc0834","p":0,"s":80},{"n":"R[Guli] Mortadelle Volaille","c":"0bfc0834","p":0,"s":20},{"n":"R[Guli] Cabanossi Gendarme","c":"0bfc0834","p":0,"s":12},{"n":"R[Guli] Bavarois Mini Kabanos","c":"0bfc0834","p":0,"s":36},{"n":"R[Guli] Panais Entier","c":"0bfc0834","p":0,"s":60},{"n":"Bissli Falafel OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Grill OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Boulgar OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bissli Hot OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bamba OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Bamba OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Tapouk OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Tapouk OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Cracotte OSEM 100g","c":"16a4e603","p":400,"s":0},{"n":"Cracotte OSEM 70g","c":"16a4e603","p":300,"s":0},{"n":"Krembo OSEM Vanille","c":"16a4e603","p":500,"s":0},{"n":"Krembo OSEM Chocolat","c":"16a4e603","p":500,"s":0},{"n":"Aigle Noir Fumoir Saumon 200g","c":"13b06477","p":1200,"s":0},{"n":"Aigle Noir Fumoir Thon 200g","c":"13b06477","p":1000,"s":0},{"n":"Steak Hach\u00e9 5% 1kg","c":"13b06477","p":800,"s":0},{"n":"Steak Hach\u00e9 15% 1kg","c":"13b06477","p":750,"s":0},{"n":"Poulet Entier Frais","c":"13b06477","p":500,"s":0},{"n":"Cuisses de Poulet Frais 1kg","c":"13b06477","p":600,"s":0},{"n":"Blanc de Poulet Frais 1kg","c":"13b06477","p":900,"s":0},{"n":"Merguez Frais 1kg","c":"13b06477","p":700,"s":0},{"n":"Saucisse Frais 1kg","c":"13b06477","p":650,"s":0},{"n":"Escalope de Dinde Frais 1kg","c":"13b06477","p":1100,"s":0},{"n":"Agneau Hach\u00e9 1kg","c":"13b06477","p":1400,"s":0},{"n":"C\u00f4tes de Porc Frais 1kg","c":"13b06477","p":900,"s":0},{"n":"Filet de Poulet 1kg","c":"13b06477","p":1200,"s":0},{"n":"Boeuf Hach\u00e9 Surgel\u00e9 1kg","c":"adb67835","p":900,"s":0},{"n":"Nuggets Poulet Surgel\u00e9 1kg","c":"adb67835","p":700,"s":0},{"n":"Frites Surgel\u00e9es 2kg","c":"adb67835","p":600,"s":0},{"n":"Pizza Surgel\u00e9e","c":"adb67835","p":500,"s":0},{"n":"Eau Min\u00e9rale 1.5L","c":"a7a910fe","p":100,"s":0},{"n":"Coca-Cola 33cl","c":"a7a910fe","p":150,"s":0},{"n":"Jus d'Orange 1L","c":"a7a910fe","p":350,"s":0},{"n":"Vin Rouge 75cl","c":"a7a910fe","p":800,"s":0}]};
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
          else if(mapped==="congele")mapped="surgel\u00e9";
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
  function _addToCart(name,priceCents,barcode,categoryId){
    if(!name){_toast("Nom manquant");return false;}
    var myId="M"+Date.now()+Math.floor(Math.random()*9999);
    _myCart.push({myId:myId,name:name,priceCents:priceCents||0,bc:barcode||"",cat:categoryId||"autre"});
    _realBcMap[myId]=barcode||"";
    _dbPut({barcode:barcode||myId,name:name,sale_price_cents:priceCents||0,category:categoryId||"autre",source:"add",last_updated:Date.now()});
    try{document.dispatchEvent(new CustomEvent("acim:add",{detail:{name:name,price:priceCents,barcode:barcode,cat:categoryId}}));}catch(e){}
    _renderPOS();return true;
  }
  function _cartInfo(){
    var info=[];
    for(var i=0;i<_myCart.length;i++){var e=_myCart[i];
      info.push({idx:i,myId:e.myId,name:e.name,price:e.priceCents,bc:_realBcMap[e.myId]||e.bc,cat:e.cat});
    }return info;
  }
  function _removeFromCart(idx){
    _myCart.splice(idx,1);_renderPOS();_broadcastCart();
  }
  function _cartTotal(){
    var t=0;for(var i=0;i<_myCart.length;i++)t+=_myCart[i].priceCents;return t;
  }

  // ─── BROADCAST (écran client) ────────────────────────
  var _custBc=null;
  try{_custBc=new BroadcastChannel("acim-customer-display");}catch(e){}
  function _broadcastCart(){
    if(!_custBc)return;var info=_cartInfo();var total=0;
    for(var i=0;i<info.length;i++)total+=info[i].price;
    _custBc.postMessage({type:"cart-update",lines:info,total:total});}
  function _broadcastClear(){
    if(!_custBc)return;_custBc.postMessage({type:"cart-clear"});}

  // ─────────────────────────────────────────────────────
  //  POS UI — LAYOUT
  // ─────────────────────────────────────────────────────
  var _pos=null,_posSearch=null,_posCats=null,_posGrid=null,_posCart=null,_posTotal=null,_posItems=null,_posCheckout=null;
  var _allProducts=[],_filteredProducts=[],_activeCat="";

  function _createPOS(){
    if(_pos)return;
    _pos=document.createElement("div");_pos.id="acim-pos";
    _pos.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;display:flex;flex-direction:column;background:#f0f2f5;font-family:Segoe UI,Arial,sans-serif;";

    // ── TOP BAR ──
    var topBar=document.createElement("div");
    topBar.style.cssText="display:flex;align-items:center;padding:8px 12px;background:#1a1a2e;gap:8px;flex-shrink:0;";
    var logo=document.createElement("span");
    logo.textContent="🏪 AcimCaisse";logo.style.cssText="color:#fff;font-size:15px;font-weight:700;margin-right:4px;flex-shrink:0;";
    topBar.appendChild(logo);

    _posSearch=document.createElement("input");_posSearch.id="acim-pos-search";
    _posSearch.type="text";_posSearch.placeholder="Rechercher un produit (nom ou code-barres)...";
    _posSearch.style.cssText="flex:1;padding:8px 14px;border:none;border-radius:8px;font-size:14px;outline:none;background:#2a2a4e;color:#fff;min-width:0;";
    _posSearch.addEventListener("input",function(){_filterProducts();});
    _posSearch.addEventListener("keydown",function(e){
      if(e.key==="Enter"){var v=this.value.trim();if(v.length>=2){_processBarcode(v);this.value="";this.focus();}}
      if(e.key==="Escape"){this.value="";_filterProducts();this.blur();}
    });
    topBar.appendChild(_posSearch);

    var newBtn=document.createElement("button");
    newBtn.textContent="➕";newBtn.title="Nouveau produit";
    newBtn.style.cssText="padding:6px 10px;border:none;border-radius:6px;background:#2a2a4e;color:#fff;font-size:16px;cursor:pointer;flex-shrink:0;";
    newBtn.onclick=function(){_quickCreate("",0);};
    topBar.appendChild(newBtn);

    _pos.appendChild(topBar);

    // ── BODY: left (products) + right (cart) ──
    var body=document.createElement("div");
    body.style.cssText="flex:1;display:flex;overflow:hidden;";

    // LEFT PANEL
    var left=document.createElement("div");
    left.style.cssText="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:8px;";

    // Category pills
    _posCats=document.createElement("div");
    _posCats.id="acim-pos-cats";
    _posCats.style.cssText="display:flex;gap:4px;padding:4px 0 8px;overflow-x:auto;flex-shrink:0;";
    _buildCatPills();
    left.appendChild(_posCats);

    // Product grid
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
    var totalRow=document.createElement("div");
    totalRow.style.cssText="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";
    var totalLabel=document.createElement("span");
    totalLabel.style.cssText="font-size:14px;color:#1a1a2e;";totalLabel.textContent="Total";
    _posTotal=document.createElement("span");
    _posTotal.id="acim-pos-total";
    _posTotal.style.cssText="font-size:22px;font-weight:700;color:#e65100;";_posTotal.textContent="0,00 €";
    totalRow.appendChild(totalLabel);totalRow.appendChild(_posTotal);
    cartFoot.appendChild(totalRow);

    _posCheckout=document.createElement("button");
    _posCheckout.id="acim-pos-checkout";
    _posCheckout.textContent="💰 Encaisser";
    _posCheckout.style.cssText="width:100%;padding:12px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:background .15s;";
    _posCheckout.onmouseenter=function(){this.style.background="#c43e00";};
    _posCheckout.onmouseleave=function(){this.style.background="#e65100";};
    _posCheckout.onclick=function(){_checkout();};
    cartFoot.appendChild(_posCheckout);
    right.appendChild(cartFoot);

    body.appendChild(right);
    _pos.appendChild(body);
    document.body.appendChild(_pos);
  }

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

  function _renderGrid(){
    _posGrid.innerHTML="";
    if(_filteredProducts.length===0){
      _posGrid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;font-size:14px;">Aucun produit trouvé</div>';
      return;
    }
    _filteredProducts.forEach(function(p){
      var card=document.createElement("div");
      var hasPrice=p.sale_price_cents>0;
      card.style.cssText="background:#fff;border-radius:10px;padding:10px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:2px solid "+(hasPrice?"transparent":"#ffe082")+";transition:all .15s;display:flex;flex-direction:column;align-items:center;text-align:center;";
      card.onmouseenter=function(){this.style.boxShadow="0 3px 12px rgba(0,0,0,0.15)";this.style.borderColor="#e65100";};
      card.onmouseleave=function(){this.style.boxShadow="0 1px 3px rgba(0,0,0,0.08)";this.style.borderColor=hasPrice?"transparent":"#ffe082";};

      var ic=document.createElement("span");
      ic.textContent=_catIcon(p.category||"autre");
      ic.style.cssText="font-size:28px;margin-bottom:4px;";
      card.appendChild(ic);

      var nm=document.createElement("div");
      nm.style.cssText="font-size:12px;font-weight:600;color:#1a1a2e;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;";
      nm.textContent=p.name||"?";card.appendChild(nm);

      if(hasPrice){
        var pr=document.createElement("div");
        pr.style.cssText="font-size:15px;font-weight:700;color:#e65100;margin-top:4px;";
        pr.textContent=(p.sale_price_cents/100).toFixed(2)+"€";
        card.appendChild(pr);
      }else{
        var noPr=document.createElement("div");
        noPr.style.cssText="font-size:11px;color:#e65100;margin-top:4px;font-weight:600;";
        noPr.textContent="✏️ Sans prix";
        card.appendChild(noPr);
      }

      card.onclick=function(){
        if(hasPrice){
          _addToCart(p.name,p.sale_price_cents,p.barcode,p.category);
          _toast("✅ "+p.name);
        }else{
          _addToCart(p.name,0,p.barcode,p.category);
          _toast("✏️ "+p.name+" — cliquez dans le ticket pour le prix");
        }
      };
      _posGrid.appendChild(card);
    });
  }

  function _renderCart(){
    var info=_cartInfo();var total=_cartTotal();
    document.getElementById("acim-pos-count").textContent=info.length+" article"+(info.length!==1?"s":"");
    _posTotal.textContent=(total/100).toFixed(2).replace(".",",")+" €";
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
      row.style.cssText="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid #f0f0f0;transition:background .15s;";
      row.onmouseenter=function(){this.style.background="#fafafa";};
      row.onmouseleave=function(){this.style.background="transparent";};

      var icon=document.createElement("span");
      icon.textContent=_catIcon(item.cat||"autre");
      icon.style.cssText="font-size:16px;margin-right:8px;flex-shrink:0;";
      row.appendChild(icon);

      var infoDiv=document.createElement("div");
      infoDiv.style.cssText="flex:1;min-width:0;";
      var nm=document.createElement("div");
      nm.style.cssText="font-size:12px;font-weight:600;color:"+(isZero?"#e65100":"#1a1a2e")+";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      nm.textContent=isZero?"✏️ "+item.name:item.name;
      infoDiv.appendChild(nm);

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
      dupBtn.onclick=function(e){e.stopPropagation();_addToCart(item.name,item.price,item.bc,item.cat);_toast("✅ "+item.name);};
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
    if(!_pos)return;
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
      if(local&&local.sale_price_cents>0){
        _addToCart(local.name,local.sale_price_cents,bc,local.category);
        _toast("✅ "+local.name+" "+(local.sale_price_cents/100).toFixed(2)+"€");return;
      }
      if(local&&local.name){
        _addToCart(local.name,0,bc,local.category);
        _toast("✏️ "+local.name+" — cliquez dans le ticket pour le prix");return;
      }
      // Not found locally — try Open Food Facts
      _lookupOFF(bc).then(function(off){
        if(off){_addToCart(off.name,0,bc,off.category);_toast("📡 "+off.name+" (Open Food Facts)");return;}
        _toast("❌ Produit inconnu: "+bc);
      });
    });
  }

  // ─── CHECKOUT ────────────────────────────────────────
  function _checkout(){
    if(_myCart.length===0){_toast("Panier vide");return;}
    var total=_cartTotal();
    var saleItems=_myCart.slice();
    _persistSale(saleItems,total);
    try{document.dispatchEvent(new CustomEvent("acim:checkout",{detail:{total:total,count:saleItems.length}}));}catch(e){}
    _broadcastClear();_myCart=[];_realBcMap={};
    _renderPOS();
    _toast("✅ Encaissé ! "+(total/100).toFixed(2)+"€");
  }

  // ─── INLINE EDIT ─────────────────────────────────────
  function _inlineEdit(idx,clickX,clickY){
    if(!_myCart[idx])return;
    var item=_myCart[idx];
    var oldCard=document.getElementById("acim-inline-edit");if(oldCard)oldCard.remove();
    var card=document.createElement("div");card.id="acim-inline-edit";
    var left=Math.min(clickX-140,Math.max(10,window.innerWidth-300));
    var top=Math.min(clickY-20,10);
    card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:280px;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000001;font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:13px;font-weight:700;margin-bottom:8px;color:#1a1a2e;";ti.textContent=_catIcon(item.cat||"autre")+" Modifier";card.appendChild(ti);
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.priceCents>0?(item.priceCents/100).toFixed(2):"";pi.placeholder="Prix";
    pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:16px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var exPoids="",exUnit="kg";
    var pm=item.name&&item.name.match(/ (\d+[.,]?\d*)\s*(kg|g|L|pc|pièce)/);
    if(pm){exPoids=pm[1].replace(",",".");exUnit=pm[2]=='pièce'?'pc':pm[2];}
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=exPoids;poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:12px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");unitSel.style.cssText="font-size:12px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(u[0]==exUnit)o.selected=true;unitSel.appendChild(o);});
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||"autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);
    if(item.bc){var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:11px;color:#888;";bcRow.textContent="📊 "+item.bc;card.appendChild(bcRow);}
    var br=document.createElement("div");br.style.cssText="display:flex;gap:6px;";
    var bDel=document.createElement("button");bDel.textContent="🗑️";bDel.title="Supprimer";
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){card.remove();_removeFromCart(idx);_toast("Supprimé");};
    var bCancel=document.createElement("button");bCancel.textContent="×";
    bCancel.style.cssText="padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;background:#f5f5f5;font-size:12px;cursor:pointer;";
    bCancel.onclick=function(){card.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓";
    bOk.style.cssText="flex:1;padding:6px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      if(pv>0){nn=nn+" "+pv+u;}
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?_myCart[idx].priceCents:Math.round(np*100);
      card.remove();
      _myCart[idx].name=nn;_myCart[idx].priceCents=pc;_myCart[idx].cat=selCat;
      _dbPut({barcode:_myCart[idx].bc||_myCart[idx].myId,name:nn,sale_price_cents:pc,category:selCat,source:"edit",last_updated:Date.now()});
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
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";pi.value=priceCents>0?(priceCents/100).toFixed(2):"";
    pi.placeholder="Prix de vente";pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:10px 14px;border:3px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);
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
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?0:Math.round(np*100);
      var autoBc=_nextBarcode();
      _addToCart(nn,pc,autoBc,selCat);
      _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"manual",last_updated:Date.now()});
      ov.remove();
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
    setTimeout(function(){ni.focus();},100);
  }

  function _dialogOpen(){return !!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick");}

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
    _loadBcSeq().then(function(){
      _log("v32 — POS UI complète");
      _dbGetAll().then(function(all){
        _allProducts=all;
        _createPOS();
        _renderPOS();
      });
      _importBackupFromEmbedded().then(function(imported){
        if(imported){
          _dbGetAll().then(function(all){
            _allProducts=all;_filterProducts();
          });
          _toast("✅ Catalogue importé (38 produits)");
        }
      });
    });
    document.addEventListener("keydown",function(e){
      if(e.ctrlKey&&e.key==="k"){e.preventDefault();_posSearch.focus();}
      if(e.ctrlKey&&e.key==="n"){e.preventDefault();_quickCreate("",0);}
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();

  window._acimGetCartInfo=_cartInfo;
  window._acimDebug=function(){return{cart:_myCart.length};};
  window._acimProcessBarcode=_processBarcode;
  window._acimAddToCart=function(name,price,cat){_addToCart(name,price,"",cat);};
})();
// ─── FIN AcimCaisse v32 ───