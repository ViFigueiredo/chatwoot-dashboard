# Arquitetura — Chatwoot BI Dashboard

## Visão Geral

O Chatwoot BI Dashboard é uma ferramenta de inteligência operacional que se conecta à API do Chatwoot para extrair, consolidar e visualizar dados de agentes e conversas. É carregado via iframe dentro do Chatwoot e deployado na Vercel.

## Stack

| Camada | Tecnologia | Host |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind 4 + Recharts + TanStack Table | Vercel |
| Backend | Go (net/http + go-redis + cors) | Railway |
| Cache | Upstash Redis (REST API serverless) | Upstash |
| Auth | Bearer token via env var `DASHBOARD_TOKEN` | - |

## Arquitetura de Deploy

```
┌──────────────┐     iframe      ┌──────────────────┐      HTTP       ┌──────────────────┐
│   Chatwoot   │ ──────────────→ │  Vercel (React)  │ ──────────────→ │  Backend Go      │
│  (host UI)   │                 │  Frontend BI     │   CORS + Auth   │  API REST        │
└──────────────┘                 └──────────────────┘                 └───┬──────────┬───┘
                                                                         │          │
                                                                cache hit│          │cache miss
                                                                         ▼          ▼
                                                               ┌─────────────┐  ┌──────────────┐
                                                               │   Upstash   │  │  Chatwoot    │
                                                               │   Redis     │  │  API REST    │
                                                               └─────────────┘  └──────────────┘
```

## Fluxo de Dados

1. Usuário abre o iframe dentro do Chatwoot
2. Frontend React envia `Authorization: Bearer <DASHBOARD_TOKEN>` em cada request
3. Backend Go valida o token via middleware
4. Backend verifica cache no Upstash Redis
5. Se cache hit → retorna dados do cache (latência ~50ms)
6. Se cache miss → busca dados da API do Chatwoot com paginação paralela
7. Backend salva no cache com TTL de 15 minutos
8. Frontend renderiza gráficos (Recharts) e tabelas (TanStack Table)

## Autenticação

- Uma única senha definida via variável de ambiente `DASHBOARD_TOKEN`
- Frontend armazena o token no `localStorage`
- Backend valida o token em cada request via middleware
- Se `DASHBOARD_TOKEN` estiver vazio, todos os requests são aceitos (modo desenvolvimento)

## Cache

- **Upstash Redis**: serverless, HTTP REST (sem pool de conexões)
- TTL: 900 segundos (15 minutos)
- Chave principal: `chatwoot:report:v1`
- Compartilhado entre todos os usuários simultâneos
- Scripts off-line também podem acessar o mesmo cache

## Paginação e Resiliência

O client Go do Chatwoot implementa:
- **Retry com backoff exponencial**: 500ms, 1s, 2s, 4s
- **Paginação paralela**: N workers goroutines buscam páginas simultaneamente
- **Segunda passagem**: páginas que falharam são retentadas sequencialmente
- **Timeout**: 30 segundos por request

## Frontend

### Componentes
- `AuthGuard` — Tela de login com token
- `Layout` — Shell com sidebar e navegação
- `StatCard` — Cards de métricas
- `DataTable` — Tabela com sorting e filtros (TanStack Table)
- `FilterBar` — Filtros inteligentes (busca, status, etiquetas)
- `ExportButton` — Exportação Excel/CSV (SheetJS client-side)

### Gráficos
- `AgentPerformance` — Barras horizontais por agente
- `LabelDistribution` — Donut de distribuição de etiquetas
- `StatusOverview` — Donut de status das conversas
- `ActivityTimeline` — Timeline de atividade
- `ProspectionFunnel` — Funil prospecção vs atendimento

### Páginas
- `/` — Dashboard (visão geral)
- `/agentes` — Tabela detalhada por agente
- `/prospeccao` — Análise de prospecção
- `/analise` — Análise temporal A+B
- `/consultor` — Painel individual do agente

## Estrutura de Pastas

```
chatwoot-dashboard/
├── backend/          # Go API server
├── frontend/         # React + Vite
├── scripts/          # Scripts off-line (Go)
├── scripts.bat/      # Windows batch
├── scripts.sh/       # Linux/Mac shell
├── docs/             # Documentação
├── vercel.json       # Config deploy Vercel
├── docker-compose.yml
└── .env.example
```

## Decisões de Projeto

1. **Go ao invés de Node.js**: performance significativamente melhor para paginação massiva (22k conversas), goroutines nativas para concorrência, binário compilado sem cold start
2. **Upstash ao invés de Vercel KV**: sem vendor lock-in, funciona em qualquer hosting, HTTP REST (sem pool de conexões)
3. **React ao invés de vanilla JS**: componentização para BI complexa, hooks para estado, TanStack Table para tabelas
4. **Vercel para frontend + Railway para backend**: separação de responsabilidades, deploy otimizado para cada stack
