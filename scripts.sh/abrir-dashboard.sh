#!/bin/bash
# Inicia o backend Go e abre o dashboard no navegador
cd "$(dirname "$0")/.."

echo "Chatwoot Dashboard - Iniciando..."
echo ""

# Build and run backend
if command -v go &> /dev/null; then
    echo "Compilando backend Go..."
    cd backend
    go build -o ../chatwoot-server .
    cd ..
    ./chatwoot-server &
    SERVER_PID=$!
    echo "Backend rodando na porta 8080 (PID: $SERVER_PID)"
else
    echo "Go não encontrado. Instale: https://go.dev/dl/"
    exit 1
fi

# Try to open browser
sleep 2
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080
elif command -v open &> /dev/null; then
    open http://localhost:8080
else
    echo "Abra manualmente: http://localhost:8080"
fi

echo ""
echo "Pressione Ctrl+C para parar."
wait $SERVER_PID
