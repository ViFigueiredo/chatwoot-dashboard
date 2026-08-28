@echo off
cd /d "%~dp0.."
echo Chatwoot Dashboard - Iniciando...
echo.

where go >nul 2>nul
if %errorlevel% neq 0 (
    echo Go não encontrado. Instale: https://go.dev/dl/
    pause
    exit /b 1
)

echo Compilando backend Go...
cd backend
go build -o ..\chatwoot-server.exe .
cd ..

start "" http://localhost:8080
chatwoot-server.exe
