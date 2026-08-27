# Manual de Desenvolvimento & Arquitetura — Chatwoot Dashboard

Este documento serve como referência técnica detalhada e manual de diretrizes para desenvolvedores e agentes autônomos de IA que operam neste repositório. Ele detalha a arquitetura do sistema, fluxos de dados, lógica de negócio aplicada, integrações com a API do Chatwoot e boas práticas de desenvolvimento.

---

## 1. Visão Geral do Projeto

O **Chatwoot Dashboard** é uma aplicação leve em Node.js desenvolvida para extrair, consolidar e apresentar dados operacionais de agentes e conversas do **Chatwoot**. 

### Filosofia Técnica:
- **Zero Dependências Externas:** O projeto utiliza exclusivamente módulos nativos do Node.js (`http`, `https`, `fs`, `path`, `url`) e JavaScript Vanilla no frontend. Não há uso de pacotes npm externos (como Express, Axios ou frameworks frontend).
- **Processamento no Servidor vs. Scripts Off-line:** 
  - A visualização ao vivo e consolidada é controlada pelo `server.js` com cache em memória.
  - Análises históricas profundas e relatórios massivos de prospecção e mensagens são executados off-line via scripts utilitários de exportação (`export-*.js`) para poupar recursos em tempo de execução do servidor.

---

## 2. Mapa do Código (Estrutura de Arquivos)

- **`server.js`**: Servidor HTTP nativo. Gerencia o cache local e expõe os endpoints para a interface web.
- **`config.json`** *(Git-Ignored)*: Arquivo de configuração local contendo URLs, tokens administrativos e parâmetros operacionais de tempo de vida de cache (TTL), limites de concorrência e datas de corte.
- **`public/`**: Contém o frontend estático.
  - `index.html`: Dashboard principal com análise detalhada de conversas e etiquetas por agente (atendimento ativo/receptivo).
  - `supervisor.html`: Painel para supervisores focado na análise de prospecções.
  - `consultor.html`: Painel individual para agentes.
  - `dashboard-data.json`: Arquivo consolidado estático gerado off-line para alimentar as visualizações de supervisão e consultoria.
- **Scripts de Exportação (`export-*.js`)**:
  - `export-csv.js`: Exporta um consolidado de agentes e etiquetas para `dados-agentes.csv`.
  - `export-analise.js`: Executa análises temporais divididas em conversas por etiquetas (Análise A) e mensagens enviadas (Análise B), gerando arquivos CSV correspondentes.
  - `export-primeiras.js`: Consolida relatórios de novos clientes prospectados por dia (lógica de outbound).
  - `export-dashboard-data.js`: Gera o arquivo `public/dashboard-data.json` realizando a análise cronológica de prospecções por conversa.
  - `export-detalhado.js`: Exporta um registro massivo contendo cada mensagem enviada por agentes de forma individual, associando-a aos metadados da conversa original.
- **Automatizadores (`*.bat`)**: Scripts Windows Batch para facilitação de execução das rotinas de exportação e inicialização do servidor.

---

## 3. Arquitetura de Integração com a API do Chatwoot

A integração direta com a API REST do Chatwoot adota padrões rígidos de robustez, resiliência e controle de fluxo para mitigar timeouts e falhas causadas por limites de banda e latência.

### 3.1. Autenticação e Cabeçalhos
Toda requisição externa é direcionada para `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}` e deve conter obrigatoriamente os seguintes cabeçalhos de controle:
```javascript
headers: {
  'api_access_token': CONFIG.apiToken,
  'Content-Type': 'application/json',
}
```

### 3.2. Mecanismo de Resiliência (Retries com Backoff Exponencial)
Implementado na função `apiGet(pathname, retries = 4)`. Caso ocorra uma falha de conexão (DNS, timeout físico, erros HTTP 5xx temporários), o sistema aguarda um período exponencial antes de re-executar a consulta:
- Tentativa 1: $500\text{ms} \times 2^0 = 500\text{ms}$
- Tentativa 2: $500\text{ms} \times 2^1 = 1000\text{ms}$
- Tentativa 3: $500\text{ms} \times 2^2 = 2000\text{ms}$
- Tentativa 4: $500\text{ms} \times 2^3 = 4000\text{ms}$

### 3.3. Paginação Paralela Limidada por Concorrência
No carregamento em massa das conversas (`fetchAllConversations`), o sistema:
1. Faz o fetch da **Página 1** para descobrir a quantidade total de registros (`meta.all_count`) e o tamanho da página.
2. Calcula o número total de páginas (`totalPages`).
3. Dispara múltiplos "Workers" concorrentes (definidos em `CONFIG.fetchConcurrency`, padrão `8` ou `15`) para processar as páginas subsequentes de forma assíncrona.
4. Coleta as falhas definitivas de páginas durante o processamento assíncrono e executa uma **segunda passagem síncrona/sequencial**, mais lenta e segura, exclusiva para recuperar as páginas que falharam.

---

## 4. Regras de Negócio e Métricas

### 4.1. Cruzamento de Etiquetas (Labels) por Agente
No Chatwoot, as etiquetas pertencem às conversas, e não aos agentes. O projeto cruza os dados iterando sobre cada conversa:
1. Identifica o agente responsável (`c.meta.assignee.id`). Se não houver responsável, agrupa sob o ID simbólico `"unassigned"` ("Sem responsável").
2. Adiciona à contagem do status correspondente do agente (`open`, `resolved`, `pending` ou `snoozed`).
3. Itera sobre a lista de etiquetas da conversa (`c.labels`) e incrementa o contador individual de cada etiqueta associado àquele agente em específico:
   ```javascript
   bucket.labels[tag] = (bucket.labels[tag] || 0) + 1;
   ```

### 4.2. Definição e Lógica de Prospecção (Outbound vs. Inbound)
Um dos diferenciais analíticos do projeto é isolar ações de **Prospecção Ativa (Outbound)** do **Atendimento Receptivo (Inbound)**.
*   **Conversa de Prospecção:** Aquela cujo **primeiro contato cronológico** (primeira mensagem trocada na história da conversa) foi enviado por um **Agente** (`message_type` = `1` / outgoing).
*   **Conversa de Atendimento:** Aquela iniciada pelo **Cliente** (`message_type` = `0` / incoming).

#### Algoritmo de Identificação Cronológica:
Para descobrir qual foi a primeira mensagem real, os scripts (`export-primeiras.js` / `export-dashboard-data.js`):
1. Solicitam o histórico de mensagens da conversa.
2. Como a API do Chatwoot retorna as mensagens em lotes mais recentes, os scripts paginam retroativamente usando o parâmetro `before=<id_da_mensagem_mais_antiga_do_lote>` até que a API retorne um lote vazio ou com tamanho inferior ao limite padrão (20 itens), sinalizando o verdadeiro início da conversa.
3. Analisam o `message_type` da mensagem com o menor timestamp/ID:
   - Se for uma mensagem privada (`private: true`) ou gerada por robô de integração de terceiros, ela é tratada conforme as regras configuradas para evitar falsos positivos.
   - Se for uma mensagem pública enviada por agente (`message_type: 1`), registra como prospecção no dia em que essa mensagem foi enviada.

---

## 5. Especificações de Dados (Schemas)

### 5.1. Esquema de Configuração (`config.json`)
```json
{
  "baseUrl": "https://chatwoot.seu-dominio.com",
  "accountId": 3,
  "apiToken": "TOKEN_DE_ADMIN_DO_CHATWOOT",
  "port": 3000,
  "cacheTtlSeconds": 900,
  "fetchConcurrency": 15,
  "cutoffDate": "2026-08-17",
  "excludeSenders": ["NomeBot", "webhook-integration"]
}
```

### 5.2. Payload da API Web (`/api/report`)
```json
{
  "generatedAt": "2026-08-27T18:00:00.000Z",
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

---

## 6. Diretrizes para Modificações e Evoluções

Caso precise alterar qualquer arquivo deste ecossistema, certifique-se de seguir as regras abaixo para evitar regressões:

1.  **Preserve a Ausência de Dependências:** Não instale nenhum pacote npm no projeto. Qualquer nova funcionalidade de rede, manipulação de arquivos ou servidor deve ser implementada usando módulos padrão do Node.js.
2.  **Não Bypass o Cache:** Evite realizar chamadas diretas à API do Chatwoot a cada requisição web do usuário. Sempre que possível, utilize a abstração do cache em memória (`getReport`).
3.  **Trate o Encodificação e Caracteres Especiais:** Certifique-se de que todas as saídas de arquivos e respostas HTTP explicitam `charset=utf-8` para preservar a acentuação correta de nomes de agentes e etiquetas brasileiras.
4.  **Cuidado com Limites de Taxa (Rate Limits):** Ao alterar a concorrência padrão de requisições de paginação (`fetchConcurrency`), certifique-se de que o valor não irá sobrecarregar ou causar bloqueios temporários de IP no servidor onde o Chatwoot está hospedado.
5.  **Valide Alterações de Layout:** O frontend utiliza propriedades personalizadas CSS (`:root`) com variáveis de paleta escura moderna. Qualquer ajuste visual no HTML deve respeitar e estender essas variáveis para manter a coesão de estilo entre as páginas `index.html`, `supervisor.html` e `consultor.html`.
