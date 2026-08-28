#!/bin/bash
# build-image.sh: build e push da imagem Docker
# Uso: ./scripts/build-image.sh [registry]
# Exemplos:
#   ./scripts/build-image.sh                    # ghcr.io (padrão)
#   ./scripts/build-image.sh docker.io/vinicius  # Docker Hub

set -e

REGISTRY="${1:-ghcr.io/vifigueiredo}"
IMAGE="$REGISTRY/chatwootbi:latest"

echo "🔨 Buildando imagem Docker..."
docker build -t chatwootbi:latest -f backend/Dockerfile backend/

echo "🏷️  Tagging para $IMAGE..."
docker tag chatwootbi:latest "$IMAGE"

echo "🔐 Login no registry..."
docker login "$REGISTRY"

echo "🚀 Push..."
docker push "$IMAGE"

echo "✅ Imagem enviada: $IMAGE"
echo ""
echo "No Portainer, use a imagem:"
echo "  $IMAGE"
