@echo off
setlocal
cd /d "%~dp0"
if not exist "scripts\conectar-whatsapp.ps1" (
  echo Arquivo scripts\conectar-whatsapp.ps1 nao encontrado.
  echo Baixe a versao atualizada do projeto.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\conectar-whatsapp.ps1"
if errorlevel 1 (
  echo.
  echo A conexao falhou. Leia a mensagem acima e confira as janelas de servico.
  pause
  exit /b 1
)
pause
