// Relatorio de PROSPECCAO - clientes novos prospectados por dia.
// Regra: uma conversa e "prospeccao" quando a PRIMEIRA mensagem da conversa
// foi enviada pelo AGENTE (outgoing). Se o cliente falou primeiro (incoming),
// e atendimento receptivo e NAO conta.
// Dia da prospeccao = data dessa primeira mensagem do agente.
// Roda com: node export-primeiras.js
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

const OUT = path.join(__dirname, 'analise-prospeccao-primeira-msg-dia.csv');

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

function fmt(unix) {
  const d = new Date(unix * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const hora = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return { data, hora, diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][d.getDay()] };
}

// ---- Busca conversas com atividade a partir do corte ----
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
    drawProgress(Math.min(page, estPages), estPages, `varrendo pagina ${page} | no periodo: ${kept.length}`);
    if (!anyRecent && page > 1) stop = true;
    page++;
    if (page > estPages + 5) break;
  }
  return kept;
}

// ---- Determina se a conversa foi PROSPECCAO (agente falou primeiro) ----
// Pagina ate o inicio da conversa para achar a 1a mensagem cronologica.
// Retorna a 1a mensagem se ela for outgoing de um agente; senao null.
async function findProspeccao(conv) {
  const cid = conv.id;
  let earliest = null;      // mensagem com menor created_at vista ate agora
  let before = null;
  let guard = 0;
  while (guard++ < 400) {
    const q = before ? `/conversations/${cid}/messages?before=${before}` : `/conversations/${cid}/messages`;
    const res = await apiGet(q);
    const msgs = (res && res.payload) || [];
    if (msgs.length === 0) break;
    let oldestId = Infinity;
    for (const m of msgs) {
      if ((m.id || Infinity) < oldestId) oldestId = m.id;
      // considera qualquer mensagem "real" (incoming do cliente ou outgoing do agente)
      if (m.message_type !== 0 && m.message_type !== 1) continue; // ignora activity/template
      if (m.private) continue; // notas internas nao definem inicio
      if (!earliest || (m.created_at || 0) < earliest.created_at) earliest = m;
    }
    if (msgs.length < 20) break; // chegou ao inicio da conversa
    before = oldestId;
  }
  if (!earliest) return null;
  // Prospeccao = a primeira mensagem da conversa foi enviada pelo agente
  if (earliest.message_type !== 1) return null;
  const sender = earliest.sender || {};
  if (sender.type !== 'user' || !sender.id) return null;
  if (isExcluded(sender.name)) return null;
  return earliest;
}

async function main() {
  console.log('Chatwoot - Relatorio de PROSPECCAO (clientes novos por dia)');
  console.log('Conta prospeccao = conversa cuja 1a mensagem foi enviada pelo agente');
  console.log('Periodo: a partir de ' + CUTOFF_STR);
  console.log('Conta: ' + CONFIG.accountId + ' | ' + CONFIG.baseUrl);
  console.log('');

  process.stdout.write('Buscando etiquetas... ');
  const labelsRes = await apiGet('/labels');
  const labelTitles = ((labelsRes && labelsRes.payload) || []).map((l) => l.title);
  console.log(`OK (${labelTitles.length} etiquetas)`);
  if (EXCLUDE.size) console.log('Ignorando remetentes: ' + (CONFIG.excludeSenders || []).join(', '));

  console.log('\n[1/2] Selecionando conversas com atividade desde ' + CUTOFF_STR + ':');
  const convs = await fetchConversationsSince();
  process.stdout.write('\n');
  console.log('      ' + convs.length + ' conversas no periodo.');

  console.log('[2/2] Verificando quem iniciou cada conversa:');
  const candidates = [];
  const concurrency = CONFIG.fetchConcurrency || 8;
  let done = 0, idx = 0, prosp = 0;
  const failed = [];
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= convs.length) break;
      const conv = convs[i];
      try {
        const first = await findProspeccao(conv);
        if (first) {
          // So conta se a prospeccao (1a msg do agente) ocorreu no periodo
          if ((first.created_at || 0) >= CUTOFF) {
            const t = fmt(first.created_at);
            const sender = first.sender || {};
            const labels = conv.labels || [];
            const labelFlags = {};
            for (const tl of labelTitles) labelFlags[tl] = labels.includes(tl) ? 1 : 0;
            const contact = (conv.meta && conv.meta.sender) || {};
            candidates.push({
              ts: first.created_at,
              agente: sender.name || ('Agente ' + sender.id),
              email: sender.email || '',
              data: t.data, hora: t.hora, diaSemana: t.diaSemana,
              conversaId: conv.id,
              contatoId: contact.id || null,
              cliente: contact.name || '',
              telefone: contact.phone_number || '',
              statusConversa: conv.status || '',
              labelFlags,
            });
            prosp++;
          }
        }
      } catch (e) { failed.push(conv.id); }
      done++;
      drawProgress(done, convs.length, `conversas ${done}/${convs.length} | abordagens: ${prosp}`);
    }
  }
  const ws = [];
  for (let i = 0; i < concurrency; i++) ws.push(worker());
  await Promise.all(ws);
  process.stdout.write('\n');

  // ---- Deduplica por CLIENTE: mantem so a 1a abordagem do periodo ----
  // Chave do cliente: telefone (normalizado); se nao houver, usa o id do contato.
  const abordagensTotais = candidates.length;
  const firstByClient = {};
  for (const c of candidates) {
    const phone = String(c.telefone || '').replace(/\D/g, '');
    const key = phone || ('id:' + (c.contatoId || c.conversaId));
    const prev = firstByClient[key];
    if (!prev || c.ts < prev.ts) firstByClient[key] = c;
  }
  const rows = Object.values(firstByClient);
  const repetidos = abordagensTotais - rows.length;
  await Promise.all(ws);
  process.stdout.write('\n');

  rows.sort((a, b) => a.agente.localeCompare(b.agente) ||
    (a.data + a.hora).localeCompare(b.data + b.hora));

  const header = ['Agente', 'Email', 'Data', 'Hora_Inicio', 'DiaSemana', 'Conversa_ID',
    'Cliente', 'Telefone', 'Status_Conversa', ...labelTitles];
  const lines = [header.map(csv).join(';')];
  for (const r of rows) {
    lines.push([
      r.agente, r.email, r.data, r.hora, r.diaSemana, r.conversaId,
      r.cliente, r.telefone, r.statusConversa,
      ...labelTitles.map((t) => r.labelFlags[t]),
    ].map(csv).join(';'));
  }
  fs.writeFileSync(OUT, '\uFEFF' + lines.join('\r\n'), 'utf8');

  console.log('');
  console.log('=================================================');
  console.log('CONCLUIDO - 100%');
  console.log('Periodo: a partir de ' + CUTOFF_STR);
  console.log('Conversas analisadas: ' + convs.length);
  console.log('Abordagens ativas (conversas iniciadas por agente): ' + abordagensTotais);
  console.log('Clientes UNICOS prospectados no periodo: ' + rows.length);
  console.log('Reabordagens do mesmo cliente descartadas: ' + repetidos);
  if (failed.length) console.log('ATENCAO: ' + failed.length + ' conversa(s) falharam ao baixar.');
  console.log('Arquivo gerado: ' + OUT);
  console.log('Dica: Tabela Dinamica -> Linhas=Agente, Colunas=Data,');
  console.log('      Valores=Contagem de Conversa_ID = clientes novos por dia.');
  console.log('=================================================');
}

main().catch((err) => { console.error('\nERRO: ' + (err.message || err)); process.exit(1); });
