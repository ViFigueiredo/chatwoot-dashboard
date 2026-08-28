#!/bin/bash
# Deploy preparation script
cd "$(dirname "$0")/.."

echo "Chatwoot Dashboard - Deploy Prep"
echo ""

# Run build
./scripts.sh/build.sh

echo ""
echo "Próximos passos para deploy:"
echo ""
echo "1. Frontend (Vercel):"
echo "   - Conecte o repositório no vercel.com/import"
echo "   - Configure as env vars no painel da Vercel"
echo "   - Deploy automático a cada push"
echo ""
echo "2. Backend (Railway):"
echo "   - Conecte o repositório no railway.app"
echo "   - Configure as env vars"
echo "   - O Dockerfile será detectado automaticamente"
echo ""
echo "3. Cache (Upstash):"
echo "   - Crie um database em console.upstash.com"
echo "   - Copie a URL e Token para as env vars"
