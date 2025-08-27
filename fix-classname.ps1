param(
  [switch]$DryRun  # si lo pasas, no escribe cambios: solo informa
)

# 1) Config
$root = Get-Location
$includeExt = @("*.tsx","*.ts","*.jsx","*.js")
$excludeDirs = @("\node_modules\", "\.next\", "\dist\", "\build\", "\.git\")

# 2) Recolectar archivos candidatos
$files = Get-ChildItem -Path $root -Recurse -File -Include $includeExt |
  Where-Object {
    $full = $_.FullName
    -not ($excludeDirs | ForEach-Object { $full -like "*$_*" }) # excluye rutas
  }

if(-not $files){
  Write-Host "No se encontraron archivos candidatos." -ForegroundColor Yellow
  exit 0
}

# 3) Reemplazo
$changedCount = 0
$totalMatches = 0
$changedFiles = @()

foreach($f in $files){
  $text = [System.IO.File]::ReadAllText($f.FullName)
  # cuenta matches
  $matches = ([regex]::Matches($text, 'class="')).Count
  if($matches -gt 0){
    $totalMatches += $matches
    Write-Host "[$matches] $($f.FullName)"

    if(-not $DryRun){
      # backup .bak
      Copy-Item -Path $f.FullName -Destination ($f.FullName + ".bak") -Force

      # reemplazo
      $new = $text -replace 'class="','className="'
      # (opcional) también corrige class='...' → className='...'
      $new = $new -replace "class='","className='"

      # escribir con UTF8 (sin BOM)
      [System.IO.File]::WriteAllText($f.FullName, $new, (New-Object System.Text.UTF8Encoding($false)))

      $changedCount++
      $changedFiles += $f.FullName
    }
  }
}

if($DryRun){
  Write-Host "`nDRY-RUN: No se ha modificado ningún archivo." -ForegroundColor Yellow
  Write-Host "Coincidencias totales encontradas: $totalMatches"
}else{
  Write-Host "`nListo ✅ Archivos modificados: $changedCount  | Coincidencias reemplazadas aprox.: $totalMatches" -ForegroundColor Green
  if($changedCount -gt 0){
    Write-Host "Se han creado backups .bak junto a cada archivo cambiado."
  }
}
