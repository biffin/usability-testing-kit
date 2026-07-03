#!/usr/bin/env node
/**
 * Re-test diff — did the fixes work?
 *
 * Compares two studies of the same site (e.g. `acme` vs `acme-v2`) session by
 * session, matched on persona × task, and reports every metric that moved. This
 * is what turns the kit from a one-off critique into a measurement instrument:
 * run the study, ship the fixes, re-run the SAME personas through the SAME
 * tasks under a new slug, then diff.
 *
 * Provenance guard: each scorecard.json records the scoring-config hash AND the
 * model that role-played the persona. A synthetic persona scored under different
 * weights — or played by a different model — is a different instrument, so a
 * delta it produces is not necessarily a site improvement. The diff says so up
 * front when the rulers differ.
 *
 * Reads scorecard.json sidecars (preferred), falling back to parsing
 * transcript.md. Pure Node, zero dependencies.
 *
 * Usage:
 *   node lib/diff.js <baseline-slug> <current-slug>   (or: npm run diff -- a b)
 *
 * Writes projects/<current-slug>/diff-report.md and prints the comparison.
 */
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./config');
const { parseScorecard } = require('../eval/check-sessions');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(ROOT, 'projects');

const baseTaskOf = (folder) => (folder.match(/^(\d+)/) || [null, folder])[1];

function loadStudy(slug) {
  const dir = path.join(PROJECTS_DIR, slug, 'sessions');
  if (!fs.existsSync(dir)) {
    console.error(`No sessions found for project "${slug}" (looked in projects/${slug}/sessions/)`);
    process.exit(1);
  }
  const study = {}; // key "persona×task" -> session
  for (const persona of fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_'))) {
    const pdir = path.join(dir, persona.name);
    // Aggregate replications (01-r1, 01-r2) into one persona×baseTask entry.
    const buckets = {};
    for (const task of fs.readdirSync(pdir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const sdir = path.join(pdir, task.name);
      const scPath = path.join(sdir, 'scorecard.json');
      const trPath = path.join(sdir, 'transcript.md');
      let json = null;
      if (fs.existsSync(scPath)) { try { json = JSON.parse(fs.readFileSync(scPath, 'utf8')); } catch { json = null; } }
      const parsed = (!json && fs.existsSync(trPath)) ? parseScorecard(fs.readFileSync(trPath, 'utf8')) : null;
      if (!json && !parsed) continue;
      const m = json?.metrics || parsed || {};
      const rec = {
        result: json?.result || (parsed ? (parsed.success === 1 ? 'PASS' : parsed.success === 0 ? 'FAIL' : 'PARTIAL') : '—'),
        sessionScore: json?.sessionScore ?? parsed?.sessionScore ?? null,
        metrics: { success: m.success ?? null, efficiency: m.efficiency ?? null, seq: m.seq ?? null, intent: m.intent ?? null, confidence: m.confidence ?? null },
        issues: Array.isArray(json?.issues) ? json.issues : [],
        meta: json?.meta || null,
      };
      const bt = baseTaskOf(task.name);
      (buckets[bt] = buckets[bt] || []).push(rec);
    }
    for (const [bt, recs] of Object.entries(buckets)) {
      study[`${persona.name}×${bt}`] = aggregate(persona.name, bt, recs);
    }
  }
  return study;
}

// Mean the numeric metrics across replications; keep the union of issues + meta.
function aggregate(persona, task, recs) {
  const avg = (key) => {
    const vals = recs.map(r => r.metrics[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const scores = recs.map(r => r.sessionScore).filter(v => v != null);
  return {
    persona, task, n: recs.length,
    sessionScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    metrics: { success: avg('success'), efficiency: avg('efficiency'), seq: avg('seq'), intent: avg('intent'), confidence: avg('confidence') },
    result: recs.length === 1 ? recs[0].result : `${recs.filter(r => /PASS/.test(r.result) && !/PARTIAL/.test(r.result)).length}/${recs.length} PASS`,
    issues: recs.flatMap(r => r.issues),
    hashes: [...new Set(recs.map(r => r.meta?.scoringHash).filter(Boolean))],
    models: [...new Set(recs.map(r => r.meta?.model).filter(Boolean))],
  };
}

const fmtDelta = (d) => (d == null ? '—' : d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2));
// SessionScore/metrics: higher is better, so a positive delta is an improvement.
const arrow = (d) => (d == null ? '·' : d > 0.001 ? '▲ improved' : d < -0.001 ? '▼ worse' : '· unchanged');

function main() {
  const [baseSlug, currSlug] = [process.argv[2], process.argv[3]];
  if (!baseSlug || !currSlug) {
    const available = fs.existsSync(PROJECTS_DIR) ? fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).join(', ') : '(none)';
    console.error(`Usage: node lib/diff.js <baseline-slug> <current-slug>\nAvailable projects: ${available}`);
    process.exit(1);
  }
  const base = loadStudy(baseSlug);
  const curr = loadStudy(currSlug);
  const config = loadConfig();

  const allHashes = [...new Set([...Object.values(base), ...Object.values(curr)].flatMap(s => s.hashes))];
  const allModels = [...new Set([...Object.values(base), ...Object.values(curr)].flatMap(s => s.models))];
  const sameRuler = allHashes.length <= 1 && allModels.length <= 1;

  const lines = [];
  const out = (s = '') => lines.push(s);

  out(`# Re-test diff — ${baseSlug} → ${currSlug}`);
  out(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  out('');
  if (sameRuler) {
    out(`> Same ruler on both sides${allHashes[0] ? ` (scoring \`${allHashes[0]}\`${allModels[0] ? `, model ${allModels[0]}` : ''})` : ''} — every delta below reflects a change in the SITE, not the instrument.`);
  } else {
    out(`> ⚠️ **Instrument mismatch.** Scoring configs: ${allHashes.map(h => `\`${h}\``).join(', ') || 'unstamped'} · models: ${allModels.join(', ') || 'unknown'}. A synthetic persona scored under different weights or played by a different model is a different measurement instrument — some deltas below may reflect the ruler, not the site. Re-score both studies under one config/model for a clean comparison.`);
  }
  out('');

  const keys = [...new Set([...Object.keys(base), ...Object.keys(curr)])].sort();
  let improved = 0, worse = 0, unchanged = 0;
  const transitions = [];

  out('## Session deltas');
  out('');
  out('| Persona × task | Result | SessionScore | Δ | Success | SEQ | Intent | Confidence |');
  out('|---|---|---|---|---|---|---|---|');
  for (const key of keys) {
    const b = base[key], c = curr[key];
    if (!b || !c) {
      out(`| ${key} | ${b ? b.result : '—'} → ${c ? c.result : '—'} | | only in ${b ? baseSlug : currSlug} | | | | |`);
      continue;
    }
    const d = (b.sessionScore != null && c.sessionScore != null) ? Math.round((c.sessionScore - b.sessionScore) * 100) / 100 : null;
    if (d > 0.001) improved++; else if (d < -0.001) worse++; else unchanged++;

    const bPass = /PASS/.test(b.result) && !/PARTIAL/.test(b.result);
    const cPass = /PASS/.test(c.result) && !/PARTIAL/.test(c.result);
    const bFail = /FAIL/.test(b.result), cFail = /FAIL/.test(c.result);
    if (bFail && cPass) transitions.push(`FAIL → PASS: ${key}`);
    if (bPass && cFail) transitions.push(`PASS → FAIL: ${key} ⚠`);

    const dm = (k) => (b.metrics[k] != null && c.metrics[k] != null) ? fmtDelta(Math.round((c.metrics[k] - b.metrics[k]) * 100) / 100) : '—';
    out(`| ${key} | ${b.result} → ${c.result} | ${b.sessionScore?.toFixed(2) ?? '—'} → ${c.sessionScore?.toFixed(2) ?? '—'} | **${fmtDelta(d)}** ${arrow(d)} | ${dm('success')} | ${dm('seq')} | ${dm('intent')} | ${dm('confidence')} |`);
  }
  out('');

  // Issue transitions: resolved (in baseline, gone in current) and new.
  const issueSet = (study) => new Set(Object.values(study).flatMap(s => s.issues.map(i => i.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80))));
  const baseIssues = issueSet(base), currIssues = issueSet(curr);
  const resolved = [...baseIssues].filter(i => !currIssues.has(i));
  const introduced = [...currIssues].filter(i => !baseIssues.has(i));

  out('## Issue changes');
  out('');
  out(`- **Resolved (${resolved.length}):** ${resolved.length ? resolved.slice(0, 10).map(i => `“${i}”`).join('; ') : '_none_'}`);
  out(`- **New (${introduced.length}):** ${introduced.length ? introduced.slice(0, 10).map(i => `“${i}”`).join('; ') : '_none_'}`);
  out('');

  out('## Headline');
  out('');
  out(`Of the matched sessions: **${improved} improved · ${worse} worse · ${unchanged} unchanged.**`);
  const matched = keys.filter(k => base[k] && curr[k]);
  const meanB = matched.map(k => base[k].sessionScore).filter(v => v != null);
  const meanC = matched.map(k => curr[k].sessionScore).filter(v => v != null);
  const mb = meanB.length ? meanB.reduce((a, b) => a + b, 0) / meanB.length : null;
  const mc = meanC.length ? meanC.reduce((a, b) => a + b, 0) / meanC.length : null;
  if (mb != null && mc != null) out(`Mean SessionScore across the ${matched.length} matched session(s): **${mb.toFixed(2)} → ${mc.toFixed(2)}** (${fmtDelta(Math.round((mc - mb) * 100) / 100)}).`);
  if (transitions.length) { out(''); out(transitions.join('  \n')); }
  out('');

  const reportPath = path.join(PROJECTS_DIR, currSlug, 'diff-report.md');
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(lines.join('\n'));
  console.log(`\n→ written to ${path.relative(ROOT, reportPath)}`);
}

if (require.main === module) main();
