# Chatwoot BI Dashboard

Dashboard de inteligência operacional para o Chatwoot. Carregado via iframe dentro do Chatwoot, deployado na Vercel.

## O que faz

- Consulta a API do Chatwoot em tempo real (~22k conversas)
- Cruza dados de conversas por agente e etiqueta
- Gráficos inteligentes: performance, distribuição, status, timeline
- Tabelas com filtros inteligentes (busca, status, etiquetas)
- Exportação Excel/CSV client-side
- Cache compartilhado via Upstash Redis

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + Tailwind 4 + Recharts + TanStack Table |
| Backend | Go (net/http + go-redis + cors) |
| Cache | Upstash Redis (REST API serverless) |
| Auth | Bearer token via `DASHBOARD_TOKEN` |

## Setup Local

### Pré-requisitos
- Go 1.22+
- Node.js 22+
- Docker (opcional)

### Início Rápido

```bash
# 1. Clone e configure
git clone <repo-url>
cd chatwoot-dashboard
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 2. Docker Compose (mais fácil)
docker-compose up

# Ou manualmente:
# Terminal 1 - Backend
cd backend && go run .

# Terminal 2 - Frontend
cd frontend && npm install && npm run dev
```

### Acessos
- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## Deploy

### Frontend (Vercel)
1. Conecte o repositório no [vercel.com/import](https://vercel.com/import)
2. Configure `VITE_API_URL` apontando para o backend
3. Deploy automático a cada push

### Backend (Railway)
1. Conecte o repositório no [railway.app](https://railway.app)
2. Configure as env vars (ver `docs/DEPLOY.md`)
3. Dockerfile detectado automaticamente

### Cache (Upstash)
1. Crie um database em [console.upstash.com](https://console.upstash.com)
2. Configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

## Scripts Off-line

```bash
# Linux/Mac
./scripts.sh/gerar-analise.sh        # Análise A+B
./scripts.sh/gerar-prospeccao.sh     # Prospecção
./scripts.sh/gerar-dados-dashboard.sh # Dashboard supervisor
./scripts.sh/gerar-detalhado.sh      # Detalhado

# Windows
scripts.bat\gerar-analise.bat
scripts.bat\gerar-prospeccao.bat
scripts.bat\gerar-dados-dashboard.bat
scripts.bat\gerar-detalhado.bat
```

## Estrutura

```
chatwoot-dashboard/
├── backend/          # Go API server
├── frontend/         # React + Vite
├── scripts/          # Scripts off-line (Go)
├── scripts.bat/      # Windows batch
├── scripts.sh/       # Linux/Mac shell
├── docs/             # Documentação
├── vercel.json       # Config Vercel
├── docker-compose.yml
└── .env.example
```

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Guia de Desenvolvimento](docs/GUIA-DESENVOLVIMENTO.md)
- [Deploy](docs/DEPLOY.md)
- [API](docs/API.md)
- [Scripts](docs/SCRIPTS.md)

## Segurança

- Token de autenticação via env var `DASHBOARD_TOKEN`
- Credenciais do Chatwoot em env vars (nunca no código)
- `.env.local` e `config.json` estão no `.gitignore`
- Headers de iframe configurados no `vercel.json`
