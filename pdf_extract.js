// Pont d'extraction de texte PDF pour AcimCaisse (utilise pdf.js, Apache-2.0).
// Expose window.acimExtractPdfText(uint8array) -> Promise<string>.
// v7: OCR Tesseract.js + pre-parseur JS pour restructurer les lignes produit
//     afin que le parseur Dart (parse_invoice_text.dart) puisse les traiter.
(function(){
function getLib(){return window.pdfjsLib||(window['pdfjs-dist/build/pdf'])}

window.acimExtractPdfText=async function(bytes){
const pdfjsLib=getLib();
if(!pdfjsLib)throw new Error('pdf.js non charge');
pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js';
const doc=await pdfjsLib.getDocument({data:bytes}).promise;
let out='';

for(let p=1;p<=doc.numPages;p++){
const page=await doc.getPage(p);
const content=await page.getTextContent();
const textItems=content.items.filter(i=>i.str&&i.str.trim());

if(textItems.length>3){
out+=extractTextPdf(content);
}else{
try{
console.log('[AcimCaisse] PDF scanne, OCR page '+p+'...');
const ocrText=await ocrPage(page);
if(ocrText&&ocrText.trim()){
console.log('[AcimCaisse] OCR brut: '+ocrText.split('\n').filter(l=>l.trim()).length+' lignes');
out+=ocrText;
}else{
console.log('[AcimCaisse] OCR: texte vide');
}
}catch(e){
console.error('[AcimCaisse] OCR echoue: '+e.message);
}
}
}

out=preParseInvoiceText(out);
return out;
};

function extractTextPdf(content){
const rows=[];let current=null;
for(const item of content.items){
const y=item.transform[5];const x=item.transform[4];
if(!current||Math.abs(y-current.y)>3){current={y:y,parts:[]};rows.push(current)}
current.parts.push({x:x,str:item.str})}
let out='';
for(const row of rows){row.parts.sort((a,b)=>a.x-b.x);
const line=row.parts.map((p)=>p.str).join(' ').replace(/\s+/g,' ').trim();
if(line)out+=line+'\n'}
return out;
}

async function ocrPage(page){
if(!window.Tesseract){
console.log('[AcimCaisse] Chargement Tesseract.js v5...');
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
document.head.appendChild(s);
await new Promise((resolve,reject)=>{
s.onload=resolve;
s.onerror=()=>reject(new Error('Tesseract.js non chargeable'));
});
}
const viewport=page.getViewport({scale:3});
const canvas=document.createElement('canvas');
canvas.width=viewport.width;canvas.height=viewport.height;
const ctx=canvas.getContext('2d');
ctx.fillStyle='#FFFFFF';
ctx.fillRect(0,0,canvas.width,canvas.height);
await page.render({canvasContext:ctx,viewport:viewport}).promise;
enhanceContrast(canvas);

let text='';
try{
const worker=await Tesseract.createWorker('fra',1,{logger:function(){}});
await worker.setParameters({tessedit_pageseg_mode:'6'});
const result=await worker.recognize(canvas);
text=result.data.text||'';
await worker.terminate();
console.log('[AcimCaisse] OCR worker OK');
}catch(e){
console.log('[AcimCaisse] Worker echoue, fallback...');
try{
const result=await Tesseract.recognize(canvas,'fra',{logger:function(){}});
text=result.data.text||'';
}catch(e2){console.error('[AcimCaisse] OCR echoue: '+e2.message);}
}
return text;
}

function enhanceContrast(canvas){
try{
const ctx=canvas.getContext('2d');
const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
const d=imgData.data;
let min=255,max=0;
for(let i=0;i<d.length;i+=4){
const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
if(gray<min)min=gray;if(gray>max)max=gray;
}
const range=max-min||1;
for(let i=0;i<d.length;i+=4){
const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
const v=((gray-min)/range)*255;
d[i]=d[i+1]=d[i+2]=255*Math.pow(v/255,0.85);
d[i+3]=255;
}
ctx.putImageData(imgData,0,0);
}catch(e){}
}

// ═══════════════════════════════════════════════════════════
// PRE-PARSEUR : restructure le texte pour le parseur Dart
// ═══════════════════════════════════════════════════════════

function preParseInvoiceText(text){
if(!text||!text.trim())return text;
text=correctOcr(text);
var lines=text.split('\n');
var productLineCount=0;
for(var i=0;i<lines.length;i++){
if(/^\d{3}\s+\S/.test(lines[i].trim()))productLineCount++;
}
if(productLineCount>=2){
console.log('[AcimCaisse] '+productLineCount+' lignes produit, pre-parse...');
var result=restructureProductLines(lines);
var cnt=result.split('\n').filter(function(l){return l.trim();}).length;
console.log('[AcimCaisse] Pre-parse: '+cnt+' produits');
return result;
}
return text;
}

function restructureProductLines(lines){
var products=[];
for(var i=0;i<lines.length;i++){
var line=lines[i].trim();
if(!line)continue;
var m=line.match(/^(\d{3})\s+(\S+)\s+(.+)$/);
if(!m)continue;
var lineNo=parseInt(m[1]);
if(lineNo>999||lineNo<1)continue;
var code=m[2].replace(/[|\\\/]/g,'');
if(!code)continue;
var rest=m[3].trim();
var lower=line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
var skip=false;
var sw=['total','tva','facture','conditions','escompte','acompte',
'net a payer','port ht','montant ht','base ht','designation'];
for(var w=0;w<sw.length;w++){if(lower.indexOf(sw[w])>=0){skip=true;break;}}
if(skip)continue;
var extracted=extractProductInfo(code,rest);
if(extracted)products.push(extracted);
}
if(products.length===0)return lines.join('\n');
return products.join('\n');
}

function extractProductInfo(code,rest){
var tokens=rest.split(/\s+/);

// Fix OCR number errors: "7-000" -> "7.000"
for(var i=0;i<tokens.length;i++){
tokens[i]=tokens[i].replace(/^(\d+)[-:;](\d{2,3})$/,'$1.$2');
}

// Merge split decimals: "161 46" -> "161,46"
var merged=[];
for(var i=0;i<tokens.length;i++){
var cur=parseNum(tokens[i]);
if(cur!==null&&i+1<tokens.length){
var next=parseNum(tokens[i+1]);
if(next!==null&&cur===Math.floor(cur)&&next<100&&next>=0){
if(tokens[i+1].length<=2&&tokens[i+1].replace(/[.,]/g,'').length<=2){
var nn=(i+2<tokens.length)?parseNum(tokens[i+2]):null;
if(nn===null||nn>1000){merged.push(tokens[i]+','+tokens[i+1]);i++;continue;}
}
}
}
merged.push(tokens[i]);
}
tokens=merged;

// Collect all numbers
var nums=[];
for(var i=0;i<tokens.length;i++){
var v=parseNum(tokens[i]);
if(v!==null)nums.push({index:i,value:v});
}
if(nums.length<2)return null;

var lineTotal=nums[nums.length-1].value;
var unitPrice=null;var qty=null;

if(lineTotal>0){
// Method A: find price that divides total cleanly
for(var k=nums.length-2;k>=0;k--){
var v=nums[k].value;
if(v===0)continue;
// Skip likely remise (10% discount = 10.00 near end)
if(v>=9.5&&v<=10.5&&k>=nums.length-3)continue;
if(v>=0.50&&v<=500){
var cq=lineTotal/v;
if(cq>0&&cq<=10000){
var r=Math.round(cq);
if(Math.abs(cq-r)<0.5){unitPrice=v;qty=r;break;}
var rd=Math.round(cq*1000)/1000;
if(Math.abs(cq-rd)<0.05){unitPrice=v;qty=rd;break;}
}
}
}

// Refinement: swap price/qty if "price" is integer and "qty" is not
// This catches cases like: found price=40 (actually qty in kg), qty=28 (computed)
// The real answer is: qty=40kg, price=27.90
if(unitPrice!==null&&qty!==null&&unitPrice>qty){
var isPriceInt=(unitPrice===Math.floor(unitPrice));
var swappedResult=lineTotal/unitPrice;
var isSwappedInt=(swappedResult===Math.floor(swappedResult));
// Only swap if: price is integer (likely a qty), AND swapped result is NOT integer (likely a real price)
if(isPriceInt&&!isSwappedInt){
var altQty=unitPrice;
var altPrice=Math.round((lineTotal/altQty)*100)/100;
if(altPrice>=0.10&&altPrice<=500&&altPrice<altQty){
qty=altQty;unitPrice=altPrice;
}
}
}

// Method B: find qty as integer, compute price
if(unitPrice===null){
for(var k=nums.length-3;k>=0;k--){
var v=nums[k].value;
if(v>=1&&v<=10000&&v===Math.floor(v)){
var cp=lineTotal/v;
if(cp>=0.10&&cp<=500){qty=v;unitPrice=Math.round(cp*100)/100;break;}
}
}
}
}

// Method C: zero total or last resort
if(unitPrice===null){
if(lineTotal===0){
for(var k=nums.length-2;k>=0;k--){
if(nums[k].value>=1&&nums[k].value<=10000){qty=nums[k].value;unitPrice=0;break;}
}
}else{
for(var k=0;k<nums.length-1;k++){
if(nums[k].value>=1&&nums[k].value<=10000){
qty=nums[k].value;unitPrice=Math.round((lineTotal/qty)*100)/100;break;
}
}
}
}
if(unitPrice===null||qty===null||qty<=0)return null;

// ── Extract and clean product name ──
var nameEndIdx=tokens.length;
for(var j=tokens.length-1;j>=0;j--){
if(parseNum(tokens[j])===null){nameEndIdx=j+1;break;}
if(j===0)nameEndIdx=0;
}
var nameTokens=tokens.slice(0,nameEndIdx);
var name=cleanName(nameTokens.join(' '));

// Normalisation finale: enlever chiffres isolés, unités, etc.
name=normalizeProductName(name);

if(name.length<2||!/[A-Za-z\u00C0-\u024F]/.test(name))return null;

var qtyStr=(qty===Math.floor(qty))?qty.toString():qty.toFixed(3);
var priceStr=unitPrice.toFixed(2).replace('.',',');
return 'R'+code+' '+name+' '+qtyStr+' '+priceStr;
}

// ─── Name cleaning ─────────────────────────────
function cleanName(raw){
var s=raw;
// 1) Remove weight+colisage: "300 grsx5", "600 gr X7", "0.800 kg X6", "10 kg"
//    CAREFUL: no greedy \d* at end (was eating next number!)
s=s.replace(/\b\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|L|l)[xX×]?\d*(?:\s+[xX×]\s*\d+)?/gi,'');
// 2) Remove "2 x 350 gr" patterns
s=s.replace(/\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|L|l)\b/gi,'');
// 3) Remove remaining unit words
s=s.replace(/\b(?:grs?|kg|g|ml|L|l)\b/gi,'');
// 4) Remove "2 x 350" (number x number)
s=s.replace(/\b\d+\s*[xX×]\s*\d+/g,'');
// 5) Remove "3x" (number x) and "x5" (x number) colisage tokens
s=s.replace(/\b\d+[xX×]/g,' ');
s=s.replace(/[xX×]\s*\d+/g,' ');
// 6) Remove "ns" (OCR artifact)
s=s.replace(/\bns\b/gi,'');
// 7) Remove remaining isolated numbers (keep if adjacent to letter like "A4")
s=s.replace(/\b\d+(?:[.,]\d+)?\b/g,function(match,offset,str){
var b=offset-1>=0?str.charAt(offset-1):'';
var a=offset+match.length<str.length?str.charAt(offset+match.length):'';
if(/[A-Za-z\u00C0-\u024F]/.test(b)||/[A-Za-z\u00C0-\u024F]/.test(a))return match;
return '';
});
// 8) Clean up punctuation (keep apostrophes for French like d'Oie)
s=s.replace(/%/g,' ');
s=s.replace(/[\[\](){}|\\\/]/g,' ');
s=s.replace(/\s+/g,' ').trim();
return s;
}

// ─── Normalisation produit (nettoyage final) ────
function normalizeProductName(raw){
if(!raw||typeof raw!=='string')return '';
var s=raw;
// Supprimer OCR parasites
s=s.replace(/[|\\{}=<>^~`#§¤°±]/g,' ');
// Supprimer poids/quantités : "4x125g", "6x150ml"
s=s.replace(/\b\d+(?:[.,]\d+)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi,' ');
s=s.replace(/\b\d+\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|l|cl)\b/gi,' ');
s=s.replace(/\b\d+(?:[.,]\d+)?\s*(?:grs?|kg|g|ml|cl|l|L)\b/gi,' ');
s=s.replace(/[xX×]\s*\d+/g,' ');
s=s.replace(/\b\d+(?:[.,]\d+)?\s*%/g,' ');
s=s.replace(/\b\d+[.,]\d{1,2}\s*(?:€|EUR|euro)\b/gi,' ');
// Parenthèses vides ou juste un chiffre
s=s.replace(/\(\s*\)/g,' ');
s=s.replace(/\(\s*\d+(?:[.,]\d+)?\s*\)/g,' ');
// Tirets
s=s.replace(/\s*[-–—]\s*/g,' ');
s=s.replace(/\s*\.\s*/g,' ');
// Chiffres isolés (pas A4, B12)
s=s.replace(/\b\d+(?:[.,]\d+)?\b/g,function(m,o,st){
var b=o>0?st.charAt(o-1):' ';
var a=o+m.length<st.length?st.charAt(o+m.length):' ';
if(/[A-Za-z\u00C0-\u024F]/.test(b)||/[A-Za-z\u00C0-\u024F]/.test(a))return m;
return ' ';
});
// Mots vides
var sw=['le','la','les','de','du','des','un','une','au','aux','et','en'];
var words=s.split(/\s+/);
var kept=[];
for(var w=0;w<words.length;w++){
if(words[w].length>2||/^[A-Z]{1,3}$/.test(words[w]))kept.push(words[w]);
}
s=kept.join(' ');
// Casse
s=s.toLowerCase().replace(/(?:^|\s)\S/g,function(c){return c.toUpperCase();});
s=s.replace(/\s+/g,' ').trim();
if(s.length<2&&raw.length>=2){
s=raw.replace(/[|\\{}=<>^~`#§¤°±]/g,' ').replace(/\s+/g,' ').trim();
s=s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
}
return s;
}

// ─── Parseur de nombre francais ─────────────────
function parseNum(token){
if(!token)return null;
var t=token.replace(/[€%]/g,'').trim();
t=t.replace(/[\u00A0\s]/g,'');
if(!t)return null;
if(!/^\d*[.,]?\d+$/.test(t))return null;
if(t.indexOf(',')>=0){
t=t.replace(/\./g,'');
t=t.replace(',','.');
}else if(t.indexOf('.')>=0){
var parts=t.split('.');
if(parts.length===2){
if(parts[1].length===3){
// "4.000" = 4.0 (3 decimal zeros) vs "1.200" = 1200 (thousands)
if(parts[1]==='000'){}else{t=t.replace('.','');}
}
// else "7.68" = decimal, keep as-is
}else if(parts.length>2){t=t.replace(/\./g,'');}
}
var result=parseFloat(t);
return isNaN(result)?null:result;
}

// ─── Corrections OCR ────────────────────────────
function correctOcr(text){
if(!text)return text;
var lines=text.split('\n');
for(var i=0;i<lines.length;i++){
lines[i]=fixNumbersInLine(fixCommonOcrErrors(lines[i]));
}
return lines.join('\n').replace(/\n{3,}/g,'\n\n');
}

function fixNumbersInLine(line){
// CRITICAL: Dart parser treats dots as thousand separators!
// "10.70" -> Dart reads 1070, must become "10,70"
return line.replace(/\b(\d[\d ]*)([.])(\d{1,2})\b/g,function(m,b,s,a){
return a.length<=2?b+','+a:m;
});
}

function fixCommonOcrErrors(line){
var f=[
[/\bQuanti[t7]e\b/gi,'Quantite'],
[/\bDe[s5]ignation\b/gi,'Designation'],
[/\bMontan[t7]\b/gi,'Montant'],
[/\bT\s*\.\s*V\s*\.\s*A\s*\./g,'T.V.A.'],
[/\bH\s*\.\s*T\s*\./g,'H.T.'],
[/\bT\s*\.\s*T\s*\.\s*C\s*\./g,'T.T.C.'],
[/\bPrix\s*unitaire\b/gi,'Prix unitaire'],
[/\bNet\s*[aà]\s*payer\b/gi,'Net a payer'],
];
for(var i=0;i<f.length;i++)line=line.replace(f[i][0],f[i][1]);
return line;
}

})();
