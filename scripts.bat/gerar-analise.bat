@echo off
REM Gera as análises A (conversas) e B (mensagens) por agente
cd /d "%~dp0.."
echo Chatwoot - Gerando análises A e B...
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    echo Go não encontrado. Instale: https://go.dev/dl/
    pause
    exit /b 1
)

echo Usando Go...
go run scripts/cmd/export-analise/main.go

echo.
echo Arquivos gerados:
echo   - analise-A-conversas.csv
echo   - analise-B-mensagens.csv
pause
