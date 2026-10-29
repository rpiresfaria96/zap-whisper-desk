@echo off
cd /d "%~dp0"
echo Este modo abre um CMD apenas para diagnosticar falhas da central.
echo Para uso normal, abra INICIAR_DISCRETO.vbs (sem CMD).
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0Central_IdealZap.ps1"
echo.
echo Se nao abriu a central, copie a mensagem de erro acima.
pause
