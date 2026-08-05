// ─── AcimCaisse Sprint 3 — Big-screen price flash + Voice assistant ──
// Loaded after acim-caisse.js. Listens to acim:add / acim:scan CustomEvents
// and to BroadcastChannel("acim-customer-display"). Zero coupling.
;(function(){
  "use strict";
  if(window.__acimS3)return; window.__acimS3=true;

  // ── Settings (persisted in localStorage, toggle via floating mic button) ──
  var S={voiceOn:false,flashOn:true,announce:"addition"};
  try{var s=localStorage.getItem("acim-s3");if(s)S=Object.assign(S,JSON.parse(s));}catch(e){}
  function saveS(){try{localStorage.setItem("acim-s3",JSON.stringify(S));}catch(e){}}

  // ── Helpers ──
  function fmtEuros(c){return((c||0)/100).toFixed(2).replace(".",",");}
  function fmtName(n){return String(n||"");}

  // ── BIG PRICE FLASH OVERLAY ──
  var flashEl=null,flashTimer=null,flashAudio=null;
  function showFlash(opts){
    if(!S.flashOn)return;
    if(flashEl)flashEl.remove();
    if(flashTimer)clearTimeout(flashTimer);
    var ov=document.createElement("div");
    ov.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:10000006;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif;animation:acimFlashIn .18s ease-out;pointer-events:none;";
    var name=document.createElement("div");
    name.style.cssText="color:#fff;font-size:32px;font-weight:700;margin-bottom:14px;text-shadow:0 2px 8px rgba(0,0,0,0.7);max-width:80vw;text-align:center;";
    name.textContent=opts.name||" Produit";
    ov.appendChild(name);
    var big=document.createElement("div");
    var bgColor=opts.error?"#c62828":(opts.subtitle?"#1976d2":"#e65100");
    big.style.cssText="font-size:160px;font-weight:900;color:#fff;background:"+bgColor+";padding:24px 60px;border-radius:24px;box-shadow:0 12px 40px "+bgColor+"AA;text-shadow:0 4px 12px rgba(0,0,0,0.5);line-height:1;";
    big.textContent=fmtEuros(opts.priceCents||0)+" €";
    ov.appendChild(big);
    if(opts.subtitle){
      var sub=document.createElement("div");
      sub.style.cssText="color:#fff;font-size:28px;margin-top:14px;opacity:0.85;";
      sub.textContent=opts.subtitle;
      ov.appendChild(sub);
    }
    if(opts.warn){
      var warn=document.createElement("div");
      warn.style.cssText="color:#ffcdd2;font-size:20px;margin-top:10px;opacity:0.9;";
      warn.textContent=opts.warn;
      ov.appendChild(warn);
    }
    // Inject animation CSS once
    if(!document.getElementById("acim-s3-style")){
      var st=document.createElement("style");
      st.id="acim-s3-style";
      st.textContent="@keyframes acimFlashIn{from{opacity:0;transform:scale(0.86)}to{opacity:1;transform:scale(1)}}@keyframes acimFlashOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.92)}}.acim-flash-out{animation:acimFlashOut .25s ease-in forwards;}";
      document.head.appendChild(st);
    }
    document.body.appendChild(ov);
    flashEl=ov;
    flashTimer=setTimeout(function(){
      ov.classList.add("acim-flash-out");
      setTimeout(function(){if(ov.parentNode)ov.remove();flashEl=null;},260);
    },opts.duration||1500);
  }

  // ── Voice: speech synthesis ──
  var _lastSpoke=0;
  function speak(text){
    if(!S.voiceOn)return;
    if(!window.speechSynthesis)return;
    var now=Date.now();
    if(now-_lastSpoke<300)return; // throttle
    _lastSpoke=now;
    try{
      window.speechSynthesis.cancel();
      var u=new SpeechSynthesisUtterance(text);
      u.lang="fr-FR";
      u.rate=1.05;
      u.pitch=1.0;
      u.volume=1.0;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  // ── Build announcement text from acim:add detail ──
  function announceAdd(detail){
    var name=fmtName(detail.name);
    var priceCents=detail.price||0;
    var weight=detail.weight,unitType=detail.unitType,pricePerUnit=detail.pricePerUnit;
    if(weight!=null&&unitType&&pricePerUnit!=null){
      var wStr=(unitType==="kg")?(weight.toFixed(3).replace(".",",")+" kg"):(weight+" "+unitType);
      var ppuEur=fmtEuros(pricePerUnit);
      var totalEur=fmtEuros(priceCents);
      return name+", "+wStr+" à "+ppuEur+" euros par "+unitType+", total "+totalEur+" euros";
    }
    return name+", "+fmtEuros(priceCents)+" euros";
  }

  // ── Listen to acim:add (fires after _addToCart) ──
  document.addEventListener("acim:add",function(e){
    var d=e.detail||{};
    var flashOpts={name:d.name,priceCents:d.price||0};
    if(d.weight!=null&&d.unitType&&d.pricePerUnit!=null){
      var wStr=(d.unitType==="kg")?(d.weight.toFixed(3).replace(".",",")+" kg"):(d.weight+" "+d.unitType);
      flashOpts.subtitle=_formatWLocal(d.weight,d.unitType)+" × "+_formatPPULocal(d.pricePerUnit,d.unitType);
      flashOpts.priceCents=d.price;
      flashOpts.warn="Total "+fmtEuros(d.price)+" €";
    }
    if((d.price||0)===0){
      flashOpts.error=true;
      flashOpts.warn="Prix non défini — à saisir";
    }
    showFlash(flashOpts);
    speak(announceAdd(d));
  });

  function _formatWLocal(w,u){
    if(w==null||!u)return"";
    if(u==="kg")return w.toFixed(3)+" kg";
    if(u==="g")return w.toFixed(0)+" g";
    if(u==="L")return w.toFixed(2)+" L";
    if(u==="pc")return w.toFixed(0)+" pc";
    return w+" "+u;
  }
  function _formatPPULocal(ppu,u){
    if(!ppu||!u)return"";
    return(ppu/100).toFixed(2)+"€/"+u;
  }

  // ── Listen to acim:scan (fires at scan time, before product resolution) ──
  document.addEventListener("acim:scan",function(e){
    // No price here yet — small "scan" tick sound + neutral flash
    // (kept minimal; acim:add will show the real price)
  });

  // ── SpeechRecognition (vox) — "ajoute 2 kg poulet", "scan 30123" ──
  var recog=null,recogActive=false;
  function initRecog(){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return false;
    recog=new SR();
    recog.lang="fr-FR";
    recog.continuous=true;
    recog.interimResults=false;
    recog.onresult=function(event){
      for(var i=event.resultIndex;i<event.results.length;i++){
        if(!event.results[i].isFinal)continue;
        var phrase=event.results[i][0].transcript.trim().toLowerCase();
        handleVoiceCommand(phrase);
      }
    };
    recog.onend=function(){recogActive=false;updateMicBtn();};
    recog.onerror=function(){recogActive=false;updateMicBtn();};
    return true;
  }
  function handleVoiceCommand(phrase){
    _logVox("VOIX: "+phrase);
    // "ajoute <qty> kg <product>" — best-effort parse, validated before commit
    // Patterns:
    //   "ajoute 2 kilos de poulet"        → qty=2, unit=kg, product=poulet
    //   "ajoute 3 tomates"                 → qty=3, unit=unit, product=tomates
    //   "annule" / "annule dernier"
    //   "total"                            → announce current total
    //   "scan 301234"                      → processBarcode("301234")
    if(/^(annule|annuler)/.test(phrase)){
      // Confirm before deleting last cart row
      if(_myCart&&_myCart.length>0){
        confirmVoice("Annuler le dernier article ?",function(){
          _myCart.pop();_renderPOS();
          speak("Article annulé");
        });
      }else speak("Le panier est vide");
      return;
    }
    if(/^total/.test(phrase)){
      var t=_cartTotal?_cartTotal():0;
      speak("Total du panier: "+fmtEuros(t)+" euros");
      return;
    }
    var scanMatch=phrase.match(/^scan\s+(\d{4,})/);
    if(scanMatch&&window._acimProcessBarcode){
      var bc=scanMatch[1];
      confirmVoice("Scanner le code "+bc+" ?",function(){
        window._acimProcessBarcode(bc);
      });
      return;
    }
    // Add by name (best-effort): "ajoute 2 kg poulet" / "ajoute poulet"
    var m=phrase.match(/^ajoute\s+(?:(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|g|litre|litres|l|pcs|pieces?)\s+(?:de\s+)?)?([^]+)/i);
    if(m&&window._acimAddToCartByVoice){
      var qty=m[1]?parseFloat(m[1].replace(",",".")):null;
      var unitRaw=(m[2]||"").toLowerCase();
      var unit=null;
      if(/^(kg|kilo|kilos)$/.test(unitRaw))unit="kg";
      else if(/^g$/.test(unitRaw))unit="g";
      else if(/^(l|litre|litres)$/.test(unitRaw))unit="L";
      else if(/^(pcs|pieces?|p)$/.test(unitRaw))unit="pc";
      var prodName=m[3].trim();
      window._acimAddToCartByVoice(prodName,qty,unit);
      return;
    }
    speak("Je n'ai pas compris: "+phrase);
  }
  function confirmVoice(prompt, onYes){
    // Speak the prompt + flash a confirm UI (visible only when voice is on)
    speak(prompt);
    if(!window._acimGetCartInfo){onYes();return;} // sandbox
    var old=document.getElementById("acim-voice-confirm");if(old)old.remove();
    var ov=document.createElement("div");ov.id="acim-voice-confirm";
    ov.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:14px 22px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:10000007;font-family:Segoe UI;display:flex;gap:12px;align-items:center;";
    var t=document.createElement("div");t.style.cssText="font-size:15px;";t.textContent="🎤 "+prompt;
    ov.appendChild(t);
    var bYes=document.createElement("button");bYes.textContent="✓";bYes.style.cssText="padding:6px 12px;border:none;border-radius:6px;background:#4caf50;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bYes.onclick=function(){ov.remove();onYes();};
    var bNo=document.createElement("button");bNo.textContent="✕";bNo.style.cssText="padding:6px 12px;border:none;border-radius:6px;background:#c62828;color:#fff;font-size:16px;cursor:pointer;font-weight:700;";
    bNo.onclick=function(){ov.remove();speak("Action annulée");};
    ov.appendChild(bYes);ov.appendChild(bNo);
    document.body.appendChild(ov);
    setTimeout(function(){if(ov.parentNode)ov.remove();},8000);
  }
  function _logVox(m){try{console.log(m);}catch(e){}}

  // ── Floating mic button — toggles voice on/off ──
  var micBtn=null;
  function buildMicBtn(){
    if(micBtn)return;
    micBtn=document.createElement("button");
    micBtn.style.cssText="position:fixed;bottom:18px;left:18px;width:64px;height:64px;border:none;border-radius:50%;background:"+(S.voiceOn?"#4caf50":"#1a1a2e")+" color:#fff;font-size:30px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.4);z-index:10000008;transition:all .15s;";
    micBtn.textContent="🎤";
    micBtn.title="Activer la reconnaissance vocale";
    micBtn.onclick=function(){
      S.voiceOn=!S.voiceOn;
      if(S.voiceOn){
        if(!recog&&!initRecog()){_toastVox("Reconnaissance vocale non supportée par ce navigateur");S.voiceOn=false;updateMicBtn();return;}
        try{recog.start();recogActive=true;}catch(e){}
        speak("Assistant vocal activé. Dites par exemple: ajoute 2 kilos de poulet.");
      }else{
        if(recog)try{recog.stop();}catch(e){}
        if(window.speechSynthesis)window.speechSynthesis.cancel();
      }
      updateMicBtn();
      saveS();
    };
    document.body.appendChild(micBtn);
  }
  function updateMicBtn(){
    if(!micBtn)return;
    micBtn.style.background=S.voiceOn?"#4caf50":"#1a1a2e";
    micBtn.style.opacity=recogActive?"1":"0.6";
    micBtn.title=S.voiceOn?(recogActive?" Vocal actif — écoute":" Vocal en pause"):"Activer la reconnaissance vocale";
  }
  function _toastVox(m){
    var t=document.createElement("div");t.textContent=m;
    t.style.cssText="position:fixed;bottom:90px;left:18px;background:#c62828;color:#fff;padding:8px 12px;border-radius:6px;font-size:13px;z-index:10000009;font-family:Segoe UI;";
    document.body.appendChild(t);setTimeout(function(){t.remove();},3000);
  }

  // Lazy build the mic button + flash toggle once DOM is ready and POS init done.
  function ensure(){
    if(!document.body)return;
    if(!micBtn)buildMicBtn();
  }
  if(document.readyState==="complete"||document.readyState==="interactive")setTimeout(ensure,800);
  else document.addEventListener("DOMContentLoaded",function(){setTimeout(ensure,800);});
  // Also rebuild if POS re-inits
  setTimeout(ensure,2500);

  // ── BroadcastChannel piggyback (announces cart updates to other tabs) ──
  // (Optional — keeps a second screen / phone in sync; uses the same channel as customer-display)
  try{
    var bc=new BroadcastChannel("acim-customer-display");
    bc.onmessage=function(ev){
      // We don't speak on broadcast to avoid double-announce (since acim:add already fires locally)
      // Hook reserved for multi-poste announce + remote validation in Sprint 4.
    };
  }catch(e){}

  // ── Public hooks (used by handleVoiceCommand) ──
  // _acimAddToCartByVoice is supplied by acim-caisse.js (it knows products).
  // We expose a tiny stub here so the sandbox / tests can mock it.
  window._acimS3={showFlash:showFlash,speak:speak,handleVoiceCommand:handleVoiceCommand,confirmVoice:confirmVoice,toggleVoice:function(){micBtn&&micBtn.click();}};
})();
