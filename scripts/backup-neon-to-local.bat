@echo off
setlocal

REM Ajusta estos valores si quieres sobreescribir los defaults
set LOCAL_CONN=postgresql://escalapp:escalapp@localhost:5432/escalapp
set BACKUPS_DIR=.\backups
REM set PGBIN=C:\Program Files\PostgreSQL\16\bin

REM Llama al script PowerShell con argumentos
powershell -ExecutionPolicy Bypass -File ".\scripts\backup-neon-to-local.ps1" ^
  -LocalConn "%LOCAL_CONN%" ^
  -BackupsDir "%BACKUPS_DIR%" ^
  %PGBIN_ARG%

endlocal
