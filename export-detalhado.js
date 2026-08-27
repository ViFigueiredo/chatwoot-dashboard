// Relatorio DETALHADO (registro por registro) - uma linha por mensagem enviada.
// Objetivo: analisar volume de mensagens por dia por agente (tabela dinamica).
// Campos no estilo da Analise A (status e etiquetas da conversa) em cada linha.
// Gera 1 CSV. Mostra progresso em %. Roda com: node export-detalhado.js
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const API_BASE = `${CONFIG.baseUrl}/api/v1/accounts/${CONFIG.accountId}`;

const CUTOFF_STR = CONFIG.cutoffDate || '2026-08-17';
const CUTOFF = Math.floor(new Date(CUTOFF_STR + 'T00:00:00').getTime() / 1000);

// Remetentes a ignorar (bots/integracoes), case-insensitive.
const EXCLUDE = new Set((CONFIG.excludeSenders || []).map((s) => String(s).toLowerCase().trim()));
function isExcluded(name) { return EXCLUDE.has(String(name || '').toLowerCase().trim()); }

const OUT = path.join(__dirname, 'analise-detalhada-mensagens.csv');

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

// Converte unix (segundos) em data/hora local
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

// ---- Coleta as mensagens enviadas de UMA conversa, como linhas detalhadas ----
// Cada linha carrega o contexto da conversa (status, etiquetas, responsavel),
// no estilo da Analise A, mais os dados da mensagem (data/hora/agente).
async function collectRows(conv, labelTitles, out) {
  const cid = conv.id;
  const status = conv.status || '';
  const labels = conv.labels || [];
  const labelFlags = {};
  for (const t of labelTitles) labelFlags[t] = labels.includes(t) ? 1 : 0;
  const assignee = (conv.meta && conv.meta.assignee) || null;

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
      if (m.message_type !== 1) continue;   // 1 = outgoing
      if (m.private) continue;              // ignora nota interna
      if ((m.created_at || 0) < CUTOFF) continue;
      const sender = m.sender || {};
      if (sender.type !== 'user' || !sender.id) continue; // so agente real
      if (isExcluded(sender.name)) continue;              // ignora bots/integracoes
      const t = fmt(m.created_at);
      out.push({
        agente: sender.name || ('Agente ' + sender.id),
        agenteId: sender.id,
        email: sender.email || '',
        data: t.data,
        hora: t.hora,
        diaSemana: t.diaSemana,
        conversaId: cid,
        statusConversa: status,
        respPelaConversa: assignee ? (assignee.name || '') : 'Sem responsavel',
        labelFlags,
      });
    }
    const oldestCreated = Math.min(...msgs.map((m) => m.created_at || 0));
    if (oldestCreated < CUTOFF) break;
    if (msgs.length < 20) break;
    before = oldest;
  }
}

async function main() {
  console.log('Chatwoot - Relatorio DETALHADO (registro por registro)');
  console.log('Uma linha por mensagem enviada, a partir de ' + CUTOFF_STR);
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

  console.log('[2/2] Baixando mensagens e montando registros:');
  const rows = [];
  const concurrency = CONFIG.fetchConcurrency || 8;
  let done = 0, idx = 0;
  const failed = [];
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= convs.length) break;
      try { await collectRows(convs[i], labelTitles, rows); }
      catch (e) { failed.push(convs[i].id); }
      done++;
      drawProgress(done, convs.length, `conversas ${done}/${convs.length} | linhas: ${rows.length}`);
    }
  }
  const ws = [];
  for (let i = 0; i < concurrency; i++) ws.push(worker());
  await Promise.all(ws);
  process.stdout.write('\n');

  // Ordena por agente e depois por data/hora
  rows.sort((a, b) => a.agente.localeCompare(b.agente) ||
    (a.data + a.hora).localeCompare(b.data + b.hora));

  // Monta CSV: uma linha por mensagem, colunas no estilo A + data/hora
  const header = ['Agente', 'Email', 'Data', 'Hora', 'DiaSemana', 'Conversa_ID',
    'Status_Conversa', 'Responsavel_Conversa', ...labelTitles];
  const lines = [header.map(csv).join(';')];
  for (const r of rows) {
    lines.push([
      r.agente, r.email, r.data, r.hora, r.diaSemana, r.conversaId,
      r.statusConversa, r.respPelaConversa,
      ...labelTitles.map((t) => r.labelFlags[t]),
    ].map(csv).join(';'));
  }
  fs.writeFileSync(OUT, '\uFEFF' + lines.join('\r\n'), 'utf8');

  console.log('');
  console.log('=================================================');
  console.log('CONCLUIDO - 100%');
  console.log('Periodo: a partir de ' + CUTOFF_STR);
  console.log('Conversas no periodo: ' + convs.length);
  console.log('Registros (mensagens enviadas): ' + rows.length);
  if (failed.length) console.log('ATENCAO: ' + failed.length + ' conversa(s) falharam ao baixar.');
  console.log('Arquivo gerado: ' + OUT);
  console.log('Dica: no Excel, use Tabela Dinamica com Linhas=Agente, Colunas=Data,');
  console.log('      Valores=Contagem de Conversa_ID para ver mensagens por dia.');
  console.log('=================================================');
}

main().catch((err) => { console.error('\nERRO: ' + (err.message || err)); process.exit(1); });
