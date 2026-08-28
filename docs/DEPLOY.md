# Deploy — Chatwoot BI Dashboard

## Visão Geral

| Componente | Serviço | Deploy |
|---|---|---|
| Frontend | Vercel | Automático via GitHub Actions |
| Backend | Railway | Automático via GitHub Actions |
| Cache | Upstash | Manual (setup único) |
| CI/CD | GitHub Actions | Automático a cada push |

## Fluxo GitOps

```
git push main
    │
    ├── .github/workflows/ci.yml
    │   ├── Test Backend (Go)
    │   ├── Test Frontend (React)
    │   └── Lint
    │
    ├── .github/workflows/deploy-frontend.yml
    │   └── (se mudou frontend/)
    │       ├── Build React
    │       └── Deploy Vercel
    │
    └── .github/workflows/deploy-backend.yml
        └── (se mudou backend/)
            └── Deploy Railway
```

## Setup Inicial

### 1. Upstash Redis (uma vez)

1. Acesse https://console.upstash.com
2. Crie um database: `chatwoot-dashboard`
3. Copie a **REST URL** e **REST Token**

### 2. Vercel (Frontend)

1. Acesse https://vercel.com
2. Importe o repositório GitHub
3. Configure:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Adicione env vars no painel:
   ```
   VITE_API_URL=https://chatwoot-api.up.railway.app
   ```
5. Configure **Deploy Hooks** (opcional, GitHub Actions já faz)

### 3. Railway (Backend)

1. Acesse https://railway.app
2. Crie projeto: "New Project" → "Deploy from GitHub repo"
3. Selecione o repositório
4. Railway detecta o `Dockerfile` automaticamente
5. Adicione env vars no painel:
   ```
   DASHBOARD_TOKEN=sua-senha
   CHATWOOT_BASE_URL=https://atendimento.grupoavantti.com.br
   CHATWOOT_ACCOUNT_ID=3
   CHATWOOT_API_TOKEN=seu-token
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXxx...
   ```
6. Copie a URL gerada (ex: `https://chatwoot-api.up.railway.app`)

### 4. GitHub Secrets

Configure no repositório GitHub → Settings → Secrets and variables → Actions:

| Secret | Descrição |
|---|---|
| `VERCEL_TOKEN` | Token de deploy do Vercel |
| `VERCEL_ORG_ID` | ID da organização Vercel |
| `VERCEL_PROJECT_ID` | ID do projeto Vercel |
| `RAILWAY_TOKEN` | Token de deploy do Railway |

Para obter os tokens:
- **Vercel**: `vercel whoami` ou painel → Settings → Tokens
- **Railway**: Painel → Account Settings → Tokens

### 5. GitHub Variables (Opcional)

Configure no repositório GitHub → Settings → Secrets and variables → Actions → Variables:

| Variable | Descrição |
|---|---|
| `VITE_API_URL` | URL do backend (para build) |

## Variáveis de Ambiente

| Variável | Obrigatória | Frontend | Backend | Descrição |
|---|---|---|---|---|
| `DASHBOARD_TOKEN` | Sim | - | ✅ | Token de autenticação |
| `CHATWOOT_BASE_URL` | Sim | - | ✅ | URL do Chatwoot |
| `CHATWOOT_ACCOUNT_ID` | Sim | - | ✅ | ID da conta |
| `CHATWOOT_API_TOKEN` | Sim | - | ✅ | Token admin |
| `UPSTASH_REDIS_REST_URL` | Sim | - | ✅ | URL Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Sim | - | ✅ | Token Upstash |
| `PORT` | Não | - | ✅ | Porta backend (8080) |
| `CACHE_TTL_SECONDS` | Não | - | ✅ | TTL cache (900) |
| `VITE_API_URL` | Não | ✅ | - | URL do backend |
| `VERCEL_TOKEN` | CI/CD | ✅ | - | Deploy Vercel |
| `RAILWAY_TOKEN` | CI/CD | - | ✅ | Deploy Railway |

## Comandos Úteis

```bash
# Makefile
make help              # Ver todos os comandos
make dev               # Rodar localmente
make test              # Rodar todos os testes
make build             # Build completo
make install-hooks     # Instalar pre-commit hook

# Deploy manual (se necessário)
vercel --prod          # Deploy frontend
railway up             # Deploy backend
```

## Pré-commit Hook

Instale o hook para rodar testes antes de cada commit:

```bash
make install-hooks
# ou
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

O hook roda automaticamente:
1. TypeScript check
2. Frontend tests
3. Go build check
4. Go tests

## Troubleshooting

### Deploy falha no GitHub Actions
- Verifique se os Secrets estão configurados
- Verifique os logs no GitHub → Actions
- Confirme que os testes passam localmente

### CORS errors
- Backend: verifique o middleware CORS em `backend/cors/`
- Frontend: verifique `VITE_API_URL` apontando para o backend

### Cache não atualiza
- Use `?refresh=1` para forçar refresh
- Verifique Upstash no painel console.upstash.com
- Verifique logs do backend no Railway
