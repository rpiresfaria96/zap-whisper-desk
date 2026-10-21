@echo off
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%runtime\node-v22.22.2-win-x64"
set "SERVER_DIR=%ROOT%wppconnect-server"
set "COREPACK_HOME=%ROOT%_cache\corepack"
set "npm_config_cache=%ROOT%_cache\npm"
set "YARN_CACHE_FOLDER=%ROOT%_cache\yarn"
set "PATH=%NODE_DIR%;%PATH%"

if not exist "%NODE_DIR%\node.exe" (
  echo Node.js local ainda nao instalado. Execute PREPARAR_AMBIENTE.bat primeiro.
  pause
  exit /b 1
)
if not exist "%SERVER_DIR%\node_modules" (
  echo Dependencias do WPPConnect nao encontradas. Execute PREPARAR_AMBIENTE.bat primeiro.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Dependencias da interface nao encontradas. Execute PREPARAR_AMBIENTE.bat primeiro.
  pause
  exit /b 1
)

echo Iniciando os tres componentes a partir desta pasta...
start "WPPConnect Server - 8787" /D "%SERVER_DIR%" cmd /k "set PATH=%NODE_DIR%;%PATH%&& set COREPACK_HOME=%COREPACK_HOME%&& set PORT=8787&& yarn.cmd dev"
timeout /t 3 >nul
start "Ideal Zap - API local - 3001" /D "%ROOT%" cmd /k ""%NODE_DIR%\node.exe" backend\server.mjs"
start "Ideal Zap - Interface - 8080" /D "%ROOT%" cmd /k "set PATH=%NODE_DIR%;%PATH%&& npm.cmd run dev -- --host 127.0.0.1 --port 8080"
timeout /t 5 >nul
start "" "http://127.0.0.1:8787/manager/"
start "" "http://127.0.0.1:8080/"

echo.
echo WPPConnect: http://127.0.0.1:8787
echo Manager:    http://127.0.0.1:8787/manager/
echo Interface:  http://127.0.0.1:8080/
echo Adaptador:  http://127.0.0.1:3001/health
echo.
echo Deixe as tres janelas de terminal abertas.
echo Para encerrar, feche cada janela de terminal.
pause
