const core = window.SmartInventoryCore;
const api = window.AcimAPI;
const media = window.AcimMedia;
const detection = window.AcimDetection;

const storageKey = "acimcaisse.session";
const localKey = "acimcaisse.local";
const modes = core.modes;

const state = {
  mode: "sale",
  productIndex: 0,
  barcodeFound: false,
  currentPrice: null,
  entries: core.createEntries(),
  messages: [],
  products: core.products,
  dbProducts: [],
  currentProductId: null,
  online: navigator.onLine,
  recording: false,
  recordingAudio: false,
  user: null,
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  pinInput: document.getElementById("pinInput"),
  loginError: document.getElementById("loginError"),
  modeList: document.getElementById("modeList"),
  modeTitle: document.getElementById("modeTitle"),
  sessionStatus: document.getElementById("sessionStatus"),
  summaryLabel: document.getElementById("summaryLabel"),
  totalValue: document.getElementById("totalValue"),
  listTitle: document.getElementById("listTitle"),
  itemCount: document.getElementById("itemCount"),
  itemList: document.getElementById("itemList"),
  conversation: document.getElementById("conversation"),
  confidence: document.getElementById("confidence"),
  productName: document.getElementById("productName"),
  productCode: document.getElementById("productCode"),
  productPrice: document.getElementById("productPrice"),
  productStock: document.getElementById("productStock"),
  productImage: document.getElementById("productImage"),
  productState: document.getElementById("productState"),
  quickEntry: document.getElementById("quickEntry"),
  quickInput: document.getElementById("quickInput"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  captureBtn: document.getElementById("captureBtn"),
  recordAudioBtn: document.getElementById("recordAudioBtn"),
  recordVideoBtn: document.getElementById("recordVideoBtn"),
  rotateBtn: document.getElementById("rotateBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  unknownBtn: document.getElementById("unknownBtn"),
  exportBtn: document.getElementById("exportBtn"),
  resetBtn: document.getElementById("resetBtn"),
  cameraCaption: document.getElementById("cameraCaption"),
  capturedImage: document.getElementById("capturedImage"),
  audioPlayback: document.getElementById("audioPlayback"),
  videoPlayback: document.getElementById("videoPlayback"),
  mediaPreview: document.getElementById("mediaPreview"),
  syncStatus: document.getElementById("syncStatus"),
  syncText: document.getElementById("syncText"),
  syncDot: document.getElementById("syncDot"),
  scrapeForm: document.getElementById("scrapeForm"),
  scrapeUrl: document.getElementById("scrapeUrl"),
  scrapeResults: document.getElementById("scrapeResults"),
};

function money(cents) {
  return core.money(cents || 0);
}

function addMessage(text, tone = "") {
  state.messages.push({ text, tone });
  if (state.messages.length > 12) state.messages.shift();
  renderMessages();
}

function addUserMessage(text) {
  state.messages.push({ text, tone: "user" });
  if (state.messages.length > 12) state.messages.shift();
  renderMessages();
}

function renderMessages() {
  els.conversation.innerHTML = "";
  state.messages.forEach((message) => {
    const item = document.createElement("li");
    item.className = `message ${message.tone}`.trim();
    item.textContent = message.text;
    els.conversation.appendChild(item);
  });
  els.conversation.scrollTop = els.conversation.scrollHeight;
}

function currentMode() {
  return modes.find((m) => m.id === state.mode);
}

function currentProduct() {
  return state.products[state.productIndex];
}

function renderModes() {
  els.modeList.innerHTML = "";
  modes.forEach((mode) => {
    const button = document.createElement("button");
    button.className = `mode-button${mode.id === state.mode ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="mode-icon">${mode.icon}</span>
      <span>
        <span>${mode.label}</span>
        <small>${mode.detail}</small>
      </span>
      <span class="mode-dot"></span>
    `;
    button.addEventListener("click", () => setMode(mode.id));
    els.modeList.appendChild(button);
  });
}

function renderProduct() {
  const product = currentProduct();
  const db = state.dbProducts.find((p) => p.id === state.currentProductId);
  const active = db || product;
  els.productName.textContent = active.name;
  els.productCode.textContent = state.barcodeFound && active.barcode ? active.barcode : "Non trouve";
  els.productPrice.textContent = state.currentPrice == null ? "Inconnu" : money(state.currentPrice);
  els.productStock.textContent = db ? String(db.stock) : "0";
  els.productState.textContent = state.barcodeFound ? "Confirme" : "A confirmer";
  els.confidence.textContent = `${product.confidence}%`;
  if (db && db.image) {
    els.productImage.innerHTML = `<img src="${db.image}" alt="" style="max-width:100%;max-height:80px;border-radius:6px;">`;
  } else {
    els.productImage.innerHTML = "<em>Aucune</em>";
  }
}

function renderEntries() {
  const mode = currentMode();
  const entries = state.entries[state.mode];
  els.summaryLabel.textContent = mode.summary;
  els.listTitle.textContent = mode.listTitle;
  els.itemCount.textContent = String(entries.length);
  els.itemList.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "item-row";
    empty.innerHTML = `<div><strong>${mode.empty}</strong><small>En attente</small></div><span>-</span>`;
    els.itemList.appendChild(empty);
  } else {
    entries.slice(-8).reverse().forEach((entry) => {
      const row = document.createElement("li");
      row.className = "item-row";
      row.innerHTML = `
        <div>
          <strong>${entry.name}</strong>
          <small>${entry.note}</small>
        </div>
        <span>${entry.value}</span>
      `;
      els.itemList.appendChild(row);
    });
  }

  if (state.mode === "sale") {
    const total = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    els.totalValue.textContent = money(total);
  } else {
    els.totalValue.textContent = String(entries.length);
  }
}

function renderShell() {
  const mode = currentMode();
  els.modeTitle.textContent = mode.title;
  els.sessionStatus.textContent = mode.status;
  renderModes();
  renderProduct();
  renderEntries();
  renderMessages();
}

function resetProductContext() {
  const product = currentProduct();
  state.barcodeFound = false;
  state.currentPrice = product.price;
  state.currentProductId = null;
}

function setMode(modeId) {
  state.mode = modeId;
  const mode = currentMode();
  addMessage(`Mode ${mode.label}.`);
  addMessage(nextPrompt(currentProduct()), "warning");
  renderShell();
}

function nextPrompt(product) {
  return core.nextPrompt({
    mode: state.mode,
    barcodeFound: state.barcodeFound,
    currentPrice: state.currentPrice,
    product,
  });
}

function detectProduct() {
  state.productIndex = (state.productIndex + 1) % state.products.length;
  resetProductContext();
  const product = currentProduct();
  addMessage(`Nouveau produit detecte: ${product.name}.`);
  addMessage(nextPrompt(product), product.confidence < 80 ? "warning" : "success");
  renderShell();
}

function rotateProduct() {
  state.barcodeFound = Boolean(currentProduct().barcode);
  document.querySelector(".product-box").classList.toggle("rotated");
  if (state.barcodeFound) {
    addMessage(`Code-barres trouve: ${currentProduct().barcode}.`, "success");
  } else {
    addMessage("Code-barres toujours invisible. Dites la reference ou creez le produit.", "warning");
  }
  addMessage(nextPrompt(currentProduct()), "warning");
  renderShell();
}

function parseUserIntent(text) {
  const t = text.toLowerCase();
  if (/nouveau ticket|ticket|vente/.test(t)) return { intent: "set_mode", mode: "sale" };
  if (/inventaire|compter|stock/.test(t)) return { intent: "set_mode", mode: "inventory" };
  if (/reception|livraison|fournisseur/.test(t)) return { intent: "set_mode", mode: "receiving" };
  if (/catalogue|fiche|produit/.test(t)) return { intent: "set_mode", mode: "catalog" };
  if (/correction|ajustement/.test(t)) return { intent: "set_mode", mode: "stock_fix" };
  if (/camera|webcam/.test(t)) return { intent: "start_camera" };
  if (/scrap|fournisseur|site/.test(t)) return { intent: "scrape" };
  return { intent: "entry" };
}

function applyEntry(rawText = "") {
  const text = rawText.trim();
  if (!text) return;

  const intent = parseUserIntent(text);
  if (intent.intent === "set_mode") {
    setMode(intent.mode);
    return;
  }
  if (intent.intent === "start_camera") {
    startCamera();
    return;
  }
  if (intent.intent === "scrape") {
    els.scrapeUrl.focus();
    addMessage("Colle l'URL du fournisseur a scraper.", "warning");
    return;
  }

  const product = currentProduct();
  const amount = core.parseNumberFromText(text);
  const result = core.createEntry({
    mode: state.mode,
    product,
    text,
    currentPrice: state.currentPrice,
    barcodeFound: state.barcodeFound,
  });

  if (result.error === "missing_price") {
    addMessage("Prix manquant. Dites par exemple: 2 euros 50.", "warning");
    return;
  }

  if (result.currentPrice !== undefined) {
    state.currentPrice = result.currentPrice;
  }

  if (state.mode === "sale" && state.currentPrice == null && amount != null) {
    state.currentPrice = amount;
    addMessage(`Prix enregistre: ${money(amount)}.`, "success");
  } else if (state.mode === "sale" && amount != null) {
    addMessage(`Prix enregistre: ${money(state.currentPrice)}.`, "success");
  }

  if (result.entry) {
    state.entries[state.mode].push(result.entry);
    addMessage(result.message, "success");
    queueSync("sales", "local", "insert", result.entry);
  }

  renderShell();
}

async function startCamera() {
  const ok = await media.start();
  els.cameraCaption.textContent = ok ? "Camera active" : "Camera non disponible";
  if (ok) addMessage("Camera activee.", "success");
  else addMessage("Impossible d'acceder a la camera.", "warning");
}

async function captureImage() {
  if (!media.stream) await startCamera();
  if (!media.stream) return;
  const blob = await media.captureImage();
  const preview = document.getElementById("capturedImage");
  preview.src = URL.createObjectURL(blob);
  preview.style.display = "block";
  try {
    const data = await api.uploadFile(blob);
    state.currentProductImage = data.url;
    addMessage("Image capturee et sauvegardee.", "success");
  } catch (err) {
    addMessage("Image non uploadee. Mode offline.", "warning");
  }
}

async function toggleVideo() {
  if (!media.stream) await startCamera();
  if (!media.stream) return;
  if (state.recording) {
    const blob = await media.stopVideo();
    state.recording = false;
    els.recordVideoBtn.textContent = "VID";
    const preview = document.getElementById("videoPlayback");
    preview.src = URL.createObjectURL(blob);
    preview.style.display = "block";
    try {
      await api.uploadFile(blob);
      addMessage("Video sauvegardee.", "success");
    } catch (err) {
      addMessage("Video non uploadee.", "warning");
    }
  } else {
    await media.startVideo();
    state.recording = true;
    els.recordVideoBtn.textContent = "STOP";
    addMessage("Enregistrement video demarre.", "success");
  }
}

async function toggleAudio() {
  if (state.recordingAudio) {
    const blob = await media.stopAudio();
    state.recordingAudio = false;
    els.recordAudioBtn.textContent = "MIC";
    const preview = document.getElementById("audioPlayback");
    preview.src = URL.createObjectURL(blob);
    preview.style.display = "block";
    try {
      await api.uploadFile(blob);
      addMessage("Audio sauvegarde.", "success");
    } catch (err) {
      addMessage("Audio non uploade.", "warning");
    }
  } else {
    await media.startAudio();
    state.recordingAudio = true;
    els.recordAudioBtn.textContent = "STOP";
    addMessage("Enregistrement audio demarre.", "success");
  }
}

async function runDetection() {
  if (!media.stream) await startCamera();
  if (!media.stream) return;
  addMessage("Analyse de l'image en cours...", "warning");
  const predictions = await detection.detect();
  const canvas = document.getElementById("detectionCanvas");
  const ctx = canvas.getContext("2d");
  const video = document.getElementById("cameraFeed");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (predictions.length) {
    predictions.forEach((p) => {
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 3;
      ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]);
      ctx.fillStyle = "#00ff88";
      ctx.fillText(`${p.class} ${Math.round(p.score * 100)}%`, p.bbox[0], p.bbox[1] - 5);
    });
    addMessage(`${predictions.length} objet(s) detecte(s): ${predictions.map((p) => p.class).join(", ")}.`, "success");
  } else {
    addMessage("Aucun objet detecte.", "warning");
  }
}

function voiceInput() {
  const fallback = state.mode === "sale" ? "2 euros 50" : "12";
  addUserMessage(fallback);
  applyEntry(fallback);
}

function createUnknown() {
  addMessage("Je ne suis pas certain.", "warning");
  addMessage("Montrez le code-barres, tournez l'etiquette, dites la reference ou creez un nouveau produit.");
  setMode("catalog");
}

function exportSession() {
  const payload = core.exportPayload(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `acimcaisse-session-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  addMessage("Session exportee en JSON.", "success");
}

function resetSession() {
  const fresh = core.createState();
  Object.keys(state).forEach((key) => {
    if (key !== "products" && key !== "dbProducts" && key !== "user") delete state[key];
  });
  Object.assign(state, fresh);
  resetProductContext();
  addMessage("Nouvelle session locale.");
  addMessage(`Produit probable: ${currentProduct().name}.`);
  addMessage(nextPrompt(currentProduct()), "warning");
  renderShell();
}

function queueSync(table, recordId, action, payload) {
  if (!navigator.onLine) {
    const queue = JSON.parse(localStorage.getItem(localKey) || "[]");
    queue.push({ table, recordId, action, payload, createdAt: new Date().toISOString() });
    localStorage.setItem(localKey, JSON.stringify(queue));
    return;
  }
  api.syncQueue({ client_id: "web-1", table_name: table, record_id: recordId, action, payload }).catch(() => {
    const queue = JSON.parse(localStorage.getItem(localKey) || "[]");
    queue.push({ table, recordId, action, payload, createdAt: new Date().toISOString() });
    localStorage.setItem(localKey, JSON.stringify(queue));
  });
}

async function syncLocalQueue() {
  const queue = JSON.parse(localStorage.getItem(localKey) || "[]");
  if (!queue.length) return;
  for (const item of queue) {
    try {
      await api.syncQueue({ ...item, client_id: "web-1" });
    } catch (err) {
      continue;
    }
  }
  localStorage.setItem(localKey, "[]");
  addMessage("Sync offline terminee.", "success");
}

async function handleLogin(event) {
  event.preventDefault();
  const pin = els.pinInput.value;
  try {
    const data = await api.login("admin", pin);
    state.user = data;
    showApp();
    addMessage(`Bienvenue ${data.username}.`);
    await loadProducts();
  } catch (err) {
    els.loginError.textContent = "PIN incorrect.";
  }
}

function showApp() {
  els.loginScreen.style.display = "none";
  els.appShell.style.display = "grid";
}

async function loadProducts() {
  try {
    const data = await api.getProducts();
    state.dbProducts = data.products || [];
  } catch (err) {
    if (err.message.includes("401")) {
      api.token = null;
      localStorage.removeItem("acim-token");
      showLogin();
      return;
    }
    addMessage("Mode offline : pas de produits charges.", "warning");
  }
  renderShell();
}

function showLogin() {
  els.loginScreen.style.display = "grid";
  els.appShell.style.display = "none";
}

async function handleScrape(event) {
  event.preventDefault();
  const url = els.scrapeUrl.value;
  if (!url) return;
  addMessage(`Scraping de ${url}...`, "warning");
  try {
    const data = await api.scrape(url);
    els.scrapeResults.innerHTML = "";
    (data.results || []).slice(0, 8).forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.slice(0, 120);
      els.scrapeResults.appendChild(li);
    });
    addMessage(`${data.results.length} elements extraits.`, "success");
  } catch (err) {
    addMessage("Scraping echoue. CORS ou site bloque.", "warning");
  }
}

function updateOnlineStatus() {
  state.online = navigator.onLine;
  els.syncText.textContent = state.online ? "En ligne" : "Hors ligne";
  els.syncDot.style.background = state.online ? "var(--accent)" : "var(--amber)";
  if (state.online) syncLocalQueue();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  document.getElementById("detectBtn").addEventListener("click", runDetection);
  els.startCameraBtn.addEventListener("click", startCamera);
  els.captureBtn.addEventListener("click", captureImage);
  els.recordVideoBtn.addEventListener("click", toggleVideo);
  els.recordAudioBtn.addEventListener("click", toggleAudio);
  els.rotateBtn.addEventListener("click", rotateProduct);
  els.voiceBtn.addEventListener("click", voiceInput);
  els.unknownBtn.addEventListener("click", createUnknown);
  els.exportBtn.addEventListener("click", exportSession);
  els.resetBtn.addEventListener("click", resetSession);
  els.quickEntry.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = els.quickInput.value.trim();
    if (!text) return;
    addUserMessage(text);
    applyEntry(text);
    els.quickInput.value = "";
  });
  els.scrapeForm.addEventListener("submit", handleScrape);
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
}

function init() {
  if (api.token) {
    showApp();
    loadProducts();
  }
  bindEvents();
  resetProductContext();
  renderShell();
  updateOnlineStatus();
  if (!state.messages.length) {
    addMessage("Nouveau ticket.");
    addMessage(`Produit probable: ${currentProduct().name}.`);
    addMessage(nextPrompt(currentProduct()), "warning");
  }
}

init();
