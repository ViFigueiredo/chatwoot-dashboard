#!/bin/bash
# Gera o relatório de prospecção (clientes novos por dia)
cd "$(dirname "$0")/.."
echo "Chatwoot - Gerando relatório de prospecção..."
echo ""

if command -v go &> /dev/null; then
    echo "Usando Go..."
    go run scripts/cmd/export-primeiras/main.go
else
    echo "Go não encontrado. Instale: https://go.dev/dl/"
    exit 1
fi

echo ""
echo "Arquivo gerado: analise-prospeccao-primeira-msg-dia.csv"
