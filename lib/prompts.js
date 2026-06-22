// Prompt templates for synthesis.
// Sessions are run directly by Claude Code using Playwright MCP.

function buildSynthesisPrompt(allTranscripts) {
  return `You are a senior UX researcher reviewing transcripts from synthetic user sessions.

Below are ${allTranscripts.length} sessions. Each session is one persona attempting one task on the target website. Every transcript ends with a "Quantitative Scorecard" markdown table containing 5 metrics plus a SessionScore. Read all transcripts in full, then produce a structured findings report.

# Output structure

Produce findings.md with two parts, in this order:

## PART 1 — Aggregate Metrics (data-driven)

Parse the Quantitative Scorecard from every transcript and produce the following. Show your work — every flag must reference real numbers from the transcripts.

### A. Success rate per task
Markdown table: Task | N sessions | Mean Success | Notes. Sort by ascending mean.

### B. Mean SEQ per task
Markdown table: Task | N | Mean SEQ. Flag any task with mean SEQ ≤ 4 as **"high-friction"** with a one-line explanation of why personas struggled.

### C. Mean Intent per task
Markdown table: Task | N | Mean Intent. Flag any task with mean Intent ≤ 3 as **"conversion risk"** with a one-line diagnosis.

### D. Success-vs-Confidence gap (false-success risk)
For each task, compute (mean Task Confidence / 7) − mean Success. If positive by 0.15 or more, flag as **"false-success risk"** — personas felt more sure than they should have. List the specific sessions where this gap appeared.

### E. Success rate per persona
Markdown table: Persona | N tasks | Mean Success. Flag personas with mean ≤ 0.5 as **"audience-fit risk"** — the site may not be built for someone like them.

### F. Persona × Task heatmap (SessionScore)
Markdown table, rows = personas, columns = tasks, cells = SessionScore prefixed with one emoji:
- 🟢 if SessionScore ≥ 0.7
- 🟡 if 0.4 ≤ SessionScore < 0.7
- 🔴 if SessionScore < 0.4

### G. Issue density per session
For each session, compute weighted issue score = (High count × 3) + (Medium count × 2) + (Low count × 1). Rank sessions highest to lowest. Show top 5.

## PART 2 — Qualitative Findings

Produce 6-10 findings ranked by severity. For each finding:
- **Title** (one phrase)
- **Severity**: Critical (blocks task) / Friction (slows task) / Opportunity (works but could be better)
- **Personas affected**: list which personas hit this
- **Description**: 2-3 sentences
- **Evidence**: 2-3 direct quotes from the transcripts (with persona name)
- **Recommendation**: 1-2 sentences

What to look for:
1. Friction patterns appearing in 3+ persona types
2. Navigation labels or vocabulary that caused confusion
3. Places personas mentioned competitors or alternatives unprompted
4. Gaps between persona expectations and what they actually found
5. Trust and credibility holes specific to a persona segment
6. Pricing transparency reactions
7. Moments where a persona was ready to leave — what kept them or lost them
8. Tasks flagged in Part 1 — connect the qualitative evidence to the quantitative signal

# Rules
- Be specific and quote the synthetic personas verbatim
- Don't generalize without evidence from the transcripts
- Cross-reference Part 1 metrics with Part 2 findings where they overlap
- If a scorecard is missing or malformed in a transcript, note it in Part 1 and continue with the rest

# Sessions

${allTranscripts.join('\n\n---SESSION-BREAK---\n\n')}`;
}

module.exports = { buildSynthesisPrompt };
