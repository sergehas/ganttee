---
name: grilling
description:
  Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to
  stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design
tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already
settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the
whole frontier in one round, then wait for the user's answers before the next round.

## How to ask

Ask questions **only** through the ask-questions tool. Never write a question as chat prose, never
number questions in a message, never render a question as a markdown list or table.

One round = one tool call. Pass the whole frontier as the questions array so the user sees a single
panel per round.

For each question in the array:

- `header` — a short unique identifier, **50 characters or fewer**. Every header in the call must be
  distinct, or the answers cannot be mapped back. Reuse of a header from an earlier round is fine.
- `question` — the question itself, one sentence, **200 characters or fewer**. Longer framing does
  not go here.
- `message` — optional markdown for context, trade-offs, or anything that does not fit the
  200-character limit.
- `options` — the candidate answers, when the decision is a choice. Mark your recommended answer
  with `recommended: true`. Omit `options` entirely for open questions.
- `multiSelect` — set it to `true` whenever more than one option can legitimately be picked
  together. Do not force a decision to be exclusive when it is not.
- `allowFreeformInput` — leave it at its default so the user can answer outside your options. Set it
  to `false` only when the choice is genuinely closed.

Always offer your recommended answer. If the question has options, it is the `recommended` option;
if it does not, state it in `message`.

Each round the user answers reshapes the tree — settled decisions push the frontier outward and
unblock questions that depended on them. Recompute the frontier and ask the next round. A question
whose answer depends on another question still open in this round belongs to a _later_ round, not
this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the
environment (filesystem, tools, etc.), dispatch a sub-agent to find it — don't ask the user for
anything you could look up yourself. Don't block on it: a running exploration is an unsettled
prerequisite, so only the questions downstream of it wait for the sub-agent to report — ask the rest
of the frontier now. The _decisions_ are the user's — put each to them and wait.

## Before you send

Check every message before you send it:

- Does it contain a question mark? That question belongs in an ask-questions call, not in the
  message.
- Does it list, number, or restate the round's questions? Delete that — the panel already shows
  them.
- Is the round's tool call still pending an answer? Then say nothing and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing
left silently assumed. Do not act on it until the user confirms you have reached a shared
understanding.
