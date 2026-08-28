@echo off
chcp 65001 >nul
title Chatwoot - Relatorio Detalhado (mensagens por dia)
cd /d "%~dp0"

echo.
echo  ================================================
echo   Chatwoot - Relatorio Detalhado
echo   Uma linha por mensagem enviada (registro a registro)
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

node export-detalhado.js

echo.
if errorlevel 1 (
  echo  Houve um erro na geracao. Veja a mensagem acima.
) else (
  echo  Pronto! Abrindo o arquivo gerado...
  if exist "analise-detalhada-mensagens.csv" start "" "analise-detalhada-mensagens.csv"
)
echo.
pause
