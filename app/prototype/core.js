(function initCore(root) {
  const modes = [
    {
      id: "sale",
      label: "Vente",
      icon: "VE",
      detail: "Ticket client",
      title: "Vente",
      status: "Ticket ouvert",
      summary: "Ticket",
      listTitle: "Lignes",
      empty: "Aucun article",
    },
    {
      id: "inventory",
      label: "Inventaire",
      icon: "IN",
      detail: "Comptage stock",
      title: "Inventaire",
      status: "Comptage en cours",
      summary: "Articles comptes",
      listTitle: "Comptage",
      empty: "Rien compte",
    },
    {
      id: "receiving",
      label: "Reception",
      icon: "RE",
      detail: "Entree fournisseur",
      title: "Reception livraison",
      status: "Bon brouillon",
      summary: "Reception",
      listTitle: "Entrees",
      empty: "Aucune entree",
    },
    {
      id: "catalog",
      label: "Catalogue",
      icon: "CA",
      detail: "Fiche produit",
      title: "Creation catalogue",
      status: "Fiche ouverte",
      summary: "Fiches",
      listTitle: "Produits",
      empty: "Aucune fiche",
    },
    {
      id: "stock_fix",
      label: "Correction",
      icon: "CO",
      detail: "Ajustement stock",
      title: "Correction stock",
      status: "Correction active",
      summary: "Corrections",
      empty: "Aucune correction",
      listTitle: "Ajustements",
    },
  ];

  const products = [
    {
      id: "p-yogurt",
      name: "Yaourt X nature 4x125g",
      short: "Yaourt X",
      barcode: "3770001250012",
      price: null,
      confidence: 86,
    },
    {
      id: "p-rice",
      name: "Riz long grain 1kg",
      short: "Riz 1kg",
      barcode: "3770001250029",
      price: 450,
      confidence: 92,
    },
    {
      id: "p-juice",
      name: "Jus mangue 1L",
      short: "Jus 1L",
      barcode: "",
      price: 300,
      confidence: 74,
    },
  ];

  function createEntries() {
    return {
      sale: [],
      inventory: [],
      receiving: [],
      catalog: [],
      stock_fix: [],
    };
  }

  function createState() {
    return {
      mode: "sale",
      productIndex: 0,
      barcodeFound: false,
      currentPrice: null,
      entries: createEntries(),
      messages: [],
    };
  }

  function money(cents) {
    return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
  }

  function parseNumberFromText(text) {
    const normalized = String(text).toLowerCase().replace(",", ".");
    const euroParts = normalized.match(/(\d+)\s*(euros?|eur)\s*(\d{1,2})?)/);
    if (euroParts) {
      const euros = Number(euroParts[1]);
      const cents = euroParts[3] ? Number(euroParts[3].padEnd(2, "0")) : 0;
      return euros * 100 + cents;
    }

    const match = normalized.match(/\d+(\.\d+)?/);
    if (!match) {
      return null;
    }
    return Math.round(Number(match[0]) * 100);
  }

  // Parse quantity with decimals support (e.g., "0.5", "2.3 kg", "1,5")
  function quantityFromText(text, fallback = 1) {
    const normalized = String(text).toLowerCase().replace(",", ".");
    
    // Try to extract decimal number directly
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|u|pcs?|piece)?/i);
    
    if (match) {
      const quantity = Number(match[1]);
      return Math.max(0, quantity);
    }
    
    // Fallback to old method for backwards compatibility
    const amount = parseNumberFromText(text);
    if (amount == null) {
      return fallback;
    }
    return Math.max(0, amount / 100);
  }

  // Format quantity with optional unit
  function formatQuantity(quantity, unitType) {
    if (!unitType) {
      return `${quantity % 1 === 0 ? quantity : quantity.toFixed(3)}`;
    }
    return `${quantity % 1 === 0 ? quantity : quantity.toFixed(3)} ${unitType}`;
  }

  function nextPrompt({ mode, barcodeFound, currentPrice, product }) {
    if (!barcodeFound && product.barcode) {
      return "Code-barres non trouve. Tournez legerement le produit.";
    }
    if (currentPrice == null && ["sale", "catalog"].includes(mode)) {
      return "Prix inconnu. Dites le prix ou entrez-le.";
    }
    if (mode === "inventory") {
      return "Quantite en rayon ?";
    }
    if (mode === "receiving") {
      return "Quantite recue ?";
    }
    if (mode === "stock_fix") {
      return "Nouvelle quantite ?";
    }
    return "Produit pret.";
  }

  function createEntry({ mode, product, text, currentPrice, barcodeFound }) {
    const amount = parseNumberFromText(text);
    const quantity = quantityFromText(text, 1);
    const unitType = product.unit_type || null;

    if (mode === "sale") {
      const price = currentPrice == null ? amount : currentPrice;
      if (price == null) {
        return { error: "missing_price" };
      }
      return {
        entry: {
          name: product.name,
          note: barcodeFound ? "Code confirme" : "Ajout assiste",
          value: money(price),
          amount: price,
          quantity: quantity,
          unitType: unitType,
        },
        currentPrice: price,
        message: "Ajout au ticket.",
      };
    }

    if (mode === "inventory") {
      return {
        entry: {
          name: product.name,
          note: "Comptage rayon",
          value: formatQuantity(quantity, unitType),
          amount: quantity,
          quantity: quantity,
          unitType: unitType,
        },
        message: `Stock compte: ${formatQuantity(quantity, unitType)}.`,
      };
    }

    if (mode === "receiving") {
      return {
        entry: {
          name: product.name,
          note: "Entree fournisseur",
          value: `+${formatQuantity(quantity, unitType)}`,
          amount: quantity,
          quantity: quantity,
          unitType: unitType,
        },
        message: `Entree livraison: ${formatQuantity(quantity, unitType)}.`,
      };
    }

    if (mode === "catalog") {
      const price = currentPrice == null && amount != null ? amount : currentPrice;
      return {
        entry: {
          name: text && amount == null ? text : product.name,
          note: price == null ? "Prix a completer" : money(price),
          value: barcodeFound ? "Code" : "Manuel",
          amount: 1,
          quantity: quantity,
          unitType: unitType,
        },
        currentPrice: price,
        message: "Fiche catalogue creee.",
      };
    }

    if (mode === "stock_fix") {
      return {
        entry: {
          name: product.name,
          note: "Nouvelle quantite",
          value: formatQuantity(quantity, unitType),
          amount: quantity,
          quantity: quantity,
          unitType: unitType,
        },
        message: `Correction enregistree: ${formatQuantity(quantity, unitType)}.`,
      };
    }

    return { error: "unknown_mode" };
  }

  function saleTotal(entries) {
    return entries.sale.reduce((sum, entry) => sum + entry.amount, 0);
  }

  function exportPayload(state) {
    return {
      exportedAt: new Date().toISOString(),
      activeMode: state.mode,
      currentProductIndex: state.productIndex,
      entries: state.entries,
      totals: {
        saleCents: saleTotal(state.entries),
      },
    };
  }

  const api = {
    modes,
    products,
    createState,
    createEntries,
    money,
    parseNumberFromText,
    quantityFromText,
    formatQuantity,
    nextPrompt,
    createEntry,
    saleTotal,
    exportPayload,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SmartInventoryCore = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
