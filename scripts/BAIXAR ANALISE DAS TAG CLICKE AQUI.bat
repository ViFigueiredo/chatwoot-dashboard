@echo off
chcp 65001 >nul
title Chatwoot - Exportar CSV por Agente
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Gerador de CSV por Agente
echo  ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ERRO: Node.js nao encontrado no sistema.
  echo  Instale o Node.js em https://nodejs.org e tente de novo.
  echo.
  pause
  exit /b 1
)

node export-csv.js

echo.
if errorlevel 1 (
  echo  Houve um erro na geracao. Veja a mensagem acima.
) else (
  echo  Pronto! Abra o arquivo dados-agentes.csv nesta pasta.
)
echo.
pause
