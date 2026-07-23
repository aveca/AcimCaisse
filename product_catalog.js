// ─── AcimCaisse : Catalogue Cacher + Ajout Rapide (v2) ─────────────────
// Simplifié: nom + prix + catégorie = c'est tout
// Photo → OCR → suggestion nom/prix
// Catégories en 1 clic
;(function(){
  "use strict";

  var DB_NAME = "acim-catalog";
  var DB_VERSION = 1;
  var STORE = "products";
  var db = null;

  // ── Catégories casher (1 clic) ────────────────────
  var CATS = [
    { id: "viande",     icon: "🥩", label: "Viande",    kw: ["viande","beef","poulet","steak","merguez","saucisse","escalope","haché","agneau","veau","hot dog","charcuterie","pastrami","canard","côte","mince"] },
    { id: "laitier",    icon: "🧀", label: "Laitier",   kw: ["lait","fromage","yaourt","beurre","crème","labné","camembert","emmental","mozzarella","kiri","petit suisse"] },
    { id: "épicerie",   icon: "🏪", label: "Épicerie",  kw: ["riz","pâtes","sauce","huile","conserves","thon","haricots","maïs","tomate","olive","miel","confiture","couscous","lentille","chickpea"] },
    { id: "boulangerie",icon: "🍞", label: "Boulangerie",kw: ["pain","baguette","pita","matza","challah","brioche","biscotte","cake","muffin"] },
    { id: "boisson",    icon: "🥤", label: "Boisson",   kw: ["jus","eau","soda","limonade","thé","café","sirop","smoothie","nectar"] },
    { id: "surgelé",    icon: "🧊", label: "Surgelé",   kw: ["surgelé","frozen","pizza","beignet","nugget","frite","glace","sorbet"] },
    { id: "snack",      icon: "🍪", label: "Snack",     kw: ["biscuit","chips","chocolat","bonbon","barre","pretzel","popcorn","nougat"] },
    { id: "condiment",  icon: "🧂", label: "Condiment", kw: ["sel","poivre","épice","moutarde","ketchup","mayo","vinaigre","raifort","sauce soja"] },
    { id: "ménager",    icon: "🧴", label: "Ménager",   kw: ["savon","détergent","lessive","nettoyant","papier","essuie","aluminium","sac"] },
    { id: "vin",        icon: "🍷", label: "Vin",       kw: ["vin","wine","kiddouch","malbec","cabernet","merlot","chardonnay"] },
    { id: "pessah",     icon: "✡️", label: "Pessah",    kw: ["pessah","passover","matza","cacher le-pessah"] },
    { id: "autre",      icon: "📦", label: "Autre",     kw: [] }
  ];

  // ── Marques casher ────────────────────────────────
  var BRANDS = [
    "Yarden","Mehadrin","Kedem","Osem","Elite","Strauss","Tnuva","Tara",
    "Prigat","Jafora","Carmel","Schmerlings","Felder","Beigel","Barkat",
    "Manischewitz","Rokeach","Liebers","Klik","Danone","Nestle","Heinz"
  ];

  // ── Certifications ────────────────────────────────
  var CERTS = ["Beth Din de Paris","Consistoire","K Paris","Badatz","OU","OK","Star-K","Cacher Lmehadrin","Rabbinat"];

  var OFF_API = "https://world.openfoodfacts.org/api/v0/product/";
  var OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl";

  function _log(m) { console.log("[AcimCatalog] " + m); }
  function _err(m, e) { console.error("[AcimCatalog] " + m, e); }

  // ═══════════════════════════════════════════════════
  //  NORMALISATION NOM PRODUIT — partout, tout le temps
  // ═══════════════════════════════════════════════════

  function normalizeName(raw) {
    if (!raw || typeof raw !== "string") return "";
    var s = raw;

    // 1) Supprimer les caractères OCR parasites
    s = s.replace(/[|\\{}=<>^~`#§¤°±]/g, " ");

    // 2) Supprimer les poids/quantités : "4x125g", "6x150ml", "2 x 250 g", "0.800 kg"
    s = s.replace(/\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi, " ");
    s = s.replace(/\b\d+\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi, " ");

    // 3) Supprimer les unités isolées avec chiffre : "125g", "1L", "500ml", "250 ml"
    s = s.replace(/\b\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|cl|l|L)\b/gi, " ");

    // 4) Supprimer "x6", "x12", "×3" (colisage)
    s = s.replace(/[xX×]\s*\d+/g, " ");

    // 5) Supprimer les pourcentages : "15%", "5 %"
    s = s.replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ");

    // 6) Supprimer les prix qui se sont glissés : "2.50€", "1,99 €"
    s = s.replace(/\b\d+[.,]\d{1,2}\s*(?:€|EUR|euro)\b/gi, " ");

    // 7) Supprimer les codes entre parenthèses : "(E322)", "(ref:1234)"
    s = s.replace(/\(\s*(?:E\d+|ref\.?\s*\d+|n°\s*\d+|code\s*\d+)\s*\)/gi, " ");

    // 8) Nettoyer les parenthèses vides ou avec juste un chiffre
    s = s.replace(/\(\s*\)/g, " ");
    s = s.replace(/\(\s*\d+(?:[.,]\d+)?\s*\)/g, " ");

    // 9) Supprimer les tirets en trop (garder le premier mot après si ça a du sens)
    // "Produit - Bio" → "Produit Bio"
    // "Produit - " → "Produit"
    s = s.replace(/\s*[-–—]\s*/g, " ");
    s = s.replace(/\s*\.\s*/g, " ");

    // 10) Supprimer les chiffres isolés (pas collés à des lettres comme "A4", "B12")
    s = s.replace(/\b\d+(?:[.,]\d+)?\b/g, function(match, offset, str) {
      var before = offset > 0 ? str.charAt(offset - 1) : " ";
      var after = offset + match.length < str.length ? str.charAt(offset + match.length) : " ";
      if (/[A-Za-z\u00C0-\u024F]/.test(before) || /[A-Za-z\u00C0-\u024F]/.test(after)) return match;
      return " ";
    });

    // 11) Supprimer les mots vides françaiscourants en trop
    var stopWords = ["le", "la", "les", "de", "du", "des", "un", "une", "au", "aux", "et", "en"];
    var words = s.split(/\s+/);
    var kept = [];
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (word.length === 0) continue;
      // Garder si: > 2 lettres OU c'est une marque/sigle (majuscule seule)
      if (word.length > 2 || /^[A-Z]{1,3}$/.test(word)) {
        kept.push(word);
      }
    }
    s = kept.join(" ");

    // 12) Casse: Première lettre majuscule, reste minuscule
    s = s.toLowerCase().replace(/(?:^|\s)\S/g, function(c) { return c.toUpperCase(); });

    // 13) Nettoyage final espaces
    s = s.replace(/\s+/g, " ").trim();

    // 14) Si trop court, essayer de garder le nom brut nettoyé minimalement
    if (s.length < 2 && raw.length >= 2) {
      s = raw.replace(/[|\\{}=<>^~`#§¤°±]/g, " ").replace(/\s+/g, " ").trim();
      s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    return s;
  }

  // ═══════════════════════════════════════════════════
  //  AJOUT RAPIDE — Le cœur du module
  // ═══════════════════════════════════════════════════

  function quickAdd(barcode, opts) {
    opts = opts || {};
    var dialog = document.getElementById("acim-quickadd");
    if (dialog) dialog.remove();

    var overlay = document.createElement("div"); overlay.id = "acim-quickadd";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif;";

    var panel = document.createElement("div");
    panel.style.cssText = "background:#fff;border-radius:16px;padding:20px;width:90%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.3);";

    // ── Header ──
    var header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;";
    var titleEl = document.createElement("div");
    titleEl.style.cssText = "font-size:18px;font-weight:700;color:#1a1a2e;";
    titleEl.textContent = "➕ Nouveau produit";
    var closeBtn = document.createElement("button");
    closeBtn.style.cssText = "background:none;border:none;font-size:22px;cursor:pointer;color:#999;";
    closeBtn.textContent = "✕";
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Barcode (si fourni) ──
    if (barcode) {
      var bcDiv = document.createElement("div");
      bcDiv.style.cssText = "background:#f5f5f5;border-radius:8px;padding:6px 10px;margin-bottom:10px;font-size:12px;color:#666;display:flex;align-items:center;gap:6px;";
      bcDiv.innerHTML = '📊 <span style="font-family:monospace;font-weight:600;color:#333;">' + barcode + '</span>';
      panel.appendChild(bcDiv);
    }

    // ── Photo bouton ──
    var photoRow = document.createElement("div");
    photoRow.style.cssText = "display:flex;gap:8px;margin-bottom:10px;";

    var photoBtn = document.createElement("button");
    photoBtn.style.cssText = "flex:1;padding:10px;border:2px dashed #ccc;border-radius:10px;background:#fafafa;cursor:pointer;font-size:14px;color:#666;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;";
    photoBtn.innerHTML = "📸 <span>Photo du produit</span>";
    photoBtn.onmouseover = function() { this.style.borderColor="#e65100"; this.style.background="#fff3e0"; };
    photoBtn.onmouseout = function() { this.style.borderColor="#ccc"; this.style.background="#fafafa"; };
    photoBtn.onclick = function() { _takePhoto(nameInput, priceInput); };
    photoRow.appendChild(photoBtn);

    var lookupBtn = document.createElement("button");
    lookupBtn.style.cssText = "padding:10px 14px;border:1px solid #e0e0e0;border-radius:10px;background:#f5f5f5;cursor:pointer;font-size:14px;color:#666;transition:all 0.2s;";
    lookupBtn.innerHTML = "🔍";
    lookupBtn.title = "Chercher sur Open Food Facts";
    lookupBtn.onmouseover = function() { this.style.background="#e3f2fd"; };
    lookupBtn.onmouseout = function() { this.style.background="#f5f5f5"; };
    lookupBtn.onclick = function() { _lookupOFF(barcode || "", nameInput, priceInput); };
    photoRow.appendChild(lookupBtn);

    panel.appendChild(photoRow);

    // ── Aperçu photo ──
    var previewDiv = document.createElement("div");
    previewDiv.id = "acim-photo-preview";
    previewDiv.style.cssText = "display:none;margin-bottom:10px;text-align:center;";
    panel.appendChild(previewDiv);

    // ── Nom ──
    var nameLabel = document.createElement("div");
    nameLabel.style.cssText = "font-size:11px;color:#999;font-weight:600;margin-bottom:2px;";
    nameLabel.textContent = "NOM DU PRODUIT";
    panel.appendChild(nameLabel);

    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Ex: Steak haché boeuf";
    nameInput.style.cssText = "width:100%;font-size:16px;font-weight:600;color:#1a1a2e;padding:10px 12px;border:2px solid #e0e0e0;border-radius:10px;outline:none;background:#fafafa;margin-bottom:10px;transition:border 0.2s;";
    nameInput.onfocus = function() { this.style.borderColor="#e65100"; this.style.background="#fff"; };
    nameInput.onblur = function() { this.style.borderColor="#e0e0e0"; this.style.background="#fafafa"; };
    if (opts.name) nameInput.value = opts.name;
    panel.appendChild(nameInput);

    // ── Prix ──
    var priceRow = document.createElement("div");
    priceRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:12px;";

    var priceLabel = document.createElement("div");
    priceLabel.style.cssText = "font-size:11px;color:#999;font-weight:600;min-width:32px;";
    priceLabel.textContent = "PRIX";
    priceRow.appendChild(priceLabel);

    var priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.step = "0.01";
    priceInput.min = "0";
    priceInput.placeholder = "0.00";
    priceInput.style.cssText = "width:100px;font-size:18px;font-weight:700;color:#e65100;text-align:right;padding:10px 12px;border:2px solid #e0e0e0;border-radius:10px;outline:none;background:#fafafa;transition:border 0.2s;";
    priceInput.onfocus = function() { this.style.borderColor="#e65100"; this.style.background="#fff"; this.select(); };
    priceInput.onblur = function() { this.style.borderColor="#e0e0e0"; this.style.background="#fafafa"; };
    if (opts.priceCents) priceInput.value = (opts.priceCents / 100).toFixed(2);
    priceRow.appendChild(priceInput);

    var euroLabel = document.createElement("span");
    euroLabel.style.cssText = "font-size:18px;font-weight:700;color:#e65100;";
    euroLabel.textContent = "€";
    priceRow.appendChild(euroLabel);

    // Suggestion prix (sera remplie par lookup)
    var priceHint = document.createElement("span");
    priceHint.id = "acim-price-hint";
    priceHint.style.cssText = "font-size:11px;color:#999;margin-left:auto;";
    priceRow.appendChild(priceHint);

    panel.appendChild(priceRow);

    // ── Catégories (1 clic) ──
    var catLabel = document.createElement("div");
    catLabel.style.cssText = "font-size:11px;color:#999;font-weight:600;margin-bottom:6px;";
    catLabel.textContent = "CATÉGORIE";
    panel.appendChild(catLabel);

    var catGrid = document.createElement("div");
    catGrid.style.cssText = "display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:12px;";

    var selectedCat = opts.category || _guessCat(nameInput.value || "");

    for (var ci = 0; ci < CATS.length; ci++) {
      (function(cat) {
        var btn = document.createElement("button");
        btn.className = "acim-cat-btn";
        btn.dataset.cat = cat.id;
        btn.style.cssText = "padding:6px 2px;border:2px solid " + (cat.id === selectedCat ? "#e65100" : "#e0e0e0") + ";border-radius:8px;background:" + (cat.id === selectedCat ? "#fff3e0" : "#fafafa") + ";cursor:pointer;text-align:center;transition:all 0.15s;";
        btn.innerHTML = '<div style="font-size:18px;">' + cat.icon + '</div><div style="font-size:8px;color:#666;margin-top:2px;">' + cat.label + '</div>';
        btn.onclick = function() {
          // Deselect all
          catGrid.querySelectorAll(".acim-cat-btn").forEach(function(b) {
            b.style.borderColor = "#e0e0e0"; b.style.background = "#fafafa";
          });
          this.style.borderColor = "#e65100"; this.style.background = "#fff3e0";
          selectedCat = cat.id;
        };
        catGrid.appendChild(btn);
      })(CATS[ci]);
    }
    panel.appendChild(catGrid);

    // ── Auto-catégorisation quand on tape le nom ──
    nameInput.addEventListener("input", function() {
      var guessed = _guessCat(this.value);
      if (guessed !== selectedCat) {
        selectedCat = guessed;
        catGrid.querySelectorAll(".acim-cat-btn").forEach(function(b) {
          b.style.borderColor = b.dataset.cat === guessed ? "#e65100" : "#e0e0e0";
          b.style.background = b.dataset.cat === guessed ? "#fff3e0" : "#fafafa";
        });
      }
    });

    // ── Boutons ──
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;";

    var cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Annuler";
    cancelBtn.style.cssText = "flex:1;padding:10px;border:none;border-radius:10px;background:#e8e8e8;font-size:14px;cursor:pointer;font-weight:600;color:#666;";
    cancelBtn.onclick = function() { overlay.remove(); };
    btnRow.appendChild(cancelBtn);

    var addBtn = document.createElement("button");
    addBtn.innerHTML = "✓ Ajouter";
    addBtn.style.cssText = "flex:2;padding:10px;border:none;border-radius:10px;background:#e65100;color:#fff;font-size:14px;cursor:pointer;font-weight:700;";
    addBtn.onmouseover = function() { this.style.background = "#bf360c"; };
    addBtn.onmouseout = function() { this.style.background = "#e65100"; };
    addBtn.onclick = function() {
      var name = nameInput.value.trim();
      var price = parseFloat(priceInput.value);
      if (!name) { nameInput.style.borderColor = "#c62828"; nameInput.focus(); return; }
      if (isNaN(price) || price <= 0) { priceInput.style.borderColor = "#c62828"; priceInput.focus(); return; }

      var product = {
        barcode: barcode || "MAN-" + Date.now(),
        name: normalizeName(name),
        brand: _guessBrand(name),
        category: selectedCat,
        kosher: true,
        sale_price_cents: Math.round(price * 100),
        purchase_price_cents: 0,
        unit: "",
        source: barcode ? "scan" : "manual",
        last_updated: Date.now(),
        purchase_count: 0
      };

      saveProduct(product);
      overlay.remove();
      _toast("✅ " + name + " ajouté !");

      // Si un callback est défini (pour intégration avec le panier)
      if (opts.onAdded) opts.onAdded(product);
    };
    btnRow.appendChild(addBtn);

    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    // Focus sur le nom (ou prix si déjà rempli)
    setTimeout(function() {
      if (nameInput.value) priceInput.focus();
      else nameInput.focus();
    }, 50);

    // Si barcode fourni, auto-lookup
    if (barcode) {
      _autoLookup(barcode, nameInput, priceInput, catGrid);
    }
  }

  // ═══════════════════════════════════════════════════
  //  PHOTO → OCR → Suggestion nom/prix
  // ═══════════════════════════════════════════════════

  function _takePhoto(nameInput, priceInput) {
    // Méthode 1: Input file (marche partout, desktop + mobile)
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // Caméra arrière sur mobile

    input.onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;

      _toast("📸 Analyse de la photo...");

      // Aperçu
      var previewDiv = document.getElementById("acim-photo-preview");
      if (previewDiv) {
        var img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.cssText = "max-width:200px;max-height:150px;border-radius:8px;border:2px solid #e0e0e0;";
        previewDiv.innerHTML = "";
        previewDiv.appendChild(img);
        previewDiv.style.display = "block";
      }

      try {
        // OCR avec Tesseract.js
        var text = await _ocrImage(file);
        _log("OCR résultat: " + text.substring(0, 200));

        if (text && text.trim()) {
          var suggestion = _parseProductFromOCR(text);
          if (suggestion.name && !nameInput.value) {
            nameInput.value = suggestion.name; // déjà normalisé par _parseProductFromOCR
            nameInput.style.borderColor = "#4caf50";
            nameInput.dispatchEvent(new Event("input")); // trigger auto-cat
          }
          if (suggestion.price && !priceInput.value) {
            priceInput.value = suggestion.price;
            priceInput.style.borderColor = "#4caf50";
          }
          _toast("✅ Suggestion: " + suggestion.name);
        } else {
          _toast("⚠️ Texte non détecté, saisissez manuellement");
        }
      } catch(ex) {
        _err("OCR échoué", ex);
        _toast("⚠️ OCR échoué, saisissez manuellement");
      }
    };
    input.click();
  }

  async function _ocrImage(file) {
    // Charger Tesseract.js si pas encore fait
    if (!window.Tesseract) {
      _log("Chargement Tesseract.js...");
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      document.head.appendChild(s);
      await new Promise(function(resolve, reject) {
        s.onload = resolve;
        s.onerror = function() { reject(new Error("Tesseract.js non chargeable")); };
      });
    }

    // Redimensionner l'image pour accélérer l'OCR
    var img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise(function(r) { img.onload = r; });

    var canvas = document.createElement("canvas");
    var maxW = 800;
    var scale = Math.min(1, maxW / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);

    // Améliorer le contraste
    _enhanceContrast(canvas);

    // OCR
    var worker = await Tesseract.createWorker("fra+eng", 1, { logger: function() {} });
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    var result = await worker.recognize(canvas);
    await worker.terminate();

    return result.data.text || "";
  }

  function _enhanceContrast(canvas) {
    try {
      var ctx = canvas.getContext("2d");
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = imgData.data;
      for (var i = 0; i < d.length; i += 4) {
        var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Seuillage adaptatif — noir si sombre, blanc sinon
        var val = gray < 128 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch(e) {}
  }

  function _parseProductFromOCR(text) {
    var lines = text.split("\n").map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 2; });
    var name = "";
    var price = "";

    // Chercher un prix (pattern: X.XX € ou X,XX€)
    for (var i = 0; i < lines.length; i++) {
      var pm = lines[i].match(/(\d+[.,]\d{1,2})\s*(?:€|EUR|euro)/i);
      if (pm) {
        price = pm[1].replace(",", ".");
        break;
      }
    }

    // Le nom = première ligne non-prix qui ressemble à un produit
    var skipPatterns = /^(total|sous.total|tva|code|ref|n°|facture|ticket|caisse|date|heure|merci|paiement|cb|carte|espèces)/i;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.length < 3) continue;
      if (/^\d+[.,]\d{1,2}$/.test(line)) continue;
      if (skipPatterns.test(line)) continue;
      if (/^\d+$/.test(line)) continue;
      name = line;
      break;
    }

    // Normaliser le nom (supprime chiffres bizarres, unités, OCR parasites)
    name = normalizeName(name);

    return { name: name, price: price };
  }

  // ═══════════════════════════════════════════════════
  //  LOOKUP Open Food Facts
  // ═══════════════════════════════════════════════════

  function _autoLookup(barcode, nameInput, priceInput, catGrid) {
    if (!barcode || barcode.startsWith("MAN-")) return;

    // D'abord chercher dans le catalogue local
    getLocalProduct(barcode).then(function(local) {
      if (local && local.name) {
        nameInput.value = local.name;
        priceInput.value = local.sale_price_cents ? (local.sale_price_cents / 100).toFixed(2) : "";
        nameInput.dispatchEvent(new Event("input"));
        _toast("📋 Trouvé dans le catalogue");
        return;
      }

      // Sinon chercher sur OFF
      _lookupOFF(barcode, nameInput, priceInput);
    });
  }

  function _lookupOFF(barcode, nameInput, priceInput) {
    if (!barcode) {
      // Chercher par nom
      var query = nameInput ? nameInput.value.trim() : "";
      if (!query || query.length < 3) { _toast("Tapez un nom pour chercher"); return; }

      _toast("🔍 Recherche OFF: " + query + "...");
      fetch(OFF_SEARCH + "?search_terms=" + encodeURIComponent(query) +
        "&tagtype_0=labels&tag_contains_0=contains&tag_0=kosher&page_size=5&json=1")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.products && data.products.length > 0) {
            _showOFFResults(data.products, nameInput, priceInput);
          } else {
            _toast("Aucun résultat casher sur OFF");
          }
        })
        .catch(function() { _toast("⚠️ OFF indisponible"); });
      return;
    }

    _toast("🔍 Lookup " + barcode + "...");
    fetch(OFF_API + barcode + ".json")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 1 && data.product) {
          var p = data.product;
          var rawName = p.product_name_fr || p.product_name || "";
          if (nameInput && !nameInput.value) {
            nameInput.value = normalizeName(rawName);
            nameInput.dispatchEvent(new Event("input"));
          }
          _toast("✅ " + normalizeName(rawName));
          // Sauvegarder dans le catalogue
          saveProduct({
            barcode: barcode,
            name: normalizeName(rawName),
            brand: p.brands || "",
            category: _guessCat((p.product_name || "") + " " + (p.categories || "")),
            kosher: (p.labels || "").toLowerCase().includes("kosher") || (p.labels || "").toLowerCase().includes("cacher"),
            sale_price_cents: 0,
            purchase_price_cents: 0,
            source: "openfoodfacts",
            last_updated: Date.now(),
            purchase_count: 0
          });
        } else {
          _toast("❓ Produit inconnu sur OFF");
        }
      })
      .catch(function() { _toast("⚠️ OFF indisponible"); });
  }

  function _showOFFResults(products, nameInput, priceInput) {
    var old = document.getElementById("acim-off-results"); if (old) old.remove();

    var div = document.createElement("div");
    div.id = "acim-off-results";
    div.style.cssText = "background:#f5f5f5;border-radius:8px;padding:8px;margin-bottom:8px;max-height:150px;overflow-y:auto;";

    var label = document.createElement("div");
    label.style.cssText = "font-size:10px;color:#999;margin-bottom:4px;";
    label.textContent = "Sélectionnez un produit :";
    div.appendChild(label);

    for (var i = 0; i < products.length; i++) {
      (function(p) {
        var item = document.createElement("div");
        item.style.cssText = "padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:2px;transition:background 0.1s;";
        item.innerHTML = "<b>" + (p.product_name || "?") + "</b> <span style='color:#999;font-size:11px;'>" + (p.brands || "") + "</span>";
        item.onmouseover = function() { this.style.background = "#e3f2fd"; };
        item.onmouseout = function() { this.style.background = "transparent"; };
        item.onclick = function() {
          if (nameInput) {
            nameInput.value = normalizeName(p.product_name_fr || p.product_name || "");
            nameInput.dispatchEvent(new Event("input"));
          }
          div.remove();
          _toast("✅ " + normalizeName(p.product_name || ""));
        };
        div.appendChild(item);
      })(products[i]);
    }

    // Insérer avant les boutons
    var panel = nameInput.closest("div").parentElement;
    var btnRow = panel.querySelector("div:last-child");
    panel.insertBefore(div, btnRow);
  }

  // ═══════════════════════════════════════════════════
  //  IA: Catégorisation / Marque
  // ═══════════════════════════════════════════════════

  function _guessCat(text) {
    if (!text) return "épicerie";
    var t = text.toLowerCase();
    var best = "épicerie", bestScore = 0;
    for (var i = 0; i < CATS.length; i++) {
      var score = 0;
      for (var k = 0; k < CATS[i].kw.length; k++) {
        if (t.includes(CATS[i].kw[k])) score++;
      }
      if (score > bestScore) { bestScore = score; best = CATS[i].id; }
    }
    return best;
  }

  function _guessBrand(text) {
    if (!text) return "";
    var t = text.toLowerCase();
    for (var i = 0; i < BRANDS.length; i++) {
      if (t.includes(BRANDS[i].toLowerCase())) return BRANDS[i];
    }
    return "";
  }

  // ═══════════════════════════════════════════════════
  //  CATALOGUE COMPLET (recherche, export)
  // ═══════════════════════════════════════════════════

  function showCatalog() {
    var old = document.getElementById("acim-catalog-dlg"); if (old) old.remove();

    var overlay = document.createElement("div"); overlay.id = "acim-catalog-dlg";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif;";

    var panel = document.createElement("div");
    panel.style.cssText = "background:#fff;border-radius:16px;padding:20px;width:92%;max-width:650px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.3);";

    // Header
    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;";
    var ttl = document.createElement("div");
    ttl.style.cssText = "font-size:20px;font-weight:700;color:#1a1a2e;";
    ttl.textContent = "📖 Catalogue Cacher";
    var xBtn = document.createElement("button");
    xBtn.style.cssText = "background:none;border:none;font-size:22px;cursor:pointer;color:#999;";
    xBtn.textContent = "✕"; xBtn.onclick = function() { overlay.remove(); };
    hdr.appendChild(ttl); hdr.appendChild(xBtn);
    panel.appendChild(hdr);

    // Compteur
    var countDiv = document.createElement("div");
    countDiv.style.cssText = "font-size:12px;color:#999;margin-bottom:12px;";
    countDiv.textContent = "...";
    panel.appendChild(countDiv);
    getProductCount().then(function(n) { countDiv.textContent = n + " produits en catalogue"; });

    // Barre d'actions
    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;";

    var acts = [
      { text: "➕ Nouveau", color: "#e65100", fn: function() { quickAdd("", { onAdded: function() { showCatalog(); } }); } },
      { text: "📥 Import OFF", color: "#2e7d32", fn: function() { _importOFFBatch(); } },
      { text: "📄 Import CSV", color: "#1565c0", fn: function() { _importCSVFile(); } },
      { text: "📤 Export CSV", color: "#555", fn: function() { _exportCSV(); } },
      { text: "⚠️ Anomalies", color: "#c62828", fn: function() { _showAnomalies(resultsDiv); } }
    ];
    for (var a = 0; a < acts.length; a++) {
      (function(act) {
        var btn = document.createElement("button");
        btn.textContent = act.text;
        btn.style.cssText = "padding:6px 10px;border:none;border-radius:8px;background:" + act.color + ";color:#fff;font-size:12px;cursor:pointer;font-weight:600;";
        btn.onclick = act.fn;
        actions.appendChild(btn);
      })(acts[a]);
    }
    panel.appendChild(actions);

    // Recherche
    var searchRow = document.createElement("div");
    searchRow.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";
    var searchIn = document.createElement("input");
    searchIn.type = "text"; searchIn.placeholder = "Rechercher...";
    searchIn.style.cssText = "flex:1;padding:8px 12px;border:1px solid #e0e0e0;border-radius:8px;font-size:13px;outline:none;";
    var searchBtn = document.createElement("button");
    searchBtn.textContent = "🔍"; searchBtn.style.cssText = "padding:8px 12px;border:none;border-radius:8px;background:#e65100;color:#fff;cursor:pointer;";
    searchBtn.onclick = function() { _searchCatalog(searchIn.value, resultsDiv); };
    searchIn.onkeydown = function(e) { if (e.key === "Enter") searchBtn.click(); };
    searchRow.appendChild(searchIn); searchRow.appendChild(searchBtn);
    panel.appendChild(searchRow);

    // Résultats
    var resultsDiv = document.createElement("div");
    resultsDiv.id = "acim-catalog-results";
    resultsDiv.style.cssText = "min-height:60px;";
    resultsDiv.innerHTML = '<div style="text-align:center;color:#bbb;padding:20px;">Recherchez ou ajoutez des produits</div>';
    panel.appendChild(resultsDiv);

    overlay.appendChild(panel);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);

    // Charger les derniers produits
    _searchCatalog("", resultsDiv);
  }

  function _searchCatalog(query, container) {
    searchProducts(query || "", 50).then(function(products) {
      if (products.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Aucun produit</div>';
        return;
      }

      var html = "";
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var catInfo = CATS.find(function(c) { return c.id === p.category; }) || CATS[CATS.length - 1];
        var price = p.sale_price_cents ? (p.sale_price_cents / 100).toFixed(2) + "€" : "—";
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #f0f0f0;cursor:pointer;" data-barcode="' + (p.barcode || "") + '" class="acim-cat-item">';
        html += '<span style="font-size:18px;">' + catInfo.icon + '</span>';
        html += '<div style="flex:1;"><b style="font-size:13px;">' + (p.name || "?") + '</b>';
        if (p.brand) html += ' <span style="color:#999;font-size:11px;">' + p.brand + '</span>';
        html += '</div>';
        html += '<span style="font-weight:700;color:#e65100;font-size:14px;">' + price + '</span>';
        html += '<button style="background:none;border:1px solid #eee;border-radius:6px;padding:3px 6px;cursor:pointer;font-size:11px;color:#c62828;" onclick="event.stopPropagation();window._acimCatalog.deleteProduct(\'' + (p.barcode || "") + '\');this.closest(\'.acim-cat-item\').remove();">✕</button>';
        html += '</div>';
      }
      container.innerHTML = html;
    });
  }

  function _importOFFBatch() {
    _toast("📥 Import produits casher OFF (page 1)...");
    fetch("https://world.openfoodfacts.org/label/kosher/1.json")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var count = 0;
        if (data.products) {
          var chain = Promise.resolve();
          data.products.forEach(function(p) {
            if (!p.code) return;
            chain = chain.then(function() {
              return saveProduct({
                barcode: p.code,
                name: normalizeName(p.product_name_fr || p.product_name || ""),
                brand: p.brands || "",
                category: _guessCat((p.product_name || "") + " " + (p.categories || "")),
                kosher: true,
                sale_price_cents: 0,
                purchase_price_cents: 0,
                source: "openfoodfacts",
                last_updated: Date.now(),
                purchase_count: 0
              }).then(function() { count++; });
            });
          });
          return chain.then(function() { return count; });
        }
        return 0;
      })
      .then(function(count) {
        _toast("✅ " + count + " produits casher importés !");
      })
      .catch(function(e) { _toast("⚠️ Erreur import: " + e.message); });
  }

  function _importCSVFile() {
    var input = document.createElement("input");
    input.type = "file"; input.accept = ".csv,.txt,.tsv";
    input.onchange = function(e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var count = importCSV(ev.target.result);
        _toast("✅ " + count + " produits importés depuis CSV");
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function _exportCSV() {
    getAllProducts().then(function(products) {
      var csv = "barcode;name;brand;category;price_cents;kosher;source\n";
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        csv += [p.barcode, '"' + (p.name || "").replace(/"/g, '""') + '"', '"' + (p.brand || "").replace(/"/g, '""') + '"', p.category || "", p.sale_price_cents || 0, p.kosher ? "1" : "0", p.source || ""].join(";") + "\n";
      }
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "catalogue-cacher-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a); a.click();
      setTimeout(function() { a.remove(); URL.revokeObjectURL(url); }, 300);
      _toast("📤 " + products.length + " produits exportés");
    });
  }

  function _showAnomalies(container) {
    getAllProducts().then(function(products) {
      var anomalies = [];
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        if (!p.sale_price_cents || p.sale_price_cents === 0) {
          anomalies.push({ msg: "Sans prix: " + p.name, product: p });
        }
        if (!p.name || p.name.length < 2) {
          anomalies.push({ msg: "Sans nom: " + p.barcode, product: p });
        }
      }
      if (anomalies.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#4caf50;padding:20px;">✅ Tout est OK !</div>';
      } else {
        var html = '<div style="font-size:13px;font-weight:700;color:#c62828;margin-bottom:8px;">⚠️ ' + anomalies.length + ' anomalies</div>';
        for (var i = 0; i < anomalies.length; i++) {
          html += '<div style="padding:4px 8px;font-size:12px;color:#c62828;border-bottom:1px solid #fee;">⚠️ ' + anomalies[i].msg + '</div>';
        }
        container.innerHTML = html;
      }
    });
  }

  // ═══════════════════════════════════════════════════
  //  IMPORT CSV
  // ═══════════════════════════════════════════════════

  function importCSV(csvText) {
    var lines = csvText.split("\n");
    if (lines.length < 2) return 0;
    var sep = csvText.includes("\t") ? "\t" : (csvText.includes(";") ? ";" : ",");
    var headers = lines[0].split(sep).map(function(h) { return h.trim().toLowerCase(); });

    var colMap = {};
    var aliases = {
      barcode: ["barcode","code","code-barres","ean","ean13","upc","cb"],
      name: ["name","nom","produit","libelle","libellé","designation"],
      brand: ["brand","marque"],
      category: ["category","categorie","catégorie","rayon","famille"],
      sale_price: ["sale_price","prix_vente","pv","prix vente","prix","price"],
      kosher_cert: ["kosher_cert","certification","cacher"]
    };
    for (var key in aliases) {
      for (var a = 0; a < aliases[key].length; a++) {
        var idx = headers.indexOf(aliases[key][a]);
        if (idx >= 0) { colMap[key] = idx; break; }
      }
    }

    var count = 0;
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var cols = line.split(sep);
      var barcode = colMap.barcode !== undefined ? (cols[colMap.barcode] || "").trim().replace(/"/g, "") : "";
      var name = colMap.name !== undefined ? (cols[colMap.name] || "").trim().replace(/"/g, "") : "";
      if (!barcode && !name) continue;

      var product = {
        barcode: barcode || "CSV-" + Date.now() + "-" + i,
        name: normalizeName(name),
        brand: colMap.brand !== undefined ? (cols[colMap.brand] || "").trim().replace(/"/g, "") : _guessBrand(name),
        category: colMap.category !== undefined ? (cols[colMap.category] || "").trim().replace(/"/g, "") : _guessCat(name),
        kosher: true,
        sale_price_cents: colMap.sale_price !== undefined ? _parsePrice(cols[colMap.sale_price]) : 0,
        purchase_price_cents: 0,
        source: "csv",
        last_updated: Date.now(),
        purchase_count: 0
      };
      saveProduct(product);
      count++;
    }
    return count;
  }

  // ═══════════════════════════════════════════════════
  //  IndexedDB CRUD
  // ═══════════════════════════════════════════════════

  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          var store = d.createObjectStore(STORE, { keyPath: "barcode" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("category", "category", { unique: false });
        }
      };
      req.onsuccess = function(e) { db = e.target.result; resolve(db); };
      req.onerror = function(e) { reject(e.target.error); };
    });
  }

  function saveProduct(product) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(product);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function getLocalProduct(barcode) {
    return openDB().then(function(d) {
      return new Promise(function(resolve, reject) {
        var req = d.transaction(STORE, "readonly").objectStore(STORE).get(barcode);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function searchProducts(query, limit) {
    limit = limit || 50;
    return openDB().then(function(d) {
      return new Promise(function(resolve) {
        var results = [];
        var q = query.toLowerCase();
        d.transaction(STORE, "readonly").objectStore(STORE).openCursor(null, "next").onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor && results.length < limit) {
            var p = cursor.value;
            if (!q || (p.name && p.name.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q)) || (p.category && p.category.toLowerCase().includes(q))) {
              results.push(p);
            }
            cursor.continue();
          } else { resolve(results); }
        };
      });
    });
  }

  function getAllProducts() {
    return openDB().then(function(d) {
      return new Promise(function(resolve) {
        var req = d.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
      });
    });
  }

  function getProductCount() {
    return openDB().then(function(d) {
      return new Promise(function(resolve) {
        var req = d.transaction(STORE, "readonly").objectStore(STORE).count();
        req.onsuccess = function() { resolve(req.result); };
      });
    });
  }

  function deleteProduct(barcode) {
    return openDB().then(function(d) {
      return new Promise(function(resolve) {
        var tx = d.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(barcode);
        tx.oncomplete = function() { resolve(); };
      });
    });
  }

  function _parsePrice(str) {
    if (!str) return 0;
    var n = parseFloat(str.replace(",", ".").replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : Math.round(n * 100);
  }

  function _toast(msg) {
    var old = document.getElementById("acim-cat-toast"); if (old) old.remove();
    var t = document.createElement("div"); t.id = "acim-cat-toast"; t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-family:Segoe UI,Arial,sans-serif;z-index:99999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function() { t.style.transition = "opacity 0.3s"; t.style.opacity = "0"; setTimeout(function() { t.remove(); }, 300); }, 2500);
  }

  // ── Raccourcis ──
  document.addEventListener("keydown", function(e) {
    if (e.key === "C" && e.ctrlKey && e.shiftKey && !e.altKey) {
      e.preventDefault();
      showCatalog();
    }
    if (e.key === "N" && e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      quickAdd("", {});
    }
  });

  // ── API publique ──
  window._acimCatalog = {
    quickAdd: quickAdd,
    show: showCatalog,
    lookup: function(barcode) { return _lookupOFF(barcode, null, null); },
    search: searchProducts,
    importCSV: importCSV,
    save: saveProduct,
    get: getLocalProduct,
    deleteProduct: deleteProduct,
    count: getProductCount,
    cats: CATS
  };

  _log("Catalogue Cacher v2 — Ctrl+Shift+C catalogue, Ctrl+N ajout rapide");
})();
