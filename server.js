// Chatwoot Dashboard - Dados por agente com etiquetas
// Sem dependencias externas. Roda com: node server.js
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const API_BASE = `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}`;

// ---- HTTP client para a API do Chatwoot ----
function apiGetOnce(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + pathname);
    const opts = {
      method: 'GET',
      headers: {
        'api_access_token': CONFIG.apiToken,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(url, opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('JSON invalido de ' + pathname)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} em ${pathname}`));
        }
      });
    });
    req.on('error', reject);
    // Timeout de socket: evita ficar preso numa pagina lenta
    req.setTimeout(30000, () => req.destroy(new Error('timeout em ' + pathname)));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Faz o GET com retry e backoff exponencial (trata 500/timeout esporadicos do Chatwoot)
async function apiGet(pathname, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiGetOnce(pathname);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        const wait = 500 * Math.pow(2, attempt); // 0.5s, 1s, 2s, 4s
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

// ---- Cache simples em memoria ----
let cache = { data: null, at: 0 };

async function fetchAllConversations(onProgress) {
  // Primeira pagina: descobre o total via meta.all_count
  const first = await apiGet(`/conversations?status=all&page=1`);
  const firstPayload = (first && first.data && first.data.payload) || [];
  const meta = (first && first.data && first.data.meta) || {};
  const total = meta.all_count || firstPayload.length;
  const perPage = firstPayload.length || 25;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const all = firstPayload.slice();
  if (onProgress) onProgress(all.length, meta);

  // Busca as paginas restantes em paralelo, com concorrencia limitada
  const concurrency = CONFIG.fetchConcurrency || 8;
  let nextPage = 2;
  const failedPages = [];

  async function worker() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = nextPage++;
      if (page > totalPages) break;
      try {
        const res = await apiGet(`/conversations?status=all&page=${page}`);
        const payload = (res && res.data && res.data.payload) || [];
        for (const c of payload) all.push(c);
        if (onProgress) onProgress(all.length, meta);
      } catch (e) {
        // Mesmo apos os retries a pagina falhou: registra e segue
        console.error(`Falha definitiva na pagina ${page}: ${e.message}`);
        failedPages.push(page);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  // Segunda tentativa (sequencial e mais lenta) para paginas que falharam
  if (failedPages.length > 0) {
    console.error(`Retentando ${failedPages.length} pagina(s) que falharam...`);
    const stillFailed = [];
    for (const page of failedPages) {
      try {
        await sleep(300);
        const res = await apiGet(`/conversations?status=all&page=${page}`, 5);
        const payload = (res && res.data && res.data.payload) || [];
        for (const c of payload) all.push(c);
      } catch (e) {
        console.error(`Pagina ${page} falhou de novo: ${e.message}`);
        stillFailed.push(page);
      }
    }
    failedPages.length = 0;
    for (const p of stillFailed) failedPages.push(p);
  }

  return { conversations: all, totalPages, failedPages, expected: total };
}

// ---- Agregacao: dados por agente com etiquetas ----
async function buildReport(onProgress) {
  const [agentsRes, labelsRes] = await Promise.all([
    apiGet('/agents'),
    apiGet('/labels'),
  ]);
  const agents = Array.isArray(agentsRes) ? agentsRes : (agentsRes.payload || []);
  const labels = (labelsRes && labelsRes.payload) || [];
  const labelColor = {};
  for (const l of labels) labelColor[l.title] = l.color;

  const fetched = await fetchAllConversations(onProgress);

  const conversations = fetched.conversations;

  // Estrutura por agente
  const byAgent = {};
  for (const a of agents) {
    byAgent[a.id] = {
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      availability: a.availability_status,
      total: 0,
      open: 0,
      resolved: 0,
      pending: 0,
      snoozed: 0,
      labels: {}, // title -> count
    };
  }
  // Bucket para conversas sem agente
  const UNASSIGNED = 'unassigned';
  byAgent[UNASSIGNED] = {
    id: null, name: 'Sem responsavel', email: '', role: '-',
    availability: '-', total: 0, open: 0, resolved: 0, pending: 0,
    snoozed: 0, labels: {},
  };

  for (const c of conversations) {
    const aid = (c.meta && c.meta.assignee && c.meta.assignee.id) || UNASSIGNED;
    const bucket = byAgent[aid] || byAgent[UNASSIGNED];
    bucket.total += 1;
    if (c.status === 'open') bucket.open += 1;
    else if (c.status === 'resolved') bucket.resolved += 1;
    else if (c.status === 'pending') bucket.pending += 1;
    else if (c.status === 'snoozed') bucket.snoozed += 1;
    const labs = c.labels || [];
    for (const t of labs) {
      bucket.labels[t] = (bucket.labels[t] || 0) + 1;
    }
  }

  // So retorna agentes que tem alguma conversa (mais o unassigned se tiver)
  const rows = Object.values(byAgent)
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    generatedAt: new Date().toISOString(),
    totalConversations: conversations.length,
    expectedConversations: fetched.expected,
    failedPages: fetched.failedPages,
    labels: labels.map((l) => ({ title: l.title, color: l.color })),
    agents: rows,
  };
}

async function getReport(force) {
  const now = Date.now();
  if (!force && cache.data && (now - cache.at) / 1000 < CONFIG.cacheTtlSeconds) {
    return cache.data;
  }
  const data = await buildReport();
  cache = { data, at: Date.now() };
  return data;
}

// ---- Servidor HTTP ----
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${CONFIG.port}`);
  try {
    if (u.pathname === '/api/report') {
      const force = u.searchParams.get('refresh') === '1';
      const data = await getReport(force);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (u.pathname === '/supervisor' || u.pathname === '/supervisor.html') {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'supervisor.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (u.pathname === '/consultor' || u.pathname === '/consultor.html') {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'consultor.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (u.pathname === '/dashboard-data.json') {
      const file = path.join(__dirname, 'public', 'dashboard-data.json');
      if (!fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'dashboard-data.json nao encontrado. Rode: node export-dashboard-data.js' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
});

server.listen(CONFIG.port, () => {
  console.log(`Dashboard rodando em http://localhost:${CONFIG.port}`);
  console.log('Carregando dados na primeira requisicao (pode demorar por causa da paginacao).');
});

