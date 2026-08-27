// Gera o CSV com os dados por agente (mesmos numeros do dashboard).
// Mostra progresso em % no console. Roda com: node export-csv.js
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const API_BASE = `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}`;
const OUT_FILE = path.join(__dirname, 'dados-agentes.csv');

// ---- HTTP client com retry/backoff ----
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
    req.setTimeout(30000, () => req.destroy(new Error('timeout em ' + pathname)));
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function apiGet(pathname, retries = 4) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await apiGetOnce(pathname); }
    catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

// ---- Barra de progresso no console ----
function drawProgress(done, total, label) {
  const pct = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  const bar = '#'.repeat(filled) + '-'.repeat(width - filled);
  const line = `\r[${bar}] ${String(pct).padStart(3)}%  ${label}`;
  process.stdout.write(line.padEnd(70));
}

// ---- Busca todas as conversas com progresso ----
async function fetchAllConversations() {
  const first = await apiGet(`/conversations?status=all&page=1`);
  const firstPayload = (first && first.data && first.data.payload) || [];
  const meta = (first && first.data && first.data.meta) || {};
  const total = meta.all_count || firstPayload.length;
  const perPage = firstPayload.length || 25;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const all = firstPayload.slice();
  let pagesDone = 1;
  drawProgress(pagesDone, totalPages, `pagina ${pagesDone}/${totalPages}`);

  const concurrency = CONFIG.fetchConcurrency || 8;
  let nextPage = 2;
  const failedPages = [];

  async function worker() {
    while (true) {
      const page = nextPage++;
      if (page > totalPages) break;
      try {
        const res = await apiGet(`/conversations?status=all&page=${page}`);
        const payload = (res && res.data && res.data.payload) || [];
        for (const c of payload) all.push(c);
      } catch (e) {
        failedPages.push(page);
      }
      pagesDone++;
      drawProgress(pagesDone, totalPages, `pagina ${pagesDone}/${totalPages}`);
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  // Retenta paginas que falharam, sequencial
  if (failedPages.length > 0) {
    const stillFailed = [];
    for (const page of failedPages) {
      try {
        await sleep(300);
        const res = await apiGet(`/conversations?status=all&page=${page}`, 5);
        const payload = (res && res.data && res.data.payload) || [];
        for (const c of payload) all.push(c);
      } catch (e) { stillFailed.push(page); }
    }
    failedPages.length = 0;
    for (const p of stillFailed) failedPages.push(p);
  }

  return { conversations: all, totalPages, failedPages, expected: total };
}

// ---- Escapa um campo para CSV ----
function csv(v) {
  const s = String(v == null ? '' : v);
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main() {
  console.log('Chatwoot - Exportando dados por agente para CSV');
  console.log('Conta: ' + CONFIG.accountId + ' | ' + CONFIG.baseUrl);
  console.log('');

  process.stdout.write('Buscando agentes e etiquetas... ');
  const [agentsRes, labelsRes] = await Promise.all([apiGet('/agents'), apiGet('/labels')]);
  const agents = Array.isArray(agentsRes) ? agentsRes : (agentsRes.payload || []);
  const labels = (labelsRes && labelsRes.payload) || [];
  const labelTitles = labels.map((l) => l.title);
  console.log(`OK (${agents.length} agentes, ${labelTitles.length} etiquetas)`);
  console.log('Baixando conversas (isso pode demorar):');

  const fetched = await fetchAllConversations();
  process.stdout.write('\n');
  const conversations = fetched.conversations;

  // Agrega por agente
  const byAgent = {};
  for (const a of agents) {
    byAgent[a.id] = {
      id: a.id, name: a.name, email: a.email || '', role: a.role || '',
      availability: a.availability_status || '',
      total: 0, open: 0, resolved: 0, pending: 0, snoozed: 0, labels: {},
    };
  }
  const UNASSIGNED = 'unassigned';
  byAgent[UNASSIGNED] = {
    id: '', name: 'Sem responsavel', email: '', role: '', availability: '',
    total: 0, open: 0, resolved: 0, pending: 0, snoozed: 0, labels: {},
  };

  for (const c of conversations) {
    const aid = (c.meta && c.meta.assignee && c.meta.assignee.id) || UNASSIGNED;
    const b = byAgent[aid] || byAgent[UNASSIGNED];
    b.total++;
    if (c.status === 'open') b.open++;
    else if (c.status === 'resolved') b.resolved++;
    else if (c.status === 'pending') b.pending++;
    else if (c.status === 'snoozed') b.snoozed++;
    for (const t of (c.labels || [])) b.labels[t] = (b.labels[t] || 0) + 1;
  }

  const rows = Object.values(byAgent).filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total);

  // Monta CSV: uma coluna por etiqueta (mesma info do dashboard)
  const header = ['Agente', 'Email', 'Perfil', 'Status', 'Total', 'Abertas',
    'Pendentes', 'Resolvidas', 'Adiadas', ...labelTitles];
  const lines = [header.map(csv).join(';')];
  for (const a of rows) {
    const line = [
      a.name, a.email, a.role, a.availability, a.total,
      a.open, a.pending, a.resolved, a.snoozed,
      ...labelTitles.map((t) => a.labels[t] || 0),
    ];
    lines.push(line.map(csv).join(';'));
  }

  // BOM para o Excel abrir acentos corretamente
  fs.writeFileSync(OUT_FILE, '\uFEFF' + lines.join('\r\n'), 'utf8');

  console.log('');
  console.log('=================================================');
  console.log('CONCLUIDO - 100%');
  console.log('Conversas processadas: ' + conversations.length + ' de ' + fetched.expected);
  console.log('Agentes com atividade: ' + rows.length);
  if (fetched.failedPages.length) {
    console.log('ATENCAO: ' + fetched.failedPages.length + ' pagina(s) nao carregaram: ' + fetched.failedPages.join(', '));
  }
  console.log('Arquivo gerado: ' + OUT_FILE);
  console.log('=================================================');
}

main().catch((err) => {
  console.error('\nERRO: ' + (err.message || err));
  process.exit(1);
});
