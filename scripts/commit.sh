#!/bin/bash
# commit.sh: testa → commita → pusha
# Uso: ./scripts/commit.sh "mensagem do commit"

set -e

MSG="${1:-chore: atualização automática}"

echo "🔍 Rodando testes..."

# 1. TypeScript
echo "  → TypeScript..."
cd frontend
if ! npx tsc -b --noEmit 2>/dev/null; then
    echo "❌ TypeScript com erros. Corrija antes de commitar."
    exit 1
fi

# 2. Frontend tests
echo "  → Frontend tests..."
if ! npx vitest run 2>/dev/null; then
    echo "❌ Testes do frontend falharam."
    exit 1
fi
cd ..

# 3. Go build
echo "  → Go build (API + Worker)..."
cd backend
if ! go build -o /dev/null ./cmd/api 2>/dev/null; then
    echo "❌ Build da API falhou."
    exit 1
fi
if ! go build -o /dev/null ./cmd/worker 2>/dev/null; then
    echo "❌ Build do Worker falhou."
    exit 1
fi

# 4. Go tests
echo "  → Go tests..."
if ! go test ./... 2>/dev/null; then
    echo "❌ Testes do backend falharam."
    exit 1
fi
cd ..

echo "✅ Todos os testes passaram!"

echo "📦 Commitando..."
git add -A
git commit -m "$MSG

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>"

echo "🚀 Enviando..."
git push

echo "✅ Commit e push concluídos!"
