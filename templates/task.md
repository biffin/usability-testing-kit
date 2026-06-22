# Task Template

<!--
FIELD GUIDE — read before filling in

"Starting URL": Usually the homepage. Use a specific page if the task naturally
starts somewhere else (e.g. a pricing task might start at /pricing if it exists).

"Goal in the persona's own words": One sentence in quotes. Write it as the persona
would say it to a friend — not research language. "I want to know if this is for
someone like me" beats "evaluate first impression and audience fit."

"What counts as completion": 1–3 bullet points. Each one must be observable.
"Can articulate what the product does in plain English" is observable.
"Understands the value proposition" is not.

"What counts as failure": 2–4 bullet points. Think about the specific ways this
persona could fail — not generic failure modes. Failure for a price-sensitive
owner-operator is different from failure for an IT director.

"Max steps": Keep it low. 6 for simple tasks (first impression, pricing check).
Up to 10 for discovery tasks. Never more than 12. Prevents sessions from becoming
aimless browsing.

"Optimal path": The shortest reasonable click path a confident, well-oriented user
would take to complete the task. Used to compute Efficiency = optimal_steps / actual_steps
during sessions. Count only clicks/navigations — reading a page is not a step.
If the task is structurally blocked (e.g. pricing hidden behind a demo form), the
optimal path is "give up cleanly after checking nav + footer" — encode what a
*successful* attempt looks like, not what an ideal site would offer.

"What to look for": 4–7 bullet points. These are observation prompts for the
researcher/Claude narrating the session. They should be specific to this company's
site — reference actual page names, nav labels, or features you observed.

"Skip this task for": Optional. Note any personas who should skip this task and why.
Common cases: existing customer skips first impression, SMB persona skips enterprise
case study evaluation.
-->

# Task NN — [Task Name]

## Starting URL
[URL]

## Goal in the persona's own words
"[Goal as a direct quote from the persona's perspective]"

## What counts as completion
- [Observable success criterion 1]
- [Observable success criterion 2]
- [Observable success criterion 3 — optional]

## What counts as failure
- [Failure mode 1]
- [Failure mode 2]
- [Failure mode 3]
- [Failure mode 4 — optional]

## Max steps
[N]

## Optimal path (for efficiency calculation)
- Step 1: [page or action]
- Step 2: [page or action]
- Step 3: [page or action — optional]

Optimal step count: [N]

## What to look for during the session
- [Observation prompt 1]
- [Observation prompt 2]
- [Observation prompt 3]
- [Observation prompt 4]
- [Observation prompt 5]

## Skip this task for
[Persona name(s) — reason. Delete this section if no skips apply.]

---

# THE 5 UNIVERSAL TASK STUBS
# Copy, rename, and adapt these for any website. Replace [COMPANY], [URL], and
# all bracketed placeholders with content specific to the site you observed.

---

# Task 01 — First Impression

## Starting URL
[HOMEPAGE URL]

## Goal in the persona's own words
"In the first 30 seconds on this homepage, I want to know: what does this company actually do, and am I in the right place?"

## What counts as completion
- The persona can say in plain language what [COMPANY] sells
- The persona can say whether this site seems built for someone like them

## What counts as failure
- The persona is still confused about the product category after 30 seconds of scanning
- The persona feels the site is written for a completely different type of buyer
- The persona can't identify what [COMPANY] sells from the hero alone

## Max steps
6

## Optimal path (for efficiency calculation)
- Step 1: Land on homepage
- Step 2: Scan hero + subheadline (no click required to comprehend)

Optimal step count: 1

## What to look for during the session
- What do they read first — headline, subheadline, nav, or image?
- Does the vocabulary in the hero match the vocabulary this persona uses?
- Are there any above-the-fold signals of company size fit (SMB vs enterprise)?
- Does anything in the hero make them want to scroll, or do they plateau?
- What would they click first if they had to click something?

---

# Task 02 — Solution Discovery

## Starting URL
[HOMEPAGE URL]

## Goal in the persona's own words
"I have a specific problem — [PERSONA'S #1 PAIN POINT IN THEIR OWN WORDS]. I want to find out if [COMPANY] has something that solves it."

## What counts as completion
- The persona finds a specific product, feature, or solution page that addresses their pain
- The persona can describe in their own words what that solution does

## What counts as failure
- The persona navigates for more than 4 steps without finding relevant content
- The persona gives up and tries to search instead of navigating
- The persona finds a page but can't tell if it solves their specific problem
- The persona mistakes a related-but-wrong solution for the right one

## Max steps
8

## Optimal path (for efficiency calculation)
- Step 1: Click the relevant top-nav category (Solutions / Products / Industries)
- Step 2: Click the specific solution that matches the persona's pain
- Step 3: Land on solution detail page

Optimal step count: 3

## What to look for during the session
- Which nav path do they take first — Solutions, Products, Industries, or search?
- Are navigation labels intuitive to this persona's vocabulary?
- Does the solutions/products page help them self-select, or does it require them to already know the product?
- Is there an "Industries" section that would help them find their use case faster?
- What makes them confident they've found the right thing (vs. keep looking)?

---

# Task 03 — Pricing & ROI

## Starting URL
[HOMEPAGE URL — or /pricing if a pricing page exists]

## Goal in the persona's own words
"I need to figure out what this is going to cost me and whether it's worth it for a [COMPANY SIZE / INDUSTRY] like mine."

## What counts as completion
- The persona finds either a price, a pricing tier, or a clear explanation of how pricing works
- The persona can make a rough judgment: "this seems in my budget" or "this is out of reach"

## What counts as failure
- The persona cannot find any pricing signal without submitting a form or booking a call
- The persona finds pricing but can't interpret it for their situation (e.g. pricing is per-seat but they think in per-vehicle)
- The persona encounters a demo-request gate and decides it's not worth the commitment

## Max steps
6

## Optimal path (for efficiency calculation)
- Step 1: Click "Pricing" from the top nav (or footer if not in main nav)
- Step 2: Read the tier table or pricing explanation

Optimal step count: 1

(If pricing is hidden behind a form, optimal path = check top nav + footer for any pricing signal, then conclude "no public pricing." Optimal step count: 2.)

## What to look for during the session
- Is pricing accessible from the main nav?
- If pricing is hidden, how does the persona react — do they assume it's too expensive?
- Are there self-qualification tools (pricing calculators, tier selectors) that help?
- Does the pricing page speak to their company size, or only to enterprise?
- What information does the demo/pricing form ask for — does it feel like too much?

---

# Task 04 — Trust & Credibility

## Starting URL
[HOMEPAGE URL]

## Goal in the persona's own words
"Before I put this company's software in my business, I want to know: are they legit? Have companies like mine actually used this successfully?"

## What counts as completion
- The persona finds at least one trust signal that specifically resonates with them (a case study from a similar company, a relevant award, a customer count, a relevant certification)
- The persona feels confident enough to take a next step

## What counts as failure
- The persona finds only enterprise logos or Fortune 500 case studies (and they are not an enterprise buyer)
- The persona can't find any customer evidence beyond quotes
- The persona finds trust signals but none that feel relevant to their industry or company size
- The persona encounters a security/compliance page that is too technical to parse

## Max steps
8

## Optimal path (for efficiency calculation)
- Step 1: Click "Customers" / "Case studies" / "Customer stories" from nav
- Step 2: Open a case study from a company similar to the persona's
- Step 3: Read enough to assess fit (similar size, industry, use case)

Optimal step count: 2

## What to look for during the session
- What trust signals does the site surface first?
- Do the case study companies match this persona's company size and industry?
- Are customer testimonials attributed to specific, named people with real job titles?
- Are there third-party validation signals (G2, Capterra, industry awards)?
- What is conspicuously missing that this persona would want to see?

---

# Task 05 — Next Step / Conversion

## Starting URL
[HOMEPAGE URL]

## Goal in the persona's own words
"OK, I'm interested enough to take a next step. What does that actually involve, and is it worth my time?"

## What counts as completion
- The persona clicks through to the primary CTA (demo request, free trial, get pricing, contact sales)
- The persona can assess whether the ask (form length, commitment level) feels proportionate to where they are in their decision process

## What counts as failure
- The persona is unwilling to fill out the form because it asks for too much too soon
- The primary CTA leads to a dead end or a confusing page
- The form language creates anxiety (e.g. "a sales rep will call you within 24 hours" when the persona wanted to self-serve)
- The persona can't find a clear next step at all

## Max steps
6

## Optimal path (for efficiency calculation)
- Step 1: Click the primary CTA (hero or nav — whichever is most prominent)
- Step 2: Land on the form/next-step page and assess what's being asked

Optimal step count: 1

## What to look for during the session
- What CTA does the persona click — the one in the hero, the nav, or somewhere else?
- What does the form ask for — name/email only, or company size, phone, revenue?
- Is there a self-serve path (free trial, instant access) or is everything sales-gated?
- How does the confirmation/thank-you state feel — reassuring or anxiety-inducing?
- Would this persona complete the form, or abandon it partway through?
