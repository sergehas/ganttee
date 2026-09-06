---
description:
  "Ganttee git workflow — Conventional Commits message format and gitflow branch naming. Use
  whenever writing a commit message, naming or creating a branch, or reviewing git history."
---

# Git Workflow

Ganttee uses **Conventional Commits** for every commit message and **gitflow** for every branch
name.

## Rules: Commit Messages (Conventional Commits)

Every commit message header must match:

```text
<type>(<scope>): <subject>
```

- **type** — required, lowercase, one of the allowed types below.
- **scope** — optional, lowercase; the area of the codebase touched.
- **subject** — required, imperative mood, no trailing period. State the change directly. Drop:
  articles (a/an/the), hedging. Short synonyms (big not extensive, fix not "implement a solution
  for"). No tool-call narration, no decorative emoji. no file list.
- **important**: overall commit message title **must be 72 characters or less**.
- One logical change per commit. Do not bundle unrelated fixes.

A full commit may add a body and footers:

```text
<type>(<scope>): <subject>
```

<body: why, wrapped at ~72 cols>

<footers: BREAKING CHANGE: ..., Refs: #123, Closes #123>

````

- Body (optional, after a blank line) explains **why**, not what.

### Allowed types

| Type       | Use for                                                       |
| ---------- | ------------------------------------------------------------- |
| `feat`     | A new user-facing feature.                                    |
| `fix`      | A bug fix.                                                    |
| `docs`     | Documentation only (README, specs, instructions, JSDoc-only). |
| `style`    | Formatting/whitespace; no code behavior change.               |
| `refactor` | Code change that neither fixes a bug nor adds a feature.      |
| `perf`     | A performance improvement.                                    |
| `test`     | Adding or correcting tests.                                   |
| `build`    | Build system, esbuild, bundling, or dependency changes.       |
| `ci`       | CI configuration and scripts.                                 |
| `chore`    | Maintenance that doesn't touch `src/` behavior.               |
| `revert`   | Reverts a previous commit.                                    |

### Suggested scopes

Prefer one of these when a scope applies (they mirror the source layers in
[source-code-organization.instructions.md](./source-code-organization.instructions.md)):

`editor`, `sidebar`, `webview`, `services`, `models`, `protocol`, `store`,
`build`, `deps`, `docs`, `test`.

### Breaking changes

Signal a breaking change with a `!` after the type/scope **and** a `BREAKING CHANGE:` footer:

```text
feat(protocol)!: rename dependency message payload

BREAKING CHANGE: `DependencyMessage.kind` is now `DependencyMessage.type`.
````

### Examples

```text
feat(editor): add milestone drag-and-drop
fix(services): reject dependency cycles during validation
docs(specs): add scheduling-engine acceptance criteria
refactor(webview): extract TaskForm field components
test(services): cover dangling-dependency branch
build(deps): bump echarts to 5.5.1
docs(instructions): add git workflow instructions
```

Do **not** write vague subjects (`update code`, `fix stuff`), use past tense (`added`), or exceed
the length limits.

## Branch Names (gitflow)

Branch names must be one of the long-lived branches or use a gitflow prefix:

| Branch / prefix | Purpose                                        |
| --------------- | ---------------------------------------------- |
| `main`          | Production-ready, released code.               |
| `develop`       | Integration branch for the next release.       |
| `feature/*`     | New work branched from `develop`.              |
| `release/*`     | Release stabilization branched from `develop`. |
| `hotfix/*`      | Urgent production fix branched from `main`.    |
| `fix/*`         | Non-urgent fix branched from `develop`.        |

The segment after the prefix must be lowercase kebab-case, and prefixed with an issue id:

`<prefix>/<issue-id>-<kebab-summary>` — lowercase, short, no ticket-less branches.

### Examples

```text
feature/inmemory-graph
feature/123-milestone-drag
release/1.2.0
hotfix/1.1.1-parse-crash
fix/dependency-cycle-detection
```

One ticket per branch. Reference the ticket you were given; do not invent an ID.

`release/*` and `hotfix/*` use the target version, not a ticket.

Avoid uppercase, spaces, or a missing prefix (e.g. `my-branch`, `Feature/X`).

## Boundaries

- 🚫 Never run destructive git commands without explicit confirmation: `git push --force`,
  `git reset --hard`, `git rebase` on shared branches, branch/tag deletion, `commit --amend` on
  pushed commits.
- 🚫 Never run the release scripts (`release:patch|minor|major`, `increment`, `postrelease`) — CI
  owns versioning and tagging.
- 🚫 Never commit secrets, credentials, or `.env` values.
- Project rule: do not stage or commit on the user's behalf unless asked.

## Local Setup

Point git at the commit template once per clone so `git commit` (without `-m`) pre-fills the format:

```sh
git config commit.template .gitmessage
```

`npm install` provisions the husky hooks that enforce these rules; no other setup is required.
