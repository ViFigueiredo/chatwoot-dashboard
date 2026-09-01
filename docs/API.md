# API — Chatwoot BI Dashboard Backend

Base URL: `https://<backend-url>/api`

## Autenticação

Todos os endpoints (exceto `/health`) requerem:
```
Authorization: Bearer <DASHBOARD_TOKEN>
```

## Endpoints

### GET /api/health
Health check. Não requer autenticação.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /api/auth-check
Valida o `DASHBOARD_TOKEN` enviado no header `Authorization`. Usado pela tela de
login do frontend, que não pode validar contra `/api/health` (público, aceitaria
qualquer token). Retorna `401` quando o token está ausente ou é inválido.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /api/report
Retorna o relatório consolidado de agentes com etiquetas.

**Query Parameters:**
- `refresh=1` — Força refresh do cache

**Response:**
```json
{
  "generatedAt": "2026-08-28T12:00:00Z",
  "totalConversations": 22350,
  "expectedConversations": 22350,
  "failedPages": [],
  "labels": [
    { "title": "Suporte", "color": "#ff0000" }
  ],
  "agents": [
    {
      "id": 12,
      "name": "Nome do Agente",
      "email": "agente@empresa.com",
      "role": "agent",
      "availability": "online",
      "total": 150,
      "open": 10,
      "resolved": 135,
      "pending": 5,
      "snoozed": 0,
      "labels": {
        "Suporte": 80,
        "Vendas": 70
      }
    }
  ]
}
```

### GET /api/report-refresh
Força refresh do cache e retorna dados atualizados.

**Response:** Mesmo do `/api/report`

### GET /api/export-agents
Exporta dados dos agentes em CSV.

**Response:** CSV file (Content-Type: text/csv)

**Headers:**
```
Content-Disposition: attachment; filename=dados-agentes.csv
```

### GET /api/export-analysis
Exporta análise A (conversas) e B (mensagens) em CSV.

**Response:** CSV file com análise temporal

### GET /api/export-prospection
Exporta relatório de prospecção em CSV.

**Response:** CSV file com clientes novos por dia

### GET /api/dashboard-data
Retorna os dados do dashboard de supervisores (arquivo JSON pré-gerado).

**Response:** JSON com dados de prospecção

## Erros

Todos os erros retornam:
```json
{
  "error": "Mensagem do erro"
}
```

Códigos de erro:
- `401` — Token inválido ou ausente
- `404` — Recurso não encontrado
- `500` — Erro interno do servidor

## Taxa de Requisições

- Cache TTL: 900 segundos (15 minutos)
- Primeira requisição: pode levar até 5-10 minutos (paginação de ~22k conversas)
- Requisições subsequentes: ~50ms (cache hit)
- Requisições com refresh: ~5-10 minutos (cache miss forçado)
