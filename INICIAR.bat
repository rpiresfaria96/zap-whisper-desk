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
set "YARN_DIR="
set "YARN_COMMAND="
set "npm_config_dir="
set "NPM_CONFIG_DIR="

echo.
echo ================================================
echo   IDEAL ZAP - INICIAR
echo ================================================
echo.

REM Um arquivo de diagnostico por execucao; nunca conter QR, chaves ou conversas.
> "%ROOT%LOG_DIAGNOSTICO.txt" echo === IDEAL ZAP - DIAGNOSTICO AUTOMATICO ===
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo Versao do diagnostico: 1
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo Horario local da inicializacao: %DATE% %TIME%
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo Dados de pareamento, mensagens e credenciais nao sao registrados.
echo LOG: "%ROOT%LOG_DIAGNOSTICO.txt"


if not exist "%NODE_DIR%\node.exe" goto PREPARAR
if not exist "%NODE_DIR%\corepack.cmd" goto PREPARAR
if not exist "%SERVER_DIR%\node_modules" goto PREPARAR
if not exist "%ROOT%node_modules" goto PREPARAR
if not exist "%ROOT%scripts\configurar-sessao.ps1" goto PREPARAR
if not exist "%ROOT%scripts\evitar-inicio-duplicado.ps1" goto PREPARAR
if not exist "%ROOT%scripts\executar-wppconnect.mjs" goto PREPARAR
if not exist "%ROOT%backend\diagnostics.mjs" goto PREPARAR

REM Se o servidor ja estiver respondendo, nao iniciar outra instancia na mesma porta.
curl.exe -fsS --max-time 3 "http://127.0.0.1:8788/healthz" >nul 2>&1
if not errorlevel 1 (
  echo ERRO: O WPPConnect antigo ainda responde na porta 8788.
  echo Feche a janela "Ideal Zap - WPPConnect 8788" antes de iniciar.
  echo Isso e obrigatorio para aplicar as correcoes no processo novo.
  echo NAO exclua tokens, .env ou userDataDir.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] WPP_OLD_PROCESS_BLOCKED
  goto FALHA
)

echo Preparando WPPConnect para iniciar apenas uma sessao...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\evitar-inicio-duplicado.ps1"
if errorlevel 1 (
  echo ERRO: nao foi possivel ajustar a inicializacao do WPPConnect.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] WPP_CONFIGURATION_FAILED
  goto FALHA
)

echo Iniciando WPPConnect (porta 8788)...
REM O Corepack acompanha o Node portatil; yarn.cmd pode nao existir sem criar shims.
start "Ideal Zap - WPPConnect 8788" /D "%SERVER_DIR%" cmd /k ""%NODE_DIR%\node.exe" "%ROOT%scripts\executar-wppconnect.mjs""

echo Aguardando o WPPConnect ficar pronto...
for /L %%i in (1,1,90) do (
  curl.exe -fsS --max-time 2 "http://127.0.0.1:8788/healthz" >nul 2>&1 && goto WPP_READY
  timeout /t 2 /nobreak >nul
)
echo ERRO: WPPConnect nao iniciou. Veja a janela "Ideal Zap - WPPConnect 8788".
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] WPP_START_TIMEOUT
goto FALHA

:WPP_READY
echo Configurando automaticamente a sessao do WhatsApp...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\configurar-sessao.ps1"
if errorlevel 1 (
  echo ERRO: nao foi possivel configurar a sessao.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] SESSION_TOKEN_SETUP_FAILED
  goto FALHA
)

REM Uma API antiga na porta 3001 pode impedir a exibicao do QR.
REM Checamos a versao da integracao antes de reaproveitar o processo existente.
curl.exe -fsS --max-time 3 "http://127.0.0.1:3001/health" 2>nul | findstr /C:"qr-bridge-v1" >nul
if not errorlevel 1 (
  echo ERRO: A API antiga ainda responde na porta 3001.
  echo Feche a janela "Ideal Zap - API 3001" e execute INICIAR.bat novamente.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] API_OLD_PROCESS_BLOCKED
  goto FALHA
)
curl.exe -fsS --max-time 3 "http://127.0.0.1:3001/health" >nul 2>&1
if not errorlevel 1 (
  echo ERRO: Uma API antiga ja esta usando a porta 3001.
  echo Feche a janela antiga da API e execute INICIAR.bat novamente.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] API_OLD_PROCESS_3001
  goto FALHA
)
echo Iniciando API local (porta 3001)...
start "Ideal Zap - API 3001" /D "%ROOT%" cmd /k ""%NODE_DIR%\node.exe" backend\server.mjs"

:API_READY
curl.exe -fsS --max-time 3 "http://127.0.0.1:8080/" >nul 2>&1
if not errorlevel 1 (
  echo ERRO: A interface anterior ainda responde na porta 8080.
  echo Feche a janela "Ideal Zap - Interface 8080" e execute INICIAR.bat novamente.
  >> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] UI_OLD_PROCESS_BLOCKED
  goto FALHA
)
echo Iniciando interface (porta 8080)...
start "Ideal Zap - Interface 8080" /D "%ROOT%" cmd /k "set PATH=%NODE_DIR%;%PATH%&& npm.cmd run dev -- --host 0.0.0.0 --port 8080"

:INTERFACE_READY
echo Aguardando a interface abrir...
for /L %%i in (1,1,60) do (
  curl.exe -fsS --max-time 3 "http://127.0.0.1:8080/" >nul 2>&1 && goto ABRIR
  timeout /t 2 /nobreak >nul
)
echo ERRO: a interface nao respondeu na porta 8080. Consulte a janela da interface.
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] UI_START_TIMEOUT
goto FALHA

:ABRIR
echo.
echo Tudo iniciado. Abrindo o Ideal Zap...
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] UI_READY_8080
start "" "http://127.0.0.1:8080/"
echo O QR Code aparece no Ideal Zap quando o telefone precisa ser vinculado.
echo Mantenha as janelas dos servicos abertas.
echo.
echo Para atender em outro computador DA MESMA REDE LOCAL:
echo Acesse http://IP_DESTE_COMPUTADOR:8080/
echo Descubra o Endereco IPv4 no comando ipconfig, ou veja abaixo:
powershell.exe -NoProfile -Command "$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1; if ($cfg) { Write-Host ('LINK NA REDE: http://' + $cfg.IPv4Address.IPAddress + ':8080/') }"
echo IMPORTANTE: NAO abra a porta 8080 na internet. Use apenas rede privada/confiavel.
exit /b 0

:PREPARAR
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] PREREQUISITES_MISSING
echo Ainda faltam arquivos necessarios.
echo Execute PREPARAR_AMBIENTE.bat uma vez antes de usar INICIAR.bat.
goto FALHA

:FALHA
>> "%ROOT%LOG_DIAGNOSTICO.txt" echo [LAUNCHER] START_FAILED
echo.
echo Nao foi possivel iniciar todos os componentes. Veja os erros acima.
pause
exit /b 1
