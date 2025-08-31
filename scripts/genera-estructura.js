// scripts/genera-estructura.js
// Genera un TXT con la jerarquía del proyecto, ignorando ruido común.
// Salida: estructura-clave.txt en la raíz del proyecto (formato con backslashes y prefijo "\").
// Uso: npm run estructura

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "estructura-clave.txt");

// Directorios a ignorar por nombre directo (top-level o en cualquier nivel)
const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".github",
  ".husky",
  ".next",
  ".vercel",
  ".turbo",
  ".cache",
  ".idea",
  ".vscode",
  "coverage",
  "dist",
  "build",
  "out",
  ".pnpm-store"
]);

// Rutas (subrutas) a ignorar por coincidencia dentro del path relativo
const IGNORE_PATH_SUBSTRINGS = [
  // Backup de migraciones SQLite antiguas
  path.join("prisma", "migrations_sqlite_backup")
];

// Patrones de archivos a ignorar
const IGNORE_FILE_PATTERNS = [
  /^\./,                         // Dotfiles: .env, .gitignore, .dockerignore, etc.
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,
  // Locks y logs
  /\.(lock|log)$/i,              // package-lock.json, yarn.lock, pnpm-lock.yaml, *.log
  // Source maps
  /\.map$/i,
  // Archivos grandes/binaros comunes que no aportan al análisis
  /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)$/i,
  /\.(mp4|mov|avi|mkv|mp3|wav|flac|m4a)$/i,
  /\.(zip|tar|gz|7z|rar)$/i,
  // Infra que no quieres en el listado clave
  /^Dockerfile$/i,
  /^docker-compose\.ya?ml$/i,
  /^nginx\.conf$/i,
  // Documentos generales
  /^README\.md$/i
];

// Tamaño máximo de archivo (evita listados accidentales de binarios enormes)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function isIgnoredDir(fullPath, name) {
  if (IGNORE_DIR_NAMES.has(name)) return true;
  const rel = path.relative(ROOT, fullPath);
  // Normaliza a separador del SO para comparar substrings
  const normalized = rel.split(path.sep).join(path.sep);
  return IGNORE_PATH_SUBSTRINGS.some(sub => normalized.includes(sub));
}

function isIgnoredFile(name) {
  return IGNORE_FILE_PATTERNS.some(re => re.test(name));
}

function toBackslashPath(fullPath) {
  const rel = path.relative(ROOT, fullPath);
  if (!rel) return ""; // evita línea vacía para el root
  const back = rel.split(path.sep).join("\\");
  return "\\" + back;
}

function walk(dir, base = "", collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Orden determinista: carpetas primero, luego archivos; alfabético
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, "en");
  });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relBack = toBackslashPath(full);

    if (entry.isDirectory()) {
      if (isIgnoredDir(full, entry.name)) continue;
      // Añadimos la carpeta al listado
      if (relBack) collector.push(relBack);
      walk(full, entry.name, collector);
      continue;
    }

    if (entry.isFile()) {
      if (isIgnoredFile(entry.name)) continue;
      try {
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_SIZE_BYTES) continue;
        if (relBack) collector.push(relBack);
      } catch {
        // Ignora errores de stat/permiso
      }
    }
    // symlinks y otros tipos se ignoran
  }
}

function main() {
  try {
    const lines = [];
    walk(ROOT, "", lines);

    // Orden global por si acaso, y sin líneas vacías
    const finalLines = lines.filter(Boolean).sort((a, b) => a.localeCompare(b, "en"));

    fs.writeFileSync(OUT_FILE, finalLines.join("\n") + "\n", "utf8");

    console.log("✅ Estructura exportada a:", OUT_FILE);
    console.log("   Root analizado:", ROOT);
    console.log("   Elementos listados:", finalLines.length);
  } catch (err) {
    console.error("❌ Error generando la estructura:", err?.message || err);
    process.exit(1);
  }
}

main();
