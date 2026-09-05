---
name: ask-user
description: Ask which skill or flow fits your situation. A router over the skills in this repo.
disable-model-invocation: true
---

# Ask User

You don't remember every skill, so ask.

## Precondition

**`/setup-skills`** — run once per repo, before your first engineering flow. It configures the issue
tracker (GitHub or local markdown) and domain doc layout (`CONTEXT.md`, ADRs) that
`/grill-with-docs` and `/domain-modeling` assume.

## Sharpen an idea

The route most work travels: you have an idea, a plan, or a design, and it isn't sharp enough to
build from yet.

- **`/grill-with-docs`** — start here whenever you are **working in a working directory**. It's
  stateful: what it learns lands in `CONTEXT.md` and ADRs as it goes.
- **`/grill-me`** — the same relentless interview, **stateless**: it saves nothing and builds no
  `CONTEXT.md`. Reach for it when there's no repo under the work — a plan, a design, a piece of
  writing. In a working directory `/grill-with-docs` is strictly the better one: same interview,
  plus a paper trail.
- **`/grilling`** — the primitive both run: rounds, the frontier, facts are the agent's job and
  decisions are yours. The two above are the named ways in.

The session is done when the frontier is empty. Then build — but check **Moving context** first if
the build won't fit in what's left of the window.

## Vocabulary underneath

**`/domain-modeling`** — sharpen the project's _domain_ language: challenge a fuzzy term, resolve an
overloaded word ("account" doing three jobs), record a hard-to-reverse decision as an ADR. It's the
active discipline `/grill-with-docs` drives to keep `CONTEXT.md` a clean glossary. Reach for it
directly when the **words**, not the process, are the problem.

## Gather facts

**`/research`** — delegate reading legwork to a **background agent**: it investigates a question
against **primary sources**, then leaves a cited Markdown file in the repo. Keep working while it
reads. What it produces is material to take _into_ `/grill-with-docs` — research feeds the thinking,
it doesn't replace it.

## Unblock

- **`/to-questionnaire`** — when the thing blocking you isn't in your head or the codebase but in
  **someone else's**, this writes them a questionnaire to fill in. It's the inverse of `/grill-me`:
  instead of interviewing you about the subject, it interviews you about the **send** — who it's
  going to, what you need back — and aims the questions at the gap. What comes back is material for
  `/grill-with-docs`.
- **`/wait-what`** — the corrective for a message that didn't land. Use it mid-conversation, inside
  any other skill, and the agent re-pitches what it just said with the context you were missing, in
  plain English, using the `CONTEXT.md` vocabulary. It works after the fact; `/grill-with-docs` is
  the upfront cure, because a shared language agreed early is what stops the jargon arriving at all.

## Moving context

A **phase** is a chunk of work inside a session — the grilling, the implementation, the QA. At the
**boundary** between two of them you have five options — **Continue**, **`/clear`**, **`/handoff`**,
a **subagent**, **`/compact`** — and picking between them is the fuzziest decision in this whole
map. Make the decision **at** a boundary; mid-phase, continue or split the rest into subagents.

Read [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) for the ordered tree — the five questions, the
reasoning behind each branch, and why the primary-source cost makes **Continue** the one to rule out
first.

**`/handoff`** is the narrow one: only for a **new harness**, a **new directory**, a **colleague**,
or forking a side task **mid-phase**. What it buys is portability.

## Authoring

**`/writing-for-agents`** — reference for writing documents agents consume: skills,
`copilot-instructions.md`, `AGENTS.md`, and any doc reached by a pointer. Reach for it when you're
editing this repo's own customization.
