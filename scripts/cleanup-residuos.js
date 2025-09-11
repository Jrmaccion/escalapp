#!/usr/bin/env node
// scripts/cleanup-residuos.js - Eliminar archivos residuales del proyecto

const fs = require('fs');
const path = require('path');

console.log('🧹 Limpiando residuos del proyecto PadelRise...\n');

const residuosAEliminar = [
  // SQLite innecesario (schema usa PostgreSQL)
  'prisma/prisma/dev.db',
  'prisma/dev.db',
  
  // Archivos .bak de migraciones
  'prisma/migrations/20250905230731_round_add_updated_at/migration.sql.bak',
  
  // Otros archivos temporales comunes
  '.next',
  'node_modules/.cache',
  '*.log',
  '.env.local',
  '.vercel',
  'tsconfig.tsbuildinfo'
];

const directoriosAEliminar = [
  'prisma/prisma'  // Directorio SQLite completo
];

let archivosEliminados = 0;
let directoriosEliminados = 0;

// Función helper para eliminar archivo si existe
function eliminarSiExiste(rutaArchivo) {
  if (fs.existsSync(rutaArchivo)) {
    try {
      fs.unlinkSync(rutaArchivo);
      console.log(`✅ Eliminado: ${rutaArchivo}`);
      archivosEliminados++;
    } catch (error) {
      console.log(`❌ Error eliminando ${rutaArchivo}: ${error.message}`);
    }
  } else {
    console.log(`⚪ No encontrado: ${rutaArchivo}`);
  }
}

// Función helper para eliminar directorio recursivamente
function eliminarDirectorioRecursivo(rutaDir) {
  if (fs.existsSync(rutaDir)) {
    try {
      fs.rmSync(rutaDir, { recursive: true, force: true });
      console.log(`✅ Directorio eliminado: ${rutaDir}`);
      directoriosEliminados++;
    } catch (error) {
      console.log(`❌ Error eliminando directorio ${rutaDir}: ${error.message}`);
    }
  } else {
    console.log(`⚪ Directorio no encontrado: ${rutaDir}`);
  }
}

// Eliminar archivos residuales
console.log('📄 Eliminando archivos residuales...');
residuosAEliminar.forEach(archivo => {
  eliminarSiExiste(archivo);
});

console.log('\n📁 Eliminando directorios residuales...');
directoriosAEliminar.forEach(directorio => {
  eliminarDirectorioRecursivo(directorio);
});

// Buscar y eliminar más archivos .bak en migraciones
console.log('\n🔍 Buscando archivos .bak adicionales en migraciones...');
const migrationDir = 'prisma/migrations';
if (fs.existsSync(migrationDir)) {
  const migrationFolders = fs.readdirSync(migrationDir);
  migrationFolders.forEach(folder => {
    const folderPath = path.join(migrationDir, folder);
    if (fs.statSync(folderPath).isDirectory()) {
      const files = fs.readdirSync(folderPath);
      files.forEach(file => {
        if (file.endsWith('.bak')) {
          const bakPath = path.join(folderPath, file);
          eliminarSiExiste(bakPath);
        }
      });
    }
  });
}

// Resumen
console.log('\n📊 Resumen de limpieza:');
console.log(`   Archivos eliminados: ${archivosEliminados}`);
console.log(`   Directorios eliminados: ${directoriosEliminados}`);

if (archivosEliminados > 0 || directoriosEliminados > 0) {
  console.log('\n✨ ¡Limpieza completada! Tu proyecto PadelRise está más limpio.');
} else {
  console.log('\n🎉 No había residuos que limpiar. Tu proyecto ya está limpio.');
}

console.log('\n💡 Para ejecutar este script: node scripts/cleanup-residuos.js');