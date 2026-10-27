---
name: setup-skills
description:
  Configure this repo for the engineering skills — set up its issue tracker and domain doc layout.
  Run once before first use of the other engineering skills.
disable-model-invocation: true
---

# Setup Skills

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker** — where issues live (GitHub or local markdown)
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm
with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `git remote -v` and `.git/config` — is this a GitHub repo? Which one?
- `.github/copilot-instructions.md`, `AGENTS.md`, and `CLAUDE.md` — does any exist? Is there already
  an `## Agent skills` section in it?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does this skill's prior output already exist? Is there an `issue-tracker.md`
  file?
- `.scratch/` — sign that a local-markdown issue tracker convention is already in use

### 2. Present findings and ask

Summarize what's present and what's missing. Then take the sections in order — one section, one
answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line
explainer only when the choice genuinely branches; skip the section entirely when exploration
already settled it.

**Section A — Issue tracker.**

> Explainer: The "issue tracker" is where issues live for this repo. Skills like `to-tickets` and
> `to-spec` read from and write to it — they need to know whether to call `gh issue create` or write
> a markdown file under `.scratch/`. Pick the place you actually track work for this repo.

Default to **local markdown** (recommended). Offer **GitHub** as an alternative (recommended if
`git remote` points at GitHub).

Record the choice in variable for Step 4.

**Section B — Domain docs.** Default to **single-context** — one `CONTEXT.md` + `docs/adr/` at the
repo root. This fits almost every repo. Lead with it so the user can accept it in a word, and write
it without asking when exploration found no monorepo signals.

Offer **multi-context** — a root `CONTEXT-MAP.md` pointing to per-context `CONTEXT.md` files — only
when exploration found monorepo signals. Then confirm which layout they want.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever config file is being edited (see step 4 for
  selection rules)
- The contents of `docs/agents/issue-tracker.md` (based on their tracker choice)
- The contents of `docs/agents/domain.md` (based on their domain doc layout choice)

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `.github/copilot-instructions.md` exists, edit it.
- Else if `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If none exists, ask the user which one to create — don't pick for them.

Never create a second config file when one already exists — always edit the one that's already
there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather
than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Issue tracker

Issues and specs live as [GitHub issues / local markdown files]. See `docs/agents/issue-tracker.md`.

### Domain docs

[one-line summary of layout — "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

Then write the docs files using the seed templates in this skill folder as a starting point:

- If GitHub was selected → write `docs/agents/issue-tracker.md` from
  [issue-tracker-github.md](./issue-tracker-github.md) template
- If Local markdown was selected → write `docs/agents/issue-tracker.md` from
  [issue-tracker-local.md](./issue-tracker-local.md) template
- [domain.md](./domain.md) — domain doc consumer rules + layout

### 5. Done

Tell the user the setup is complete and which engineering skills will now read from these files.
Mention they can edit `docs/agents/issue-tracker.md` and `docs/agents/domain.md` directly later —
re-running this skill is only necessary if they want to switch trackers or restart from scratch.
