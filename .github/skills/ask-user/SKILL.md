---
name: ask-user
description: Ask which skill or flow fits your situation. A router over the skills in this repo.
disable-model-invocation: true
---

# Ask User

You don't remember every skill, so ask.

Before stating what a skill does or recommending a step be skipped, read that skill's SKILL.md: the
summaries here are for orientation only.

A **flow** is a path through the skills. Most paths run along one **main flow**, and one **on-ramp**
merges onto it. Everything else is standalone, or a vocabulary layer that runs underneath.

## The main flow: idea → ship

The route most work travels. You have an idea and want it built.

1. **`/grill-with-docs`** sharpens the idea by interview. Start here whenever you are **working in a
   working directory**: it's stateful, retaining what it learns in `GLOSSARY.md` and ADRs. (No
   working directory? Use `/grill-me` instead, covered under Standalone. Both run the same
   `/grilling` primitive; `grill-with-docs` is the one that leaves a paper trail, which makes it the
   better of the two whenever a repo is there to leave it in.)
2. **Branch: is this a multi-session build?**
   - **Yes** → write a spec. **`/feature-spec`** scaffolds `docs/specs/<slug>/SPEC.md`; the **Spec
     Writer** agent drafts it (`Draft`), the **Spec Reviewer** agent optionally checks it
     (`Reviewed`), and the **Test Planner** agent plans its tests. **`/spec-router`** suggests the
     right agent whenever you mention a spec or a roadmap status.
   - **No** → build it right here, in the same context window.
3. **Build it.** For a spec, the **Spec Implementer** agent presents a plan, builds it after your
   approval, and moves the spec to `Implementing` and then `Implemented`. Either way, the code gets
   built by driving **`/tdd`** (one red-green slice at a time) and closes out with
   **`/code-review`**, a two-axis review (Standards + Spec) of the diff. Reach for **`/tdd`** on its
   own when you just want to build a concrete behaviour test-first without a full spec, and
   **`/code-review`** on its own whenever you want to review a branch or PR against a fixed point.

   Before the work goes up as a pull request, **`/release-readiness`** runs the quality gate and
   **`/manage-changelog`** records the change. **`/create-pr`** then raises the PR from the
   repository template.

4. **`/retro`** closes the loop. After a build, and especially one that went sideways, it looks back
   over the session and suggests changes to the agent's **environment**, not the code: navigation
   pointers, automated checks, the coding standards `/code-review` enforces, steering files,
   tooling. Mechanical mistakes become deterministic checks; judgement calls become coding
   standards. The next build then starts from a better environment.

### Context hygiene

Keep steps 1–2 in **one unbroken context window** (don't compact or clear until the spec is drafted)
so the grilling and the spec build on the same thinking. The implementation then starts fresh,
working from the spec. Run `/retro` in the session it's looking back on, before you clear; after
clearing, point it at that session's log instead.

The limit on this is the **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**:
the window (~150k tokens on state-of-the-art models) within which the model still reasons sharply.
If a session approaches it before the spec is drafted, don't push on degraded; `/compact` at the
nearest phase boundary and carry on (see Phase boundaries).

## On-ramp

A starting situation that generates work, then merges onto the main flow.

- **Something's broken** → **`/diagnosing-bugs`**. For the hard ones: the bug that resists a first
  glance, the intermittent flake, the regression that crept in between two known-good states. It
  refuses to theorise until it has a **tight feedback loop** (one command that already goes red on
  _this_ bug), then fixes with a regression test. Once the fix is in, run **`/retro`** in the same
  session to ask what would have prevented the bug; where the real finding is that there's no good
  seam to lock it down, that's a job for **`/improve-codebase-architecture`**.

## Codebase health

Not feature work, just upkeep.

- **`/improve-codebase-architecture`** runs whenever you have a spare moment to keep the codebase
  good for agents to operate in. It surfaces **deepening opportunities**; picking one _generates an
  idea_ you can take into the main flow at `/grill-with-docs`. It's the survey that finds the
  candidates; **`/codebase-design`** (below) is the bench you design the chosen one on.

## Vocabulary underneath

Two model-invoked references that run _beneath_ the other skills, each the single source of truth
for its vocabulary. Reach for them directly when the **words**, not the process, are the problem; or
let the skills above pull them in.

- **`/domain-modeling`**: sharpen the project's _domain_ language: challenge a fuzzy term, resolve
  an overloaded word ("account" doing three jobs), record a hard-to-reverse decision as an ADR. It's
  the active discipline `/grill-with-docs` drives to keep `GLOSSARY.md` a clean glossary.
- **`/codebase-design`** is the deep-module vocabulary (module, interface, depth, seam, adapter,
  leverage, locality) for designing a module's _shape_: a lot of behaviour behind a small interface
  at a clean seam. `/tdd` and `/improve-codebase-architecture` both speak it.

## Phase boundaries

A **phase** is a chunk of work inside a session: the grilling, the implementation, the QA. At the
**boundary** between two of them you have five options, and picking between them is the fuzziest
decision in this whole map:

- **Continue**: stay put. Costs nothing, loses nothing.
- **`/clear`**: empty the window, when nothing here matters to what's next.
- **`/handoff`** writes a portable markdown file. Narrow: only for a **new harness**, a **new
  directory**, a **colleague**, or forking a side task **mid-phase**. What it buys is portability.
- **Subagent**: send a tightly-scoped task to its own window and get a report back.
- **`/compact`** compresses this context and seeds a fresh session with it. The **default**, at the
  bottom of the tree rather than the first reach.

Read [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) for the ordered tree: the five questions, the
reasoning behind each branch, and why the primary-source cost makes **Continue** the one to rule out
first. Make the decision **at** a boundary; mid-phase, continue or split the rest into subagents.

## Standalone

Off the main flow entirely.

- **`/grill-me`**: the same relentless interview as `/grill-with-docs`, but **stateless**: it saves
  nothing locally and builds no `GLOSSARY.md`. Reach for it when you are **not working in a working
  directory** (sharpening a plan, a design, a piece of writing, anything with no repo under it). If
  you are in a working directory, use `/grill-with-docs` instead: it runs the same interview and
  leaves a paper trail, so it is strictly the better one.
- **`/grilling`** is the interview primitive itself: rounds, the frontier, facts are the agent's job
  and decisions are yours. `/grill-me` and `/grill-with-docs` are the two named ways in, and
  `/improve-codebase-architecture` runs it internally. Reach for it directly only when you want the
  interview with no wrapper around it.- **`/research`**: delegate reading legwork to a **background
  agent**: it investigates a question against **primary sources**, then leaves a cited Markdown file
  in the repo. Keep working while it reads. The file it produces is something to take _into_ the
  main flow at `/grill-with-docs`, since research feeds the thinking rather than replacing it.
- **`/to-questionnaire`** comes in when the thing blocking you isn't in your head or the codebase
  but in **someone else's**, and it writes them a questionnaire to fill in. It's the inverse of
  `/grill-me`: instead of interviewing you about the subject, it interviews you about the **send**
  (who it's going to, what you need back) and aims the questions at the gap. What comes back is
  material for `/grill-with-docs` or `/feature-spec`.
- **`/wait-what`** is the corrective for a message that didn't land. Use it mid-conversation, inside
  any other skill, and the agent re-pitches what it just said with the context you were missing, in
  plain English, using the `GLOSSARY.md` vocabulary. It works after the fact; `/grill-with-docs` is
  the upfront cure, because a shared language agreed early is what stops the jargon arriving at all.
- **`/writing-for-agents`** is the reference for writing documents agents consume: skills,
  AGENTS.md, pointed-at docs.

## Precondition

**`/setup-skills`**: configures the issue tracker and doc layout the other skills assume. It has
already run for this repo (see `docs/agents/`); re-run it only to switch issue trackers.
