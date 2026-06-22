# Generation Spec — How to Analyze a Website and Build a Research Sprint

This file tells Claude exactly how to turn a website into a set of personas and tasks.
Claude Code reads this during MODE 1 (Generate). Do not modify it unless you want to change the generation logic.

---

## PART 1: WEBSITE ANALYSIS

Before writing a single persona, read the website carefully. You are looking for signals that answer these questions:

### Product & category
- What does this company actually sell? (software, hardware, service, marketplace?)
- What is the product category in plain English? (fleet tracking, project management, payroll, etc.)
- Is it B2B, B2C, or both?
- What is the primary action the site wants visitors to take? (book demo, start trial, get pricing, contact sales)

### Buyer signals
- Who does the site seem to be written for? Look at: hero headline, case study logos, "Who we serve" pages, testimonial job titles
- Are there signals of company size? ("for teams of 10 to 10,000" / "Fortune 500 customers" / "built for small business")
- What industries appear? (construction, healthcare, logistics, retail, etc.)
- What job titles appear in case studies and testimonials?

### Vocabulary audit
- Write down 8–12 words/phrases the site uses prominently that buyers might also use (e.g. "telematics", "fleet management", "ELD compliance")
- Write down 3–5 words that appear to be jargon a non-technical buyer wouldn't know
- Note: does the site use "platform", "ecosystem", "enterprise"? These are enterprise signals.
- Note: does the site use "simple", "no IT required", "setup in minutes"? These are SMB signals.

### Pricing transparency
- Is there a pricing page? Does it show actual numbers?
- Is pricing hidden behind "contact us" or a demo request?
- Is there a free trial or freemium tier?
- This is critical for personas — a hidden price is always a finding.

### Navigation structure
- List the top-level nav items
- Note any second-level items that reveal solution categories or industries

### Notable features
- Any AI features, comparison tools, ROI calculators, or interactive demos?
- Any self-serve signup vs. sales-led motion?

Write a brief internal analysis (5–10 bullets) before starting persona generation. This keeps your personas grounded in what you actually observed.

---

## PART 2: PERSONA GENERATION

### How many personas
Generate **4 personas** by default. Generate 5 if the product clearly serves two distinct industries or both SMB and enterprise.

### The 4 required persona archetypes
Every research sprint needs these four perspectives. Adapt them to the company's actual buyers:

| # | Archetype | What they bring |
|---|-----------|-----------------|
| 1 | **Economic buyer** | Makes the final purchase decision. Cares about ROI, cost, and risk. Often a VP, director, or owner. |
| 2 | **End user / practitioner** | Uses the product daily. Cares about ease of use, time savings, not learning new software. |
| 3 | **Technical evaluator** | Evaluates integrations, security, implementation complexity. IT manager, systems admin, or technical operations. |
| 4 | **Skeptic / gatekeeper** | Price-sensitive, burned by bad software before, skeptical of sales processes. Often an owner-operator or ops manager at a smaller company. |

Optional 5th: **Existing customer** — already uses the product, returns to the site to find a specific feature or expand usage.

### Persona quality rules

**DO:**
- Give each persona a real first and last name that fits their background
- Set them in a specific city and specific company (real-sounding, not generic)
- Give them a specific trigger that brought them to the site TODAY (not "they need this product")
- Include the exact words they use AND the words they don't use — vocabulary contrast is what makes personas useful for narration
- Give them a time constraint ("15 minutes on his lunch break", "45 minutes before a board meeting")
- Ground their pain points in signals you actually saw on the website
- Include one behavioral detail about how they use websites (e.g. "looks for pricing before anything else", "opens 3 tabs and compares")

**DON'T:**
- Use placeholder names like "Marketing Manager Mary" or "IT Director Ian"
- Write goals that could apply to any product ("wants to improve efficiency")
- Make everyone technically savvy — at least 2 personas should be low-to-medium tech comfort
- Invent an industry the website doesn't serve
- Use the word "utilize" or "leverage" anywhere in a persona file

### Persona file format
Use the schema in `templates/persona.md` exactly. File name: `[firstname-role].md` in lowercase with hyphens. Save under `projects/[slug]/personas/`.

---

## PART 3: TASK GENERATION

### The 5 universal tasks
Always generate these tasks. Adapt the language to the specific company — the starting URL, goal phrasing, and "what to look for" items should all reference what you observed on the site.

#### Task 01 — First Impression
**Core question:** In 30 seconds of scanning, does a visitor know what this company does and whether they're the right audience?

What to customize:
- The "what to look for" items should reference the specific headline, vocabulary, and imagery you saw
- Note if the site has unusual above-the-fold elements (banners, overlays, chatbots)
- Max steps: 6

#### Task 02 — Solution Discovery
**Core question:** Can a visitor with a specific pain point find the relevant product or feature?

What to customize:
- Pick the most common pain point for the economic buyer persona
- The goal should be phrased as their specific problem, not "find the solutions page"
- Max steps: 8

#### Task 03 — Pricing & ROI
**Core question:** Can a visitor determine what this costs and whether it's worth it for their situation?

What to customize:
- If pricing is visible: task is "find and interpret the pricing page"
- If pricing is hidden: task is "try to figure out what this costs without talking to sales"
- Note: this task surfaces pricing transparency as a finding either way
- Max steps: 6

#### Task 04 — Trust & Credibility
**Core question:** Does the site give a visitor enough evidence to trust this company with their business?

What to customize:
- Reference the specific trust signals you saw (case studies, certifications, customer logos, reviews)
- For SMB-oriented sites: do case studies show companies the persona would relate to?
- For enterprise: are there security, compliance, or SLA pages?
- Max steps: 8

#### Task 05 — Next Step / Conversion
**Core question:** What happens when a visitor tries to take action? Does the process feel appropriate for their stage?

What to customize:
- The "next step" depends on the site's CTA: book demo, start trial, contact sales, get pricing
- This task should test the full flow: click CTA → what form appears → what's asked → does it feel like too much commitment?
- Max steps: 6

### Optional Task 06
Add a 6th task only if the site has one of these:
- An AI feature, chatbot, or interactive demo worth testing
- A competitive comparison page or "vs. [competitor]" page
- A free trial or self-serve signup flow
- An ROI calculator

Title the task after the specific feature (e.g. "Task 06 — AI Feature Evaluation" or "Task 06 — Free Trial Signup").

### Skip rules
- Existing customer persona: skip Task 01 (already knows the product), skip Task 03 (already a customer)
- For each task, note any persona-specific skip rules at the bottom of the task file

### Defining the optimal path (for efficiency scoring)
Every task needs an **Optimal path** — the shortest reasonable click sequence a confident, well-oriented user would take to complete it. This is what Efficiency (a session metric) is measured against.

While browsing the site in Part 1, note for each universal task:
- The exact nav label, page, and click sequence a smart user would follow
- The total click count (reading a page is not a click)

Rules:
- Count only navigations / clicks. Scrolling and reading don't count.
- If the task is structurally blocked (pricing hidden behind a demo form, no case studies on the site, etc.), the optimal path encodes what a *successful attempt* looks like — usually "check nav + footer, then conclude the information isn't public." Don't pretend the site has something it doesn't.
- Keep paths short — most should be 1–3 clicks. If your optimal path is >4 clicks, the site has an IA problem (and that itself is a finding worth noting).

Write the path into the `Optimal path` section of each task file using the schema in `templates/task.md`.

### Task file format
Use the schema in `templates/task.md` exactly. File name: `0N-task-name.md`. Save under `projects/[slug]/tasks/`.

---

## PART 4: FINAL CHECK BEFORE SAVING

Before saving any files, verify:

- [ ] Each persona is grounded in something specific from the website (an industry, a job title, a vocabulary word)
- [ ] No two personas have the same primary pain point
- [ ] At least one persona would be put off by enterprise-only signals
- [ ] Each task has a specific, observable completion criterion (not "understands the product")
- [ ] Task goals are written in the persona's voice, not a researcher's voice
- [ ] The starting URL for each task is correct and accessible
- [ ] Each task has a populated **Optimal path** section with step list and an integer **Optimal step count**
- [ ] Persona file names and task file names follow the naming convention
