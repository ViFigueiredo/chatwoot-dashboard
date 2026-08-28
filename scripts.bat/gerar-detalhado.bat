@echo off
REM Gera o relatório detalhado (uma linha por mensagem)
cd /d "%~dp0.."
echo Chatwoot - Gerando relatório detalhado...
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    echo Go não encontrado. Instale: https://go.dev/dl/
    pause
    exit /b 1
)

echo Usando Go...
go run scripts/cmd/export-detalhado/main.go

echo.
echo Arquivo gerado: analise-detalhada-mensagens.csv
pause
