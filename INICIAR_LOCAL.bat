@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instale a versao LTS do Node.js e execute este arquivo novamente.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm nao encontrado. Reinstale o Node.js LTS marcando a opcao para adicionar ao PATH.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Arquivo .env criado.
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo.
  echo Criei backend\.env. Agora vou abrir o arquivo para voce configurar.
  echo Preencha WPP_SESSION e WPP_TOKEN, salve e execute este arquivo novamente.
  start "" notepad "%~dp0backend\.env"
  pause
  exit /b 0
)

findstr /C:"WPP_TOKEN=cole-seu-token-aqui" "backend\.env" >nul
if not errorlevel 1 (
  echo.
  echo Voce ainda precisa preencher WPP_TOKEN no arquivo backend\.env.
  start "" notepad "%~dp0backend\.env"
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependencias nao encontradas. Instalando agora...
  call npm install
  if errorlevel 1 (
    echo.
    echo Falha ao instalar dependencias. Confira a internet e a instalacao do Node.js.
    pause
    exit /b 1
  )
)

start "Ideal Zap - API local" /D "%~dp0" cmd /k "npm run api"
start "Ideal Zap - Interface" /D "%~dp0" cmd /k "npm run dev"
timeout /t 4 >nul
start "" "http://localhost:5173"
