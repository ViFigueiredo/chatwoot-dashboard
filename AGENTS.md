# Manual de Desenvolvimento & Arquitetura — Chatwoot BI Dashboard

Este documento serve como referência técnica para agentes autônomos de IA que operam neste repositório.

---

## 1. Visão Geral

O **Chatwoot BI Dashboard** é uma ferramenta de inteligência operacional que consulta a API do Chatwoot, consolida dados de agentes e conversas, e apresenta gráficos e tabelas interativas. É carregado via iframe dentro do Chatwoot e deployado na Vercel.

### Stack
- **Frontend**: React 19 + Vite + Tailwind 4 + Recharts + TanStack Table (Vercel)
- **Backend**: Go (net/http + go-redis + cors) (Railway)
- **Cache**: Upstash Redis serverless (HTTP REST)
- **Auth**: Bearer token via `DASHBOARD_TOKEN`

---

## 2. Mapa do Código

### Backend (`backend/`)
- `main.go` — Entry point, rotas, middleware, startup
- `config/config.go` — Leitura de env vars
- `auth/middleware.go` — Validação do Bearer token
- `cors/middleware.go` — CORS para iframe
- `cache/redis.go` — Wrapper Upstash Redis
- `chatwoot/client.go` — HTTP client com retry/backoff
- `chatwoot/conversations.go` — Paginação paralela
- `chatwoot/models.go` — Structs Go
- `handlers/report.go` — Handlers de report e export
- `csv/writer.go` — Helpers CSV

### Frontend (`frontend/src/`)
- `components/` — Componentes reutilizáveis
- `charts/` — Gráficos Recharts
- `pages/` — Páginas/routes
- `hooks/` — Custom hooks
- `lib/` — API client, Excel, formatters
- `types/` — Interfaces TypeScript

### Scripts (`scripts/`)
- `cmd/*/main.go` — Scripts off-line em Go
- `internal/` — Código compartilhado entre scripts

---

## 3. Regras de Projeto

### 3.1. Autenticação
- Uma única senha via `DASHBOARD_TOKEN`
- Frontend: `localStorage` → `Authorization: Bearer <token>`
- Backend: middleware valida em cada request

### 3.2. Cache
- Upstash Redis com TTL de 900s (15 min)
- Chave: `chatwoot:report:v1`
- Compartilhado entre todos os usuários
- Sempre verificar cache antes de buscar da API

### 3.3. Resiliência
- Retry com backoff exponencial (500ms, 1s, 2s, 4s)
- Paginação paralela com N goroutines
- Segunda passagem síncrona para páginas que falharam
- Timeout de 30s por request

### 3.4. Frontend
- Usar `@/` alias para `src/`
- Componentes em `PascalCase`
- Hooks em `use*.ts`
- CSS variables para tema dark
- Nunca fazer fetch direto — usar `src/lib/api.ts`

### 3.5. Backend
- Handlers em `handlers/`
- Models em `chatwoot/models.go`
- Usar `context.Context` para cancelamento
- Tratar erros explicitamente

---

## 4. Endpoints da API

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/health` | GET | Health check (sem auth) |
| `/api/auth-check` | GET | Valida o `DASHBOARD_TOKEN` (usado pela tela de login) |
| `/api/report` | GET | Relatório consolidado |
| `/api/report-refresh` | GET | Força refresh do cache |
| `/api/export-agents` | GET | CSV de agentes |
| `/api/export-analysis` | GET | CSV análise A+B |
| `/api/export-prospection` | GET | CSV prospecção |
| `/api/dashboard-data` | GET | Dados do supervisor |

---

## 5. Variáveis de Ambiente

| Var | Obrigatória | Descrição |
|---|---|---|
| `DASHBOARD_TOKEN` | Sim | Token de autenticação |
| `CHATWOOT_BASE_URL` | Sim | URL do Chatwoot |
| `CHATWOOT_ACCOUNT_ID` | Sim | ID da conta |
| `CHATWOOT_API_TOKEN` | Sim | Token admin |
| `UPSTASH_REDIS_REST_URL` | Sim | URL Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Sim | Token Upstash |
| `PORT` | Não | Porta backend (8080) |
| `CACHE_TTL_SECONDS` | Não | TTL cache (900) |
| `FETCH_CONCURRENCY` | Não | Workers (8) |
| `VITE_API_URL` | Não | URL backend (frontend) |

---

## 6. Diretrizes para Modificações

1. **Preservar autenticação**: Qualquer novo endpoint deve usar o middleware de auth
2. **Não bypass o cache**: Sempre verificar cache antes de buscar da API
3. **Tratar encoding**: Usar `charset=utf-8` em todas as respostas
4. **Manter CORS**: Respeitar headers de iframe
5. **Documentação**: Atualizar docs/ ao adicionar endpoints ou features
6. **Scripts**: Adicionar equivalente .sh e .bat ao criar novos scripts
