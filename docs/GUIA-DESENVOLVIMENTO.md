# Guia de Desenvolvimento — Chatwoot BI Dashboard

## Setup Local

### Pré-requisitos
- Go 1.22+
- Node.js 22+
- npm ou pnpm
- Docker (opcional, para Redis local)

### Início Rápido

```bash
# 1. Clone o repositório
git clone <repo-url>
cd chatwoot-dashboard

# 2. Copie o .env
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 3. Instale dependências do frontend
cd frontend && npm install && cd ..

# 4. Rode com Docker Compose
docker-compose up

# Ou manualmente:
# Terminal 1: Backend
cd backend && go run .

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Acessos
- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## Convenções de Código

### Go (Backend)
- Usar `snake_case` para pacotes e arquivos
- Handlers ficam em `backend/handlers/`
- Models ficam em `backend/chatwoot/models.go`
- Middleware em pastas próprias (`auth/`, `cors/`)
- Tratar erros explicitamente (não ignorar)
- Usar `context.Context` para cancelamento e timeouts

### TypeScript (Frontend)
- Usar `camelCase` para variáveis e funções
- Componentes em `PascalCase` (arquivo = nome do componente)
- Interfaces em `src/types/index.ts`
- Hooks customizados em `src/hooks/`
- Utilitários puros em `src/lib/`
- Usar `@/` como alias para `src/`

### CSS
- Usar variáveis CSS definidas em `globals.css`
- Classes Tailwind para estilização
- Não usar CSS modules ou styled-components
- Tema dark: paleta `--color-bg`, `--color-text`, etc.

## Padrões de Projeto

### API Client (Frontend)
```typescript
// Sempre usar o módulo api.ts para requests
import { fetchReport } from '@/lib/api'
const report = await fetchReport()
```

### Cache (Backend)
```go
// Sempre verificar cache antes de buscar da API
cached, err := cache.GetReport()
if err == nil && cached != nil {
    return cached, nil
}
// ... buscar da API ...
cache.SetReport(report, cfg.CacheTTLSeconds)
```

### Autenticação
- Token definido em `DASHBOARD_TOKEN` (env var)
- Frontend: armazenar no `localStorage`, enviar como `Authorization: Bearer <token>`
- Backend: middleware valida em cada request

## Scripts Off-line

### Executar scripts
```bash
# Linux/Mac
./scripts.sh/gerar-analise.sh
./scripts.sh/gerar-prospeccao.sh
./scripts.sh/gerar-dados-dashboard.sh
./scripts.sh/gerar-detalhado.sh

# Windows
scripts.bat\gerar-analise.bat
scripts.bat\gerar-prospeccao.bat
scripts.bat\gerar-dados-dashboard.bat
scripts.bat\gerar-detalhado.bat
```

### Adicionar novo script
1. Criar `scripts/cmd/<nome>/main.go`
2. Criar equivalente em `scripts.sh/<nome>.sh` e `scripts.bat/<nome>.bat`
3. Documentar em `docs/SCRIPTS.md`

## Deploy

### Frontend (Vercel)
1. Conectar repositório no vercel.com/import
2. Configurar env vars no painel
3. Deploy automático a cada push na main

### Backend (Railway)
1. Conectar repositório no railway.app
2. Configurar env vars
3. O Dockerfile será detectado automaticamente

### Cache (Upstash)
1. Criar database em console.upstash.com
2. Copiar REST URL e Token
3. Adicionar como env vars no backend

## Documentação

Sempre manter atualizado:
- `docs/ARQUITETURA.md` — Visão geral
- `docs/GUIA-DESENVOLVIMENTO.md` — Este arquivo
- `docs/DEPLOY.md` — Passo a passo
- `docs/API.md` — Endpoints
- `docs/SCRIPTS.md` — Scripts off-line
- `AGENTS.md` — Diretrizes para agentes de IA
