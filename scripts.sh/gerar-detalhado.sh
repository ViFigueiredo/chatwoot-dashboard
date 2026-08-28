#!/bin/bash
# Gera o relatório detalhado (uma linha por mensagem enviada)
cd "$(dirname "$0")/.."
echo "Chatwoot - Gerando relatório detalhado..."
echo ""

if command -v go &> /dev/null; then
    echo "Usando Go..."
    go run scripts/cmd/export-detalhado/main.go
else
    echo "Go não encontrado. Instale: https://go.dev/dl/"
    exit 1
fi

echo ""
echo "Arquivo gerado: analise-detalhada-mensagens.csv"
