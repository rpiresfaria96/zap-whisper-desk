@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Dependencias do projeto nao encontradas.
  echo Abra um terminal nesta pasta e execute: npm install
  pause
  exit /b 1
)
if not exist ".env" (
  echo Falta o arquivo .env na pasta raiz. Copie .env.example para .env.
  pause
  exit /b 1
)
if not exist "backend\.env" (
  echo Falta backend\.env. Copie backend\.env.example para backend\.env e configure a sessao e o token.
  pause
  exit /b 1
)

start "Ideal Zap - API local" /D "%~dp0" cmd /k "npm run api"
start "Ideal Zap - Interface" /D "%~dp0" cmd /k "npm run dev"
timeout /t 3 >nul
start "" "http://localhost:5173"
