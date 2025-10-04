<# 
  backup-neon-to-local.ps1
  -------------------------------------------------------
  Crea un volcado completo desde Neon (producción) y lo restaura en Postgres local.
  - Lee DATABASE_URL de .env.production.local (fallback: .env, .env.local)
  - Guarda el backup en ./backups con timestamp
  - Restaura sobre la BD local indicada (drop + recreate schema public)
  Requisitos:
  - psql y pg_dump en PATH o pasar -PgBin (ej: "C:\Program Files\PostgreSQL\17\bin")
  Uso básico:
    .\scripts\backup-neon-to-local.ps1 `
      -LocalConn "postgresql://escalapp:escalapp@localhost:5432/escalapp" `
      -BackupsDir ".\backups" `
      -PgBin "C:\Program Files\PostgreSQL\17\bin"
#>

param(
  [string]$EnvFile = ".\.env.production.local",
  [string]$LocalConn = "postgresql://escalapp:escalapp@localhost:5432/escalapp",
  [string]$BackupsDir = ".\backups",
  [string]$PgBin = ""
)

# -------- Helpers --------
function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# -------- Resolver herramientas pg_* --------
$pgDump = "pg_dump"
$psql   = "psql"
if ($PgBin -ne "") {
  $pgDump = Join-Path $PgBin "pg_dump.exe"
  $psql   = Join-Path $PgBin "psql.exe"
}

# Comprobaciones básicas (usando & para evitar Start-Process)
try { & $pgDump --version   | Out-Null } catch { Write-Err "pg_dump no disponible. Ajusta -PgBin o PATH."; exit 1 }
try { & $psql   --version   | Out-Null } catch { Write-Err "psql no disponible. Ajusta -PgBin o PATH.";  exit 1 }

# -------- Localizar archivo .env --------
if (-not (Test-Path $EnvFile)) {
  Write-Warn "$EnvFile no existe. Intento con .env y .env.local"
  if     (Test-Path ".\.env")       { $EnvFile = ".\.env" }
  elseif (Test-Path ".\.env.local") { $EnvFile = ".\.env.local" }
  else { Write-Err "No encontré ningún .env con DATABASE_URL. Indica ruta con -EnvFile."; exit 1 }
}
Write-Info "Usando archivo env: $EnvFile"

# -------- Extraer DATABASE_URL de producción --------
$envContent = Get-Content -Raw -Encoding UTF8 $EnvFile
$prodMatch = [regex]::Match($envContent, '^\s*DATABASE_URL\s*=\s*("?)(?<url>postgres(?:ql)?://[^"\r\n#]+)\1\s*$', 'IgnoreCase, Multiline')
if (-not $prodMatch.Success) {
  Write-Err "No se encontró DATABASE_URL en $EnvFile"
  exit 1
}
$ProdConn = $prodMatch.Groups["url"].Value.Trim()
Write-Ok "DATABASE_URL (producción) detectada."

# -------- Consejos Neon --------
if ($ProdConn -notmatch 'sslmode=') {
  Write-Warn "La cadena de Neon no incluye sslmode. Añadiendo '?sslmode=require' para pg_dump."
  if ($ProdConn -match '\?') { $ProdConn = "$ProdConn&sslmode=require" } else { $ProdConn = "$ProdConn?sslmode=require" }
}

# -------- Preparar carpeta de backups --------
if (-not (Test-Path $BackupsDir)) {
  New-Item -ItemType Directory -Path $BackupsDir | Out-Null
  Write-Ok "Creada carpeta $BackupsDir"
}
$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$backupFile = Join-Path $BackupsDir ("neon_full_" + $ts + ".sql")

# -------- Dump desde Neon (usar & y args array) --------
Write-Info "Lanzando pg_dump desde Neon (puede tardar según tamaño)..."
$dumpArgs = @(
  "--format=plain",
  "--no-owner",
  "--no-privileges",
  "--encoding=UTF8",
  "--verbose",
  "--dbname=$ProdConn",
  "--file=$backupFile"
)
& $pgDump @($dumpArgs)
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile)) {
  Write-Err "pg_dump falló. Revisa credenciales o conectividad."
  exit 1
}
Write-Ok "Backup generado: $backupFile"

# -------- Probar conexión local --------
Write-Info "Comprobando conexión local..."
$checkArgs = @("-d", $LocalConn, "-v", "ON_ERROR_STOP=1", "-c", "SELECT current_database(), current_user;")
& $psql @($checkArgs)
if ($LASTEXITCODE -ne 0) {
  Write-Err "No puedo conectar a la BD local. Revisa -LocalConn (usuario/contraseña/puerto/dbname)."
  exit 1
}
Write-Ok "Conexión local OK."

# -------- Reset del schema public en local (todo en un solo -c) --------
Write-Warn "Se va a DROPear el schema 'public' en la BD local y restaurar el backup completo."
$resetSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO CURRENT_USER;"
$resetArgs = @("-d", $LocalConn, "-v", "ON_ERROR_STOP=1", "-c", $resetSql)
& $psql @($resetArgs)
if ($LASTEXITCODE -ne 0) {
  Write-Err "No se pudo resetear el schema public en local."
  exit 1
}
Write-Ok "Schema public reseteado."

# -------- Restaurar en local --------
Write-Info "Restaurando backup en local (psql)..."
$restoreArgs = @("-d", $LocalConn, "-v", "ON_ERROR_STOP=1", "-f", $backupFile)
& $psql @($restoreArgs)
if ($LASTEXITCODE -ne 0) {
  Write-Err "La restauración falló. Revisa el log mostrado arriba."
  exit 1
}
Write-Ok "Restauración completada."

# -------- Sugerencias post-restore (opcional) --------
Write-Info "Sugerencias post-restore:"
Write-Host "  - Si usas Prisma: npx prisma generate" -ForegroundColor DarkGray
Write-Host "  - Si necesitas reset total con migraciones locales: npx prisma migrate reset" -ForegroundColor DarkGray
Write-Host ""
Write-Ok "Proceso terminado con éxito."
