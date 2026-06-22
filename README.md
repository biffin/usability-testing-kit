# Usability Testing Kit

Synthetic usability testing for any website. Claude Code controls a real browser, role-plays as buyer personas, and saves detailed transcripts — all from a single conversation.

---

## How it works

1. You give Claude Code a website URL
2. Claude browses the site and generates buyer personas + research tasks tailored to that company
3. Claude then runs sessions: navigating the site as each persona, narrating what they see, think, and feel
4. You end up with transcripts, screenshots, and a synthesized findings report

No scripting. No API calls during sessions. Everything runs inside Claude Code.

### Quantitative metrics

Each session produces a 5-metric scorecard alongside the qualitative narration:

1. **Task success** — PASS / PARTIAL / FAIL → 1.0 / 0.5 / 0.0 (ISO 9241-11 effectiveness)
2. **Efficiency** — `optimal_steps / actual_steps`, capped at 1.0 (synthetic stand-in for time on task)
3. **SEQ** (1–7) — "Overall, how easy was that?" (the standard post-task ease metric)
4. **Intent** (1–7) — "Would you take the next step?" (conversion signal)
5. **Task confidence** (1–7) — "How confident are you that you actually found it?" (catches false success)

Plus a composite **SessionScore** (0–1) for ranking sessions. Future phases can add first-click success, vendor trust, lostness, and comprehension — see the plan file for the rollout.

---

## Setup (one-time, ~5 minutes)

### 1. Open this folder in Claude Code

The `CLAUDE.md` file is loaded automatically — it tells Claude what to do in both generation and session modes.

### 2. Make sure Playwright MCP is enabled

Claude Code needs the Playwright MCP server to control a browser. Check your Claude Code settings — if Playwright isn't listed, add it:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Restart Claude Code after adding it.

### 3. Install synthesis dependencies (optional)

Only needed if you want to run `synthesize.js` to auto-generate `findings.md`. You can skip this and ask Claude Code to synthesize in-conversation instead.

```bash
npm install
cp .env.example .env
# Open .env and paste your key from console.anthropic.com
```

---

## Running research on a new company

The kit is **multi-project**. Every project lives under `projects/<slug>/` and is fully self-contained. The kit code (templates, lib, eval, synthesize) is shared across all projects.

**Slug convention:** lowercase domain root. `https://www.stripe.com` → `stripe`. Running the same site again? Suffix it: `stripe-2026-redesign`.

### Step 1 — Generate personas and tasks

Open a new Claude Code conversation in this folder and say:

> "Generate for https://www.example.com"

Claude will:
- Create `projects/example/` with `personas/`, `tasks/`, `sessions/`, `_research/screenshots/`, and a `project.md` metadata file
- Browse the site (homepage, nav, pricing, industries, case studies)
- Generate 4–5 buyer personas saved to `projects/example/personas/`
- Generate 5–6 research tasks saved to `projects/example/tasks/`
- Print a summary of what was generated and why

**Review the generated files.** Edit anything that feels off. The AI's first pass is a strong starting point, not gospel.

### Step 2 — Run sessions

```
Run [persona name] through task 01
Run [persona name] through task 02 in example
```

If only one project exists, Claude will use it automatically. Otherwise specify the slug. Claude opens a browser, navigates as the persona, narrates their experience, and saves:
- `projects/<slug>/sessions/[persona]/[task]/transcript.md`
- `projects/<slug>/sessions/[persona]/[task]/screenshots/`

### Step 3 — Synthesize findings

**Option A — In conversation:**
> "Read all the transcripts in projects/example/ and produce a structured findings report"

**Option B — Script:**
```bash
npm run synthesize -- <slug>
# or
node synthesize.js <slug>
```
Outputs `projects/<slug>/findings.md`. The report opens with an **Aggregate Metrics dashboard** (success rates per task and per persona, mean SEQ/Intent flags, false-success-risk flags, persona × task SessionScore heatmap, weighted issue density), followed by 6–10 severity-tagged qualitative findings with persona quotes.

### Step 4 — Evaluate the sessions (optional)

```bash
npm run eval -- <slug>
# or
node eval/check-sessions.js <slug>
```

Runs Tier 1 automated checks on every transcript and writes `projects/<slug>/eval-report.md`. Catches the most common synthetic-research failures before you trust the findings:

1. **Scorecard completeness** — all 5 metrics present, math correct (Efficiency, SessionScore), Likert items have persona reasoning, values in 1–7 range.
2. **Persona vocabulary** — fails if the persona used a banned word from their persona file; warns if they used none of their characteristic words.
3. **Hallucination claims** — surfaces specific factual claims (prices, percentages, trial lengths, certifications) for you to spot-check against screenshots.
4. **Step bound** — `actual_steps` ≤ `Max steps` from the task file.
5. **Construct coherence** — flags internal contradictions like Success=FAIL but SEQ=7/7.

Re-run any time after new sessions land. No API calls, no dependencies — pure parsing.

> **Slug-resolution shortcut:** if exactly one project exists under `projects/`, you can omit the slug for both `synthesize` and `eval`.

---

## Starting a new project alongside an existing one

Just point Claude at the new URL:

> "Generate for https://www.acme.com"

A new `projects/acme/` folder is created. Your existing projects stay untouched. To compare across projects, run synthesize/eval on each separately — each project's `findings.md` and `eval-report.md` live in its own folder.

To archive or share one project, zip its `projects/<slug>/` folder. The kit code at the root never needs to travel with it.

---

## Project structure

```
usability-testing-kit/
├── CLAUDE.md                  ← Instructions for Claude Code (auto-loaded)
├── generate-prompt.md         ← Detailed generation spec (Claude reads this)
├── templates/
│   ├── persona.md             ← Persona schema with field guide + example
│   ├── task.md                ← Task schema with field guide + 5 universal stubs
│   └── project.md             ← Per-project metadata header
├── lib/
│   └── prompts.js             ← Synthesis prompt builder
├── eval/
│   └── check-sessions.js      ← Tier 1 automated session checks
├── synthesize.js              ← Optional: generates findings.md via API
├── .env.example               ← API key template
└── projects/
    └── <slug>/                ← One folder per research project
        ├── project.md         ← URL, dates, status, scope notes
        ├── personas/          ← Generated by Claude (one file per persona)
        ├── tasks/             ← Generated by Claude (one file per task)
        ├── sessions/          ← Session output (transcripts + screenshots)
        ├── _research/         ← Mode 1 site-analysis screenshots
        ├── findings.md        ← Written by synthesize.js
        └── eval-report.md     ← Written by eval/check-sessions.js
```

---

## Recommended session order

Run all tasks for one persona before moving to the next. Watch the first session live — does the persona sound like a real person? Adjust their vocabulary and pain points if needed before running more sessions.

| Persona type | Tasks to run |
|---|---|
| Economic buyer | 01, 02, 03, 04, 05 |
| End user / practitioner | 01, 02, 04, 05 |
| Technical evaluator | 01, 02, 04, 05, (06 if applicable) |
| Skeptic / gatekeeper | 01, 03, 04, 05 |
| Existing customer | 02, 04, 05, (06 if applicable) |
