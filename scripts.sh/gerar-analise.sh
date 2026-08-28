#!/bin/bash
# Gera as análises A (conversas) e B (mensagens) por agente
cd "$(dirname "$0")/.."
echo "Chatwoot - Gerando análises A e B..."
echo ""

# Check if Go is available
if command -v go &> /dev/null; then
    echo "Usando Go..."
    go run scripts/cmd/export-analise/main.go
else
    echo "Go não encontrado. Instale: https://go.dev/dl/"
    exit 1
fi

echo ""
echo "Arquivos gerados:"
echo "  - analise-A-conversas.csv"
echo "  - analise-B-mensagens.csv"
