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

echo Iniciando Ideal Zap e WPPConnect a partir desta pasta...
echo O WPPConnect deste projeto usa a porta 8788 para evitar a instalacao antiga na 8787.
start "WPPConnect Server - 8788" /D "%SERVER_DIR%" cmd /k "set PATH=%NODE_DIR%;%PATH%&& set COREPACK_HOME=%COREPACK_HOME%&& set PORT=8788&& yarn.cmd dev"
echo Aguardando o WPPConnect responder em http://127.0.0.1:8788/healthz ...
for /L %%i in (1,1,60) do (
  curl.exe -fsS "http://127.0.0.1:8788/healthz" >nul 2>&1 && goto WPP_READY
  timeout /t 2 >nul
)
echo.
echo O WPPConnect ainda nao respondeu. Confira a janela "WPPConnect Server - 8788".
echo Vou abrir a interface para permitir o diagnostico.
:WPP_READY
start "Ideal Zap - API local - 3001" /D "%ROOT%" cmd /k ""%NODE_DIR%\node.exe" backend\server.mjs"
start "Ideal Zap - Interface - 8080" /D "%ROOT%" cmd /k "set PATH=%NODE_DIR%;%PATH%&& npm.cmd run dev -- --host 127.0.0.1 --port 8080"
timeout /t 7 >nul
start "" "http://127.0.0.1:8080/"

echo.
echo WPPConnect: http://127.0.0.1:8788
echo Adaptador:  http://127.0.0.1:3001/health
echo Interface:  http://127.0.0.1:8080/
echo.
echo Nao e necessario abrir o Manager nem informar senha. Na primeira vinculacao, leia o QR Code pelo WhatsApp do celular.
echo Deixe as tres janelas abertas.
echo Para encerrar, feche cada janela de terminal.
pause
