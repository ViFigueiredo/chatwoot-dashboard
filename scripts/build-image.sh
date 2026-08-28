#!/bin/bash
# build-image.sh: build e push das imagens Docker (backend + frontend)
# Uso: ./scripts/build-image.sh [registry]

set -e

REGISTRY="${1:-ghcr.io/vifigueiredo}"

echo "🔨 Buildando imagem backend (API + Worker)..."
docker build -t chatwootbi:latest -f backend/Dockerfile backend/
docker tag chatwootbi:latest "$REGISTRY/chatwootbi:latest"

echo "🔨 Buildando imagem frontend..."
docker build -t chatwootbi-frontend:latest -f frontend/Dockerfile frontend/
docker tag chatwootbi-frontend:latest "$REGISTRY/chatwootbi-frontend:latest"

echo "🔐 Login no registry..."
docker login "$REGISTRY"

echo "🚀 Push backend..."
docker push "$REGISTRY/chatwootbi:latest"

echo "🚀 Push frontend..."
docker push "$REGISTRY/chatwootbi-frontend:latest"

echo ""
echo "✅ Imagens enviadas:"
echo "   $REGISTRY/chatwootbi:latest"
echo "   $REGISTRY/chatwootbi-frontend:latest"
