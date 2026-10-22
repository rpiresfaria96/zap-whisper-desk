@echo off
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%runtime\node-v22.22.2-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

if not exist "%NODE_DIR%\node.exe" (
  echo Node.js local nao encontrado. Execute PREPARAR_AMBIENTE.bat primeiro.
  pause
  exit /b 1
)
if not exist "%ROOT%backend\server.mjs" (
  echo backend\server.mjs nao encontrado nesta pasta.
  pause
  exit /b 1
)

echo Iniciando a API local do Ideal Zap na porta 3001...
echo Feche a janela antiga "Ideal Zap - API local - 3001" antes de continuar.
"%NODE_DIR%\node.exe" "%ROOT%backend\server.mjs"
pause
