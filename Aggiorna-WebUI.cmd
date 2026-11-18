@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] Node.js 22 o successivo non e disponibile nel PATH.
  set "exit_code=1"
  goto :finish
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRORE] npm non e disponibile nel PATH.
  set "exit_code=1"
  goto :finish
)

call npm run update:webui
set "exit_code=%ERRORLEVEL%"

:finish
echo.
if "%exit_code%"=="0" (
  echo WebUI TaskFlow aggiornata. Ricarica JSpider dalla pagina delle estensioni.
) else (
  echo Aggiornamento non completato. La versione precedente e stata conservata.
)
echo.
pause
exit /b %exit_code%
