// ─── AcimCaisse v23 — _myCart Source de Vérité ──────────
// Injecté DANS l'IIFE dartProgram (A, J, $, t, B accessibles)
//
// PRINCIPES UX v23 (fix v21/v22 merge bug):
//   1. Scan → Ajout IMMÉDIAT (connu ou inconnu, jamais bloqué)
//   2. Clic ligne → Petite carte inline (pas grand modal)
//   3. Création manuelle → 3 champs (nom, prix, catégorie 1-clic)
//   4. Code-barres auto ACIM-XXXX → tag visible, impression OPTIONNELLE (pas auto)
//   5. Prix=0 autorisé (compléter plus tard)
//   6. Bouton ➕ pour création rapide
//   7. Lignes prix=0 → bordure orange + indicateur ✏️
//   8. PANIER AVANT IMPRESSION — jamais ouvrir barcode avant d'ajouter au panier
//   9. RESPONSIVE — mobile: overlay bottom-panel, inline edit bottom-sheet
//  10. _myCart = SOURCE DE VÉRITÉ — Dart peut fusionner, _myCart ne fusionne JAMAIS
//
;(function(){
  "use strict";
  var _log=function(m){console.log("[Acim] "+m);};
  var _err=function(m,e){console.error("[Acim] "+m,e);};

  // ═══════════════════════════════════════════════════════
  //  RESPONSIVE — Mobile vs Desktop layout
  // ═══════════════════════════════════════════════════════
  var _mob=window.innerWidth<600;
  function _isMob(){return window.innerWidth<600;}
  // Re-check on resize
  window.addEventListener("resize",function(){
    var wasMob=_mob;_mob=_isMob();
    if(wasMob!==_mob){
      // Rebuild overlay for new layout
      if(_overlay){_overlay.remove();_overlay=null;_linesEls=[];}
      _createOverlay();
    }
  });

  // ═══════════════════════════════════════════════════════
  //  CATÉGORIES (1 clic avec emoji)
  // ═══════════════════════════════════════════════════════
  var CATS=[
    {id:"viande",ic:"🥩",kw:["viande","poulet","steak","merguez","saucisse","escalope","haché","agneau","veau","hot dog","charcuterie","pastrami","canard","côte","mince"]},
    {id:"laitier",ic:"🧀",kw:["lait","fromage","yaourt","beurre","crème","labné","camembert","emmental","mozzarella","kiri"]},
    {id:"épicerie",ic:"🏪",kw:["riz","pâtes","sauce","huile","conserves","thon","haricots","maïs","tomate","olive","miel","confiture","couscous","lentille"]},
    {id:"boulangerie",ic:"🍞",kw:["pain","baguette","pita","matza","challah","brioche","biscotte","cake"]},
    {id:"boisson",ic:"🥤",kw:["jus","eau","soda","limonade","thé","café","sirop","smoothie"]},
    {id:"surgelé",ic:"🧊",kw:["surgelé","pizza","beignet","nugget","frite","glace"]},
    {id:"snack",ic:"🍪",kw:["biscuit","chips","chocolat","bonbon","barre","pretzel"]},
    {id:"condiment",ic:"🧂",kw:["sel","poivre","épice","moutarde","ketchup","mayo","vinaigre"]},
    {id:"ménager",ic:"🧴",kw:["savon","lessive","nettoyant","papier","essuie","sac"]},
    {id:"vin",ic:"🍷",kw:["vin","kiddouch","malbec","cabernet","merlot"]},
    {id:"autre",ic:"📦",kw:[]}
  ];
  function _guessCat(t){
    if(!t)return"autre";var s=t.toLowerCase(),best="autre",bs=0;
    for(var i=0;i<CATS.length;i++){var sc=0;
      for(var k=0;k<CATS[i].kw.length;k++){if(s.includes(CATS[i].kw[k]))sc++;}
      if(sc>bs){bs=sc;best=CATS[i].id;}}return best;}
  function _catIcon(id){
    for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i].ic;
    return "📦";}

  // ═══════════════════════════════════════════════════════
  //  NORMALISATION NOM
  // ═══════════════════════════════════════════════════════
  function _normName(raw){
    if(!raw)return"";var s=raw;
    s=s.replace(/[|\\{}=<>^~`#§¤°±]/g," ");
    s=s.replace(/\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi," ");
    s=s.replace(/\b\d+\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi," ");
    s=s.replace(/\b\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|cl|l|L)\b/gi," ");
    s=s.replace(/[xX×]\s*\d+/g," ");
    s=s.replace(/\b\d+(?:[.,]\d+)?\s*%/g," ");
    s=s.replace(/\b\d+[.,]\d{1,2}\s*(?:€|EUR|euro)\b/gi," ");
    s=s.replace(/\(\s*(?:E\d+|ref\.?\s*\d+)\s*\)/gi," ");
    s=s.replace(/\(\s*\)/g," ");
    s=s.replace(/\(\s*\d+(?:[.,]\d+)?\s*\)/g," ");
    s=s.replace(/\s*[-–—]\s*/g," ");
    s=s.replace(/\b\d+(?:[.,]\d+)?\b/g,function(m,o,st){
      var b=o>0?st.charAt(o-1):" ",a=o+m.length<st.length?st.charAt(o+m.length):" ";
      return(/[A-Za-z\u00C0-\u024F]/.test(b)||/[A-Za-z\u00C0-\u024F]/.test(a))?m:" ";});
    s=s.split(/\s+/).filter(function(w){return w.length>2||/^[A-Z]{1,3}$/.test(w);}).join(" ");
    s=s.toLowerCase().replace(/(?:^|\s)\S/g,function(c){return c.toUpperCase();});
    s=s.replace(/\s+/g," ").trim();
    if(s.length<2&&raw.length>=2){s=raw.replace(/[|\\{}=<>^~`#§¤°±]/g," ").trim();s=s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();}
    return s;}

  // ═══════════════════════════════════════════════════════
  //  CATALOGUE LOCAL (IndexedDB)
  // ═══════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════
  //  OPEN FOOD FACTS (gratuit, pas de clé)
  // ═══════════════════════════════════════════════════════
  var _OFF="https://world.openfoodfacts.org/api/v0/product/";
  function _lookupOFF(bc){return fetch(_OFF+bc+".json").then(function(r){return r.json();})
    .then(function(d){if(d.status===1&&d.product){var p=d.product;
      return{barcode:bc,name:_normName(p.product_name_fr||p.product_name||""),brand:p.brands||"",category:_guessCat((p.product_name||"")+" "+(p.categories||"")),sale_price_cents:0,source:"openfoodfacts"};}
      return null;}).catch(function(){return null;});}

  // ═══════════════════════════════════════════════════════
  //  HOOKS PANIER DART
  // ═══════════════════════════════════════════════════════
  var _notifier=null,_hooked=0;
  try{if(typeof A!=='undefined'&&A.wt&&A.wt.prototype){
    var _wtProto=A.wt.prototype;
    Object.getOwnPropertyNames(_wtProto).forEach(function(m){
      if(typeof _wtProto[m]==='function'&&m!=='constructor'&&!m.startsWith('$')){
        try{var orig=_wtProto[m];
          _wtProto[m]=function(){
            _notifier=this;_hooked++;
            if(m==='ac0')setTimeout(function(){try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}));}catch(e){}},300);
            return orig.apply(this,arguments);
          };
        }catch(e){}}});
    _log("Hooks: "+_hooked+" méthodes capturées sur A.wt");
  }}catch(e){_err('hooks',e);}

  function _find(){if(_notifier)return _notifier;
    try{if(typeof A==='undefined'||!A.wt)return null;
      var scan=function(o,d){
        if(d>5||!o||typeof o!=='object')return null;
        try{var keys=Object.keys(o);
          for(var i=0;i<Math.min(keys.length,200);i++){
            try{var v=o[keys[i]];
              if(v&&typeof v==='object'){
                if(v instanceof A.wt){_notifier=v;return v;}
                if(v.a&&typeof v.a.gj9==='function'&&typeof v.a.kF==='function'){_notifier=v;return v;}
                if(d<4)scan(v,d+1);
              }
            }catch(e){}}
        }catch(e){}return null;};
      [self,window,globalThis].forEach(function(o){try{
        if(!o)return;
        Object.getOwnPropertyNames(o).forEach(function(k){try{var v=o[k];if(v instanceof A.wt){_notifier=v;}}catch(e){}});
      }catch(e){}});
      if(!_notifier)scan(window,0);
    }catch(e){}
    return _notifier;}

  // v21: attendre que le notifier soit disponible (Flutter peut ne pas être prêt)
  function _waitForNotifier(cb,retries){
    if(!retries)retries=10;
    var n=_find();
    if(n){cb(n);return;}
    if(retries<=0){cb(null);return;}
    setTimeout(function(){_waitForNotifier(cb,retries-1);},300);
  }

  function _lines(){var n=_find();if(!n)return[];
    try{var sv=null;try{sv=n.a.gj9();}catch(e){return[];}
      if(sv&&typeof sv.gvh==='function')try{sv=sv.gvh();}catch(e){}
      if(sv&&typeof sv.gj9==='function')try{sv=sv.gj9();}catch(e){}
      if(!Array.isArray(sv)){try{var arr=[];var it=J.aM(sv);while(it.q())arr.push(it.gN(it));return arr;}
        catch(e){try{var a2=[];if(sv&&typeof sv[Symbol.iterator]==='function'){var _i=sv[Symbol.iterator](),_r;while(!(_r=_i.next()).done)a2.push(_r.value);return a2;}}catch(e2){}return[];}}
      return sv;}catch(e){return[];}}

  function _clone(p,ch){try{if(typeof p.aHD==='function')return p.aHD(
      ch.barcode!==undefined?ch.barcode:B.Q,ch.categoryId!==undefined?ch.categoryId:B.Q,
      ch.expiryDate!==undefined?ch.expiryDate:null,ch.lowStockThreshold!==undefined?ch.lowStockThreshold:B.Q,
      ch.name!==undefined?ch.name:null,ch.purchasePriceCents!==undefined?ch.purchasePriceCents:null,
      ch.salePriceCents!==undefined?ch.salePriceCents:null,ch.stockQty!==undefined?ch.stockQty:null,
      ch.unit!==undefined?ch.unit:null);}catch(e){}
    try{var c=Object.create(Object.getPrototypeOf(p));Object.keys(p).forEach(function(k){c[k]=p[k];});
      if(ch.name!==undefined)c.b=ch.name;if(ch.salePriceCents!==undefined)c.d=ch.salePriceCents;
      if(ch.barcode!==undefined)c.r=ch.barcode;return c;}catch(e2){return null;}}

  function _newArr(){try{return A.b([],t.fh);}catch(e){return[];}}
  function _update(ls){var n=_find();if(!n)return false;try{var p=n.a;p.kF(0);p.U(ls);return true;}catch(e){return false;}}

  var _diagLevel=0;

  function _makeProduct(name,priceCents,barcode,categoryId){
    try{
      if(typeof A==='object'&&typeof A.bcg==='function'&&typeof B==='object'&&B.cU&&typeof B.cU.kg==='function'&&typeof A.bD==='function'){
        var now=new A.bD(Date.now());
        var id=B.cU.kg();
        var prod=A.bcg(barcode||id,categoryId||"autre",now,null,id,null,null,name,0,priceCents,0,"unité",null,now);
        if(prod&&prod.a){_diagLevel=1;return prod;}
      }
    }catch(e){_err('makeProduct L1',e);}
    try{
      if(typeof A==='object'&&typeof A.oW==='function'&&typeof A.bD==='function'){
        var now2=new A.bD(Date.now());
        var id2="P"+Date.now()+Math.floor(Math.random()*9999);
        var prod2=new A.oW(id2,name,0,priceCents,now2,null,barcode||id2,categoryId||"autre",0,"unité",null,null,null,null);
        if(prod2&&prod2.a){_diagLevel=2;return prod2;}
      }
    }catch(e){_err('makeProduct L2',e);}
    try{
      if(typeof A==='object'&&typeof A.oW==='function'){
        var prod3=new A.oW();
        prod3.a="P"+Date.now();prod3.b=name;prod3.c=0;prod3.d=priceCents;
        prod3.e=null;prod3.f=null;prod3.r=barcode||"";prod3.w=categoryId||"autre";
        prod3.x=0;prod3.y="unité";prod3.z=null;prod3.Q=null;prod3.as=null;prod3.at=null;
        if(prod3.a){_diagLevel=3;return prod3;}
      }
    }catch(e){_err('makeProduct L3',e);}
    _toast("❌ Création produit impossible");
    return null;
  }

    // v23: _myCart = source de vérité pour le overlay
  // Dart fusionne les lignes (bug Dart), _myCart ne fusionne JAMAIS
  // Chaque ajout = nouvelle entrée dans _myCart, overlay lit depuis _myCart
  var _myCart=[]; // [{myId,name,priceCents,bc,cat,dartProd}]
  var _realBcMap={}; // myId → real barcode (for display/print)

  function _addToCart(name,priceCents,barcode,categoryId){
    if(!name){_toast("\u274C Nom manquant");return false;}
    // v23: ALWAYS create separate line in _myCart
    var myId="M"+Date.now()+Math.floor(Math.random()*9999);
    _myCart.push({
      myId:myId,name:name,priceCents:priceCents||0,
      bc:barcode||"",cat:categoryId||"autre",dartProd:null
    });
    // Sauver le vrai barcode
    _realBcMap[myId]=barcode||"";
    // Essayer de sync Dart (best effort — Dart peut fusionner, _myCart reste correct)
    try{var n=_find();if(n){
      var dartBc=barcode?barcode+"#"+myId:null;
      var prod=_makeProduct(name,priceCents,dartBc,categoryId);
      if(prod){
        _myCart[_myCart.length-1].dartProd=prod;
        var nl=_newArr();var ls=_lines();
        for(var j=0;j<ls.length;j++)nl.push(ls[j]);
        nl.push(new A.oV(prod,1,null));
        try{_update(nl);}catch(e){_err('dart sync add',e);}
      }
    }}catch(e){_err('dart add',e);}
    _pollCart();_broadcastCart();return true;}

  function _cartInfo(){
    var info=[];
    for(var i=0;i<_myCart.length;i++){var e=_myCart[i];
      info.push({idx:i,myId:e.myId,name:e.name,price:e.priceCents,
        qty:1,disc:null,bc:_realBcMap[e.myId]||e.bc,cat:e.cat});
    }
    return info;}

function _broadcastNew(item,total){
    if(!_custBc)return;
    _custBc.postMessage({type:"item-new",item:item,total:total});
  }

  function _broadcastClear(){
    if(!_custBc)return;
    _custBc.postMessage({type:"cart-clear"});
  }

  // ═══════════════════════════════════════════════════════
  //  OVERLAY TICKET — Non-bloquant + indicateurs prix=0
  // ═══════════════════════════════════════════════════════
  var _overlay=null, _linesEls=[], _pollTimer=null;
  // Responsive: Desktop = side panel, Mobile = bottom strip
  function _getLH(){return _mob?28:26;}        // line height

  function _createOverlay(){
    if(_overlay)return;
    var ov=document.createElement("div");
    ov.id="acim-ticket-overlay";
    if(_mob){
      // Mobile: bottom strip, full width, compact
      ov.style.cssText="position:fixed;bottom:0;left:0;right:0;max-height:160px;z-index:1000000;pointer-events:none;background:transparent;overflow-y:auto;overflow-x:hidden;";
    }else{
      // Desktop: petit panneau flottant coin droit — NE BLOQUE PAS Flutter
      ov.style.cssText="position:fixed;top:8px;right:8px;width:280px;max-height:50vh;z-index:1000000;pointer-events:none;background:transparent;overflow-y:auto;overflow-x:hidden;border-radius:10px;font-family:Segoe UI,Arial,sans-serif;";
    }
    ov.setAttribute("role","list");
    ov.setAttribute("aria-label","Ticket — cliquez pour modifier");
    document.body.appendChild(ov);
    _overlay=ov;
    _pollCart();
  }

  function _pollCart(){
    if(!_overlay)return;
    var info=_cartInfo();
    // Show background only when cart has items
    if(!_mob){
      _overlay.style.background=info.length>0?"rgba(255,255,255,0.92)":"transparent";
      _overlay.style.borderLeft=info.length>0?"2px solid #e65100":"none";
    }else{
      _overlay.style.background=info.length>0?"rgba(255,255,255,0.92)":"transparent";
      _overlay.style.borderTop=info.length>0?"2px solid #e65100":"none";
    }
    _overlay.innerHTML="";
    _linesEls=[];
    var lh=_getLH();
    for(var i=0;i<info.length;i++){
      var ln=document.createElement("div");
      ln.setAttribute("role","listitem");
      // Indicateur visuel pour prix=0 (bordure orange + ✏️)
      var isZero=info[i].price===0;
      var borderStyle=isZero?"border-left:3px solid #e65100;":"border-left:3px solid transparent;";
      if(_mob){
        // Mobile: compact horizontal flow
        ln.style.cssText="position:relative;display:inline-flex;align-items:center;height:"+lh+"px;padding:2px 6px;margin:1px;cursor:pointer;pointer-events:auto;"+borderStyle+"transition:background 0.15s;border-radius:4px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#333;background:rgba(255,255,255,0.95);";
        var nameSpan=document.createElement("span");
        nameSpan.style.cssText="font-size:13px;overflow:hidden;text-overflow:ellipsis;max-width:120px;";
        nameSpan.textContent=(isZero?"✏️ ":"")+info[i].name;
        ln.appendChild(nameSpan);
        if(info[i].price>0){
          var priceSpan=document.createElement("span");
          priceSpan.style.cssText="font-size:13px;font-weight:700;color:#e65100;margin-left:4px;";
          priceSpan.textContent=(info[i].price/100).toFixed(2)+"€";
          ln.appendChild(priceSpan);
        }
      }else{
        // Desktop: lignes dans le petit panneau flottant
        ln.style.cssText="position:relative;height:"+lh+"px;padding:2px 8px;cursor:pointer;pointer-events:auto;"+borderStyle+"transition:background 0.15s;font-size:11px;display:flex;align-items:center;justify-content:space-between;color:#333;background:transparent;";
        var nameSpan=document.createElement("span");
        nameSpan.style.cssText="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;";
        nameSpan.textContent=(isZero?"✏️ ":"")+info[i].name;
        ln.appendChild(nameSpan);
        if(info[i].price>0){
          var priceSpan=document.createElement("span");
          priceSpan.style.cssText="font-size:12px;font-weight:700;color:#e65100;margin-left:4px;";
          priceSpan.textContent=(info[i].price/100).toFixed(2)+"€";
          ln.appendChild(priceSpan);
        }else{
          var priceSpan=document.createElement("span");
          priceSpan.style.cssText="font-size:11px;color:#e65100;margin-left:4px;";
          priceSpan.textContent="✏️";
          ln.appendChild(priceSpan);
        }
      }
      ln.onmouseenter=function(){this.style.background=_mob?"rgba(230,81,0,0.08)":"rgba(230,81,0,0.06)";this.style.borderRadius="4px";};
      ln.onmouseleave=function(){this.style.background=_mob?"#fff":"transparent";this.style.borderRadius="0";};
      (function(idx){
        ln.addEventListener("click",function(e){
          e.stopPropagation();
          _inlineEdit(idx,e.clientX,e.clientY);
        });
      })(i);
      _overlay.appendChild(ln);
      _linesEls.push(ln);
    }
    // Mobile: wrap lines in a scrollable container
    if(_mob){
      var wrap=document.createElement("div");
      wrap.style.cssText="display:flex;flex-wrap:wrap;align-content:flex-start;gap:2px;padding:4px;pointer-events:auto;height:100%;overflow-y:auto;";
      for(var mi=0;mi<_linesEls.length;mi++){wrap.appendChild(_linesEls[mi]);}
      _overlay.appendChild(wrap);
    }
    // Desktop: panneau flottant avec en-tête + total + encaisser
    if(!_mob&&info.length>0){
      // Effacer et reconstruire le contenu du panneau
      var inner=document.createElement("div");
      inner.style.cssText="pointer-events:auto;background:rgba(255,255,255,0.95);border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.15);border:1px solid #e0e0e0;overflow:hidden;";
      // En-tête compact
      var hd=document.createElement("div");
      hd.style.cssText="padding:6px 10px;background:#1a1a2e;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;";
      hd.innerHTML='<span>🛒 Ticket</span><span>'+info.length+' lignes</span>';
      inner.appendChild(hd);
      // Zone lignes scrollable
      var linesBox=document.createElement("div");
      linesBox.style.cssText="max-height:40vh;overflow-y:auto;";
      for(var di=0;di<_linesEls.length;di++){linesBox.appendChild(_linesEls[di]);}
      inner.appendChild(linesBox);
      // Total + Encaisser
      var total=0;for(var ti2=0;ti2<info.length;ti2++)total+=info[ti2].price;
      var foot=document.createElement("div");
      foot.style.cssText="padding:6px 10px;display:flex;align-items:center;justify-content:space-between;background:#fff3e0;border-top:1px solid #e0e0e0;";
      foot.innerHTML='<span style="font-weight:700;font-size:14px;color:#1a1a2e;">Total: '+((total/100).toFixed(2))+'€</span>';
      var payBtn=document.createElement("button");
      payBtn.textContent="💰 Encaisser";
      payBtn.style.cssText="padding:4px 10px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:13px;cursor:pointer;font-weight:700;";
      payBtn.onclick=function(){_checkout();};
      foot.appendChild(payBtn);
      inner.appendChild(foot);
      _overlay.innerHTML="";
      _overlay.appendChild(inner);
    }
    // Desktop: si vide, panneau invisible (transparent)
    if(!_mob&&info.length===0){
      _overlay.innerHTML="";
    }
    // Mobile: if empty, show placeholder
    if(_mob&&info.length===0){
      var empty=document.createElement("div");
      empty.style.cssText="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:14px;";
      empty.textContent="🛒 Scanner un produit…";
      _overlay.appendChild(empty);
    }
    clearTimeout(_pollTimer);
    _pollTimer=setTimeout(_pollCart,2000);
  }

  // ═══════════════════════════════════════════════════════
  //  SCANNER AUTO — Scan → Ajout IMMÉDIAT (jamais bloqué)
  // ═══════════════════════════════════════════════════════
  var _scanBuf="",_scanTimer=null,_scanActive=false;
  function _onScanKey(e){
    if(_dialogOpen())return;
    if(e.target&&e.target.tagName==='INPUT')return;
    var ch=e.key;
    if(/^[0-9]$/.test(ch)){_scanBuf+=ch;_scanActive=true;e.preventDefault();
      clearTimeout(_scanTimer);_scanTimer=setTimeout(function(){if(_scanBuf.length>=6)_processBarcode(_scanBuf);_scanBuf="";_scanActive=false;},80);
    }else if(_scanActive){e.preventDefault();_scanBuf="";_scanActive=false;}}
  document.addEventListener("keydown",_onScanKey,true);

  function _processBarcode(bc){
    _log("Scanner: "+bc);
    // 1. Produit connu avec prix → AJOUT IMMÉDIAT (0.5 sec)
    _dbGet(bc).then(function(local){
      if(local&&local.sale_price_cents>0){
        _addToCart(local.name,local.sale_price_cents,bc,local.category);
        _toast("✅ "+local.name+" "+(local.sale_price_cents/100).toFixed(2)+"€");
        return;
      }
      // 2. Produit connu sans prix → AJOUT avec prix=0 (éditer plus tard)
      if(local&&local.name){
        _addToCart(local.name,0,bc,local.category);
        _toast("✏️ "+local.name+" — cliquez pour prix");
        return;
      }
      // 3. Inconnu → chercher OFF puis AJOUT (jamais bloqué)
      _lookupOFF(bc).then(function(off){
        if(off&&off.name){
          _dbPut({barcode:bc,name:off.name,sale_price_cents:0,category:off.category,source:"openfoodfacts",last_updated:Date.now()});
          _addToCart(off.name,0,bc,off.category);
          _toast("🔍 "+off.name+" — cliquez pour prix");
        }else{
          // 4. Vraiment inconnu → placeholder, éditer plus tard
          _addToCart("Produit "+bc,0,bc,"autre");
          _dbPut({barcode:bc,name:"Produit "+bc,sale_price_cents:0,category:"autre",source:"scan-unknown",last_updated:Date.now()});
          _toast("❓ "+bc+" — cliquez pour modifier");
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  //  ÉDITION INLINE — Petite carte flottante (pas de modal)
  // ═══════════════════════════════════════════════════════
  function _inlineEdit(idx,clickX,clickY){
    var info=_cartInfo();
    if(idx<0||idx>=info.length)return;
    var item=info[idx];

    // Fermer toute carte inline existante
    var existing=document.getElementById("acim-inline-edit");
    if(existing)existing.remove();

    var card=document.createElement("div");
    card.id="acim-inline-edit";

    if(_mob){
      // Mobile: bottom sheet — full width from bottom
      card.style.cssText="position:fixed;left:0;right:0;bottom:0;width:100%;max-height:70vh;background:#fff;border-radius:14px 14px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.25);z-index:10000001;font-family:Segoe UI,Arial,sans-serif;animation:acim-slideUp 0.2s ease;overflow-y:auto;";
    }else{
      // Desktop: floating card anchored to click position
      var cardW=280,cardH=180;
      var left=Math.min(Math.max(clickX-20,10),window.innerWidth-cardW-10);
      var top=Math.min(clickY-20,window.innerHeight-cardH-10);
      if(top<10)top=10;
      card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:"+cardW+"px;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000001;font-family:Segoe UI,Arial,sans-serif;animation:acim-pop 0.15s ease;";
    }

    // Animation CSS
    if(!document.getElementById("acim-pop-style")){
      var st=document.createElement("style");st.id="acim-pop-style";
      st.textContent="@keyframes acim-pop{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}@keyframes acim-slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}";
      document.head.appendChild(st);
    }

    // Titre compact avec icône catégorie
    var ti=document.createElement("div");
    ti.style.cssText="font-size:13px;font-weight:700;margin-bottom:8px;color:#1a1a2e;display:flex;align-items:center;gap:4px;";
    ti.textContent=_catIcon(item.cat||"autre")+" Modifier";
    card.appendChild(ti);

    // Nom
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};
    ni.onblur=function(){this.style.borderColor="#e0e0e0";};
    card.appendChild(ni);

    // Prix (champ principal si prix=0)
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.price>0?(item.price/100).toFixed(2):"";pi.placeholder="Prix";
    pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};
    pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:16px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);

    // v22: Poids dans l'édition inline
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    // Parse existing poids from name: "Viande 1.254kg" → extract "1.254" and "kg"
    var exPoids="",exUnit="kg";
    var pm=item.name&&item.name.match(/ (\d+[\.,]?\d*)\s*(kg|g|L|pc|pièce)/);
    if(pm){exPoids=pm[1].replace(",",".");exUnit=pm[2]==='pièce'?'pc':pm[2];}
    var exBase=item.name||"";
    if(pm)exBase=item.name.replace(pm[0],"").trim();
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=exPoids;poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:12px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");
    unitSel.style.cssText="font-size:12px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(u[0]===exUnit)o.selected=true;
      unitSel.appendChild(o);
    });
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);
    card.appendChild(poidsRow);

    // Catégories 1-clic (compact)
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||_guessCat(item.name||"");
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}
    card.appendChild(cr);

    // Tag code-barres (non-éditable, référence) — v21: 🖨️ optionnel
    if(item.bc){
      var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:11px;color:#888;";
      var bcIcon=document.createElement("span");bcIcon.textContent="📊";
      var bcLabel=document.createElement("span");bcLabel.textContent=item.bc;
      var bcPrint=document.createElement("button");bcPrint.textContent="🖨️";bcPrint.title="Imprimer code-barres";
      bcPrint.style.cssText="padding:2px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;font-size:10px;cursor:pointer;margin-left:auto;";
      bcPrint.onclick=function(){_openBarcodePage(ni.value.trim()||item.name,item.bc);};
      bcRow.appendChild(bcIcon);bcRow.appendChild(bcLabel);bcRow.appendChild(bcPrint);
      card.appendChild(bcRow);
    }

    // Boutons compact: 🗑 × ✓
    var br=document.createElement("div");br.style.cssText="display:flex;gap:6px;";
    var bDel=document.createElement("button");bDel.textContent="🗑️";bDel.title="Supprimer";
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){_myCart.splice(idx,1);card.remove();_toast("Supprimé");_pollCart();_broadcastCart();};

    var bCancel=document.createElement("button");bCancel.textContent="×";bCancel.title="Annuler (Esc)";
    bCancel.style.cssText="padding:6px 8px;border:1px solid #e0e0e0;border-radius:6px;background:#f5f5f5;font-size:12px;cursor:pointer;";
    bCancel.onclick=function(){card.remove();};

    var bOk=document.createElement("button");bOk.textContent="✓";bOk.title="Valider (Enter)";
    bOk.style.cssText="flex:1;padding:6px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      if(pv>0){nn=nn+" "+pv+u;}
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?_myCart[idx].priceCents:Math.round(np*100);
      // v23: edit in _myCart directly
      _myCart[idx].name=nn;
      _myCart[idx].priceCents=pc;
      _myCart[idx].cat=selCat;
      // Update realBcMap
      if(nn&&_realBcMap[_myCart[idx].myId])_realBcMap[_myCart[idx].myId]=_myCart[idx].bc;
      // Try to sync Dart product fields
      if(_myCart[idx].dartProd){
        try{
          var cp=_clone(_myCart[idx].dartProd,{name:nn,salePriceCents:pc,categoryId:selCat});
          if(cp){
            var ls=_lines(),nl=_newArr();
            for(var di=0;di<ls.length;di++){
              if(ls[di].a&&ls[di].a.a===_myCart[idx].dartProd.a){
                nl.push(new A.oV(cp,1,null));
              }else nl.push(ls[di]);
            }
            _update(nl);
          }
        }catch(e){_err('dart edit',e);}
      }
      // Update catalogue
      _dbPut({barcode:_myCart[idx].bc||_myCart[idx].myId,name:nn,sale_price_cents:pc,category:selCat,source:"edit",last_updated:Date.now()});
      card.remove();
      _toast("\u2705 "+nn+(pc>0?" "+(pc/100).toFixed(2)+"\u20ac":""));
      _pollCart();
      _broadcastCart();
    };

    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);

    // Auto-focus: prix si prix=0, nom si placeholder
    var isPlaceholder=item.name&&item.name.startsWith("Produit ");
    var fe=isPlaceholder?ni:(item.price===0?pi:ni);
    setTimeout(function(){fe.focus();fe.select();},50);

    // Raccourcis clavier
    var kh=function(e){
      if(e.key==="Enter"){e.preventDefault();bOk.click();}
      if(e.key==="Escape"){e.preventDefault();card.remove();}
      if(e.key==="Tab"&&info.length>1){e.preventDefault();var ni2=e.shiftKey?(idx-1+info.length)%info.length:(idx+1)%info.length;card.remove();
        var nextTop=20+ni2*_getLH()+_getLH()/2;_inlineEdit(ni2,window.innerWidth*0.75,nextTop);}
    };
    ni.onkeydown=kh;pi.onkeydown=kh;

    // Clic hors carte = fermer
    var closeOnOutside=function(e){
      if(!card.contains(e.target)&&e.target!==card){
        // Ne pas fermer si on clique sur une autre ligne overlay
        var overlayLine=false;
        for(var i=0;i<_linesEls.length;i++){if(_linesEls[i]===e.target)overlayLine=true;}
        if(!overlayLine){card.remove();document.removeEventListener("click",closeOnOutside);}
      }
    };
    setTimeout(function(){document.addEventListener("click",closeOnOutside);},100);
  }

  // ═══════════════════════════════════════════════════════
  //  CRÉATION RAPIDE — 3 champs: nom, prix, catégorie
  // ═══════════════════════════════════════════════════════
  function _quickCreate(name,priceCents,barcode,category){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:"+(_mob?"flex-end":"center")+";justify-content:center;";

    var card=document.createElement("div");
    var cardW=_mob?"95vw":"320px";
    card.style.cssText="background:#fff;border-radius:"+(_mob?"14px 14px 0 0":"14px")+";padding:"+(_mob?"16px":"20px")+";width:"+cardW+";max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";

    // Titre
    var ti=document.createElement("div");
    ti.style.cssText="font-size:"+(_mob?"14px":"16px")+";font-weight:700;margin-bottom:12px;color:#1a1a2e;display:flex;align-items:center;gap:6px;";
    ti.textContent="⚡ Nouveau produit";
    card.appendChild(ti);

    // Nom (champ principal)
    var ni=document.createElement("input");ni.type="text";ni.value=name||"";ni.placeholder="Nom du produit";
    ni.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";};
    ni.onblur=function(){this.style.borderColor="#e0e0e0";};
    card.appendChild(ni);

    // Prix (2nd champ)
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=priceCents?(priceCents/100).toFixed(2):"";pi.placeholder="Prix total";
    pi.style.cssText="flex:1;font-size:18px;font-weight:700;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};
    pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);

    // v22: POIDS (optionnel — pour viande, fruits au poids etc.)
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";poidsIn.placeholder="Poids (optionnel)";
    poidsIn.style.cssText="flex:1;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");
    unitSel.style.cssText="font-size:14px;padding:8px;border:2px solid #e0e0e0;border-radius:10px;outline:none;background:#fff;";
    var uKg=document.createElement("option");uKg.value="kg";uKg.textContent="kg";
    var uG=document.createElement("option");uG.value="g";uG.textContent="g";
    var uL=document.createElement("option");uL.value="L";uL.textContent="L";
    var uPc=document.createElement("option");uPc.value="pc";uPc.textContent="pièce";
    unitSel.appendChild(uKg);unitSel.appendChild(uG);unitSel.appendChild(uL);unitSel.appendChild(uPc);
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);
    card.appendChild(poidsRow);

    // Tag code-barres (auto-généré ou du scan, non-éditable)
    // v21: PAS de bouton 🖨️ ici — on ajoute au panier AVANT d'imprimer
    var autoBc=barcode||_nextBarcode();
    var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 10px;background:#f5f5f5;border-radius:8px;";
    var bcIcon=document.createElement("span");bcIcon.style.cssText="font-size:14px;";bcIcon.textContent="📊";
    var bcLabel=document.createElement("span");bcLabel.style.cssText="font-size:13px;color:#888;";bcLabel.textContent="Code: ";
    var bcVal=document.createElement("span");bcVal.style.cssText="font-size:14px;font-weight:700;color:#1a1a2e;";bcVal.textContent=autoBc;
    bcRow.appendChild(bcIcon);bcRow.appendChild(bcLabel);bcRow.appendChild(bcVal);
    card.appendChild(bcRow);

    // Catégories 1-clic (emoji)
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;";
    var selCat=category||_guessCat(name||"");
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:6px 8px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}
    card.appendChild(cr);

    // Boutons: × Annuler | ✓ Ajouter
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="× Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:1px solid #e0e0e0;border-radius:10px;background:#f5f5f5;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓ Ajouter";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      // v22: inclure poids dans le nom → chaque ligne est UNIQUE
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      if(pv>0){nn=nn+" "+pv+u;}
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?0:Math.round(np*100);
      var added=_addToCart(nn,pc,autoBc,selCat);
      if(!added){
        _toast("⏳ Réessayons…");
        setTimeout(function(){
          var added2=_addToCart(nn,pc,autoBc,selCat);
          if(!added2){_toast("❌ Impossible d'ajouter — réessayez");return;}
          _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"manual",last_updated:Date.now()});
          ov.remove();_toastWithPrint(nn,pc,autoBc);_pollCart();
        },500);return;
      }
      _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"manual",last_updated:Date.now()});
      ov.remove();_toastWithPrint(nn,pc,autoBc);_pollCart();
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);

    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);

    // Auto-focus: nom si vide, prix si nom pré-rempli
    var fe=name?pi:ni;
    setTimeout(function(){fe.focus();fe.select();},50);
    ni.onkeydown=pi.onkeydown=function(e){
      if(e.key==="Enter"){e.preventDefault();bOk.click();}
      if(e.key==="Escape"){e.preventDefault();ov.remove();}
    };
  }

  // ═══════════════════════════════════════════════════════
  //  📸 CAMÉRA SCANNER (v12)
  // ═══════════════════════════════════════════════════════
  var _scanner=null,_scannerActive=false;

  function _isMobile(){
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||('ontouchstart' in window&&window.innerWidth<1024);}

  function _createScanButton(){
    if(!_isMobile())return;
    var btn=document.createElement("div");btn.id="acim-scan-btn";
    btn.style.cssText="position:fixed;bottom:20px;right:20px;width:56px;height:56px;background:#e65100;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;z-index:99999998;box-shadow:0 4px 16px rgba(230,81,0,0.4);pointer-events:auto;";
    btn.textContent="📸";btn.title="Scanner un produit";
    btn.onclick=function(){_openScanner();};
    document.body.appendChild(btn);
  }

  function _openScanner(){
    if(_dialogOpen())return;
    if(_scannerActive){_closeScanner();return;}
    var ov=document.createElement("div");ov.id="acim-scanner";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:10000001;display:flex;flex-direction:column;";
    var hd=document.createElement("div");hd.style.cssText="padding:12px 16px;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;";ti.textContent="📸 Scanner un produit";
    var xb=document.createElement("div");xb.style.cssText="font-size:24px;cursor:pointer;padding:4px 8px;";xb.textContent="✕";
    xb.onclick=function(){_closeScanner();};
    hd.appendChild(ti);hd.appendChild(xb);ov.appendChild(hd);
    var cam=document.createElement("div");cam.id="acim-cam-view";
    cam.style.cssText="flex:1;position:relative;overflow:hidden;background:#111;";
    ov.appendChild(cam);
    var st=document.createElement("div");st.id="acim-cam-status";
    st.style.cssText="padding:12px;text-align:center;color:#fff;font-size:14px;font-family:Segoe UI,Arial,sans-serif;background:#1a1a2e;";
    st.textContent="📷 Démarrage de la caméra…";
    ov.appendChild(st);
    var mb=document.createElement("div");mb.style.cssText="padding:8px 16px;background:#1a1a2e;display:flex;gap:8px;";
    var mbBtn=document.createElement("button");mbBtn.textContent="✏️ Saisie manuelle";
    mbBtn.style.cssText="flex:1;padding:12px;border:1px solid #444;border-radius:10px;background:#2a2a3e;color:#fff;font-size:14px;cursor:pointer;font-family:Segoe UI,Arial,sans-serif;";
    mbBtn.onclick=function(){_closeScanner();_quickCreate("",0);};
    var phBtn=document.createElement("button");phBtn.textContent="📷 Photo";
    phBtn.id="acim-snap-btn";
    phBtn.style.cssText="flex:1;padding:12px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;font-family:Segoe UI,Arial,sans-serif;";
    phBtn.onclick=function(){_takeSnapshot();};
    mb.appendChild(mbBtn);mb.appendChild(phBtn);ov.appendChild(mb);
    document.body.appendChild(ov);_scannerActive=true;
    _startNativeScanner(cam,st);
  }

  function _startNativeScanner(container,statusEl){
    if('BarcodeDetector' in window){
      _log("Using native BarcodeDetector");statusEl.textContent="🔍 En attente d'un code-barres…";
      var video=document.createElement("video");video.setAttribute("autoplay","");video.setAttribute("playsinline","");
      video.style.cssText="width:100%;height:100%;object-fit:cover;";
      container.appendChild(video);
      navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(function(stream){
        video.srcObject=stream;video.play();
        var detector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e","qr_code"]});
        var detected=false;var scanLoop=function(){
          if(!_scannerActive||detected)return;
          detector.detect(video).then(function(barcodes){
            if(barcodes.length>0&&!detected){detected=true;var bc=barcodes[0].rawValue;
              _log("Camera barcode: "+bc);statusEl.textContent="✅ Code-barres: "+bc;
              setTimeout(function(){_closeScanner();_processBarcode(bc);},500);
            }
          }).catch(function(){});
          if(!detected)requestAnimationFrame(scanLoop);
        };
        video.addEventListener("loadedmetadata",function(){scanLoop();});
      }).catch(function(e){_err("camera",e);statusEl.textContent="❌ Caméra non disponible";_tryHtml5QrFallback(container,statusEl);});
    }else{_tryHtml5QrFallback(container,statusEl);}
  }

  function _tryHtml5QrFallback(container,statusEl){
    if(typeof Html5Qrcode!=='undefined'){_startHtml5Qr(container,statusEl);return;}
    statusEl.textContent="⏳ Chargement du scanner…";
    var sc=document.createElement("script");sc.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    sc.onload=function(){_log("html5-qrcode loaded");_startHtml5Qr(container,statusEl);};
    sc.onerror=function(){statusEl.textContent="❌ Scanner non disponible";};
    document.head.appendChild(sc);
  }

  function _startHtml5Qr(container,statusEl){
    try{container.innerHTML="";
      var readerDiv=document.createElement("div");readerDiv.id="acim-qr-reader";
      readerDiv.style.cssText="width:100%;height:100%;";container.appendChild(readerDiv);
      _scanner=new Html5Qrcode("acim-qr-reader");
      _scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:250,height:150},aspectRatio:1.0},
        function(decodedText){_log("QR/Barcode: "+decodedText);statusEl.textContent="✅ Code: "+decodedText;
          setTimeout(function(){_closeScanner();_processBarcode(decodedText);},500);
        },function(){}
      ).catch(function(e){_err("html5qr start",e);statusEl.textContent="❌ Caméra non disponible";});
      statusEl.textContent="🔍 En attente d'un code-barres…";
    }catch(e){_err("html5qr",e);statusEl.textContent="❌ Erreur scanner";}
  }

  function _takeSnapshot(){
    var video=document.querySelector("#acim-cam-view video");
    if(!video){_toast("❌ Pas de caméra active");return;}
    var canvas=document.createElement("canvas");canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;
    var ctx=canvas.getContext("2d");ctx.drawImage(video,0,0,canvas.width,canvas.height);
    var dataUrl=canvas.toDataURL("image/jpeg",0.8);
    if('BarcodeDetector' in window){
      var detector=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e","qr_code"]});
      var img=new Image();img.onload=function(){
        detector.detect(img).then(function(barcodes){
          if(barcodes.length>0){_closeScanner();_processBarcode(barcodes[0].rawValue);}
          else{_closeScanner();_quickCreateFromPhoto(dataUrl);}
        }).catch(function(){_closeScanner();_quickCreateFromPhoto(dataUrl);});
      };img.src=dataUrl;
    }else{_closeScanner();_quickCreateFromPhoto(dataUrl);}
  }

  function _quickCreateFromPhoto(photoDataUrl){
    // Photo sans code-barres → même formulaire simplifié avec aperçu photo
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:"+(_mob?"flex-end":"center")+";justify-content:center;";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:"+(_mob?"14px 14px 0 0":"14px")+";padding:"+(_mob?"16px":"20px")+";width:"+(_mob?"95vw":"320px")+";max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="📸 Produit sans code-barres";card.appendChild(ti);
    if(photoDataUrl){
      var img=document.createElement("img");img.src=photoDataUrl;
      img.style.cssText="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;";
      card.appendChild(img);
    }
    var ni=document.createElement("input");ni.type="text";ni.placeholder="Nom du produit";
    ni.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";};ni.onblur=function(){this.style.borderColor="#e0e0e0";};
    card.appendChild(ni);
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";pi.placeholder="Prix (0 si inconnu)";
    pi.style.cssText="flex:1;font-size:18px;font-weight:700;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);
    // v22: POIDS
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";poidsIn.placeholder="Poids (optionnel)";
    poidsIn.style.cssText="flex:1;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");
    unitSel.style.cssText="font-size:14px;padding:8px;border:2px solid #e0e0e0;border-radius:10px;outline:none;background:#fff;";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){var o=document.createElement("option");o.value=u[0];o.textContent=u[1];unitSel.appendChild(o);});
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);
    // v21: PAS de 🖨️ ici — ajouter au panier AVANT d'imprimer
    var autoBc=_nextBarcode();
    var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 10px;background:#f5f5f5;border-radius:8px;";
    var bcIcon=document.createElement("span");bcIcon.textContent="📊";
    var bcLabel=document.createElement("span");bcLabel.style.cssText="font-size:13px;color:#888;";bcLabel.textContent="Auto: ";
    var bcVal=document.createElement("span");bcVal.style.cssText="font-size:14px;font-weight:700;color:#1a1a2e;";bcVal.textContent=autoBc;
    bcRow.appendChild(bcIcon);bcRow.appendChild(bcLabel);bcRow.appendChild(bcVal);
    card.appendChild(bcRow);
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;";
    var selCat="autre";
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:6px 8px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;";
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}
    card.appendChild(cr);
    var br=document.createElement("div");br.style.cssText="display:flex;gap:8px;";
    var bCancel=document.createElement("button");bCancel.textContent="× Annuler";
    bCancel.style.cssText="flex:1;padding:10px;border:1px solid #e0e0e0;border-radius:10px;background:#f5f5f5;font-size:14px;cursor:pointer;";
    bCancel.onclick=function(){ov.remove();};
    var bOk=document.createElement("button");bOk.textContent="✓ Ajouter";
    bOk.style.cssText="flex:2;padding:10px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    bOk.onclick=function(){
      var nn=ni.value.trim(),np=parseFloat(pi.value);
      var pv=parseFloat(poidsIn.value),u=unitSel.value;
      if(pv>0){nn=nn+" "+pv+u;}
      if(!nn){ni.style.borderColor="#c62828";ni.focus();return;}
      var pc=isNaN(np)?0:Math.round(np*100);
      // v21: panier AVANT impression
      var added=_addToCart(nn,pc,autoBc,selCat);
      if(!added){
        _toast("⏳ Réessayons…");
        setTimeout(function(){
          var added2=_addToCart(nn,pc,autoBc,selCat);
          if(!added2){_toast("❌ Impossible d'ajouter");return;}
          _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"photo",last_updated:Date.now()});
          ov.remove();
          _toastWithPrint(nn,pc,autoBc);
          _pollCart();
        },500);
        return;
      }
      _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"photo",last_updated:Date.now()});
      ov.remove();
      // v21: toast avec impression optionnelle (pas auto)
      _toastWithPrint(nn,pc,autoBc);
      _pollCart();
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};document.body.appendChild(ov);
    ni.focus();
    ni.onkeydown=pi.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();bOk.click();}if(e.key==="Escape"){e.preventDefault();ov.remove();}};
  }

  function _closeScanner(){
    _scannerActive=false;
    if(_scanner){try{_scanner.stop().catch(function(){});}catch(e){}_scanner=null;}
    var video=document.querySelector("#acim-cam-view video");
    if(video&&video.srcObject){video.srcObject.getTracks().forEach(function(t){t.stop();});}
    var el=document.getElementById("acim-scanner");if(el)el.remove();
  }

  // ═══════════════════════════════════════════════════════
  //  CTRL+L — RECHERCHE → Ajout immédiat
  // ═══════════════════════════════════════════════════════
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="l"){e.preventDefault();_showLookup();}
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="n"){e.preventDefault();_quickCreate("",0);}
  });

  function _showLookup(){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-lookup";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:"+(_mob?"flex-end":"flex-start")+";justify-content:center;padding-"+(_mob?"bottom":"top")+":"+(_mob?"0":"60px")+";";
    var card=document.createElement("div");
    card.style.cssText="background:#fff;border-radius:"+(_mob?"14px 14px 0 0":"14px")+";padding:"+(_mob?"16px":"20px")+";width:"+(_mob?"95vw":"360px")+";max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="🔍 Rechercher un produit";card.appendChild(ti);
    var inp=document.createElement("input");inp.type="text";inp.placeholder="Code-barres ou nom…";
    inp.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;font-family:Segoe UI,Arial,sans-serif;";
    inp.onfocus=function(){this.style.borderColor="#e65100";};inp.onblur=function(){this.style.borderColor="#e0e0e0";};
    card.appendChild(inp);
    var res=document.createElement("div");res.style.cssText="margin-top:10px;max-height:60vh;overflow-y:auto;";card.appendChild(res);
    inp.oninput=function(){
      var v=inp.value.trim();res.innerHTML="";
      if(!v)return;
      if(/^\d{6,}$/.test(v)){
        var d=document.createElement("div");d.style.cssText="padding:8px;color:#888;font-size:13px;";
        d.textContent="⏳ Recherche…";res.appendChild(d);
        _dbGet(v).then(function(c){
          if(c&&c.sale_price_cents>0){res.innerHTML="";_addResult(res,c);return;}
          _lookupOFF(v).then(function(off){res.innerHTML="";if(off&&off.name)_addResult(res,off);
            else{var n=document.createElement("div");n.style.cssText="padding:8px;color:#999;font-size:13px;";n.textContent="Non trouvé";res.appendChild(n);}
          });
        });
      }else{
        _searchCatalog(v).then(function(arr){res.innerHTML="";
          for(var i=0;i<arr.length;i++)_addResult(res,arr[i]);
          if(!arr.length){var n=document.createElement("div");n.style.cssText="padding:8px;color:#999;font-size:13px;";
            n.textContent="Aucun résultat — ➕ pour créer un produit";res.appendChild(n);}
        });
      }
    };
    // Bouton ➕ Créer manuellement
    var addBtn=document.createElement("button");addBtn.textContent="➕ Créer un nouveau produit";
    addBtn.style.cssText="width:100%;margin-top:10px;padding:10px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    addBtn.onclick=function(){ov.remove();_quickCreate(inp.value.trim(),0);};
    card.appendChild(addBtn);

    ov.appendChild(card);ov.onclick=function(e){if(e.target===ov)ov.remove();};document.body.appendChild(ov);
    inp.focus();
    inp.onkeydown=function(e){if(e.key==="Escape"){e.preventDefault();ov.remove();}};
  }

  function _addResult(container,item){
    var d=document.createElement("div");
    d.style.cssText="padding:10px 12px;cursor:pointer;border-radius:8px;margin-bottom:4px;display:flex;align-items:center;gap:8px;font-family:Segoe UI,Arial,sans-serif;";
    d.onmouseenter=function(){this.style.background="#fff3e0";};d.onmouseleave=function(){this.style.background="transparent";};
    var ic=document.createElement("span");ic.style.cssText="font-size:18px;";ic.textContent=_catIcon(item.category||"autre");
    var tx=document.createElement("span");tx.style.cssText="flex:1;font-size:14px;";tx.textContent=item.name||"Produit sans nom";
    var pr=document.createElement("span");pr.style.cssText="font-size:13px;color:#e65100;font-weight:600;";
    pr.textContent=item.sale_price_cents>0?(item.sale_price_cents/100).toFixed(2)+"€":"✏️";
    d.appendChild(ic);d.appendChild(tx);d.appendChild(pr);
    d.onclick=function(){
      var bc=item.barcode||"";
      // Produit avec prix → ajout IMMÉDIAT (pas de dialog)
      if(item.sale_price_cents>0){
        _addToCart(item.name,item.sale_price_cents,bc,item.category);
        _toast("✅ "+item.name+" "+(item.sale_price_cents/100).toFixed(2)+"€");
      }else{
        // Pas de prix → ajout avec prix=0 + toast ✏️
        _addToCart(item.name,0,bc,item.category);
        _toast("✏️ "+item.name+" — cliquez pour prix");
      }
      container.closest("#acim-lookup").remove();
      _pollCart();
    };
    container.appendChild(d);
  }

  function _searchCatalog(q){
    return _openDB().then(function(d){if(!d)return[];
      return new Promise(function(ok){
        var tx=d.transaction("products","readonly"),st=tx.objectStore("products"),gr=st.getAll();
        gr.onsuccess=function(){var all=gr.result||[],low=q.toLowerCase(),res=[];
          for(var i=0;i<all.length;i++){var n=(all[i].name||"").toLowerCase();if(n.includes(low))res.push(all[i]);}
          ok(res);};gr.onerror=function(){ok([]);};
      });});}

  // ═══════════════════════════════════════════════════════
  //  SAUVEGARDE / RESTAURATION
  // ═══════════════════════════════════════════════════════
  async function _exportAll(){_toast("💾 Sauvegarde…");var all={},count=0;
    try{var root=await navigator.storage.getDirectory();async function rd(dir,pre){for await(var en of dir.values()){if(en.kind==="file"){try{var h=await en.getFile();var b=await h.arrayBuffer();all["opfs:"+pre+en.name]=Array.from(new Uint8Array(b));count++;}catch(e){}}else if(en.kind==="directory")await rd(en,pre+en.name+"/");}}await rd(root,"");}catch(e){}
    try{var dbs=await indexedDB.databases();for(var di=0;di<dbs.length;di++){var dn=dbs[di].name;if(!dn)continue;try{var d=await _readIDB(dn);if(d&&Object.keys(d).length>0){all["idb:"+dn]=d;count++;}}catch(e){}}}catch(e){}
    if(count>0){all._v="21.0";all._date=new Date().toISOString();var json=JSON.stringify(all),blob=new Blob([json],{type:"application/json"}),url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download="acimcaisse-"+_ds()+".json";document.body.appendChild(a);a.click();setTimeout(function(){a.remove();URL.revokeObjectURL(url);},500);
      _toast("✅ "+count+" éléments sauvegardés");}else{_toast("⚠️ Aucune donnée");}}

  function _readIDB(name){return new Promise(function(ok){try{var r=indexedDB.open(name);
    r.onupgradeneeded=function(e){e.target.transaction.abort();ok(null);};
    r.onsuccess=function(e){var db=e.target.result,stores=db.objectStoreNames;if(!stores.length){db.close();ok(null);return;}
      var res={},rem=stores.length;for(var i=0;i<stores.length;i++){(function(sn){try{var tx=db.transaction(sn,"readonly"),st=tx.objectStore(sn),gr=st.getAll();gr.onsuccess=function(){res[sn]=gr.result;rem--;if(!rem){db.close();ok(res);}};gr.onerror=function(){rem--;if(!rem){db.close();ok(res);}};}catch(e){rem--;if(!rem){db.close();ok(res);}}})(stores[i]);}}
    r.onerror=function(){ok(null);};}catch(e){ok(null);}});}

  async function _importAll(data){var count=0;
    for(var k in data){if(!k.startsWith("opfs:"))continue;try{var fp=k.substring(5),root=await navigator.storage.getDirectory(),parts=fp.split("/"),dir=root;
      for(var i=0;i<parts.length-1;i++)dir=await dir.getDirectoryHandle(parts[i],{create:true});
      var fh=await dir.getFileHandle(parts[parts.length-1],{create:true}),w=await fh.createWritable();await w.write(new Uint8Array(data[k]));await w.close();count++;}catch(e){}}
    for(var k in data){if(!k.startsWith("idb:"))continue;try{await _writeIDB(k.substring(4),data[k]);count++;}catch(e){}}
    if(data["localStorage"])try{for(var k in data["localStorage"])localStorage.setItem(k,data["localStorage"][k]);count++;}catch(e){}
    return count;}

  function _writeIDB(name,sd){return new Promise(function(ok){try{indexedDB.deleteDatabase(name).onsuccess=function(){
    var r=indexedDB.open(name);r.onupgradeneeded=function(e){var db=e.target.result;for(var sn in sd){if(!db.objectStoreNames.contains(sn)){var s=sd[sn],kp=null;if(Array.isArray(s)&&s.length>0&&s[0]&&s[0].key!==undefined)kp="key";db.createObjectStore(sn,kp?{keyPath:kp}:{autoIncrement:true});}}};
    r.onsuccess=function(e){var db=e.target.result;for(var sn in sd){try{if(!db.objectStoreNames.contains(sn))continue;var tx=db.transaction(sn,"readwrite"),st=tx.objectStore(sn);var items=sd[sn];if(Array.isArray(items))items.forEach(function(it){try{st.put(it)}catch(e){}});}catch(e){}}db.close();ok();};
    r.onerror=function(){ok();};};}catch(e){ok();}});}

  function _doImport(){var inp=document.createElement("input");inp.type="file";inp.accept=".json,.db,.sqlite";
    inp.onchange=async function(e){var f=e.target.files[0];if(!f)return;_toast("📂 Restauration…");try{var nm=f.name.toLowerCase();
      if(nm.endsWith(".json")){var data=JSON.parse(await f.text()),c=await _importAll(data);_toast("✅ "+c+" restaurés");setTimeout(function(){location.reload();},1500);}
      else if(nm.endsWith(".db")||nm.endsWith(".sqlite")){var buf=new Uint8Array(await f.arrayBuffer()),root=await navigator.storage.getDirectory();
        for(var n of [f.name,"drift.db"]){try{var fh=await root.getFileHandle(n,{create:true}),w=await fh.createWritable();await w.write(buf);await w.close();}catch(e){}}
        _toast("✅ Base restaurée");setTimeout(function(){location.reload();},1500);}
    }catch(e){_toast("❌ "+e.message);}};inp.click();}

  // ═══════════════════════════════════════════════════════
  //  RACCOURCIS + CAMÉRA FLUTTER + INIT
  // ═══════════════════════════════════════════════════════
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="s"){e.preventDefault();_exportAll();}
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="o"){e.preventDefault();_doImport();}
    if(e.key==="F2"){e.preventDefault();var info=_cartInfo();if(info.length&&!_dialogOpen())_inlineEdit(0,window.innerWidth*0.75,20+_getLH()/2);}
  });
  // Désactiver la caméra Flutter
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    var _origGetUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    var _origEnumerate=navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=function(constraints){
      if(_scannerActive)return _origGetUserMedia(constraints);
      return Promise.reject(new DOMException("Camera managed by AcimCaisse","NotAllowedError"));
    };
    navigator.mediaDevices.enumerateDevices=function(){return _origEnumerate();};
  }

  function _dialogOpen(){return !!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick")||!!document.getElementById("acim-lookup")||!!document.getElementById("acim-scanner");}
  function _ds(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function _toast(msg){if(!msg)return;var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";t.textContent=msg;
    t.style.cssText="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},2500);}

  // v21: Toast avec bouton impression OPTIONNEL — panier AVANT impression
  function _toastWithPrint(name,priceCents,barcode){
    var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";
    t.style.cssText="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:90vw;text-align:center;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;";
    var msg=document.createElement("span");
    msg.textContent="✅ "+name+(priceCents>0?" "+(priceCents/100).toFixed(2)+"€":" — ✏️ prix à compléter");
    t.appendChild(msg);
    // Bouton impression OPTIONNEL (panier déjà rempli)
    if(barcode){
      var prBtn=document.createElement("button");
      prBtn.textContent="🖨️ Imprimer";
      prBtn.style.cssText="padding:6px 12px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:12px;cursor:pointer;font-weight:700;";
      prBtn.onclick=function(){
        t.remove();
        _openBarcodePage(name,barcode);
      };
      t.appendChild(prBtn);
    }
    document.body.appendChild(t);
    // Auto-supprimer après 4 sec (plus long car bouton optionnel)
    setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},4000);
  }

  // ─── DIAGNOSTIC Ctrl+Shift+D ──────────────────────
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&e.shiftKey&&e.key==="D"){
      e.preventDefault();
      var d={notifier:!!_notifier,hooks:_hooked,cart:_cartInfo().length,
        A_bcg:typeof A==='object'&&typeof A.bcg==='function',
        B_cU:typeof B==='object'&&!!B.cU,
        B_kg:typeof B==='object'&&!!B.cU&&typeof B.cU.kg==='function',
        A_bD:typeof A==='object'&&typeof A.bD==='function',
        A_oW:typeof A==='object'&&typeof A.oW==='function',
        A_oV:typeof A==='object'&&typeof A.oV==='function',
        diag:_diagLevel};
      console.log("[Acim] DIAGNOSTIC:",JSON.stringify(d));
      _toast("notifier:"+d.notifier+" bcg:"+d.A_bcg+" kg:"+d.B_kg+" bD:"+d.A_bD+" oW:"+d.A_oW+" diag:L"+d.diag);
    }
  });

  // ─── FIX ÉCRAN CLIENT ──
  var _origWindowOpen=window.open;
  window.open=function(url,name,features){
    if(url&&typeof url==='string'&&url.includes('customer-display')){
      var screens=window.screen;
      if(screens&&screens.isExtended===false){_toast("ℹ️ Écran client: 1 seul écran");return null;}
    }
    return _origWindowOpen.apply(this,arguments);
  };

  // ═══════════════════════════════════════════════════════
  //  BOUTONS FLOTTANTS — 📊 (barcode) + ➕ (ajout) + 📸 (camera)
  // ═══════════════════════════════════════════════════════
  function _createFloatingButtons(){
    // 📊 Code-barres (bas gauche)
    var bcBtn=document.createElement("div");bcBtn.id="acim-barcode-btn";
    bcBtn.style.cssText="position:fixed;bottom:20px;left:20px;width:48px;height:48px;background:#1a1a2e;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;z-index:99999998;box-shadow:0 4px 16px rgba(0,0,0,0.3);pointer-events:auto;";
    bcBtn.textContent="📊";bcBtn.title="Imprimer codes-barres (Ctrl+B)";
    bcBtn.onclick=function(){_openBarcodePage();};
    document.body.appendChild(bcBtn);

    // ➕ Ajout rapide (bas centre) — PRINCIPAL
    var addBtn=document.createElement("div");addBtn.id="acim-add-btn";
    addBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:56px;height:56px;background:#e65100;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;z-index:99999998;box-shadow:0 4px 16px rgba(230,81,0,0.4);pointer-events:auto;";
    addBtn.textContent="➕";addBtn.title="Ajouter un produit (Ctrl+N)";
    addBtn.onclick=function(){_quickCreate("",0);};
    document.body.appendChild(addBtn);
  }

  // ─── BARCODE PAGE ──────────────────────────────
  function _openBarcodePage(name,code){
    var isDesktop=!!(window.acimDesktop&&window.acimDesktop.isDesktop);
    if(isDesktop){
      try{if(name||code)window.acimDesktop.openBarcode(name||"",code||"");
        else window.acimDesktop.openBarcode("","");return;
      }catch(e){_err("barcode desktop",e);}
    }
    var basePath=window.location.pathname.replace(/[^/]*$/,"");
    var url=basePath+"barcode.html";
    if(name||code){var params=[];
      if(name)params.push("nom="+encodeURIComponent(name));
      if(code)params.push("code="+encodeURIComponent(code));
      url+="?"+params.join("&");}
    window.open(url,"_blank");
  }

  // Ctrl+B = barcode
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="b"){
      e.preventDefault();
      var editCard=document.getElementById("acim-inline-edit");
      if(editCard){
        // Si en édition inline, imprimer le code-barres de la ligne
        var bcTag=editCard.querySelector("span"); // chercher le tag barcode
        // Fallback: chercher dans les inputs
        _openBarcodePage();
      }else{_openBarcodePage();}
    }
  });

  // ═══════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════
  function _checkout(){
    if(_myCart.length===0){_toast("\u26A0 Panier vide");return;}
    var total=0;for(var i=0;i<_myCart.length;i++)total+=_myCart[i].priceCents;
    _broadcastClear();
    _myCart=[];
    _realBcMap={};
    // Try to clear Dart
    try{var n=_find();if(n){var nl=_newArr();_update(nl);}}catch(e){}
    _pollCart();
    _toast("\u2705 Encaiss\u00E9 ! "+(total/100).toFixed(2)+"\u20ac");
  }

  function init(){
    _log("v23 — UX Simplifié: panier avant impression, responsive mobile, ajout robuste");
    _createOverlay();
    _createFloatingButtons();
    _createScanButton();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();

  window._acimGetCartInfo=_cartInfo;
  window._acimDebug=function(){return{notifier:!!_notifier,hooks:_hooked,lines:_cartInfo().length};};
})();
// ─── FIN AcimCaisse ───











})()
