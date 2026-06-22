// Reads every transcript in projects/<slug>/sessions/ and asks Claude to find cross-session patterns.
//
// Usage:
//   node synthesize.js <slug>          synthesize a specific project
//   node synthesize.js                 if exactly one project exists, use it; otherwise list and exit
//   npm run synthesize -- <slug>
//
// Output: projects/<slug>/findings.md
//
// Requires: .env file with ANTHROPIC_API_KEY (see .env.example)
// Alternative: ask Claude Code directly — "read all transcripts in projects/<slug>/ and produce a findings report"

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;

const { buildSynthesisPrompt } = require('./lib/prompts');

const PROJECTS_DIR = 'projects';

function resolveSlug(argSlug) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`No ${PROJECTS_DIR}/ folder found. Run Mode 1 in Claude Code first to create a project.`);
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
  console.error(`Usage: node synthesize.js <slug>`);
  process.exit(1);
}

async function main() {
  const slug = resolveSlug(process.argv[2]);
  const sessionsDir = path.join(PROJECTS_DIR, slug, 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    console.error(`No sessions/ folder under projects/${slug}/. Run some sessions first via Claude Code.`);
    process.exit(1);
  }

  // Walk projects/<slug>/sessions/<persona>/<task>/transcript.md
  const transcripts = [];
  const personaFolders = fs.readdirSync(sessionsDir).filter((f) =>
    fs.statSync(path.join(sessionsDir, f)).isDirectory() && !f.startsWith('_')
  );

  for (const persona of personaFolders) {
    const personaDir = path.join(sessionsDir, persona);
    const taskFolders = fs.readdirSync(personaDir).filter((f) =>
      fs.statSync(path.join(personaDir, f)).isDirectory()
    );
    for (const task of taskFolders) {
      const transcriptPath = path.join(personaDir, task, 'transcript.md');
      if (fs.existsSync(transcriptPath)) {
        const content = `## Session: ${persona} / task-${task}\n\n` +
          fs.readFileSync(transcriptPath, 'utf-8');
        transcripts.push(content);
      }
    }
  }

  if (transcripts.length === 0) {
    console.error(`No transcripts found in projects/${slug}/sessions/. Run some sessions first via Claude Code.`);
    process.exit(1);
  }

  console.log(`[${slug}] Found ${transcripts.length} transcripts. Sending to Claude for synthesis...`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildSynthesisPrompt(transcripts);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: 'You are a senior UX researcher producing a structured findings report from synthetic user research.',
    messages: [{ role: 'user', content: prompt }],
  });

  const findings = response.content.find((b) => b.type === 'text')?.text || '';
  const outPath = path.join(PROJECTS_DIR, slug, 'findings.md');
  fs.writeFileSync(outPath, findings);
  console.log(`Done. ${transcripts.length} sessions synthesized → ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
