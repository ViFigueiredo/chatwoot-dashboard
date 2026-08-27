// Gera os dados do dashboard de supervisores em public/dashboard-data.json
// Conteudo: conversas INICIADAS pelo agente (1a msg da conversa e do agente),
// com data, etiquetas e o(s) supervisor(es)/time(s) do agente.
// Roda com: node export-dashboard-data.js
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const API_BASE = `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}`;

const CUTOFF_STR = CONFIG.cutoffDate || '2026-08-17';
const CUTOFF = Math.floor(new Date(CUTOFF_STR + 'T00:00:00').getTime() / 1000);

const EXCLUDE = new Set((CONFIG.excludeSenders || []).map((s) => String(s).toLowerCase().trim()));
function isExcluded(name) { return EXCLUDE.has(String(name || '').toLowerCase().trim()); }

const OUT = path.join(__dirname, 'public', 'dashboard-data.json');

function apiGetOnce(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + pathname);
    const opts = { method: 'GET', headers: { 'api_access_token': CONFIG.apiToken, 'Content-Type': 'application/json' } };
    const req = https.request(url, opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON invalido de ' + pathname)); }
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
  for (let a = 0; a <= retries; a++) {
    try { return await apiGetOnce(pathname); }
    catch (e) { lastErr = e; if (a < retries) await sleep(500 * Math.pow(2, a)); }
  }
  throw lastErr;
}
function drawProgress(done, total, label) {
  const pct = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  const w = 30, f = Math.round((pct / 100) * w);
  process.stdout.write(`\r[${'#'.repeat(f)}${'-'.repeat(w - f)}] ${String(pct).padStart(3)}%  ${label}`.padEnd(72));
}
function fmtDate(unix) {
  const d = new Date(unix * 1000), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function fetchConversationsSince() {
  const first = await apiGet(`/conversations?status=all&page=1`);
  const meta = (first && first.data && first.data.meta) || {};
  const total = meta.all_count || 0;
  const perPage = ((first.data && first.data.payload) || []).length || 25;
  const estPages = Math.max(1, Math.ceil(total / perPage));
  const kept = [];
  let page = 1, stop = false;
  while (!stop) {
    const res = page === 1 ? first : await apiGet(`/conversations?status=all&page=${page}`);
    const payload = (res && res.data && res.data.payload) || [];
    if (payload.length === 0) break;
    let anyRecent = false;
    for (const c of payload) if ((c.last_activity_at || 0) >= CUTOFF) { kept.push(c); anyRecent = true; }
    drawProgress(Math.min(page, estPages), estPages, `varrendo pagina ${page} | no periodo: ${kept.length}`);
    if (!anyRecent && page > 1) stop = true;
    page++;
    if (page > estPages + 5) break;
  }
  return kept;
}

// Acha a 1a mensagem cronologica da conversa; retorna se for outgoing de agente.
async function findProspeccao(conv) {
  const cid = conv.id;
  let earliest = null, before = null, guard = 0;
  while (guard++ < 400) {
    const q = before ? `/conversations/${cid}/messages?before=${before}` : `/conversations/${cid}/messages`;
    const res = await apiGet(q);
    const msgs = (res && res.payload) || [];
    if (msgs.length === 0) break;
    let oldestId = Infinity;
    for (const m of msgs) {
      if ((m.id || Infinity) < oldestId) oldestId = m.id;
      if (m.message_type !== 0 && m.message_type !== 1) continue;
      if (m.private) continue;
      if (!earliest || (m.created_at || 0) < earliest.created_at) earliest = m;
    }
    if (msgs.length < 20) break;
    before = oldestId;
  }
  if (!earliest || earliest.message_type !== 1) return null;
  const sender = earliest.sender || {};
  if (sender.type !== 'user' || !sender.id) return null;
  if (isExcluded(sender.name)) return null;
  return earliest;
}

async function main() {
  console.log('Chatwoot - Gerando dados do dashboard de supervisores');
  console.log('Periodo: a partir de ' + CUTOFF_STR + ' | Conta: ' + CONFIG.accountId);
  console.log('');

  process.stdout.write('Buscando etiquetas, agentes e times... ');
  const [labelsRes, agentsRes, teamsRes] = await Promise.all([
    apiGet('/labels'), apiGet('/agents'), apiGet('/teams'),
  ]);
  const labels = (labelsRes && labelsRes.payload) || [];
  const agents = Array.isArray(agentsRes) ? agentsRes : (agentsRes.payload || []);
  const teams = Array.isArray(teamsRes) ? teamsRes : (teamsRes.payload || []);
  console.log(`OK (${labels.length} etiquetas, ${agents.length} agentes, ${teams.length} times)`);

  // Mapa agente -> lista de supervisores (times). Um agente pode estar em varios.
  const agentTeams = {}; // agentName -> [teamName]
  for (const t of teams) {
    try {
      const mem = await apiGet(`/teams/${t.id}/team_members`);
      const members = Array.isArray(mem) ? mem : (mem.payload || []);
      for (const m of members) {
        if (isExcluded(m.name)) continue;
        if (!agentTeams[m.name]) agentTeams[m.name] = [];
        agentTeams[m.name].push(t.name);
      }
    } catch (e) { /* time sem membros ou erro pontual */ }
  }

  console.log('\n[1/2] Selecionando conversas do periodo:');
  const convs = await fetchConversationsSince();
  process.stdout.write('\n      ' + convs.length + ' conversas.\n');

  console.log('[2/2] Identificando conversas iniciadas por agente:');
  const records = [];
  const concurrency = CONFIG.fetchConcurrency || 8;
  let done = 0, idx = 0, found = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= convs.length) break;
      const conv = convs[i];
      try {
        const first = await findProspeccao(conv);
        if (first && (first.created_at || 0) >= CUTOFF) {
          const sender = first.sender || {};
          const contact = (conv.meta && conv.meta.sender) || {};
          records.push({
            agente: sender.name || ('Agente ' + sender.id),
            data: fmtDate(first.created_at),
            conversaId: conv.id,
            telefone: String(contact.phone_number || '').replace(/\D/g, ''),
            contatoId: contact.id || null,
            status: conv.status || '',
            labels: conv.labels || [],
            supervisores: agentTeams[sender.name] || [],
          });
          found++;
        }
      } catch (e) { /* ignora falha pontual */ }
      done++;
      drawProgress(done, convs.length, `conversas ${done}/${convs.length} | iniciadas: ${found}`);
    }
  }
  const ws = [];
  for (let i = 0; i < concurrency; i++) ws.push(worker());
  await Promise.all(ws);
  process.stdout.write('\n');

  const out = {
    generatedAt: new Date().toISOString(),
    cutoffDate: CUTOFF_STR,
    labels: labels.map((l) => ({ title: l.title, color: l.color })),
    teams: teams.map((t) => t.name),
    agentTeams,
    records,
  };
  fs.writeFileSync(OUT, JSON.stringify(out), 'utf8');

  console.log('=================================================');
  console.log('CONCLUIDO - dados gerados: ' + records.length + ' conversas iniciadas por agente');
  console.log('Arquivo: ' + OUT);
  console.log('Agora rode: node server.js  e abra http://localhost:3000/supervisor');
  console.log('=================================================');
}

main().catch((err) => { console.error('\nERRO: ' + (err.message || err)); process.exit(1); });
