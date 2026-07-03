#!/usr/bin/env node
/**
 * Self-contained HTML report generator.
 *
 * Reads every session a project has produced — scorecard.json sidecars
 * (preferred) with transcript.md as the fallback and source of the persona's
 * Likert reasoning — and writes projects/<slug>/report.html: one file, images
 * embedded, sendable over email or Slack with nothing attached.
 *
 * Contents: a persona × task SessionScore heatmap, aggregate metrics with
 * false-success flags, a cross-session issue rollup, per-session cards, and
 * journey strips (each session's screenshots in order, captioned with the step
 * action). Replication runs (task folders like 01-r1, 01-r2) are aggregated so
 * the heatmap shows the score's spread, not a single draw.
 *
 * Pure Node, zero dependencies.
 *
 * Usage:
 *   node lib/report.js <slug>        (or: npm run report -- <slug>)
 */
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { parseScorecard } = require('../eval/check-sessions');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT, 'projects');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- tiny markdown renderer (for findings.md, if present) ----------
function inlineMd(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, href) => /^https?:/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${t}</a>` : t);
}
function renderMd(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null, table = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };
  for (const line of lines) {
    const t = line.trim();
    if (/^\|/.test(t)) {
      const cells = t.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      if (!table) { table = true; out.push('<table><thead><tr>' + cells.map(c => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>'); }
      else out.push('<tr>' + cells.map(c => `<td>${inlineMd(c)}</td>`).join('') + '</tr>');
      continue;
    }
    closeTable();
    const h = t.match(/^(#{1,4})\s+(.*)/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${inlineMd(h[2])}</h${h[1].length + 1}>`); continue; }
    if (/^---+$/.test(t)) { closeList(); out.push('<hr>'); continue; }
    const li = t.match(/^[-*]\s+(.*)/);
    if (li) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inlineMd(li[1])}</li>`); continue; }
    const oli = t.match(/^\d+\.\s+(.*)/);
    if (oli) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inlineMd(oli[1])}</li>`); continue; }
    if (t === '') { closeList(); continue; }
    closeList();
    out.push(`<p>${inlineMd(t)}</p>`);
  }
  closeList(); closeTable();
  return out.join('\n');
}

// ---------- color bands ----------
function scoreBand(score) {
  if (score == null) return { bg: '#E5E7EB', fg: '#6B7280', label: '—' };
  if (score < 0.35) return { bg: '#DC2626', fg: '#fff', label: 'Critical' };
  if (score < 0.50) return { bg: '#EA580C', fg: '#fff', label: 'Poor' };
  if (score < 0.65) return { bg: '#D97706', fg: '#fff', label: 'Fair' };
  if (score < 0.80) return { bg: '#65A30D', fg: '#fff', label: 'Good' };
  return { bg: '#16A34A', fg: '#fff', label: 'Strong' };
}
const SEV_COLOR = { high: '#DC2626', medium: '#D97706', low: '#65A30D' };
const SEV_RANK = { high: 3, medium: 2, low: 1 };

// ---------- data gathering ----------
function baseTaskOf(folder) {
  // "01-r2" -> "01"; "01" -> "01". Also tolerate "01-pricing".
  const m = folder.match(/^(\d+)/);
  return m ? m[1] : folder;
}
function replicationOf(folder) {
  const m = folder.match(/-r(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

function pngDataUri(file) {
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function loadSessions(slug) {
  const dir = path.join(PROJECTS_DIR, slug, 'sessions');
  if (!fs.existsSync(dir)) return [];
  const sessions = [];
  for (const persona of fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_'))) {
    const personaDir = path.join(dir, persona.name);
    for (const task of fs.readdirSync(personaDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const sdir = path.join(personaDir, task.name);
      const transcriptPath = path.join(sdir, 'transcript.md');
      const scorecardPath = path.join(sdir, 'scorecard.json');
      if (!fs.existsSync(transcriptPath) && !fs.existsSync(scorecardPath)) continue;

      const transcript = fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
      const parsed = transcript ? parseScorecard(transcript) : null;
      let json = null;
      if (fs.existsSync(scorecardPath)) { try { json = JSON.parse(fs.readFileSync(scorecardPath, 'utf8')); } catch { json = null; } }

      // Prefer the JSON sidecar for numbers; fall back to transcript parsing.
      const m = json?.metrics || {};
      const metrics = {
        success: m.success ?? parsed?.success ?? null,
        efficiency: m.efficiency ?? parsed?.efficiency ?? null,
        seq: m.seq ?? parsed?.seq ?? null,
        intent: m.intent ?? parsed?.intent ?? null,
        confidence: m.confidence ?? parsed?.confidence ?? null,
      };
      const sessionScore = json?.sessionScore ?? parsed?.sessionScore ?? null;

      // Journey steps: JSON links actions to screenshots. If absent, fall back
      // to whatever PNGs are on disk, uncaptioned.
      let steps = Array.isArray(json?.steps) ? json.steps : [];
      const shotsDir = path.join(sdir, 'screenshots');
      if (steps.length === 0 && fs.existsSync(shotsDir)) {
        steps = fs.readdirSync(shotsDir).filter(f => /\.png$/i.test(f)).sort()
          .map((f, i) => ({ n: i + 1, action: '', screenshot: f }));
      }
      const journey = steps.map(s => ({
        n: s.n, action: s.action || '',
        img: s.screenshot ? pngDataUri(path.join(shotsDir, s.screenshot)) : null,
        quote: s.quote || '',
      })).filter(s => s.img);

      sessions.push({
        persona: persona.name,
        taskFolder: task.name,
        baseTask: baseTaskOf(task.name),
        replication: replicationOf(task.name),
        result: json?.result || (parsed ? (parsed.success === 1 ? 'PASS' : parsed.success === 0 ? 'FAIL' : 'PARTIAL') : '—'),
        metrics, sessionScore,
        notes: {
          seq: parsed?.seqNote || '', intent: parsed?.intentNote || '', confidence: parsed?.confidenceNote || '',
        },
        issues: Array.isArray(json?.issues) ? json.issues : parseIssuesFromTranscript(transcript),
        journey,
        meta: json?.meta || null,
        hasSidecar: !!json,
      });
    }
  }
  return sessions;
}

// Fallback issue extraction: a "High/Medium/Low" severity-tagged table row.
function parseIssuesFromTranscript(transcript) {
  if (!transcript) return [];
  const issues = [];
  const re = /\|\s*(High|Medium|Low)\s*\|\s*([^|]+?)\s*\|/gi;
  let m;
  while ((m = re.exec(transcript)) !== null) {
    issues.push({ severity: m[1].toLowerCase(), text: m[2].trim() });
  }
  return issues;
}

function mean(xs) { const v = xs.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

// ---------- rendering ----------
function heatmapHtml(sessions, personas, tasks) {
  // cell = mean SessionScore across replications for persona × base task
  const cell = (p, t) => {
    const runs = sessions.filter(s => s.persona === p && s.baseTask === t && s.sessionScore != null);
    if (!runs.length) return null;
    const scores = runs.map(s => s.sessionScore);
    const mu = mean(scores);
    const spread = scores.length > 1 ? (Math.max(...scores) - Math.min(...scores)) / 2 : null;
    return { mu, n: scores.length, spread };
  };
  const head = '<tr><th class="corner">persona ╲ task</th>' + tasks.map(t => `<th>${esc(t)}</th>`).join('') + '</tr>';
  const rows = personas.map(p => {
    const cells = tasks.map(t => {
      const c = cell(p, t);
      if (!c) return '<td class="empty">·</td>';
      const b = scoreBand(c.mu);
      const sub = c.n > 1 ? `<span class="rep">±${c.spread.toFixed(2)} · n=${c.n}</span>` : '';
      return `<td style="background:${b.bg};color:${b.fg}" title="${b.label}">${c.mu.toFixed(2)}${sub}</td>`;
    }).join('');
    return `<tr><th class="rowh">${esc(p)}</th>${cells}</tr>`;
  }).join('');
  return `<table class="heat">${head}${rows}</table>`;
}

function aggregateHtml(sessions, personas, tasks) {
  const pct = (xs) => { const v = xs.filter(x => x != null); return v.length ? Math.round(mean(v.map(x => x === 1 ? 1 : x === 0.5 ? 0.5 : 0)) * 100) : null; };
  const fmt = (v, suffix = '') => v == null ? '—' : `${v}${suffix}`;

  const perTask = tasks.map(t => {
    const ss = sessions.filter(s => s.baseTask === t);
    const succ = pct(ss.map(s => s.metrics.success));
    const seq = mean(ss.map(s => s.metrics.seq));
    return `<tr><td>${esc(t)}</td><td>${ss.length}</td><td>${fmt(succ, '%')}</td><td>${seq == null ? '—' : seq.toFixed(1)}</td></tr>`;
  }).join('');

  // False-success risk: high confidence but FAIL, or low confidence but PASS.
  const flags = [];
  for (const s of sessions) {
    if (s.metrics.success === 0 && s.metrics.confidence >= 6)
      flags.push(`<li><strong>${esc(s.persona)} / ${esc(s.taskFolder)}</strong> — FAILED but rated confidence ${s.metrics.confidence}/7 (thinks they succeeded when they didn't)</li>`);
    if (s.metrics.success === 1 && s.metrics.confidence <= 2)
      flags.push(`<li><strong>${esc(s.persona)} / ${esc(s.taskFolder)}</strong> — PASSED but rated confidence ${s.metrics.confidence}/7 (succeeded without realizing it)</li>`);
  }

  const meanSeq = mean(sessions.map(s => s.metrics.seq));
  const meanIntent = mean(sessions.map(s => s.metrics.intent));
  const meanConf = mean(sessions.map(s => s.metrics.confidence));
  const badge = (label, v) => `<div class="stat"><div class="statv" style="color:${v != null && v < 4 ? '#DC2626' : '#1a1a1a'}">${v == null ? '—' : v.toFixed(1)}<span>/7</span></div><div class="statl">${label}</div></div>`;

  return `<div class="stats">${badge('Mean SEQ (ease)', meanSeq)}${badge('Mean Intent', meanIntent)}${badge('Mean Confidence', meanConf)}</div>
    <h3>Per-task success</h3>
    <table><thead><tr><th>Task</th><th>Sessions</th><th>Success rate</th><th>Mean SEQ</th></tr></thead><tbody>${perTask}</tbody></table>
    ${flags.length ? `<h3>⚠ False-success risk (${flags.length})</h3><ul class="flags">${flags.join('')}</ul>` : ''}`;
}

function issueRollupHtml(sessions) {
  // Group issues by normalized text; rank by severity × number of personas hit.
  const groups = new Map();
  for (const s of sessions) {
    for (const iss of s.issues) {
      const key = iss.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { text: iss.text, severity: iss.severity, personas: new Set(), count: 0 });
      const g = groups.get(key);
      g.personas.add(s.persona); g.count++;
      if (SEV_RANK[iss.severity] > SEV_RANK[g.severity]) g.severity = iss.severity;
    }
  }
  const shared = [...groups.values()].filter(g => g.personas.size >= 2)
    .sort((a, b) => (SEV_RANK[b.severity] * b.personas.size) - (SEV_RANK[a.severity] * a.personas.size));
  if (!shared.length) return '<p class="muted">No issue appeared across two or more personas. Per-session issues are listed on each card below.</p>';
  const rows = shared.map(g => `<tr><td><span class="chip" style="color:${SEV_COLOR[g.severity]};border-color:${SEV_COLOR[g.severity]}">${g.severity}</span></td><td>${esc(g.text)}</td><td>${g.personas.size} personas · ${g.count}×</td></tr>`).join('');
  return `<table><thead><tr><th>Severity</th><th>Issue (hit by ≥2 personas)</th><th>Reach</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function sessionCardHtml(s) {
  const b = scoreBand(s.sessionScore);
  const metricRow = (label, v, suffix = '') => `<tr><td>${label}</td><td>${v == null ? '—' : v + suffix}</td></tr>`;
  // Strip one layer of wrapping quotes the persona note may already carry, so
  // the report's own quotation marks don't double up.
  const unquote = (t) => String(t).trim().replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim();
  const likert = [
    ['SEQ (ease)', s.metrics.seq, s.notes.seq],
    ['Intent', s.metrics.intent, s.notes.intent],
    ['Confidence', s.metrics.confidence, s.notes.confidence],
  ].filter(([, , note]) => note).map(([label, v, note]) => `<li><strong>${label} ${v}/7</strong> — <em>“${esc(unquote(note))}”</em></li>`).join('');

  const issues = s.issues.length
    ? `<ul class="iss">${s.issues.map(i => `<li><span class="chip" style="color:${SEV_COLOR[i.severity] || '#6B7280'};border-color:${SEV_COLOR[i.severity] || '#6B7280'}">${esc(i.severity)}</span> ${esc(i.text)}</li>`).join('')}</ul>`
    : '<p class="muted">No issues logged.</p>';

  const strip = s.journey.length
    ? `<div class="strip">${s.journey.map(j => `<figure><img src="${j.img}" alt="step ${j.n}"><figcaption><span class="stepn">${j.n}</span> ${esc(j.action)}${j.quote ? `<br><em>“${esc(j.quote)}”</em>` : ''}</figcaption></figure>`).join('')}</div>`
    : '<p class="muted">No screenshots captured for this session.</p>';

  const resultColor = s.result.includes('PASS') && !s.result.includes('PARTIAL') ? '#16A34A' : s.result.includes('FAIL') ? '#DC2626' : '#D97706';

  return `<article class="card">
    <header>
      <h4>${esc(s.persona)} · task ${esc(s.taskFolder)}</h4>
      <span class="result" style="background:${resultColor}">${esc(s.result)}</span>
      <span class="score" style="background:${b.bg};color:${b.fg}">SessionScore ${s.sessionScore == null ? '—' : s.sessionScore.toFixed(2)}</span>
    </header>
    <div class="cols">
      <div><h5>Scorecard</h5><table class="mini"><tbody>
        ${metricRow('Success', s.metrics.success)}
        ${metricRow('Efficiency', s.metrics.efficiency)}
        ${metricRow('SEQ', s.metrics.seq, '/7')}
        ${metricRow('Intent', s.metrics.intent, '/7')}
        ${metricRow('Confidence', s.metrics.confidence, '/7')}
      </tbody></table></div>
      <div><h5>In their words</h5>${likert ? `<ul class="qs">${likert}</ul>` : '<p class="muted">No Likert reasoning parsed.</p>'}<h5>Issues</h5>${issues}</div>
    </div>
    <h5>Journey</h5>${strip}
  </article>`;
}

function main() {
  const slug = process.argv[2];
  if (!slug || !fs.existsSync(path.join(PROJECTS_DIR, slug))) {
    const available = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).join(', ') : '(none)';
    console.error(`Usage: node lib/report.js <slug>\nAvailable projects: ${available}`);
    process.exit(1);
  }
  const projectDir = path.join(PROJECTS_DIR, slug);
  const sessions = loadSessions(slug);
  if (!sessions.length) {
    console.error(`No sessions found under projects/${slug}/sessions/ — run a session first.`);
    process.exit(1);
  }

  const config = loadConfig();
  const personas = [...new Set(sessions.map(s => s.persona))].sort();
  const tasks = [...new Set(sessions.map(s => s.baseTask))].sort();

  const projectMd = fs.existsSync(path.join(projectDir, 'project.md')) ? fs.readFileSync(path.join(projectDir, 'project.md'), 'utf8') : '';
  const findingsMd = fs.existsSync(path.join(projectDir, 'findings.md')) ? fs.readFileSync(path.join(projectDir, 'findings.md'), 'utf8') : '';
  const siteUrl = (projectMd.match(/\*\*URL:\*\*\s*(\S+)/) || [])[1] || '';
  const projectName = (projectMd.match(/^#\s*Project:\s*(.+)$/m) || [])[1] || slug;

  // Provenance: warn if sessions were scored under mixed rulers or models.
  const hashes = [...new Set(sessions.map(s => s.meta?.scoringHash).filter(Boolean))];
  const models = [...new Set(sessions.map(s => s.meta?.model).filter(Boolean))];
  const noSidecar = sessions.filter(s => !s.hasSidecar).length;
  const provBits = [];
  if (hashes.length) provBits.push(`scoring ${hashes.join(', ')}`);
  if (models.length) provBits.push(`model ${models.join(', ')}`);
  if (noSidecar) provBits.push(`${noSidecar} session(s) without scorecard.json (parsed from transcript)`);

  // Cards grouped by persona, replications together.
  const orderedSessions = [...sessions].sort((a, b) =>
    a.persona.localeCompare(b.persona) || a.taskFolder.localeCompare(b.taskFolder));
  const meanScore = mean(sessions.map(s => s.sessionScore));

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Usability study — ${esc(projectName)}</title>
<style>
  :root { --ink:#1a1a1a; --muted:#6b7280; --line:#e4e7ee; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 system-ui, -apple-system, sans-serif; color: var(--ink); margin: 0; background: #f7f8fa; }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 21px; margin: 40px 0 12px; }
  h3 { font-size: 16px; margin: 22px 0 8px; } h4 { font-size: 16px; margin: 0; }
  h5 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 14px 0 6px; }
  .muted { color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; font-size: 13.5px; background: #fff; }
  th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #f0f2f6; }
  .chip { display: inline-block; border: 1.5px solid; border-radius: 999px; padding: 0 8px; font-size: 11.5px; font-weight: 700; background: #fff; text-transform: capitalize; }
  table.heat { table-layout: fixed; }
  table.heat th.corner { background: #f0f2f6; font-size: 11px; color: var(--muted); }
  table.heat td, table.heat th.rowh { text-align: center; font-weight: 700; font-size: 15px; }
  table.heat th.rowh { background: #f0f2f6; text-align: left; font-weight: 600; }
  table.heat td.empty { background: #f7f8fa; color: #cbd0d8; font-weight: 400; }
  table.heat .rep { display: block; font-size: 10px; font-weight: 500; opacity: .85; }
  .stats { display: flex; gap: 14px; margin: 6px 0 10px; }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px 18px; flex: 1; text-align: center; }
  .statv { font-size: 28px; font-weight: 700; } .statv span { font-size: 14px; color: var(--muted); font-weight: 500; }
  .statl { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  ul.flags, ul.qs, ul.iss { margin: 4px 0; padding-left: 18px; } ul.flags li, ul.qs li, ul.iss li { margin: 4px 0; font-size: 13.5px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin: 14px 0 22px; }
  .card header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .result, .score { color: #fff; font-weight: 700; border-radius: 7px; padding: 2px 9px; font-size: 12.5px; }
  .score { margin-left: auto; }
  .cols { display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; } @media (max-width:760px){ .cols{ grid-template-columns:1fr; } }
  table.mini { font-size: 13px; } table.mini td:first-child { color: var(--muted); width: 45%; }
  .strip { display: flex; gap: 10px; overflow-x: auto; padding: 6px 2px 12px; }
  .strip figure { margin: 0; flex: 0 0 240px; }
  .strip img { width: 240px; height: auto; border: 1px solid var(--line); border-radius: 6px; display: block; }
  .strip figcaption { font-size: 11.5px; color: var(--ink); margin-top: 5px; line-height: 1.35; }
  .strip .stepn { display: inline-block; background: #1a1a1a; color: #fff; border-radius: 999px; min-width: 16px; height: 16px; text-align: center; font-size: 10px; line-height: 16px; margin-right: 3px; }
  .prov { font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); margin-top: 48px; padding-top: 14px; }
  code { background: #eef1f5; border-radius: 4px; padding: 1px 5px; font-size: 13px; } a { color: #2563EB; }
</style></head><body><div class="wrap">
  <h1>Usability study — ${esc(projectName)}</h1>
  <p class="muted">${esc(siteUrl)} · generated ${new Date().toISOString().slice(0, 10)} · ${sessions.length} session(s) · ${personas.length} persona(s) × ${tasks.length} task(s) · mean SessionScore ${meanScore == null ? '—' : meanScore.toFixed(2)}</p>
  ${provBits.length ? `<p class="muted">Provenance: ${esc(provBits.join(' · '))}</p>` : ''}

  <h2>Where people struggle</h2>
  <p class="muted">SessionScore per persona × task (0 = abandoned, 1 = flawless). Cells with <code>n</code> are replication runs; <code>±</code> is half the score spread across runs — a wide spread means the experience is ambiguous enough to go either way.</p>
  ${heatmapHtml(sessions, personas, tasks)}

  <h2>Aggregate metrics</h2>
  ${aggregateHtml(sessions, personas, tasks)}

  <h2>Issues hit by more than one persona</h2>
  ${issueRollupHtml(sessions)}

  ${findingsMd ? `<h2>Findings</h2>\n${renderMd(findingsMd.replace(/^# .*\n/, ''))}` : ''}

  <h2>Session detail</h2>
  ${orderedSessions.map(sessionCardHtml).join('\n')}

  <p class="prov">Scores computed under <code>config/scoring.json</code> (kit v${esc(config.kitVersion)}, hash ${esc(config.hash)}); sessions role-played and narrated by Claude. Generated by <code>lib/report.js</code> — Usability Testing Kit. Synthetic personas predict findability and comprehension problems well; treat emotion, trust, and willingness-to-pay signals as hypotheses for real research.</p>
</div></body></html>\n`;

  const outPath = path.join(projectDir, 'report.html');
  fs.writeFileSync(outPath, html);
  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${path.relative(ROOT, outPath)} (${mb} MB, self-contained — open in any browser)`);
}

if (require.main === module) main();
