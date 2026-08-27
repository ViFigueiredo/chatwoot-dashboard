@echo off
chcp 65001 >nul
title Chatwoot - Dashboard por Supervisor
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Dashboard por Supervisor
echo  ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ERRO: Node.js nao encontrado. Instale em https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "public\dashboard-data.json" (
  echo  Dados ainda nao foram gerados.
  echo  Rode primeiro o arquivo: gerar-dados-dashboard.bat
  echo.
  pause
  exit /b 1
)

echo  Iniciando o servidor e abrindo o navegador...
echo  (mantenha esta janela ABERTA enquanto usa o dashboard)
echo.

start "" "http://localhost:3000/supervisor"
node server.js

pause
