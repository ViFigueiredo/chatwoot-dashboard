@echo off
chcp 65001 >nul
title Chatwoot - Analise A+B por Agente (a partir de 17/08/2026)
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Analise por Agente
echo   Periodo: a partir de 17/08/2026
echo   A) por conversa   B) por mensagem enviada
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

node export-analise.js

echo.
if errorlevel 1 (
  echo  Houve um erro na geracao. Veja a mensagem acima.
) else (
  echo  Pronto! Abrindo os arquivos gerados...
  if exist "analise-A-conversas.csv" start "" "analise-A-conversas.csv"
  if exist "analise-B-mensagens.csv" start "" "analise-B-mensagens.csv"
)
echo.
pause
