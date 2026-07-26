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
    {id:"viande",ic:"🥩"}, {id:"volaille",ic:"🐔"}, {id:"laitier",ic:"🧀"}, {id:"epicerie",ic:"🏪"},
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
      var chain=Promise.resolve();
      var count=0;
      for(var i=0;i<_supplierCatalog.length;i++){
        (function(p){
          chain=chain.then(function(){
            var bc=p.ean||"";
            var name=p.name||"";
            var cat=catMap[p.category]||catMap[p.cat]||"epicerie";
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

      var ic=document.createElement("span");
      ic.textContent=_catIcon(p.category||"autre");
      ic.style.cssText="font-size:40px;margin-bottom:4px;";
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
      html.push('<div class="r-line"><span>'+line+'</span><span class="r-price">'+(it.priceCents/100).toFixed(2).replace(".",",")+'</span></div>');
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
      lines.push('<div class="r-line"><span>'+line+'</span><span class="r-price">'+(it.priceCents/100).toFixed(2).replace(".",",")+'</span></div>');
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
      {label:"📥 Importer des données (JSON)",fn:function(){ov.remove();_showImportDialog();}},
      {label:"🖥️ Écran client (2e écran)",fn:function(){window.open("customer-display.html","_blank");}},
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

  function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

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
    var left=Math.max(10,(window.innerWidth-280)/2);
    var top=Math.max(10,(window.innerHeight-450)/2);
    card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:280px;max-height:80vh;overflow-y:auto;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000003;font-family:Segoe UI,Arial,sans-serif;";
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

    // Weight section
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=item.weight!=null?item.weight:"";poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:16px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
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

    var preview=document.createElement("div");preview.style.cssText="font-size:17px;font-weight:700;color:#e65100;text-align:center;margin-bottom:8px;min-height:20px;";
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
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      _renderPOS();
    };
    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);
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
        _dbPut({barcode:useBc,name:nn,sale_price_cents:0,category:selCat,stockQty:stockQty,pricePerUnit:ppuCents,unitType:unitType,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual-weight",last_updated:Date.now()});
        ov.remove();_toast("⚖️ "+nn+" — "+_formatPricePerUnit(ppuCents,unitType));
      }else{
        var np=parseFloat(pi.value);
        var pc=isNaN(np)?0:Math.round(np*100);
        _addToCart(nn,pc,useBc,selCat);
        _dbPut({barcode:useBc,name:nn,sale_price_cents:pc,category:selCat,stockQty:stockQty,purchase_price_cents:Math.round((parseFloat(ppIn.value)||0)*100),low_stock_threshold:parseInt(thIn.value)||5,expiry_date:expIn.value||null,source:"manual",last_updated:Date.now()});
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
  function _showExportDialog(){
    var old=document.getElementById("acim-export");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-export";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000002;display:flex;align-items:center;justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:14px;padding:20px;width:380px;max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:22px;font-weight:700;margin-bottom:12px;color:#1a1a2e;text-align:center;";
    ti.textContent="📤 Exporter mes données";card.appendChild(ti);
    var desc=document.createElement("div");desc.style.cssText="font-size:12px;color:#666;margin-bottom:16px;text-align:center;";
    desc.textContent="Télécharge un fichier JSON contenant tous vos produits, ventes et paramètres.";
    card.appendChild(desc);
    var statusDiv=document.createElement("div");statusDiv.style.cssText="font-size:13px;color:#666;min-height:20px;margin-bottom:12px;text-align:center;";
    card.appendChild(statusDiv);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bClose=document.createElement("button");bClose.textContent="Annuler";
    bClose.style.cssText="flex:1;padding:10px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;";
    bClose.onclick=function(){ov.remove();};
    var bExport=document.createElement("button");bExport.textContent="📤 Télécharger le fichier";
    bExport.style.cssText="flex:2;padding:10px;border:none;border-radius:8px;background:#1565c0;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bExport.onclick=function(){
      statusDiv.textContent="⏳ Préparation de l'export...";
      bExport.disabled=true;bExport.style.opacity="0.5";
      _exportAllData().then(function(data){
        var dateStr=new Date().toISOString().slice(0,10);
        var filename="acimcaisse-backup-"+dateStr+".json";
        _downloadJSON(data,filename);
        statusDiv.textContent="✅ Fichier téléchargé: "+filename;
        statusDiv.style.color="#2e7d32";
      }).catch(function(err){
        statusDiv.textContent="❌ Erreur: "+err.message;
        statusDiv.style.color="#c62828";
        bExport.disabled=false;bExport.style.opacity="1";
      });
    };
    br.appendChild(bClose);br.appendChild(bExport);card.appendChild(br);
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
          var saleDate=sale.date?new Date(sale.date).toLocaleString("fr-FR"):"?";
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
        if(!s.date)return false;
        return s.date.slice(0,10)===todayStr;
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
            if(p.method==="especes"){totalCash+=(p.amount||0);paymentCounts.especes++;}
            else if(p.method==="cb"){totalCb+=(p.amount||0);paymentCounts.cb++;}
            else{totalMixte+=(p.amount||0);paymentCounts.mixte++;}
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
            productCount[n].total+=(item.priceCents||0)*(item.qty||1);
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
    var price=prompt("Prix par dÃ©faut pour tous les produits sans prix (en €, ex: 5.00):");
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
        _toast("💰 "+fixed+" produit(s) mis Ã  "+(cents/100).toFixed(2)+"€");
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
        _toast("🏷️ "+fixed+" nom(s) corrigÃ©(s)");
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

  // ─── INIT ────────────────────────────────────────────
  function init(){
    if(!_acquireTabLock()){_toast("⚠ Caisse déjà ouverte dans un autre onglet");return;}
    Promise.all([_loadBcSeq(),_loadTicketSeq(),_loadSettings()]).then(function(){
      _log("v34 — POS complet: paiement + remise + historique + stocks");
      _importBackupFromEmbedded().then(function(imported){
        if(imported)_toast("✅ Catalogue importé (38 produits)");
        return _importSupplierCatalogFromMeta();
      }).then(function(imported){
        if(imported>0)_toast("✅ "+imported+" produits catalogue fournisseur importés");
        return _importYardenCatalog();
      }).then(function(yardenCount){
        if(yardenCount>0)_toast("✅ "+yardenCount+" produits Yarden importés");
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
