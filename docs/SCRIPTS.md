# Scripts Off-line — Chatwoot BI Dashboard

Os scripts off-line são executados localmente ou em CI/CD para gerar relatórios em CSV.

## Pré-requisitos

- Go 1.22+ instalado
- `.env.local` configurado com credenciais do Chatwoot
- (Opcional) Upstash Redis para cache compartilhado

## Scripts Disponíveis

### gerar-analise
Gera duas análises temporais a partir de uma data de corte:
- **Análise A**: Conversas movimentadas no período, por agente e etiqueta
- **Análise B**: Mensagens enviadas por agente no período

```bash
# Linux/Mac
./scripts.sh/gerar-analise.sh

# Windows
scripts.bat\gerar-analise.bat

# Go direto
cd backend && go run ../scripts/cmd/export-analise/main.go
```

**Saída:**
- `analise-A-conversas.csv`
- `analise-B-mensagens.csv`

---

### gerar-dados-dashboard
Gera o arquivo `public/dashboard-data.json` com análise cronológica de prospecções.

```bash
# Linux/Mac
./scripts.sh/gerar-dados-dashboard.sh

# Windows
scripts.bat\gerar-dados-dashboard.bat
```

**Saída:**
- `public/dashboard-data.json`

---

### gerar-detalhado
Exporta um registro massivo contendo cada mensagem enviada por agentes, com metadados da conversa.

```bash
# Linux/Mac
./scripts.sh/gerar-detalhado.sh

# Windows
scripts.bat\gerar-detalhado.bat
```

**Saída:**
- `analise-detalhada-mensagens.csv`

---

### gerar-prospeccao
Relatório de novos clientes prospectados por dia (lógica de outbound).

```bash
# Linux/Mac
./scripts.sh/gerar-prospeccao.sh

# Windows
scripts.bat\gerar-prospeccao.bat
```

**Saída:**
- `analise-prospeccao-primeira-msg-dia.csv`

---

### build
Build completo do projeto (backend Go + frontend React).

```bash
./scripts.sh/build.sh
```

**Saída:**
- `chatwoot-server` (binário Go)
- `frontend/dist/` (build do Vite)

---

### deploy
Preparação para deploy.

```bash
./scripts.sh/deploy.sh
```

---

### abrir-dashboard
Inicia o backend localmente e abre o dashboard no navegador.

```bash
# Linux/Mac
./scripts.sh/abrir-dashboard.sh

# Windows
scripts.bat\abrir-dashboard.bat
```

## Parâmetros de Configuração

Os scripts leem do `.env.local` ou `config.json`:

| Parâmetro | Descrição | Default |
|---|---|---|
| `cutoffDate` | Data de corte para análises | `2026-08-17` |
| `excludeSenders` | Remetentes a ignorar (bots) | `Figcodes Automações` |
| `fetchConcurrency` | Workers paralelos | `8` |

## Adicionar Novo Script

1. Criar `scripts/cmd/<nome>/main.go`
2. Criar `scripts.sh/<nome>.sh` e `scripts.bat/<nome>.bat`
3. Documentar nesta página
4. Atualizar `AGENTS.md` se necessário
