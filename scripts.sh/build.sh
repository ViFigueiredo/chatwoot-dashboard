#!/bin/bash
# Build completo do projeto (backend Go + frontend React)
cd "$(dirname "$0")/.."

echo "================================="
echo "Chatwoot Dashboard - Build"
echo "================================="
echo ""

# Build backend
echo "[1/2] Compilando backend Go..."
cd backend
if command -v go &> /dev/null; then
    CGO_ENABLED=0 go build -o ../chatwoot-server .
    echo "✅ Backend compilado: chatwoot-server"
else
    echo "❌ Go não encontrado"
    exit 1
fi
cd ..

# Build frontend
echo ""
echo "[2/2] Compilando frontend React..."
cd frontend
if command -v npm &> /dev/null; then
    npm run build
    echo "✅ Frontend compilado: frontend/dist/"
elif command -v pnpm &> /dev/null; then
    pnpm run build
    echo "✅ Frontend compilado: frontend/dist/"
else
    echo "❌ npm/pnpm não encontrado"
    exit 1
fi
cd ..

echo ""
echo "================================="
echo "BUILD CONCLUÍDO"
echo "================================="
echo ""
echo "Para rodar localmente:"
echo "  ./chatwoot-server"
echo ""
echo "Para deploy na Vercel:"
echo "  git push (deploy automático)"
