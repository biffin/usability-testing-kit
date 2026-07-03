# Usability Testing Kit

**Synthetic usability testing for any website, run entirely inside Claude Code.** Claude browses a site as a set of hand-built buyer personas, narrates what each one sees, thinks, and feels while trying to complete real tasks, and scores every session on five research metrics. You get transcripts, screenshots, a shareable HTML report with a persona × task heatmap, and — after you ship fixes — a measured before/after diff.

It's the sibling of the [Cognitive Walkthrough Kit](../cognitive-walkthrough-kit): same "everything runs inside Claude Code" design, opposite lens. The cognitive kit measures the *designed* cognitive load of the happy path from the DOM. This kit measures how specific *people* experience the site — where they get lost, what they misread, whether they'd take the next step. Run both and you've audited the same site from both ends.

```
you: "generate for https://your-site.com"     →  Claude browses the site, builds 4–5 personas + 5–6 tasks
you: "run Sarah through task 01"              →  Claude drives the browser as Sarah, narrating in her voice
                                                  saves a transcript, screenshots, and a scored scorecard.json
you: node lib/report.js your-site            →  one self-contained report.html: heatmap, journey strips, issues
```

---

## What you get per session

Each session produces a five-metric scorecard next to the qualitative narration:

| Metric | What it captures |
|--------|------------------|
| **Task success** | PASS / PARTIAL / FAIL → 1.0 / 0.5 / 0.0 (ISO 9241-11 effectiveness) |
| **Efficiency** | `optimal_steps / actual_steps`, capped at 1.0 (a synthetic stand-in for time on task) |
| **SEQ** (1–7) | "Overall, how easy was that?" — the standard post-task ease question |
| **Intent** (1–7) | "Would you take the next step?" — the conversion signal |
| **Task confidence** (1–7) | "How sure are you that you actually found it?" — catches *false success* |

These roll up into a composite **SessionScore** (0–1) for ranking sessions and personas. The formula and the Likert anchors live in one file — [`config/scoring.json`](config/scoring.json) — so you can tune them to your study and every tool stays in sync.

The persona's **baseline skepticism** shapes every self-report answer: a burned-before gatekeeper doesn't hand out 7s, and an eager buyer doesn't give 1s without reason. That's what keeps the numbers from being uniformly polite.

---

## Quickstart (5 minutes)

**Prerequisites:** [Node 18+](https://nodejs.org) and [Claude Code](https://claude.com/claude-code).

```bash
git clone <this-repo> usability-testing-kit
cd usability-testing-kit
node lib/doctor.js        # verifies your environment + runs a scoring self-test
```

Then open the folder in Claude Code. The repo ships a `.mcp.json` with the Playwright browser server — approve it when Claude Code asks. That's the whole setup.

Run your first study by talking to Claude:

| Say | What happens |
|-----|--------------|
| `generate for https://your-site.com` | Claude browses the site and writes 4–5 personas + 5–6 tasks to `projects/your-site/` |
| `run Sarah through task 01` | one session: browser navigation, in-character narration, transcript + `scorecard.json` |
| `run Sarah through task 01 ×3` | a **replication run** — three independent sessions, so you can see the score's spread, not just a single number |
| `read all transcripts in projects/your-site/ and write findings.md` | Claude synthesizes the findings report (free, in-conversation) |

Then generate the deliverables from your terminal:

```bash
node eval/check-sessions.js your-site   # validate every session (scorecard math, vocab, citations, coherence)
node lib/report.js your-site           # one self-contained report.html — heatmap + journey strips, shareable
```

---

## Commands

| Command | What it does |
|---------|--------------|
| `node lib/doctor.js` | Environment check + scoring self-test — run first after cloning |
| `node eval/check-sessions.js <slug>` | Validate every session: scorecard math, sidecar agreement, persona vocabulary, claim citations, step bounds, coherence |
| `node lib/report.js <slug>` | Build `projects/<slug>/report.html` — persona×task heatmap, aggregate metrics, cross-session issue rollup, per-session cards, journey strips |
| `node lib/diff.js <baseline> <current>` | Compare two studies session by session — the measured before/after |
| `node synthesize.js <slug>` | *(optional, API)* batch findings report |

All are also npm scripts (`npm run doctor`, `npm run report -- <slug>`, …). Everything except `synthesize.js` is pure Node with zero dependencies — no `npm install` needed.

---

## Tuning the scoring — and why scores are versioned

Every weight, Likert anchor, and result value lives in one file: **[`config/scoring.json`](config/scoring.json)**. If your team decides Intent should outweigh Ease for an e-commerce study, you edit one file and Claude's in-session math, the validator, the report, and the diff all agree instantly.

Every session also writes a machine-readable **`scorecard.json`** sidecar next to its transcript, stamped with the kit version, a **hash of the scoring config**, and **the model that role-played the persona**:

```json
"meta": { "kitVersion": "2.0.0", "scoringHash": "8affff00f285", "model": "claude-opus-4-8", "date": "2026-07-03" }
```

This is what makes re-tests trustworthy. A synthetic persona is a measurement instrument; a persona played by a *different model* — or scored under *different weights* — is a different instrument. When a score moves between two studies, the hash and model stamp tell you whether the *site* changed or the *ruler* did. `lib/diff.js` checks it automatically and warns on mismatch.

## The re-test workflow (measuring your fixes)

1. Study: `generate for https://site.com` → run sessions → ship the report.
2. The team ships fixes.
3. Re-test under a new slug (`site-v2`), running the **same** personas through the **same** tasks.
4. `node lib/diff.js site site-v2` → per-session deltas, FAIL→PASS transitions, and the headline: *"7 improved · 1 worse · 2 unchanged; mean SessionScore 0.54 → 0.71."*

Before/after numbers are what get design work funded — this loop is why the kit scores at all.

---

## What this is — and isn't

Synthetic personas are a **rehearsal for real research, not a replacement for it.** They are good at predicting a specific and valuable class of problem:

- **Findability** — can someone with this mental model locate the thing?
- **Comprehension** — does the copy mean to them what you intended?
- **Information scent** — do the nav labels and CTAs point where people expect?

They are **weak proxies** for emotion, brand trust, and genuine willingness to pay — a model can *estimate* how a skeptical buyer feels, but it isn't one, and it has never had to spend the money. Treat the SessionScores as a prioritized map of where to point real research, the persona quotes as hypotheses to test with humans, and the false-success flags (high confidence + FAIL) as the highest-value thing the method surfaces cheaply.

The kit is built to keep itself honest about this: every factual claim in a transcript (a price, a trial length, a certification) must cite the screenshot it came from, and the evaluator fails any claim that doesn't — so "it costs $99/mo" is always checkable against a frame, never taken on faith.

## Project structure

```
usability-testing-kit/
├── CLAUDE.md                  ← the methodology: instructions Claude Code follows (two modes)
├── generate-prompt.md         ← persona + task generation spec
├── .mcp.json                  ← Playwright browser server (Claude Code picks it up automatically)
├── config/
│   └── scoring.json           ← weights, Likert anchors, result values; hashed into each scorecard
├── templates/                 ← persona schema, task schema (+ 5 universal task stubs), project metadata
├── lib/
│   ├── doctor.js             ← environment checker + scoring self-test (run first)
│   ├── config.js             ← scoring-config loader + provenance hashing
│   ├── report.js             ← self-contained report.html per project
│   ├── diff.js               ← re-test comparison
│   └── prompts.js            ← synthesis prompt builder (optional API)
├── eval/check-sessions.js     ← validation harness → eval-report.md
├── synthesize.js              ← optional API-based findings generator
└── projects/
    └── <your-slug>/           ← one folder per site (created by Mode 1, stays local)
        ├── project.md · personas/ · tasks/ · findings.md · eval-report.md · report.html
        └── sessions/<persona>/<task>/
            ├── transcript.md · scorecard.json · screenshots/
```

Your research data lives under `projects/` and is **git-ignored** — usability findings are often confidential and can never be committed by accident.

MIT licensed. Issues and PRs welcome — especially persona/task sets for site types the templates don't cover well yet.
