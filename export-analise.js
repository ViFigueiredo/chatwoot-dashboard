// Analise A + B por agente, a partir de uma data de corte.
// A) por conversa: conversas movimentadas no periodo, por etiqueta
// B) por mensagem: mensagens enviadas pelo agente no periodo
// Gera 2 CSVs. Mostra progresso em %. Roda com: node export-analise.js
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const API_BASE = `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}`;

// Data de corte (inclusive). Pode sobrescrever no config.json com "cutoffDate".
const CUTOFF_STR = CONFIG.cutoffDate || '2026-08-17';
const CUTOFF = Math.floor(new Date(CUTOFF_STR + 'T00:00:00').getTime() / 1000);

// Remetentes a ignorar (bots/integracoes), case-insensitive.
const EXCLUDE = new Set((CONFIG.excludeSenders || []).map((s) => String(s).toLowerCase().trim()));
function isExcluded(name) { return EXCLUDE.has(String(name || '').toLowerCase().trim()); }

const OUT_A = path.join(__dirname, 'analise-A-conversas.csv');
const OUT_B = path.join(__dirname, 'analise-B-mensagens.csv');

// ---- HTTP client com retry/backoff ----
function apiGetOnce(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + pathname);
    const opts = {
      method: 'GET',
      headers: { 'api_access_token': CONFIG.apiToken, 'Content-Type': 'application/json' },
    };
    const req = https.request(url, opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('JSON invalido de ' + pathname)); }
        } else { reject(new Error(`HTTP ${res.statusCode} em ${pathname}`)); }
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
    catch (e) { lastErr = e; if (attempt < retries) await sleep(500 * Math.pow(2, attempt)); }
  }
  throw lastErr;
}

function drawProgress(done, total, label) {
  const pct = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  const bar = '#'.repeat(filled) + '-'.repeat(width - filled);
  process.stdout.write(`\r[${bar}] ${String(pct).padStart(3)}%  ${label}`.padEnd(72));
}

function csv(v) {
  const s = String(v == null ? '' : v);
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ---- Busca conversas com atividade a partir do corte ----
// As conversas vem ordenadas por last_activity_at desc, entao paramos
// quando uma pagina inteira ja estiver abaixo do corte.
async function fetchConversationsSince() {
  const first = await apiGet(`/conversations?status=all&page=1`);
  const meta = (first && first.data && first.data.meta) || {};
  const total = meta.all_count || 0;
  const perPage = ((first.data && first.data.payload) || []).length || 25;
  const estPages = Math.max(1, Math.ceil(total / perPage));

  const kept = [];
  let page = 1;
  let stop = false;
  while (!stop) {
    const res = page === 1 ? first : await apiGet(`/conversations?status=all&page=${page}`);
    const payload = (res && res.data && res.data.payload) || [];
    if (payload.length === 0) break;
    let anyRecent = false;
    for (const c of payload) {
      if ((c.last_activity_at || 0) >= CUTOFF) { kept.push(c); anyRecent = true; }
    }
    // Paginas ordenadas desc: se nenhuma conversa desta pagina esta no periodo,
    // as proximas tambem nao estarao.
    drawProgress(Math.min(page, estPages), estPages, `varrendo pagina ${page} | no periodo: ${kept.length}`);
    if (!anyRecent && page > 1) stop = true;
    page++;
    if (page > estPages + 5) break;
  }
  return kept;
}

// ---- Analise B: conta mensagens enviadas pelo agente no periodo ----
// O endpoint retorna ~20 msgs mais recentes; paginamos com "before" (id da
// mensagem mais antiga) ate cruzar o corte, para nao perder mensagens.
async function fetchMessagesStats(conv, statsByAgent) {
  const cid = conv.id;
  let before = null;
  let guard = 0;
  while (guard++ < 200) {
    const q = before ? `/conversations/${cid}/messages?before=${before}` : `/conversations/${cid}/messages`;
    const res = await apiGet(q);
    const msgs = (res && res.payload) || [];
    if (msgs.length === 0) break;
    let oldest = Infinity;
    for (const m of msgs) {
      if ((m.id || Infinity) < oldest) oldest = m.id;
      if (m.message_type !== 1) continue;      // 1 = outgoing (atendimento)
      if (m.private) continue;                 // ignora notas internas
      if ((m.created_at || 0) < CUTOFF) continue;
      const sender = m.sender || {};
      if (sender.type !== 'user' || !sender.id) continue; // so agentes reais
      if (isExcluded(sender.name)) continue;              // ignora bots/integracoes
      const key = sender.id;
      if (!statsByAgent[key]) {
        statsByAgent[key] = { id: sender.id, name: sender.name || ('Agente ' + sender.id), messages: 0, conversations: new Set() };
      }
      statsByAgent[key].messages++;
      statsByAgent[key].conversations.add(cid);
    }
    // Se a msg mais antiga desta pagina ja e anterior ao corte, paramos.
    const oldestCreated = Math.min(...msgs.map((m) => m.created_at || 0));
    if (oldestCreated < CUTOFF) break;
    if (msgs.length < 20) break; // nao ha pagina anterior
    before = oldest;
  }
}

async function main() {
  console.log('Chatwoot - Analise por agente a partir de ' + CUTOFF_STR);
  console.log('Conta: ' + CONFIG.accountId + ' | ' + CONFIG.baseUrl);
  console.log('');

  process.stdout.write('Buscando agentes e etiquetas... ');
  const [agentsRes, labelsRes] = await Promise.all([apiGet('/agents'), apiGet('/labels')]);
  const agents = Array.isArray(agentsRes) ? agentsRes : (agentsRes.payload || []);
  const labels = (labelsRes && labelsRes.payload) || [];
  const labelTitles = labels.map((l) => l.title);
  console.log(`OK (${agents.length} agentes, ${labelTitles.length} etiquetas)`);

  // ---- Fase 1: conversas do periodo ----
  console.log('\n[1/3] Selecionando conversas com atividade desde ' + CUTOFF_STR + ':');
  const convs = await fetchConversationsSince();
  process.stdout.write('\n');
  console.log('      ' + convs.length + ' conversas no periodo.');

  // ---- ANALISE A: por conversa ----
  const A = {};
  for (const a of agents) {
    A[a.id] = { id: a.id, name: a.name, email: a.email || '', availability: a.availability_status || '',
      total: 0, open: 0, resolved: 0, pending: 0, snoozed: 0, labels: {} };
  }
  A['unassigned'] = { id: '', name: 'Sem responsavel', email: '', availability: '',
    total: 0, open: 0, resolved: 0, pending: 0, snoozed: 0, labels: {} };
  for (const c of convs) {
    const aid = (c.meta && c.meta.assignee && c.meta.assignee.id) || 'unassigned';
    const b = A[aid] || A['unassigned'];
    b.total++;
    if (c.status === 'open') b.open++;
    else if (c.status === 'resolved') b.resolved++;
    else if (c.status === 'pending') b.pending++;
    else if (c.status === 'snoozed') b.snoozed++;
    for (const t of (c.labels || [])) b.labels[t] = (b.labels[t] || 0) + 1;
  }
  const rowsA = Object.values(A).filter((a) => a.total > 0).sort((x, y) => y.total - x.total);

  const headA = ['Agente', 'Email', 'Status', 'Total_Conversas', 'Abertas', 'Pendentes',
    'Resolvidas', 'Adiadas', ...labelTitles];
  const linesA = [headA.map(csv).join(';')];
  for (const a of rowsA) {
    linesA.push([a.name, a.email, a.availability, a.total, a.open, a.pending, a.resolved,
      a.snoozed, ...labelTitles.map((t) => a.labels[t] || 0)].map(csv).join(';'));
  }
  fs.writeFileSync(OUT_A, '\uFEFF' + linesA.join('\r\n'), 'utf8');
  console.log('[2/3] Analise A (por conversa) salva: ' + path.basename(OUT_A));

  // ---- ANALISE B: por mensagem enviada ----
  console.log('[3/3] Baixando mensagens das conversas do periodo:');
  const B = {};
  const concurrency = CONFIG.fetchConcurrency || 8;
  let done = 0;
  let idx = 0;
  const failed = [];
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= convs.length) break;
      try { await fetchMessagesStats(convs[i], B); }
      catch (e) { failed.push(convs[i].id); }
      done++;
      drawProgress(done, convs.length, `mensagens ${done}/${convs.length}`);
    }
  }
  const ws = [];
  for (let i = 0; i < concurrency; i++) ws.push(worker());
  await Promise.all(ws);
  process.stdout.write('\n');

  // Junta nome oficial do agente quando existir
  const agentName = {};
  for (const a of agents) agentName[a.id] = a.name;
  const rowsB = Object.values(B).map((r) => ({
    name: agentName[r.id] || r.name, id: r.id,
    messages: r.messages, conversations: r.conversations.size,
  })).sort((x, y) => y.messages - x.messages);

  const headB = ['Agente', 'Mensagens_Enviadas', 'Conversas_Atendidas', 'Media_Msg_por_Conversa'];
  const linesB = [headB.map(csv).join(';')];
  for (const r of rowsB) {
    const media = r.conversations ? (r.messages / r.conversations).toFixed(1) : '0';
    linesB.push([r.name, r.messages, r.conversations, media].map(csv).join(';'));
  }
  fs.writeFileSync(OUT_B, '\uFEFF' + linesB.join('\r\n'), 'utf8');

  const totalMsgs = rowsB.reduce((s, r) => s + r.messages, 0);
  console.log('');
  console.log('=================================================');
  console.log('CONCLUIDO - 100%');
  console.log('Periodo: a partir de ' + CUTOFF_STR);
  console.log('Conversas no periodo: ' + convs.length);
  console.log('Mensagens de agentes contadas: ' + totalMsgs);
  console.log('Agentes que enviaram mensagem: ' + rowsB.length);
  if (failed.length) console.log('ATENCAO: ' + failed.length + ' conversa(s) falharam ao baixar mensagens.');
  console.log('Arquivo A (por conversa): ' + OUT_A);
  console.log('Arquivo B (por mensagem): ' + OUT_B);
  console.log('=================================================');
}

main().catch((err) => { console.error('\nERRO: ' + (err.message || err)); process.exit(1); });
