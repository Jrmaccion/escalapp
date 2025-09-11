// scripts/fix-imports.js
const fs = require('fs');
const path = require('path');

function checkAndFixImports() {
  console.log('🔍 Verificando archivos con errores de importación...\n');

  // 1. Verificar lib/api/comodin.ts
  const comodinPath = path.join(process.cwd(), 'lib/api/comodin.ts');
  
  if (fs.existsSync(comodinPath)) {
    const comodinContent = fs.readFileSync(comodinPath, 'utf8');
    
    if (!comodinContent.includes('export') || !comodinContent.includes('comodinApi')) {
      console.log('❌ lib/api/comodin.ts no exporta comodinApi');
      console.log('💡 Necesitas añadir las exportaciones necesarias\n');
    } else {
      console.log('✅ lib/api/comodin.ts parece correcto\n');
    }
  } else {
    console.log('❌ No se encontró lib/api/comodin.ts\n');
  }

  // 2. Verificar lib/rounds.ts
  const roundsPath = path.join(process.cwd(), 'lib/rounds.ts');
  
  if (fs.existsSync(roundsPath)) {
    const roundsContent = fs.readFileSync(roundsPath, 'utf8');
    
    const missingExports = [];
    
    if (!roundsContent.includes('export') || !roundsContent.includes('generateNextRoundFromMovements')) {
      missingExports.push('generateNextRoundFromMovements');
    }
    
    if (!roundsContent.includes('GROUP_SIZE')) {
      missingExports.push('GROUP_SIZE');
    }
    
    if (missingExports.length > 0) {
      console.log('❌ lib/rounds.ts no exporta:', missingExports.join(', '));
      console.log('💡 Necesitas añadir estas exportaciones\n');
    } else {
      console.log('✅ lib/rounds.ts parece correcto\n');
    }
  } else {
    console.log('❌ No se encontró lib/rounds.ts\n');
  }

  // 3. Mostrar archivos que necesitan las importaciones
  console.log('📝 Archivos que necesitan estas importaciones:');
  console.log('- components/admin/ComodinManagement.tsx');
  console.log('- components/player/UseComodinButton.tsx');
  console.log('- app/api/rounds/[id]/generate-next/route.ts');
  console.log('- app/api/tournaments/route.ts\n');

  console.log('🚀 Para corregir:');
  console.log('1. Añade las exportaciones faltantes en lib/api/comodin.ts');
  console.log('2. Añade las exportaciones faltantes en lib/rounds.ts');
  console.log('3. Ejecuta npm run build para verificar\n');
}

// Función para crear un archivo de backup antes de modificar
function createBackup(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + '.backup.' + Date.now();
    fs.copyFileSync(filePath, backupPath);
    console.log(`📦 Backup creado: ${backupPath}`);
    return backupPath;
  }
  return null;
}

// Ejecutar verificación
checkAndFixImports();

module.exports = { checkAndFixImports, createBackup };