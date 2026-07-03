#!/usr/bin/env node
/**
 * Environment checker for the Usability Testing Kit.
 *
 * Run this FIRST after cloning. It verifies everything a session needs and
 * prints exactly what's missing and how to fix it. The headline check runs the
 * eval's own parser against a built-in fixture transcript with a known
 * scorecard — if that fails, the kit is broken before you waste a session on it.
 *
 * Pure Node, no dependencies, changes nothing on disk (except a throwaway
 * write-permission probe).
 *
 * Usage:
 *   node lib/doctor.js          (or: npm run doctor)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const results = [];
const check = (name, status, message, fix) => results.push({ name, status, message, fix });

// ---------- 1. Node version ----------
const [major] = process.versions.node.split('.').map(Number);
if (major >= 18) {
  check('Node.js version', 'pass', `v${process.versions.node}`);
} else {
  check('Node.js version', 'fail', `v${process.versions.node} — the kit needs Node 18+`,
    'Install a current LTS from https://nodejs.org');
}

// ---------- 2. Kit files present ----------
const REQUIRED_FILES = [
  'CLAUDE.md',
  'generate-prompt.md',
  'lib/config.js',
  'eval/check-sessions.js',
  'templates/persona.md',
  'templates/task.md',
  'templates/project.md',
  'config/scoring.json',
];
const missing = REQUIRED_FILES.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length === 0) {
  check('Kit files', 'pass', `All ${REQUIRED_FILES.length} required files present`);
} else {
  check('Kit files', 'fail', `Missing: ${missing.join(', ')}`,
    'Re-clone the repository — the kit is incomplete.');
}

// ---------- 3. Scoring config ----------
let config = null;
try {
  const { loadConfig } = require('./config');
  config = loadConfig();
  check('Scoring config', 'pass', `config/scoring.json valid · thresholds ${config.hash}`);
} catch (e) {
  check('Scoring config', 'fail', e.message,
    'Fix the JSON (weights must sum to 1.0), or restore config/scoring.json from the repository.');
}

// ---------- 4. Eval self-test on a fixture transcript ----------
// A tiny fake transcript with a hand-verified scorecard. If the eval can parse
// it and the SessionScore math checks out, the scoring pipeline works end to end.
try {
  const { parseScorecard } = require('../eval/check-sessions');
  const fixture = `# Sarah — Pricing check

Result: PARTIAL PASS

## Quantitative Scorecard

| Metric | Value | Notes / persona reasoning |
|---|---|---|
| Success | 0.5 | PARTIAL — found a tier but unsure it fit |
| Efficiency | 0.50 | 4 optimal vs 8 actual |
| SEQ (ease) | 3 / 7 | "It wasn't terrible but I had to hunt." |
| Intent | 2 / 7 | "I'm not filling a form to learn the price." |
| Task confidence | 4 / 7 | "Think it was right, not sure." |
| **SessionScore** | **0.47** | |

Raw counters: actual_steps=8, optimal_steps=4.
`;
  const sc = parseScorecard(fixture);
  if (!sc || sc.success !== 0.5 || sc.seq !== 3 || sc.sessionScore !== 0.47 || sc.actualSteps !== 8) {
    throw new Error('parser did not extract the expected values from the fixture');
  }
  // Recompute the SessionScore from config and confirm it matches the fixture.
  if (config) {
    const w = config.scoring.weights;
    const expected = w.success * sc.success + w.efficiency * sc.efficiency +
      w.seq * (sc.seq / 7) + w.intent * (sc.intent / 7) + w.confidence * (sc.confidence / 7);
    if (Math.abs(expected - sc.sessionScore) > config.scoring.eval.sessionScoreTolerance) {
      throw new Error(`fixture SessionScore ${sc.sessionScore} disagrees with the config formula (${expected.toFixed(2)})`);
    }
  }
  check('Eval self-test', 'pass', 'Parsed the fixture transcript and the SessionScore math checks out');
} catch (e) {
  check('Eval self-test', 'fail', `Scoring pipeline broken: ${e.message}`,
    'Restore eval/check-sessions.js and config/scoring.json from the repository.');
}

// ---------- 5. projects/ writable ----------
const projectsDir = path.join(ROOT, 'projects');
try {
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);
  const probe = path.join(projectsDir, `.doctor-probe-${Date.now()}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
  check('projects/ folder', 'pass',
    projects.length ? `Writable · existing projects: ${projects.join(', ')}` : 'Writable · no projects yet');
} catch (e) {
  check('projects/ folder', 'fail', `Cannot write to projects/: ${e.message}`,
    'Check folder permissions — session output is saved here.');
}

// ---------- 6. Playwright MCP configured ----------
function mentionsPlaywright(file) {
  try { return fs.existsSync(file) && /playwright/i.test(fs.readFileSync(file, 'utf8')); }
  catch { return false; }
}
const mcpLocations = [
  path.join(ROOT, '.mcp.json'),
  path.join(os.homedir(), '.claude.json'),
  path.join(os.homedir(), '.claude', 'settings.json'),
];
const foundMcp = mcpLocations.find(mentionsPlaywright);
if (foundMcp) {
  check('Playwright MCP', 'pass', `Configured in ${foundMcp.replace(os.homedir(), '~')}`);
} else {
  check('Playwright MCP', 'warn', 'No Playwright MCP configuration found',
    'The repo ships one in .mcp.json — Claude Code should pick it up when you open this folder (approve it when prompted). If not, add the "playwright" server to your Claude Code MCP settings and restart.');
}

// ---------- 7. Optional synthesis deps ----------
const hasSdk = fs.existsSync(path.join(ROOT, 'node_modules', '@anthropic-ai', 'sdk'));
const hasEnv = fs.existsSync(path.join(ROOT, '.env'));
if (hasSdk && hasEnv) {
  check('Optional: synthesize.js', 'pass', 'SDK installed and .env present');
} else {
  check('Optional: synthesize.js', 'info',
    'Not set up — fine. Claude synthesizes findings in-conversation for free.',
    'Only if you want the batch script: npm install && cp .env.example .env');
}

// ---------- report ----------
const ICON = { pass: '✅', warn: '⚠️ ', fail: '❌', info: 'ℹ️ ' };
console.log('\n🩺 Usability Testing Kit — doctor\n');
for (const r of results) {
  console.log(`  ${ICON[r.status]} ${r.name.padEnd(24)} ${r.message}`);
  if (r.fix && r.status !== 'pass') console.log(`     ${' '.repeat(24)}→ ${r.fix}`);
}
const fails = results.filter(r => r.status === 'fail').length;
const warns = results.filter(r => r.status === 'warn').length;
console.log('');
if (fails) {
  console.log(`  ${fails} problem(s) must be fixed before running a session.\n`);
  process.exit(1);
} else if (warns) {
  console.log('  Ready, with warnings. Open this folder in Claude Code and say: "generate for https://your-site.com"\n');
} else {
  console.log('  All good. Open this folder in Claude Code and say: "generate for https://your-site.com"\n');
}
