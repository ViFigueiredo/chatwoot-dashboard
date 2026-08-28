@echo off
chcp 65001 >nul
title Chatwoot - Gerar dados do Dashboard
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Gerar dados do Dashboard por Supervisor
echo   (isso consulta a API e pode demorar alguns minutos)
echo  ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ERRO: Node.js nao encontrado. Instale em https://nodejs.org
  echo.
  pause
  exit /b 1
)

node export-dashboard-data.js

echo.
if errorlevel 1 (
  echo  Houve um erro. Veja a mensagem acima.
) else (
  echo  Dados gerados! Agora abra o dashboard com: abrir-dashboard.bat
)
echo.
pause
