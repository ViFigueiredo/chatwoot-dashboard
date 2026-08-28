@echo off
REM Gera os dados do dashboard de supervisores
cd /d "%~dp0.."
echo Chatwoot - Gerando dados do dashboard...
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    echo Go não encontrado. Instale: https://go.dev/dl/
    pause
    exit /b 1
)

echo Usando Go...
go run scripts/cmd/export-dashboard/main.go

echo.
echo Arquivo gerado: public/dashboard-data.json
pause
