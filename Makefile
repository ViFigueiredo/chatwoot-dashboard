.PHONY: help dev dev-api dev-worker build test docker-up docker-down

help: ## Mostra todos os comandos
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Desenvolvimento Local ---

dev: ## Roda API + Worker localmente (2 terminais)
	@echo "Iniciando API e Worker..."
	@cd backend && go run ./cmd/api &
	@cd backend && go run ./cmd/worker &
	@echo "API: http://localhost:8080"
	@echo "Worker: rodando em background"

dev-api: ## Roda somente a API
	cd backend && go run ./cmd/api

dev-worker: ## Roda somente o Worker
	cd backend && go run ./cmd/worker

# --- Build & Test ---

build: ## Build dos binários API e Worker
	cd backend && go build -o bin/api ./cmd/api
	cd backend && go build -o bin/worker ./cmd/worker

test: ## Roda todos os testes
	cd backend && go test ./...
	cd frontend && npx vitest run

# --- Docker ---

docker-up: ## Sobe API + Worker + Frontend via Docker
	docker-compose up -d --build

docker-down: ## Para todos os containers
	docker-compose down

docker-logs: ## Mostra logs dos containers
	docker-compose logs -f

# --- Deploy ---

install-hooks: ## Instala pre-commit hook
	cp scripts/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
