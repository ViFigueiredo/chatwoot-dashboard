.PHONY: dev test build deploy clean install-hooks

# === Development ===

dev: ## Start both backend and frontend in development mode
	@echo "Starting backend..."
	cd backend && go run . &
	@echo "Starting frontend..."
	cd frontend && npm run dev
	@echo "Dashboard: http://localhost:3000"
	@echo "API: http://localhost:8080"

dev-backend: ## Start only backend
	cd backend && go run .

dev-frontend: ## Start only frontend
	cd frontend && npm run dev

# === Testing ===

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go tests
	cd backend && go test ./... -v

test-frontend: ## Run frontend tests
	cd frontend && npm test

test-watch: ## Run frontend tests in watch mode
	cd frontend && npm run test:watch

# === Build ===

build: build-backend build-frontend ## Build everything

build-backend: ## Build Go binary
	cd backend && CGO_ENABLED=0 go build -o ../chatwoot-server .

build-frontend: ## Build frontend for production
	cd frontend && npm run build

# === Quality ===

lint: ## Run linters
	cd frontend && npx eslint . --max-warnings=0

typecheck: ## Run TypeScript check
	cd frontend && npx tsc -b

fmt: ## Format Go code
	cd backend && gofmt -w .

# === Install ===

install: install-frontend ## Install all dependencies

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

install-hooks: ## Install git hooks
	cp scripts/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "✅ Pre-commit hook installed"

# === Docker ===

docker-up: ## Start with Docker Compose
	docker-compose up -d

docker-down: ## Stop Docker Compose
	docker-compose down

docker-build: ## Build Docker images
	docker-compose build

# === Clean ===

clean: ## Clean build artifacts
	rm -rf frontend/dist backend/chatwoot-server chatwoot-server
	cd frontend && rm -rf node_modules
	cd backend && go clean -cache

# === Help ===

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
