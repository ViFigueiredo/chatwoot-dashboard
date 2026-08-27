@echo off
chcp 65001 >nul
title Chatwoot - Prospeccao Ativa (clientes novos por dia)
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Prospeccao Ativa
echo   Clientes UNICOS abordados pelo agente por dia
echo   (conversas iniciadas pelo agente - 1a msg dele)
echo   Periodo: a partir de 17/08/2026
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

node export-primeiras.js

echo.
if errorlevel 1 (
  echo  Houve um erro na geracao. Veja a mensagem acima.
) else (
  echo  Pronto! Abrindo o arquivo gerado...
  if exist "analise-prospeccao-primeira-msg-dia.csv" start "" "analise-prospeccao-primeira-msg-dia.csv"
)
echo.
pause
