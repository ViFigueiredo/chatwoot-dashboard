@echo off
REM Gera o relatório de prospecção (clientes novos por dia)
cd /d "%~dp0.."
echo Chatwoot - Gerando relatório de prospecção...
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    echo Go não encontrado. Instale: https://go.dev/dl/
    pause
    exit /b 1
)

echo Usando Go...
go run scripts/cmd/export-primeiras/main.go

echo.
echo Arquivo gerado: analise-prospeccao-primeira-msg-dia.csv
pause
