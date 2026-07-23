@echo off
chcp 65001 >nul 2>&1
title AcimCaisse - Reparation rapide
echo.
echo   =============================================
echo     AcimCaisse - Reparation rapide
echo   =============================================
echo.
echo   Ce script corrige:
echo     - Page blanche (double injection dans main.dart.js)
echo     - SyntaxError: Invalid or unexpected token
echo.
echo   Aucune reinstallation necessaire.
echo.
pause
echo.

node -e "var fs=require('fs');var paths=['C:\\Users\\%USERNAME%\\Desktop\\AcimCaisse\\resources\\app\\www\\main.dart.js','C:\\Users\\user\\Desktop\\AcimCaisse\\resources\\app\\www\\main.dart.js'];var found=false;for(var i=0;i<paths.length;i++){try{var c=fs.readFileSync(paths[i],'utf8');var markers=[];var pos=0;while(true){var idx=c.indexOf('// ─── AcimCaisse',pos);if(idx<0)break;markers.push(idx);pos=idx+20;}console.log('  Trouve '+markers.length+' bloc(s) AcimCaisse dans '+paths[i]);if(markers.length>1){console.log('  DOUBLE INJECTION detectee -> suppression des blocs en double...');for(var mi=markers.length-1;mi>=1;mi--){var start=markers[mi];var finIdx=c.indexOf('// ─── FIN AcimCaisse ───',start);if(finIdx>=0){c=c.substring(0,start)+c.substring(finIdx+'// ─── FIN AcimCaisse ───'.length);console.log('  Bloc #'+(mi+1)+' supprime (FIN marker)');}else{var closeIdx=c.indexOf('})()',start);if(closeIdx>=0&&closeIdx<c.length-10){c=c.substring(0,start)+c.substring(closeIdx+4);console.log('  Bloc #'+(mi+1)+' supprime (})());}}}fs.writeFileSync(paths[i],c,'utf8');console.log('  main.dart.js repare ('+Math.round(c.length/1024)+' KB)');}else if(markers.length===1){console.log('  Injection unique OK, pas de probleme.');}found=true;break;}catch(e){console.log('  '+paths[i]+' non trouve ou erreur: '+e.message);}}if(!found){console.log('  Aucun main.dart.js trouve. Verifiez le chemin.');}"
echo.
echo   Reparation termine!
echo.
echo   Redemarrez AcimCaisse.exe pour verifier.
echo.
pause
