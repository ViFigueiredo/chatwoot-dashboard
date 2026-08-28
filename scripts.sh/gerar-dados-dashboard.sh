#!/bin/bash
# Gera os dados do dashboard de supervisores em public/dashboard-data.json
cd "$(dirname "$0")/.."
echo "Chatwoot - Gerando dados do dashboard..."
echo ""

if command -v go &> /dev/null; then
    echo "Usando Go..."
    go run scripts/cmd/export-dashboard/main.go
else
    echo "Go não encontrado. Instale: https://go.dev/dl/"
    exit 1
fi

echo ""
echo "Arquivo gerado: public/dashboard-data.json"
