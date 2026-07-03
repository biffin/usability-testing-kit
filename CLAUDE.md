# Usability Testing Kit — Claude Code Instructions

This is a reusable synthetic usability-testing project. Claude Code controls a real browser (via Playwright MCP) and role-plays as buyer personas navigating a target website.

**All project-specific output lives under `projects/[slug]/`** — the kit code (templates, lib, eval, synthesize) stays at the project root and is shared across every project.

There are two modes. Read the trigger phrase and follow the matching instructions exactly.

---

## Project structure

```
usability-testing-kit/
├── CLAUDE.md, generate-prompt.md, templates/, lib/, eval/, synthesize.js   ← shared kit code
├── config/scoring.json             ← ALL SessionScore weights + Likert anchors (single source of truth)
└── projects/
    └── [slug]/
        ├── project.md                  ← metadata: URL, dates, goal, status
        ├── personas/
        ├── tasks/
        ├── sessions/
        │   └── [persona-firstname]/
        │       └── [task-number]/      ← "01", or "01-r1"/"01-r2"/… for replication runs
        │           ├── transcript.md    ← the human artifact (narration + scorecard)
        │           ├── scorecard.json   ← machine-readable metrics + steps + issues + provenance
        │           └── screenshots/
        ├── _research/screenshots/      ← screenshots from Mode 1 site analysis
        ├── findings.md                 ← synthesized report
        ├── report.html                 ← written by lib/report.js (self-contained)
        ├── diff-report.md              ← written by lib/diff.js (re-tests only)
        └── eval-report.md              ← written by eval/check-sessions.js
```

**Slug convention:** lowercase domain root (e.g. `https://www.stripe.com` → `stripe`). If running the same site twice, suffix with a qualifier: `stripe-2026-redesign`. Slug must match the folder name exactly.

---

## MODE 1 — GENERATE
**Trigger:** User says "generate for [URL]" or "set up research for [URL]"

### Your job
Browse the target website, understand who it's built for, then generate personas and tasks that will make for a rich research session.

### Step 0: Determine the project slug and create the project folder
- Default slug: the domain root of the URL (e.g. `stripe.com` → `stripe`).
- If the user specified a slug in their trigger ("generate for stripe.com as project stripe-redesign"), use that.
- If `projects/[slug]/` already exists, confirm with the user before overwriting. Suggest a date-suffixed slug as an alternative.
- Create:
  - `projects/[slug]/`
  - `projects/[slug]/personas/`
  - `projects/[slug]/tasks/`
  - `projects/[slug]/sessions/`
  - `projects/[slug]/_research/screenshots/`
- Create `projects/[slug]/project.md` from `templates/project.md`, filling in slug, URL, today's date, status=draft, and a one-line goal (ask the user if you need to).

### Step 1: Read the generation spec
Read `generate-prompt.md` in this project. That file contains your full instructions for website analysis, persona generation, and task generation. Follow it exactly.

### Step 2: Browse the website
Use Playwright MCP to visit:
1. The homepage (screenshot + snapshot)
2. The main navigation — expand every top-level menu item
3. Any "Solutions", "Products", or "Platform" pages
4. The Pricing page (if it exists — note if it's hidden behind a form)
5. Any "Industries", "Who we serve", or "Customers" pages
6. One or two case studies (note company size and type)

Take a screenshot at each stop. Save them to `projects/[slug]/_research/screenshots/`.

### Step 3: Generate personas
Follow the rules in `generate-prompt.md` and use the schema in `templates/persona.md`.
Save each persona as `projects/[slug]/personas/[firstname-role].md` (e.g. `projects/stripe/personas/sarah-it-director.md`).

### Step 4: Generate tasks
Follow the rules in `generate-prompt.md` and use the schema in `templates/task.md`.
Save each task as `projects/[slug]/tasks/0N-task-name.md` (e.g. `projects/stripe/tasks/01-first-impression.md`).

### Step 5: Update project.md and print a summary
Fill in the "What I noticed about this site" section of `projects/[slug]/project.md`. Set status to `in-progress`.

Then print a summary:

```
## Generated for: [URL]  →  projects/[slug]/

### Personas (N)
| File | Name | Role | Key insight |
|------|------|------|-------------|
| ...  | ...  | ...  | ...         |

### Tasks (N)
| File | Task | Key question |
|------|------|--------------|
| ...  | ...  | ...          |

### What I noticed about this site
[3-5 bullets: vocabulary, SMB vs enterprise signals, pricing transparency, notable features]

### Suggested session order
[List persona × task combinations in recommended order]
```

---

## MODE 2 — RUN SESSION
**Trigger:** User says "run [persona] through task [N]" or "run [persona name] on task [N]". The trigger may include a project slug ("...in stripe") or omit it. It may also request replications ("...×3") — see the REPLICATION RUNS section below.

### Your job
Role-play as the persona. Navigate the website. Narrate what you see, think, and feel as that person. Save a detailed transcript.

### Step 0: Resolve the project
- If the trigger includes a project slug, use it.
- Otherwise: list the subdirectories of `projects/`. If exactly one project exists, use it. If multiple, ask the user which.

### Step 1: Load the persona and task
- Read `projects/[slug]/personas/[persona].md` — internalize who this person is
- Read `projects/[slug]/tasks/0N-task-name.md` — understand the goal, success/failure criteria, max steps, optimal path

### Step 2: Create the session folder
`projects/[slug]/sessions/[persona-firstname]/[task-number]/`
e.g. `projects/stripe/sessions/sarah/01/`
Also create `projects/[slug]/sessions/[persona-firstname]/[task-number]/screenshots/`

### Step 3: Run the session
- Open the starting URL from the task file
- Take a screenshot at each significant step (save to the screenshots folder — note: Playwright can only write to this project's directory)
- Narrate in the persona's voice: what they read, what confuses them, what resonates, what they'd do next
- **Maintain a running counter of `actual_steps`** — every click / navigation the persona performs counts as one step. Scrolling and reading do not count.
- Stay within the max steps limit from the task file
- Stop when completion criteria are met OR failure criteria are triggered OR max steps reached

### Step 3b: Compute the Quantitative Scorecard

**Read `config/scoring.json` first** — it holds the weights, the PASS/PARTIAL/FAIL values, and the Likert anchors. It is the single source of truth; do not hard-code these numbers from memory, and if the config has been tuned, use the tuned values.

Compute these 5 metrics.

**Observed metrics (computed from the session):**
1. **Task success** — the `result` value from config (`1.0` PASS / `0.5` PARTIAL / `0.0` FAIL by default)
2. **Efficiency** — `min(1.0, optimal_steps / actual_steps)` using the `Optimal step count` from the task file

**Self-report metrics (ask the persona, in character, using the Likert anchors from `config/scoring.json`):**

For each of the three items, state the scale anchors first, then ask the persona — in their own voice — to give a number AND one sentence of reasoning grounded in what they just experienced. The persona's baseline skepticism (from their persona file) must shape the answer: a skeptical, burned-before persona does not give 7s easily; an eager-buyer persona doesn't give 1s without strong reason.

3. **SEQ (ease)**, 4. **Intent**, 5. **Task confidence** — the three `likert.items` in the config. (Confidence is in their OWN success, NOT in the company.)

**Composite (computed):** apply the weighted formula from `config/scoring.json` —
`SessionScore = Σ weightᵢ · normalizedᵢ` (Success and Efficiency are already 0–1; each Likert value is divided by 7). Round to two decimals. **Verify your arithmetic** — the evaluator recomputes this and will flag a mismatch.

### Step 4: Save the transcript AND the scorecard sidecar
Save **two** files in `projects/[slug]/sessions/[persona]/[task]/`.

**(a) `transcript.md`** — the human artifact. In this order:
- Header: persona name, task name, date, starting URL, result (PASS / PARTIAL PASS / FAIL)
- Step-by-step narration with persona quotes in `> *"quote"*` format
- Task completion assessment table
- Key observations (what they read first, resonant words, confusing words, missing signals)
- **Quantitative Scorecard** (required — schema below)
- Severity-tagged issues table: High / Medium / Low

#### Quantitative Scorecard format

```markdown
## Quantitative Scorecard

| Metric | Value | Notes / persona reasoning |
|---|---|---|
| Success | 0.5 | PARTIAL — found a pricing tier but couldn't tell if it covered her use case |
| Efficiency | 0.50 | 4 optimal steps vs. 8 actual |
| SEQ (ease) | 3 / 7 | "It wasn't terrible but I had to hunt." |
| Intent | 2 / 7 | "I'm not filling out a form to learn the price." |
| Task confidence | 4 / 7 | "I think that was the right page, but I'm not sure I got the tier for my size." |
| **SessionScore** | **0.47** | |

Raw counters: actual_steps=8, optimal_steps=4.
```

Every row is required. Likert rows must include the persona's one-sentence reasoning in their own voice — not a generic UX comment. (The 0.47 above is the exact formula result for these inputs — always show the computed value, not a rounded guess.)

**(b) `scorecard.json`** — the machine-readable sidecar that `report.js`, `diff.js`, and the evaluator consume. Same numbers as the transcript. Schema:

```json
{
  "persona": "sarah", "task": "01", "result": "PARTIAL",
  "metrics": { "success": 0.5, "efficiency": 0.5, "seq": 3, "intent": 2, "confidence": 4 },
  "sessionScore": 0.47,
  "counters": { "actualSteps": 8, "optimalSteps": 4 },
  "steps": [
    { "n": 1, "action": "clicked 'Pricing' in nav", "screenshot": "02-pricing.png", "quote": "Where's the actual price?" }
  ],
  "issues": [ { "severity": "high", "text": "pricing hidden behind demo form" } ],
  "meta": { "kitVersion": "<from package.json>", "scoringHash": "<hash printed by the eval / doctor>", "model": "<the model you are running as>", "date": "<today>" }
}
```

- `steps[].screenshot` must match a real filename in `screenshots/` — this is what the report's journey strip renders.
- `meta.scoringHash` is the hash of `config/scoring.json` (run `node lib/doctor.js` to see it). `meta.model` is the model role-playing the persona. Together they let a re-test tell whether a score moved because the site changed or the instrument did.
- The numbers in the JSON must match the transcript exactly — the evaluator cross-checks them.

---

## GENERAL RULES FOR ALL SESSIONS

- Always screenshot before narrating — describe what you actually see, not what you'd expect
- Stay in character. Carlos doesn't say "the UX is suboptimal." He says "I can't figure out what this costs."
- Quotes from the persona should sound like that specific person, not like a UX report
- If a chatbot pops up and the persona would close it — close it (the persona behaves as they would)
- Note when something is missing (e.g. "no pricing visible", "no SMB examples") — absence is a finding
- Keep screenshots named sequentially: `01-hero.png`, `02-nav-open.png`, etc.
- **Cite every factual claim.** Whenever the narration states a specific fact — a price, a trial length, a certification, a percentage, a plan name — put the screenshot filename that shows it in brackets right after: `it says $99/mo [03-pricing.png]`. The evaluator FAILS any factual claim with no citation. This is what keeps a synthetic session honest: a claim someone can check on a frame, not a number the model might have imagined.
- Scoring weights and Likert anchors live in `config/scoring.json` — the single source of truth. If a user wants to reweight (e.g. Intent over Ease for an e-commerce study), edit that file, never hard-code a new formula. Re-scored sessions carry a new `scoringHash`.
- Never write files outside the active `projects/[slug]/` folder, except when updating shared kit code on explicit request.

## REPLICATION RUNS

A single synthetic session is one draw; the same persona could plausibly succeed or fail on an ambiguous site. When the user asks for replications — **"run Sarah through task 01 ×3"** — run the session N independent times and save each under a suffixed task folder: `sessions/sarah/01-r1/`, `01-r2/`, `01-r3/` (each with its own transcript.md + scorecard.json + screenshots/). Approach each run fresh — don't copy the previous one's narration or scores. The report and diff aggregate replications automatically and show the spread (a wide spread is itself a finding: the experience is ambiguous). Default is a single run; reserve ×N for the sessions that will drive a decision.

## AFTER A STUDY — the finishing toolchain

Tell the user what each command produced:
1. `node eval/check-sessions.js [slug]` — validate every session (scorecard math, sidecar agreement, persona vocabulary, claim citations, step bounds, coherence).
2. Synthesize findings in-conversation for free ("read all transcripts in projects/[slug]/ and write findings.md") — do this BEFORE report.js so the findings embed in the HTML.
3. `node lib/report.js [slug]` — build the shareable `report.html` (heatmap, journey strips, issue rollup).

For a **re-test** of a site that already has a study, use a suffixed slug (e.g. `acme-v2`), run the SAME personas through the SAME tasks, then `node lib/diff.js [old-slug] [new-slug]` and lead your summary with the diff headline (improved/worse/unchanged, FAIL→PASS transitions).

If a user reports setup problems, have them run `node lib/doctor.js` and work from its output.
