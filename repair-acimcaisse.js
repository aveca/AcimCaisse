// AcimCaisse - Reparation rapide de main.dart.js
// Corrige: page blanche, SyntaxError, double injection

var fs = require("fs");
var path = require("path");
var os = require("os");

var DATA = path.join(os.homedir(), "Desktop", "AcimCaisse");
var dartPaths = [
  path.join(DATA, "resources", "app", "www", "main.dart.js"),
  path.join(DATA, "www", "main.dart.js")
];

console.log("");
console.log("  =============================================");
console.log("    AcimCaisse - Reparation rapide");
console.log("  =============================================");
console.log("");

var found = false;
for (var i = 0; i < dartPaths.length; i++) {
  var dartPath = dartPaths[i];
  if (!fs.existsSync(dartPath)) {
    console.log("  " + dartPath + " -> non trouve");
    continue;
  }

  found = true;
  console.log("  Fichier: " + dartPath);

  var content = fs.readFileSync(dartPath, "utf8");
  var originalSize = Math.round(content.length / 1024);

  // 1. Trouver tous les blocs AcimCaisse
  var markers = [];
  var pos = 0;
  while (true) {
    var idx = content.indexOf("// ─── AcimCaisse", pos);
    if (idx < 0) break;
    markers.push(idx);
    pos = idx + 20;
  }
  console.log("  Blocs AcimCaisse: " + markers.length);

  // 2. Trouver tous les FIN markers
  var finMarkers = [];
  pos = 0;
  while (true) {
    var finIdx = content.indexOf("// ─── FIN AcimCaisse ───", pos);
    if (finIdx < 0) break;
    finMarkers.push(finIdx);
    pos = finIdx + 30;
  }
  console.log("  FIN markers: " + finMarkers.length);

  // 3. Fix: garder 1 bloc + 1 FIN marker, supprimer les doublons
  var needsRepair = false;

  if (markers.length > 1) {
    needsRepair = true;
    console.log("  !! DOUBLE INJECTION -> repair");
    // Garder le 1er bloc, supprimer les suivants
    for (var mi = markers.length - 1; mi >= 1; mi--) {
      var start = markers[mi];
      var finEnd = content.indexOf("// ─── FIN AcimCaisse ───", start);
      if (finEnd >= 0) {
        var end = finEnd + "// ─── FIN AcimCaisse ───".length;
        content = content.substring(0, start) + content.substring(end);
        console.log("  -> Bloc #" + (mi+1) + " supprime");
      }
    }
  }

  if (finMarkers.length > 1) {
    needsRepair = true;
    console.log("  !! FIN markers en double -> cleanup");
    // Garder seulement le 1er FIN marker
    // Supprimer les FIN markers en trop
    var firstFin = content.indexOf("// ─── FIN AcimCaisse ───");
    var afterFirstFin = firstFin + "// ─── FIN AcimCaisse ───".length;
    var rest = content.substring(afterFirstFin);
    // Supprimer tous les FIN markers dans le rest
    rest = rest.replace("// ─── FIN AcimCaisse ───", "");
    // Nettoyer les lignes vides en trop
    while (rest.indexOf("\n\n\n") >= 0) rest = rest.replace("\n\n\n", "\n\n");
    content = content.substring(0, afterFirstFin) + rest;
  }

  if (!needsRepair) {
    console.log("  Fichier OK, pas de probleme detecte.");
    break;
  }

  // 4. Sauvegarder
  fs.writeFileSync(dartPath, content, "utf8");
  var newSize = Math.round(content.length / 1024);
  console.log("  main.dart.js repare: " + originalSize + " KB -> " + newSize + " KB");

  // 5. Verification syntaxe
  try {
    new Function(content);
    console.log("  Syntaxe: OK");
  } catch (syntaxErr) {
    console.log("  !! Syntaxe encore invalide: " + syntaxErr.message);
    // Nettoyage complet: supprimer tout le bloc AcimCaisse
    var firstMarker = content.indexOf("// ─── AcimCaisse");
    var lastFin = content.lastIndexOf("// ─── FIN AcimCaisse ───");
    if (firstMarker >= 0 && lastFin >= 0) {
      content = content.substring(0, firstMarker) + content.substring(lastFin + "// ─── FIN AcimCaisse ───".length);
      // Nettoyer
      while (content.indexOf("\n\n\n") >= 0) content = content.replace("\n\n\n", "\n\n");
      fs.writeFileSync(dartPath, content, "utf8");
      console.log("  -> Nettoyage complet, bloc AcimCaisse entierement supprime");
      try {
        new Function(content);
        console.log("  Syntaxe: OK (sans injection)");
      } catch (e2) {
        console.log("  !! Fichier encore cassé: " + e2.message.slice(0, 80));
      }
    }
  }
  break;
}

if (!found) {
  console.log("  Aucun main.dart.js trouve dans:");
  for (var i = 0; i < dartPaths.length; i++) console.log("    " + dartPaths[i]);
  console.log("  Verifiez que AcimCaisse est installe sur le Bureau.");
}

console.log("");
console.log("  Redemarrez AcimCaisse.exe pour verifier.");
console.log("");
