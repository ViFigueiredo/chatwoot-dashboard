# Chatwoot Dashboard — Dados por Agente

Dashboard web que consulta a API do Chatwoot ao vivo e mostra, para cada
agente/operador, suas conversas e as etiquetas dessas conversas.

Importante sobre o Chatwoot: agentes **não** têm etiquetas próprias. As
etiquetas vivem nas conversas. Então este painel cruza os dados: para cada
agente ele soma quantas conversas ele atende por cada etiqueta.

## Como rodar

Precisa apenas do Node.js instalado (sem dependências externas).

```powershell
cd $env:USERPROFILE\Desktop\chatwoot-dashboard
node server.js
```

Depois abra no navegador: http://localhost:3000

A primeira carga demora ~1-2 min porque pagina todas as ~22 mil conversas da
conta. O resultado fica em cache por 15 minutos. Clique em "Atualizar" para
forçar releitura.

## O que o painel mostra

- Cards de resumo: total de conversas, abertas, resolvidas, pendentes, nº de etiquetas
- Tabela por agente com: status (online/offline), total de conversas,
  abertas/pendentes/resolvidas e as etiquetas com a contagem de cada uma
- Busca por nome de agente e ordenação clicando nos cabeçalhos
- Conversas sem responsável aparecem como "Sem responsavel"

## Arquivos

- `server.js` — servidor HTTP + cliente da API + agregação
- `public/index.html` — interface do dashboard
- `config.json` — credenciais e parâmetros

## config.json

| Campo | Descrição |
|-------|-----------|
| baseUrl | URL do Chatwoot |
| accountId | ID da conta (3) |
| apiToken | token de acesso admin |
| port | porta local (3000) |
| cacheTtlSeconds | validade do cache (900 = 15 min) |
| fetchConcurrency | páginas buscadas em paralelo (15) |

## Segurança

O `config.json` contém o token de acesso admin. Não versione esse arquivo
em repositórios públicos (adicione a um `.gitignore`). Se o token vazar,
gere um novo no painel do Chatwoot.

## Endpoints da API usados

- `GET /api/v1/accounts/3/agents` — lista de agentes
- `GET /api/v1/accounts/3/labels` — etiquetas da conta (título + cor)
- `GET /api/v1/accounts/3/conversations?status=all&page=N` — conversas paginadas
