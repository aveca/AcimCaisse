// ─── AcimCaisse v28 — _myCart Only, scanner auto-focus, panier unique ──────────
// Injecté DANS l'IIFE dartProgram (A, J, $, t, B accessibles)
// _myCart = seule source de vérité, AUCUN sync Dart
;(function(){
  "use strict";
  var _log=function(m){console.log("[Acim] "+m);};
  var _err=function(m,e){console.error("[Acim] "+m,e);};

  // Auto-barcode
  var _bcSeq=1000;
  function _nextBarcode(){return "ACIM-"+(_bcSeq++);}

  // Responsive
  var _mob=window.innerWidth<600;
  function _isMob(){return window.innerWidth<600;}
  window.addEventListener("resize",function(){
    var wasMob=_mob;_mob=_isMob();
    if(wasMob!==_mob){if(_overlay){_overlay.remove();_overlay=null;_linesEls=[];}_createOverlay();}
  });

  // Catégories
  var CATS=[
    {id:"viande",ic:"🥩",kw:["viande","poulet","steak","merguez","saucisse","escalope","haché","agneau","veau","charcuterie","côte"]},
    {id:"laitier",ic:"🧀",kw:["lait","fromage","yaourt","beurre","crème","labné","camembert","emmental","mozzarella"]},
    {id:"épicerie",ic:"🏪",kw:["riz","pâtes","sauce","huile","conserves","thon","haricots","maïs","tomate","olive","miel","couscous"]},
    {id:"boulangerie",ic:"🍞",kw:["pain","baguette","pita","matza","challah","brioche","biscotte"]},
    {id:"boisson",ic:"🥤",kw:["jus","eau","soda","limonade","thé","café","sirop"]},
    {id:"surgelé",ic:"🧊",kw:["surgelé","pizza","beignet","nugget","frite","glace"]},
    {id:"snack",ic:"🍪",kw:["biscuit","chips","chocolat","bonbon","barre","pretzel"]},
    {id:"condiment",ic:"🧂",kw:["sel","poivre","épice","moutarde","ketchup","mayo","vinaigre"]},
    {id:"ménager",ic:"🧴",kw:["savon","lessive","nettoyant","papier","sac"]},
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

  // Catalogue IndexedDB
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

  // Open Food Facts
  var _OFF="https://world.openfoodfacts.org/api/v0/product/";
  function _lookupOFF(bc){return fetch(_OFF+bc+".json").then(function(r){return r.json();})
    .then(function(d){if(d.status===1&&d.product){var p=d.product;
      return{barcode:bc,name:p.product_name_fr||p.product_name||"",category:_guessCat((p.product_name||"")+" "+(p.categories||"")),sale_price_cents:0};}
      return null;}).catch(function(){return null;});}

  // ═══════════════════════════════════════════════════════
  //  _myCart — SOURCE DE VÉRITÉ (pas Dart)
  // ═══════════════════════════════════════════════════════
  var _myCart=[]; // [{myId,name,priceCents,bc,cat}]
  var _realBcMap={};

  function _addToCart(name,priceCents,barcode,categoryId){
    if(!name){_toast("❌ Nom manquant");return false;}
    var myId="M"+Date.now()+Math.floor(Math.random()*9999);
    _myCart.push({myId:myId,name:name,priceCents:priceCents||0,bc:barcode||"",cat:categoryId||"autre"});
    _realBcMap[myId]=barcode||"";
    _dbPut({barcode:barcode||myId,name:name,sale_price_cents:priceCents||0,category:categoryId||"autre",source:"add",last_updated:Date.now()});
    _pollCart();_broadcastCart();return true;}

  function _cartInfo(){
    var info=[];
    for(var i=0;i<_myCart.length;i++){var e=_myCart[i];
      info.push({idx:i,myId:e.myId,name:e.name,price:e.priceCents,bc:_realBcMap[e.myId]||e.bc,cat:e.cat});
    }return info;}

  // BroadcastChannel (écran client)
  var _custBc=null;
  try{_custBc=new BroadcastChannel("acim-customer-display");}catch(e){}

  function _broadcastCart(){
    if(!_custBc)return;var info=_cartInfo();var total=0;
    for(var i=0;i<info.length;i++)total+=info[i].price;
    _custBc.postMessage({type:"cart-update",lines:info,total:total});}

  function _broadcastClear(){
    if(!_custBc)return;
    _custBc.postMessage({type:"cart-clear"});}

  // ═══════════════════════════════════════════════════════
  //  OVERLAY TICKET
  // ═══════════════════════════════════════════════════════
  var _overlay=null,_linesEls=[],_pollTimer=null;
  function _getLH(){return _mob?28:26;}

  function _createOverlay(){
    if(_overlay)return;
    var ov=document.createElement("div");ov.id="acim-ticket-overlay";
    if(_mob){
      ov.style.cssText="position:fixed;bottom:0;left:0;right:0;max-height:160px;z-index:1000000;pointer-events:none;background:transparent;overflow-y:auto;overflow-x:hidden;";
    }else{
      ov.style.cssText="position:fixed;top:8px;right:8px;width:280px;max-height:50vh;z-index:1000000;pointer-events:none;background:transparent;overflow-y:auto;overflow-x:hidden;border-radius:10px;font-family:Segoe UI,Arial,sans-serif;";
    }
    ov.setAttribute("role","list");ov.setAttribute("aria-label","Ticket");
    document.body.appendChild(ov);_overlay=ov;_pollCart();}

  function _pollCart(){
    if(!_overlay)return;
    if(_dialogOpen()){clearTimeout(_pollTimer);_pollTimer=setTimeout(_pollCart,500);return;}
    var info=_cartInfo();
    // Show/hide background
    var bg=info.length>0?"rgba(255,255,255,0.92)":"transparent";
    var border=info.length>0?(_mob?"2px solid #e65100":"2px solid #e65100"):"none";
    if(!_mob){_overlay.style.background=bg;_overlay.style.borderLeft=border;}
    else{_overlay.style.background=bg;_overlay.style.borderTop=border;}

    _overlay.innerHTML="";_linesEls=[];var lh=_getLH();
    for(var i=0;i<info.length;i++){
      var ln=document.createElement("div");
      var isZero=info[i].price===0;
      var borderStyle=isZero?"border-left:3px solid #e65100;":"border-left:3px solid transparent;";
      if(_mob){
        ln.style.cssText="position:relative;display:inline-flex;align-items:center;height:"+lh+"px;padding:2px 6px;margin:1px;cursor:pointer;pointer-events:auto;"+borderStyle+"border-radius:4px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#333;background:rgba(255,255,255,0.95);";
        var ns=document.createElement("span");ns.style.cssText="font-size:13px;overflow:hidden;text-overflow:ellipsis;max-width:120px;";
        ns.textContent=(isZero?"✏️ ":"")+info[i].name;ln.appendChild(ns);
        if(info[i].price>0){var ps=document.createElement("span");ps.style.cssText="font-size:13px;font-weight:700;color:#e65100;margin-left:4px;";ps.textContent=(info[i].price/100).toFixed(2)+"€";ln.appendChild(ps);}
      }else{
        ln.style.cssText="position:relative;height:"+lh+"px;padding:2px 8px;cursor:pointer;pointer-events:auto;"+borderStyle+"font-size:11px;display:flex;align-items:center;justify-content:space-between;color:#333;background:transparent;";
        var ns=document.createElement("span");ns.style.cssText="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;";
        ns.textContent=(isZero?"✏️ ":"")+info[i].name;ln.appendChild(ns);
        if(info[i].price>0){var ps=document.createElement("span");ps.style.cssText="font-size:12px;font-weight:700;color:#e65100;margin-left:4px;";ps.textContent=(info[i].price/100).toFixed(2)+"€";ln.appendChild(ps);}
        else{var ps=document.createElement("span");ps.style.cssText="font-size:11px;color:#e65100;margin-left:4px;";ps.textContent="✏️";ln.appendChild(ps);}
        // ⟳ dupliquer
        var dup=document.createElement("span");dup.textContent="⟳";dup.title="Ajouter encore";
        dup.style.cssText="font-size:12px;cursor:pointer;margin-left:4px;color:#1a1a2e;opacity:0.4;";
        dup.onmouseenter=function(){this.style.opacity="1";};
        dup.onmouseleave=function(){this.style.opacity="0.4";};
        ln.appendChild(dup);
      }
      ln.onmouseenter=function(){this.style.background=_mob?"rgba(230,81,0,0.08)":"rgba(230,81,0,0.06)";this.style.borderRadius="4px";};
      ln.onmouseleave=function(){this.style.background=_mob?"#fff":"transparent";this.style.borderRadius="0";};
      (function(idx,item){
        ln.addEventListener("click",function(e){
          if(e.target.textContent==="⟳"){e.stopPropagation();_addToCart(item.name,item.price,item.bc,item.cat);_toast("✅ "+item.name+" ajouté");return;}
          e.stopPropagation();_inlineEdit(idx,e.clientX,e.clientY);
        });
      })(i,info[i]);
      _overlay.appendChild(ln);_linesEls.push(ln);
    }
    // Desktop: inner panel
    if(!_mob&&info.length>0){
      var inner=document.createElement("div");
      inner.style.cssText="pointer-events:auto;background:rgba(255,255,255,0.95);border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.15);border:1px solid #e0e0e0;overflow:hidden;";
      var hd=document.createElement("div");hd.style.cssText="padding:6px 10px;background:#1a1a2e;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;";
      hd.innerHTML='<span>🛒 Ticket</span><span>'+info.length+' lignes</span>';inner.appendChild(hd);
      var lb=document.createElement("div");lb.style.cssText="max-height:40vh;overflow-y:auto;";
      for(var di=0;di<_linesEls.length;di++){lb.appendChild(_linesEls[di]);}
      inner.appendChild(lb);
      var total=0;for(var ti=0;ti<info.length;ti++)total+=info[ti].price;
      var foot=document.createElement("div");foot.style.cssText="padding:6px 10px;display:flex;align-items:center;justify-content:space-between;background:#fff3e0;border-top:1px solid #e0e0e0;";
      foot.innerHTML='<span style="font-weight:700;font-size:14px;color:#1a1a2e;">Total: '+((total/100).toFixed(2))+'€</span>';
      var pay=document.createElement("button");pay.textContent="💰 Encaisser";
      pay.style.cssText="padding:4px 10px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:13px;cursor:pointer;font-weight:700;";
      pay.onclick=function(){_checkout();};foot.appendChild(pay);inner.appendChild(foot);
      _overlay.innerHTML="";_overlay.appendChild(inner);
    }
    if(!_mob&&info.length===0){_overlay.innerHTML="";}
    if(_mob&&info.length===0){var em=document.createElement("div");em.style.cssText="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:14px;";em.textContent="🛒 Scanner un produit…";_overlay.appendChild(em);}
    clearTimeout(_pollTimer);_pollTimer=setTimeout(_pollCart,2000);
  }

  // ═══════════════════════════════════════════════════════
  //  SCANNER AUTO + CHAMP BARCODE (auto-focus permanent)
  // ═══════════════════════════════════════════════════════
  var _bcInput=null,_autoFocusTimer=null;
  function _createBarcodeInput(){
    if(_bcInput)return;
    _bcInput=document.createElement("input");_bcInput.id="acim-bc-input";
    _bcInput.type="text";_bcInput.placeholder="🔍 Scanner ou taper code...";
    _bcInput.style.cssText="position:fixed;top:8px;left:8px;width:260px;padding:10px 14px;border:3px solid #e65100;border-radius:12px;font-size:16px;font-weight:700;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;outline:none;background:#fff;box-shadow:0 4px 20px rgba(230,81,0,0.4);animation:acimPulse 2s ease-in-out infinite;";
    // Pulsing animation stylesheet
    var pulseStyle=document.createElement("style");pulseStyle.id="acim-pulse-style";
    pulseStyle.textContent="@keyframes acimPulse{0%,100%{box-shadow:0 4px 20px rgba(230,81,0,0.4);}50%{box-shadow:0 4px 28px rgba(230,81,0,0.7);border-color:#ff6d00;}}";
    document.head.appendChild(pulseStyle);
    _bcInput.addEventListener("keydown",function(e){
      if(e.key==="Enter"){var bc=this.value.trim();this.value="";if(bc.length>=4)_processBarcode(bc);else _toast("❌ Code trop court");}
      if(e.key==="Escape"){this.value="";this.blur();}
    });
    // Auto-focus permanent: reprend le focus après blur (si pas de dialog)
    _bcInput.addEventListener("blur",function(){
      clearTimeout(_autoFocusTimer);
      _autoFocusTimer=setTimeout(function(){
        if(!_dialogOpen()&&_bcInput&&!_bcInput.value)_bcInput.focus();
      },300);
    });
    document.body.appendChild(_bcInput);
    // Focus immédiat
    setTimeout(function(){if(_bcInput)_bcInput.focus();},100);
  }

  // Auto-focus périodique (catch-all: si Flutter steal le focus)
  function _keepBarcodeFocused(){
    if(!_bcInput)return;
    if(!_dialogOpen()&&!_bcInput.value&&document.activeElement!==_bcInput){
      try{_bcInput.focus();}catch(e){}
    }
  }
  setInterval(_keepBarcodeFocused,3000);

  // Scanner buffer: capture digits EVEN IF Flutter intercepts focus
  var _scanBuf="",_scanTimer=null,_scanActive=false;
  document.addEventListener("keydown",function(e){
    if(_dialogOpen())return;
    // Digit → auto-focus + buffer (même si Flutter a le focus)
    if(/^[0-9]$/.test(e.key)){
      if(_bcInput&&document.activeElement!==_bcInput){
        _bcInput.focus();
        // Ajouter le digit au champ si Flutter ne l'a pas déjà mis
        if(!_bcInput.value.endsWith(e.key))_bcInput.value+=e.key;
        e.preventDefault();e.stopPropagation();
      }
      _scanBuf+=e.key;_scanActive=true;
      clearTimeout(_scanTimer);_scanTimer=setTimeout(function(){
        // Si le champ a du contenu, utiliser ça (priorité au champ visible)
        var bc=_bcInput?_bcInput.value.trim():_scanBuf;
        if(_bcInput)_bcInput.value="";
        if(bc.length>=4)_processBarcode(bc);
        _scanBuf="";_scanActive=false;
      },120);
    }
  },true);

  function _processBarcode(bc){
    _log("Scanner: "+bc);
    _dbGet(bc).then(function(local){
      if(local&&local.sale_price_cents>0){
        _addToCart(local.name,local.sale_price_cents,bc,local.category);
        _toast("✅ "+local.name+" "+(local.sale_price_cents/100).toFixed(2)+"€");return;
      }
      if(local&&local.name){
        _addToCart(local.name,0,bc,local.category);
        _toast("✏️ "+local.name+" — cliquez pour prix");return;
      }
      _lookupOFF(bc).then(function(off){
        if(off&&off.name){
          _dbPut({barcode:bc,name:off.name,sale_price_cents:0,category:off.category,source:"openfoodfacts",last_updated:Date.now()});
          _addToCart(off.name,0,bc,off.category);
          _toast("🔍 "+off.name+" — cliquez pour prix");
        }else{
          _addToCart("Produit "+bc,0,bc,"autre");
          _dbPut({barcode:bc,name:"Produit "+bc,sale_price_cents:0,category:"autre",source:"scan-unknown",last_updated:Date.now()});
          _toast("❓ "+bc+" — cliquez pour modifier");
        }
      });
    });}

  // ═══════════════════════════════════════════════════════
  //  ÉDITION INLINE — carte flottante
  // ═══════════════════════════════════════════════════════
  function _inlineEdit(idx,clickX,clickY){
    var info=_cartInfo();
    if(idx<0||idx>=info.length)return;
    var item=info[idx];
    var existing=document.getElementById("acim-inline-edit");if(existing)existing.remove();
    var card=document.createElement("div");card.id="acim-inline-edit";
    if(_mob){
      card.style.cssText="position:fixed;left:0;right:0;bottom:0;width:100%;max-height:70vh;background:#fff;border-radius:14px 14px 0 0;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.25);z-index:10000001;font-family:Segoe UI,Arial,sans-serif;overflow-y:auto;";
    }else{
      var left=Math.min(Math.max(clickX-20,10),window.innerWidth-300);
      var top=Math.min(clickY-20,10);
      card.style.cssText="position:fixed;left:"+left+"px;top:"+top+"px;width:280px;background:#fff;border-radius:12px;padding:14px;box-shadow:0 6px 20px rgba(0,0,0,0.25);z-index:10000001;font-family:Segoe UI,Arial,sans-serif;";
    }
    // Titre
    var ti=document.createElement("div");ti.style.cssText="font-size:13px;font-weight:700;margin-bottom:8px;color:#1a1a2e;display:flex;align-items:center;gap:4px;";
    ti.textContent=_catIcon(item.cat||"autre")+" Modifier";card.appendChild(ti);
    // Nom
    var ni=document.createElement("input");ni.type="text";ni.value=item.name||"";ni.placeholder="Nom";
    ni.style.cssText="width:100%;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;box-sizing:border-box;margin-bottom:6px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";this.select();};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);
    // Prix
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=item.price>0?(item.price/100).toFixed(2):"";pi.placeholder="Prix";
    pi.style.cssText="flex:1;font-size:16px;font-weight:700;padding:8px 12px;border:2px solid #e0e0e0;border-radius:8px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";this.select();};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:16px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);
    // Poids
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:6px;";
    var exPoids="",exUnit="kg";
    var pm=item.name&&item.name.match(/ (\d+[.,]?\d*)\s*(kg|g|L|pc|pièce)/);
    if(pm){exPoids=pm[1].replace(",",".");exUnit=pm[2]==='pièce'?'pc':pm[2];}
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";
    poidsIn.value=exPoids;poidsIn.placeholder="Poids";
    poidsIn.style.cssText="flex:1;font-size:12px;padding:6px 10px;border:2px solid #e0e0e0;border-radius:6px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");unitSel.style.cssText="font-size:12px;padding:4px;border:2px solid #e0e0e0;border-radius:6px;outline:none;background:#fff;";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){
      var o=document.createElement("option");o.value=u[0];o.textContent=u[1];
      if(u[0]===exUnit)o.selected=true;unitSel.appendChild(o);});
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);
    // Catégories
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;";
    var selCat=item.cat||_guessCat(item.name||"");
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:4px 6px;border:2px solid #e0e0e0;border-radius:6px;background:#fff;font-size:14px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);
    // Barcode tag
    if(item.bc){var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:11px;color:#888;";
      bcRow.textContent="📊 "+item.bc;card.appendChild(bcRow);}
    // Boutons
    var br=document.createElement("div");br.style.cssText="display:flex;gap:6px;";
    var bDel=document.createElement("button");bDel.textContent="🗑️";bDel.title="Supprimer";
    bDel.style.cssText="padding:6px 8px;border:1px solid #ffcdd2;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;color:#c62828;";
    bDel.onclick=function(){card.remove();_myCart.splice(idx,1);_toast("Supprimé");_pollCart();_broadcastCart();};
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
      card.remove(); // fermer AVANT pollCart
      _myCart[idx].name=nn;_myCart[idx].priceCents=pc;_myCart[idx].cat=selCat;
      _dbPut({barcode:_myCart[idx].bc||_myCart[idx].myId,name:nn,sale_price_cents:pc,category:selCat,source:"edit",last_updated:Date.now()});
      _toast("✅ "+nn+(pc>0?" "+(pc/100).toFixed(2)+"€":""));
      _pollCart();_broadcastCart();
    };
    br.appendChild(bDel);br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    document.body.appendChild(card);
  }

  // ═══════════════════════════════════════════════════════
  //  CRÉATION RAPIDE ➕
  // ═══════════════════════════════════════════════════════
  function _quickCreate(name,priceCents,barcode,category){
    if(_dialogOpen())return;
    var ov=document.createElement("div");ov.id="acim-quick";
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:10000001;display:flex;align-items:"+(_mob?"flex-end":"center")+";justify-content:center;";
    var card=document.createElement("div");var cardW=_mob?"95vw":"320px";
    card.style.cssText="background:#fff;border-radius:"+(_mob?"14px 14px 0 0":"14px")+";padding:"+(_mob?"16px":"20px")+";width:"+cardW+";max-width:95vw;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-family:Segoe UI,Arial,sans-serif;";
    var ti=document.createElement("div");ti.style.cssText="font-size:16px;font-weight:700;margin-bottom:12px;color:#1a1a2e;";
    ti.textContent="⚡ Nouveau produit";card.appendChild(ti);
    // Nom
    var ni=document.createElement("input");ni.type="text";ni.value=name||"";ni.placeholder="Nom du produit";
    ni.style.cssText="width:100%;font-size:15px;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;box-sizing:border-box;margin-bottom:8px;";
    ni.onfocus=function(){this.style.borderColor="#e65100";};ni.onblur=function(){this.style.borderColor="#e0e0e0";};card.appendChild(ni);
    // Prix
    var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var pi=document.createElement("input");pi.type="number";pi.step="0.01";pi.min="0";
    pi.value=priceCents?(priceCents/100).toFixed(2):"";pi.placeholder="Prix total";
    pi.style.cssText="flex:1;font-size:18px;font-weight:700;padding:10px 14px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    pi.onfocus=function(){this.style.borderColor="#e65100";};pi.onblur=function(){this.style.borderColor="#e0e0e0";};
    var eu=document.createElement("span");eu.style.cssText="font-size:18px;font-weight:700;color:#e65100;";eu.textContent="€";
    row.appendChild(pi);row.appendChild(eu);card.appendChild(row);
    // Poids
    var poidsRow=document.createElement("div");poidsRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:8px;";
    var poidsIn=document.createElement("input");poidsIn.type="number";poidsIn.step="0.001";poidsIn.min="0";poidsIn.placeholder="Poids (optionnel)";
    poidsIn.style.cssText="flex:1;font-size:14px;padding:8px 12px;border:2px solid #e0e0e0;border-radius:10px;outline:none;";
    poidsIn.onfocus=function(){this.style.borderColor="#e65100";};poidsIn.onblur=function(){this.style.borderColor="#e0e0e0";};
    var unitSel=document.createElement("select");unitSel.style.cssText="font-size:14px;padding:8px;border:2px solid #e0e0e0;border-radius:10px;outline:none;background:#fff;";
    [["kg","kg"],["g","g"],["L","L"],["pc","pièce"]].forEach(function(u){var o=document.createElement("option");o.value=u[0];o.textContent=u[1];unitSel.appendChild(o);});
    poidsRow.appendChild(poidsIn);poidsRow.appendChild(unitSel);card.appendChild(poidsRow);
    // Auto barcode
    var autoBc=barcode||_nextBarcode();
    var bcRow=document.createElement("div");bcRow.style.cssText="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 10px;background:#f5f5f5;border-radius:8px;";
    bcRow.textContent="📊 Code: "+autoBc;card.appendChild(bcRow);
    // Catégories
    var cr=document.createElement("div");cr.style.cssText="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;";
    var selCat=category||_guessCat(name||"");
    for(var ci=0;ci<CATS.length;ci++){(function(cat){
      var b=document.createElement("button");b.textContent=cat.ic;b.title=cat.id;
      b.style.cssText="padding:6px 8px;border:2px solid #e0e0e0;border-radius:8px;background:#fff;font-size:16px;cursor:pointer;"+(cat.id===selCat?"border-color:#e65100;background:#fff3e0;":"");
      b.onclick=function(){cr.querySelectorAll("button").forEach(function(x){x.style.borderColor="#e0e0e0";x.style.background="#fff";});this.style.borderColor="#e65100";this.style.background="#fff3e0";selCat=cat.id;};
      cr.appendChild(b);
    })(CATS[ci]);}card.appendChild(cr);
    // Boutons
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
      ov.remove(); // fermer AVANT addToCart
      _addToCart(nn,pc,autoBc,selCat);
      _dbPut({barcode:autoBc,name:nn,sale_price_cents:pc,category:selCat,source:"manual",last_updated:Date.now()});
      _toastWithPrint(nn,pc,autoBc);
    };
    br.appendChild(bCancel);br.appendChild(bOk);card.appendChild(br);
    ov.appendChild(card);
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    document.body.appendChild(ov);
  }

  // ═══════════════════════════════════════════════════════
  //  ENCAISSER
  // ═══════════════════════════════════════════════════════
  function _checkout(){
    if(_myCart.length===0){_toast("⚠ Panier vide");return;}
    var total=0;for(var i=0;i<_myCart.length;i++)total+=_myCart[i].priceCents;
    _broadcastClear();_myCart=[];_realBcMap={};_pollCart();
    _toast("✅ Encaissé ! "+(total/100).toFixed(2)+"€");}

  // ═══════════════════════════════════════════════════════
  //  DIVERS
  // ═══════════════════════════════════════════════════════
  var _scannerActive=false;
  function _dialogOpen(){return !!document.getElementById("acim-inline-edit")||!!document.getElementById("acim-quick")||!!document.getElementById("acim-scanner");}

  function _toast(msg){
    if(!msg)return;var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";t.textContent=msg;
    t.style.cssText="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},2500);}

  function _toastWithPrint(name,priceCents,barcode){
    var old=document.getElementById("acim-toast");if(old)old.remove();
    var t=document.createElement("div");t.id="acim-toast";
    t.style.cssText="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:90vw;text-align:center;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;";
    var msg=document.createElement("span");
    msg.textContent="✅ "+name+(priceCents>0?" "+(priceCents/100).toFixed(2)+"€":" — ✏️ prix à compléter");
    t.appendChild(msg);
    if(barcode){var pr=document.createElement("button");pr.textContent="🖨️ Imprimer";
      pr.style.cssText="padding:6px 12px;border:none;border-radius:6px;background:#e65100;color:#fff;font-size:12px;cursor:pointer;font-weight:700;";
      pr.onclick=function(){t.remove();_openBarcodePage(name,barcode);};t.appendChild(pr);}
    document.body.appendChild(t);
    setTimeout(function(){t.style.transition="opacity 0.3s";t.style.opacity="0";setTimeout(function(){t.remove();},300);},4000);}

  function _openBarcodePage(name,code){
    var basePath=window.location.pathname.replace(/[^/]*$/,"");
    var url=basePath+"barcode.html";
    if(name||code){var params=[];
      if(name)params.push("nom="+encodeURIComponent(name));
      if(code)params.push("code="+encodeURIComponent(code));
      url+="?"+params.join("&");}
    window.open(url,"_blank");}

  // Ctrl+N = ajout rapide
  document.addEventListener("keydown",function(e){
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="n"){e.preventDefault();_quickCreate("",0);}
    if(e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.key==="b"){e.preventDefault();_openBarcodePage();}
    if(e.key==="F2"){e.preventDefault();var info=_cartInfo();if(info.length&&!_dialogOpen())_inlineEdit(0,window.innerWidth*0.75,20+_getLH()/2);}
  });

  // Camera désactivation
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    var _origGetUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=function(c){if(_scannerActive)return _origGetUserMedia(c);return Promise.reject(new DOMException("Camera managed by AcimCaisse","NotAllowedError"));};
  }

  // ═══════════════════════════════════════════════════════
  //  BOUTONS FLOTTANTS
  // ═══════════════════════════════════════════════════════
  function _createFloatingButtons(){
    var bcBtn=document.createElement("div");bcBtn.id="acim-barcode-btn";
    bcBtn.style.cssText="position:fixed;bottom:20px;left:20px;width:48px;height:48px;background:#1a1a2e;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;z-index:99999998;box-shadow:0 4px 16px rgba(0,0,0,0.3);pointer-events:auto;";
    bcBtn.textContent="📊";bcBtn.title="Codes-barres (Ctrl+B)";
    bcBtn.onclick=function(){_openBarcodePage();};document.body.appendChild(bcBtn);
    var addBtn=document.createElement("div");addBtn.id="acim-add-btn";
    addBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:56px;height:56px;background:#e65100;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;z-index:99999998;box-shadow:0 4px 16px rgba(230,81,0,0.4);pointer-events:auto;";
    addBtn.textContent="➕";addBtn.title="Ajouter produit (Ctrl+N)";
    addBtn.onclick=function(){_quickCreate("",0);};document.body.appendChild(addBtn);
  }

  function _createScanButton(){}

  // ═══════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════
  function init(){
    _log("v28 — barcode auto-focus permanent, panier unique, scanner 120ms, _myCart only");
    _createOverlay();_createFloatingButtons();_createBarcodeInput();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();

  window._acimGetCartInfo=_cartInfo;
  window._acimDebug=function(){return{cart:_myCart.length};};
})();
// ─── FIN AcimCaisse ───


})()
