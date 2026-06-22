// Tier 1 automated checks for every session in a project.
// Reads projects/<slug>/sessions/*/*/transcript.md, runs 5 checks,
// writes projects/<slug>/eval-report.md.
//
// Usage:
//   node eval/check-sessions.js <slug>     check a specific project
//   node eval/check-sessions.js            if exactly one project exists, use it; otherwise list and exit
//   npm run eval -- <slug>

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(PROJECT_ROOT, 'projects');

function resolveSlug(argSlug) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error('No projects/ folder found. Run Mode 1 in Claude Code first.');
    process.exit(1);
  }
  const available = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (argSlug) {
    if (!available.includes(argSlug)) {
      console.error(`Project "${argSlug}" not found. Available: ${available.join(', ') || '(none)'}`);
      process.exit(1);
    }
    return argSlug;
  }
  if (available.length === 0) {
    console.error('No projects found under projects/. Run Mode 1 in Claude Code first.');
    process.exit(1);
  }
  if (available.length === 1) return available[0];
  console.error(`Multiple projects found — specify one. Available: ${available.join(', ')}`);
  console.error(`Usage: node eval/check-sessions.js <slug>`);
  process.exit(1);
}

// Per-invocation paths. Populated in main() so importing this module doesn't trigger argv parsing.
let SLUG, PROJECT_DIR, SESSIONS_DIR, PERSONAS_DIR, TASKS_DIR, REPORT_PATH;

function initPaths(slug) {
  SLUG = slug;
  PROJECT_DIR = path.join(PROJECTS_DIR, slug);
  SESSIONS_DIR = path.join(PROJECT_DIR, 'sessions');
  PERSONAS_DIR = path.join(PROJECT_DIR, 'personas');
  TASKS_DIR = path.join(PROJECT_DIR, 'tasks');
  REPORT_PATH = path.join(PROJECT_DIR, 'eval-report.md');
}

const SCORECARD_FORMULA = {
  // SessionScore = 0.4*Success + 0.2*Efficiency + 0.133*(SEQ/7) + 0.133*(Intent/7) + 0.133*(Confidence/7)
  weights: { success: 0.4, efficiency: 0.2, seq: 0.133, intent: 0.133, confidence: 0.133 },
  tolerance: 0.03,
};

// ---------- discovery ----------

function discoverSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const personas = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  const sessions = [];
  for (const persona of personas) {
    const personaDir = path.join(SESSIONS_DIR, persona.name);
    const tasks = fs.readdirSync(personaDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    for (const task of tasks) {
      const transcriptPath = path.join(personaDir, task.name, 'transcript.md');
      if (fs.existsSync(transcriptPath)) {
        sessions.push({
          persona: persona.name,
          task: task.name,
          transcriptPath,
          transcript: fs.readFileSync(transcriptPath, 'utf8'),
        });
      }
    }
  }
  return sessions;
}

function findPersonaFile(personaFirstName) {
  if (!fs.existsSync(PERSONAS_DIR)) return null;
  const candidates = fs.readdirSync(PERSONAS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => f.toLowerCase().startsWith(personaFirstName.toLowerCase()));
  if (candidates.length === 0) return null;
  return path.join(PERSONAS_DIR, candidates[0]);
}

function findTaskFile(taskNumber) {
  if (!fs.existsSync(TASKS_DIR)) return null;
  const padded = String(taskNumber).padStart(2, '0');
  const candidates = fs.readdirSync(TASKS_DIR)
    .filter(f => f.endsWith('.md'))
    .filter(f => f.startsWith(padded));
  if (candidates.length === 0) return null;
  return path.join(TASKS_DIR, candidates[0]);
}

// ---------- parsing ----------

function parseScorecard(transcript) {
  const m = transcript.match(/## Quantitative Scorecard[\s\S]*?(?=\n##\s|\n---|\n$|$)/);
  if (!m) return null;
  const block = m[0];

  const row = (label) => {
    const re = new RegExp(`\\|\\s*\\**\\s*${label}[^|]*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]*?)\\s*\\|`, 'i');
    return block.match(re);
  };

  const num = (s) => {
    if (s == null) return null;
    const cleaned = String(s).replace(/\*/g, '').trim();
    // accept "0.5", "3 / 7", "**0.42**"
    const slashMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*\d+/);
    if (slashMatch) return parseFloat(slashMatch[1]);
    const plain = parseFloat(cleaned);
    return Number.isFinite(plain) ? plain : null;
  };

  const successRow = row('Success');
  const efficiencyRow = row('Efficiency');
  const seqRow = row('SEQ');
  const intentRow = row('Intent');
  const confidenceRow = row('Task confidence');
  const compositeRow = row('SessionScore');

  const counters = block.match(/Raw counters:\s*actual_steps\s*=\s*(\d+)[,\s]+optimal_steps\s*=\s*(\d+)/i);

  return {
    success: successRow ? num(successRow[1]) : null,
    successNote: successRow ? successRow[2].trim() : '',
    efficiency: efficiencyRow ? num(efficiencyRow[1]) : null,
    efficiencyNote: efficiencyRow ? efficiencyRow[2].trim() : '',
    seq: seqRow ? num(seqRow[1]) : null,
    seqNote: seqRow ? seqRow[2].trim() : '',
    intent: intentRow ? num(intentRow[1]) : null,
    intentNote: intentRow ? intentRow[2].trim() : '',
    confidence: confidenceRow ? num(confidenceRow[1]) : null,
    confidenceNote: confidenceRow ? confidenceRow[2].trim() : '',
    sessionScore: compositeRow ? num(compositeRow[1]) : null,
    actualSteps: counters ? parseInt(counters[1], 10) : null,
    optimalSteps: counters ? parseInt(counters[2], 10) : null,
    raw: block,
  };
}

function parsePersonaVocab(personaPath) {
  if (!personaPath) return { uses: [], avoids: [] };
  const text = fs.readFileSync(personaPath, 'utf8');
  const section = text.match(/##\s+Tech comfort[\s\S]*?(?=\n##\s|\n---|\n$|$)/i);
  if (!section) return { uses: [], avoids: [] };
  const block = section[0];

  const extractQuoted = (s) => {
    const matches = [...s.matchAll(/"([^"]+)"/g)];
    return matches.map(m => m[1].toLowerCase());
  };

  // "Uses words like: "x", "y", "z"." up to first period that isn't inside quotes
  const usesMatch = block.match(/[Uu]ses?\s+words?\s+like\s*:\s*([^.]*(?:\.[^"]*[^.]*)*?)(?=\.\s|\n|$)/);
  const avoidsMatch = block.match(/[Dd]oes\s+NOT\s+use\s*:?\s*([^.]*(?:\.[^"]*[^.]*)*?)(?=\.\s|\n|$)/);

  return {
    uses: usesMatch ? extractQuoted(usesMatch[1]) : [],
    avoids: avoidsMatch ? extractQuoted(avoidsMatch[1]) : [],
  };
}

function parseTaskBounds(taskPath) {
  if (!taskPath) return { maxSteps: null, optimalSteps: null };
  const text = fs.readFileSync(taskPath, 'utf8');
  const maxMatch = text.match(/##\s+Max steps\s*\n\s*(\d+)/);
  const optMatch = text.match(/Optimal step count\s*:\s*(\d+)/);
  return {
    maxSteps: maxMatch ? parseInt(maxMatch[1], 10) : null,
    optimalSteps: optMatch ? parseInt(optMatch[1], 10) : null,
  };
}

// ---------- checks ----------

function checkScorecardCompleteness(scorecard) {
  if (!scorecard) {
    return { status: 'fail', message: 'No Quantitative Scorecard section found in transcript' };
  }
  const required = ['success', 'efficiency', 'seq', 'intent', 'confidence', 'sessionScore'];
  const missing = required.filter(k => scorecard[k] == null);
  if (missing.length > 0) {
    return { status: 'fail', message: `Missing or unparseable metric(s): ${missing.join(', ')}` };
  }

  const issues = [];

  // Likert justifications required
  for (const [k, label] of [['seqNote', 'SEQ'], ['intentNote', 'Intent'], ['confidenceNote', 'Task confidence']]) {
    if (!scorecard[k] || scorecard[k].length < 10) {
      issues.push(`${label} row missing one-sentence persona reasoning`);
    }
  }

  // Math: Efficiency = min(1, optimal/actual)
  if (scorecard.optimalSteps != null && scorecard.actualSteps != null && scorecard.actualSteps > 0) {
    const expectedEff = Math.min(1, scorecard.optimalSteps / scorecard.actualSteps);
    if (Math.abs(scorecard.efficiency - expectedEff) > 0.02) {
      issues.push(`Efficiency ${scorecard.efficiency} != min(1, ${scorecard.optimalSteps}/${scorecard.actualSteps}) = ${expectedEff.toFixed(2)}`);
    }
  }

  // Math: SessionScore matches composite formula
  const w = SCORECARD_FORMULA.weights;
  const expectedScore = w.success * scorecard.success
    + w.efficiency * scorecard.efficiency
    + w.seq * (scorecard.seq / 7)
    + w.intent * (scorecard.intent / 7)
    + w.confidence * (scorecard.confidence / 7);
  if (Math.abs(scorecard.sessionScore - expectedScore) > SCORECARD_FORMULA.tolerance) {
    issues.push(`SessionScore ${scorecard.sessionScore} != formula result ${expectedScore.toFixed(2)}`);
  }

  // Likert bounds 1-7
  for (const k of ['seq', 'intent', 'confidence']) {
    if (scorecard[k] < 1 || scorecard[k] > 7) {
      issues.push(`${k} = ${scorecard[k]} is outside 1-7 Likert range`);
    }
  }

  if (issues.length === 0) return { status: 'pass', message: 'All 5 metrics present and consistent' };
  return { status: 'fail', message: issues.join('; ') };
}

function checkPersonaVocabulary(transcript, vocab) {
  if (vocab.uses.length === 0 && vocab.avoids.length === 0) {
    return { status: 'warn', message: 'No vocabulary section found in persona file — skipped' };
  }

  const lower = transcript.toLowerCase();
  const wordRegex = (word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

  const violations = vocab.avoids.filter(w => wordRegex(w).test(lower));
  const missingPreferred = vocab.uses.length > 0
    ? vocab.uses.filter(w => !wordRegex(w).test(lower))
    : [];
  const preferredHits = vocab.uses.length - missingPreferred.length;

  if (violations.length > 0) {
    return { status: 'fail', message: `Persona used banned word(s): ${violations.map(w => `"${w}"`).join(', ')}` };
  }
  if (vocab.uses.length > 0 && preferredHits === 0) {
    return { status: 'warn', message: `Persona did not use any of their characteristic words (${vocab.uses.map(w => `"${w}"`).join(', ')})` };
  }
  return { status: 'pass', message: `No banned words; used ${preferredHits}/${vocab.uses.length} characteristic words` };
}

function checkHallucinationClaims(transcript) {
  const patterns = [
    { name: 'price', re: /\$\d+(?:[,.]?\d+)*(?:\s*\/\s*(?:mo|month|year|yr|user|seat))?/g },
    { name: 'percentage', re: /\b\d+(?:\.\d+)?\s*%/g },
    { name: 'trial', re: /\b\d+[-\s]?day(?:\s+(?:free\s+)?trial)?\b/gi },
    { name: 'certification', re: /\b(?:SOC\s*2|ISO\s*27001|HIPAA|GDPR|PCI[-\s]?DSS|FedRAMP)\b/gi },
  ];

  // Only consider transcript narration body (skip the scorecard table, which contains numbers like 0.5 / 7)
  const body = transcript.split(/## Quantitative Scorecard/)[0];

  const claims = new Set();
  for (const { re } of patterns) {
    for (const m of body.matchAll(re)) {
      claims.add(m[0].trim());
    }
  }

  if (claims.size === 0) return { status: 'pass', message: 'No specific factual claims to verify' };
  return {
    status: 'warn',
    message: `Spot-check these specific claims against screenshots: ${[...claims].slice(0, 8).join(', ')}${claims.size > 8 ? ` (+${claims.size - 8} more)` : ''}`,
  };
}

function checkStepBound(scorecard, bounds) {
  if (!scorecard || scorecard.actualSteps == null) {
    return { status: 'warn', message: 'actual_steps not present in Raw counters line' };
  }
  if (bounds.maxSteps == null) {
    return { status: 'warn', message: 'Could not read Max steps from task file' };
  }
  if (scorecard.actualSteps > bounds.maxSteps) {
    return { status: 'fail', message: `actual_steps=${scorecard.actualSteps} exceeds Max steps=${bounds.maxSteps}` };
  }
  return { status: 'pass', message: `actual_steps=${scorecard.actualSteps} within Max steps=${bounds.maxSteps}` };
}

function checkConstructCoherence(scorecard) {
  if (!scorecard) return { status: 'fail', message: 'No scorecard to check' };
  const { success, seq, intent } = scorecard;
  if (success == null || seq == null || intent == null) {
    return { status: 'warn', message: 'Some metrics missing — coherence not checkable' };
  }
  const issues = [];
  if (success === 0 && seq >= 6) issues.push(`Success=FAIL but SEQ=${seq}/7 (contradictory)`);
  if (success === 1 && seq <= 2) issues.push(`Success=PASS but SEQ=${seq}/7 (contradictory)`);
  if (success === 0 && intent >= 6) issues.push(`Success=FAIL but Intent=${intent}/7 (contradictory — can't take next step)`);
  if (issues.length === 0) return { status: 'pass', message: 'No internal contradictions' };
  return { status: 'fail', message: issues.join('; ') };
}

// ---------- driver ----------

function inferTaskNumber(taskFolder) {
  const m = taskFolder.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function checkSession(session) {
  const scorecard = parseScorecard(session.transcript);
  const personaPath = findPersonaFile(session.persona);
  const vocab = parsePersonaVocab(personaPath);
  const taskNumber = inferTaskNumber(session.task);
  const taskPath = taskNumber != null ? findTaskFile(taskNumber) : null;
  const bounds = parseTaskBounds(taskPath);

  return {
    persona: session.persona,
    task: session.task,
    checks: {
      'Scorecard completeness': checkScorecardCompleteness(scorecard),
      'Persona vocabulary': checkPersonaVocabulary(session.transcript, vocab),
      'Hallucination claims': checkHallucinationClaims(session.transcript),
      'Step bound': checkStepBound(scorecard, bounds),
      'Construct coherence': checkConstructCoherence(scorecard),
    },
    personaPath,
    taskPath,
  };
}

// ---------- reporting ----------

const ICON = { pass: '✅', warn: '⚠️', fail: '❌' };

function writeReport(results) {
  const today = new Date().toISOString().slice(0, 10);
  const checkNames = ['Scorecard completeness', 'Persona vocabulary', 'Hallucination claims', 'Step bound', 'Construct coherence'];

  const tally = Object.fromEntries(checkNames.map(n => [n, { pass: 0, warn: 0, fail: 0 }]));
  for (const r of results) {
    for (const name of checkNames) {
      tally[name][r.checks[name].status]++;
    }
  }

  const lines = [];
  lines.push(`# Evaluation Report`);
  lines.push(`Generated: ${today}`);
  lines.push(`Sessions checked: ${results.length}`);
  lines.push('');

  if (results.length === 0) {
    lines.push('> No sessions found under `sessions/`. Run at least one session before evaluating.');
    fs.writeFileSync(REPORT_PATH, lines.join('\n'));
    return;
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('| Check | ✅ Pass | ⚠️ Warn | ❌ Fail |');
  lines.push('|---|---|---|---|');
  for (const name of checkNames) {
    const t = tally[name];
    lines.push(`| ${name} | ${t.pass} | ${t.warn} | ${t.fail} |`);
  }
  lines.push('');

  // Failures section first — what needs attention
  const failures = [];
  for (const r of results) {
    for (const name of checkNames) {
      if (r.checks[name].status === 'fail') {
        failures.push(`- **${r.persona} / ${r.task}** — ${name}: ${r.checks[name].message}`);
      }
    }
  }
  lines.push('## Failures requiring attention');
  lines.push('');
  lines.push(failures.length === 0 ? '_None — all sessions passed the hard checks._' : failures.join('\n'));
  lines.push('');

  // Per-session detail
  lines.push('## Per-session results');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.persona} / ${r.task}`);
    for (const name of checkNames) {
      const c = r.checks[name];
      lines.push(`- ${ICON[c.status]} **${name}** — ${c.message}`);
    }
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
}

function main() {
  initPaths(resolveSlug(process.argv[2]));
  const sessions = discoverSessions();
  const results = sessions.map(checkSession);
  writeReport(results);

  const totalFail = results.reduce((sum, r) => sum + Object.values(r.checks).filter(c => c.status === 'fail').length, 0);
  const totalWarn = results.reduce((sum, r) => sum + Object.values(r.checks).filter(c => c.status === 'warn').length, 0);
  console.log(`[${SLUG}] Checked ${results.length} session(s). Failures: ${totalFail}. Warnings: ${totalWarn}.`);
  console.log(`Report written to: ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
}

if (require.main === module) main();

module.exports = { discoverSessions, parseScorecard, checkSession };
