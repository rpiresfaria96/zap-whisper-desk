@echo off
setlocal
cd /d "%~dp0"
if not exist "scripts\preparar-ambiente.ps1" (
  echo Arquivo scripts\preparar-ambiente.ps1 nao encontrado.
  echo Baixe e extraia o ZIP completo do projeto atualizado.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\preparar-ambiente.ps1"
if errorlevel 1 (
  echo.
  echo A preparacao encontrou um erro. Copie a mensagem acima para suporte, ocultando tokens e chaves.
  pause
  exit /b 1
)
pause
