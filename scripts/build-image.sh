#!/bin/bash
# build-image.sh: build e push da imagem Docker
# Uso: ./scripts/build-image.sh [registry]

set -e

REGISTRY="${1:-docker.io}"
IMAGE="$REGISTRY/chatwootbi:latest"

echo "🔨 Buildando imagem Docker..."
docker build -t chatwootbi:latest -f backend/Dockerfile backend/

echo "🏷️  Tagging..."
docker tag chatwootbi:latest "$IMAGE"

echo "🚀 Push para $REGISTRY..."
docker push "$IMAGE"

echo "✅ Imagem enviada: $IMAGE"
echo ""
echo "Agora atualize o docker-compose.yml para usar:"
echo "  image: $IMAGE"
