# Usability Testing Kit — Claude Code Instructions

This is a reusable synthetic usability-testing project. Claude Code controls a real browser (via Playwright MCP) and role-plays as buyer personas navigating a target website.

**All project-specific output lives under `projects/[slug]/`** — the kit code (templates, lib, eval, synthesize) stays at the project root and is shared across every project.

There are two modes. Read the trigger phrase and follow the matching instructions exactly.

---

## Project structure

```
usability-testing-kit/
├── CLAUDE.md, generate-prompt.md, templates/, lib/, eval/, synthesize.js   ← shared kit code
└── projects/
    └── [slug]/
        ├── project.md                  ← metadata: URL, dates, goal, status
        ├── personas/
        ├── tasks/
        ├── sessions/
        │   └── [persona-firstname]/
        │       └── [task-number]/
        │           ├── transcript.md
        │           └── screenshots/
        ├── _research/screenshots/      ← screenshots from Mode 1 site analysis
        ├── findings.md                 ← written by synthesize.js
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
**Trigger:** User says "run [persona] through task [N]" or "run [persona name] on task [N]". The trigger may include a project slug ("...in stripe") or omit it.

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
Before writing the transcript, compute these 5 metrics.

**Observed metrics (computed from the session):**
1. **Task success** — `1.0` for PASS, `0.5` for PARTIAL, `0.0` for FAIL
2. **Efficiency** — `min(1.0, optimal_steps / actual_steps)` using the `Optimal step count` from the task file

**Self-report metrics (ask the persona, in character, 1–7 Likert):**

For each of the three Likert items, state the scale anchors first, then ask the persona — in their own voice — to give a number AND one sentence of reasoning grounded in what they just experienced. The persona's baseline skepticism (from their persona file) must shape the answer: a skeptical, burned-before persona does not give 7s easily; an eager-buyer persona doesn't give 1s without strong reason.

Scale anchors (use for all three):
- 1 = "I'd close the tab and never come back / never recommend this"
- 4 = "Neutral. No strong feeling either way."
- 7 = "Best site I've used for this kind of product."

3. **SEQ (ease)** — "Overall, how easy was that?"
4. **Intent** — "Would you take the next step (demo / signup / share with team)?"
5. **Task confidence** — "How confident are you that you actually found / understood what you were looking for?" (Note: confidence in their own success, NOT in the company.)

**Composite (computed):**
- `SessionScore = 0.4·Success + 0.2·Efficiency + 0.133·(SEQ/7) + 0.133·(Intent/7) + 0.133·(TaskConfidence/7)`
- Round to two decimals.

### Step 4: Save the transcript
Save to `projects/[slug]/sessions/[persona]/[task]/transcript.md`.

The transcript must include, in this order:
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
| **SessionScore** | **0.42** | |

Raw counters: actual_steps=8, optimal_steps=4.
```

Every row is required. Likert rows must include the persona's one-sentence reasoning in their own voice — not a generic UX comment.

---

## GENERAL RULES FOR ALL SESSIONS

- Always screenshot before narrating — describe what you actually see, not what you'd expect
- Stay in character. Carlos doesn't say "the UX is suboptimal." He says "I can't figure out what this costs."
- Quotes from the persona should sound like that specific person, not like a UX report
- If a chatbot pops up and the persona would close it — close it (the persona behaves as they would)
- Note when something is missing (e.g. "no pricing visible", "no SMB examples") — absence is a finding
- Keep screenshots named sequentially: `01-hero.png`, `02-nav-open.png`, etc.
- Never write files outside the active `projects/[slug]/` folder, except when updating shared kit code on explicit request.
