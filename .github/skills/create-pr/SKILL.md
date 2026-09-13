---
name: create-pr
description: >
  Raise a pull request for a documentation or code repository using the gh CLI, with  applicable
  quality checks, code-review request, and PR description validation. Use when: opening a
  PR,  raising a PR, submitting a branch for review, creating a pull request to develop/main.
  argument-hint: "Optional: target base branch (defaults to gitflow convention)"
---

# Create PR

## When to Use

- The user asks to create, open, or raise a pull request for the current branch in a documentation,
  Java, or TypeScript repository.
- The branch is ready (or nearly ready) to be reviewed and merged into an integration branch
  (`develop`) or a long-lived branch (`main`) per gitflow.

## Clarification Gate

Do not create the PR until:

1. **Target base branch is confirmed.** Infer it from gitflow conventions (`feature/*` → `develop`,
   `fix/*` → `develop`, `hotfix/*` → `main`, `release/*` → `main`), but ask if the branch prefix is
   non-standard or the user hasn't stated a target.
2. **The changelog is updated, committed, and pushed.** `docs/CHANGELOG.md` must contain the PR's
   user-visible changes under `Unreleased` in a commit that is present on the remote branch.
3. **Quality checks have been run** (see below) and either pass, or the user explicitly accepts
   creating the PR with known failures.
4. **The PR description has been shown to the user and confirmed.** Always present the filled-in
   template and wait for explicit confirmation (or requested edits) before running `gh pr create`.
   Never create the PR silently.

## Workflow

### 1. Inspect the branch

- Resolve the target repository from the `origin` remote **only**: `git remote get-url origin`, then
  parse `<owner>/<repo>` from that URL (supports both `https://<host>/<owner>/<repo>.git` and
  `git@<host>:<owner>/<repo>.git` forms). This owner/repo — not a value typed by the user, not
  `upstream`, and not `gh`'s own repo-detection heuristics — is the only repository the PR may be
  raised against. If `origin` is missing, or its URL does not resolve to a single unambiguous
  `<owner>/<repo>`, stop and ask the user instead of guessing.
- If a second remote (e.g. `upstream`) exists, note it but never use it as the PR target unless the
  user explicitly asks to raise the PR there instead of `origin`.
- Run `gh pr view --repo <owner>/<repo> --json number,state,url` first. If an open PR already exists
  for the head branch, report its URL and ask whether to update it with `gh pr edit` instead of
  creating a new one.
- `git status --short --branch` — confirm current branch, upstream, and whether there are
  uncommitted changes. When uncommitted changes exist, show them to the user and wait for explicit
  confirmation before continuing to the next step. Do not commit or stash them without being asked.
- `git log <base>..HEAD --oneline` — list commits that will be in the PR. If it returns no commits,
  stop and tell the user there is nothing to raise a PR for.
- `git diff --stat <base>...HEAD` — summarize the file-level diff to inform the Summary/Changes
  sections.
- Confirm the branch is pushed to `origin` (`git push -u origin <branch>` if not), since
  `gh pr create` requires the head branch to exist on the resolved `origin` remote.

### 2. Update, commit, and push the changelog

- Update `docs/CHANGELOG.md` with the [`manage-changelog`](../manage-changelog/SKILL.md) skill.
- Confirm the update is committed on the branch. Do not create the PR while it remains uncommitted;
  ask the user to commit it or explicitly ask you to do so.
- Push the branch after the changelog commit. Confirm the remote branch points to the local `HEAD`
  by comparing `git rev-parse HEAD` with `git ls-remote origin refs/heads/<branch>`. Do not create
  the PR until the commit containing the changelog update is present on the remote branch.

### 3. Run quality checks

Before drafting the PR, inspect the repository-root build and configuration files to identify its
build system and the scripts, tasks, goals, or targets it defines. Do not invent commands.

Determine which configured commands cover each of these checks:

- Lint / formatting
- Type-check / compile
- Tests
- Build

Prefer a configured aggregate command when it explicitly covers multiple checks. Run the smallest
set of commands that covers every applicable check, and do not run a narrower command after an
aggregate command has already covered it. Run a separate configured command only for an applicable
check that remains uncovered.

If no recognized build-system configuration provides quality-check commands, use the `other`
fallback for lint / formatting: `npx --yes prettier --config ./prettierrc.json --write .`

Report any failures to the user before proceeding. Let the user decide whether to fix them first or
raise the PR anyway (e.g. draft PR for early feedback).

### 4. Draft the PR description

- Classify the repository by counting tracked files without displaying their paths. Run a shell-side
  aggregate over `git ls-files` that returns only the Markdown (`.md`) and code (`.java`, `.ts`)
  counts.
- Never load the complete tracked-file list into the conversation context.
- If the Markdown count is greater than the code count, load
  [PR_DOC_TEMPLATE.md](../create-pr/PR_DOC_TEMPLATE.md). Otherwise, including ties or if the
  counting command exits non-zero or returns no numeric output, tell the user the classification
  failed and use [PR_CODE_TEMPLATE.md](../create-pr/PR_CODE_TEMPLATE.md)

- Fill in every `{{placeholder}}` using only evidence from the commit log, diff, and quality-check
  results gathered above. Do not invent testing steps, issue references, or reviewer notes that
  weren't actually done.
- Draft a Conventional Commits-style title summarizing the change, consistent with the repo's commit
  message convention if one exists.

### 5. Confirm with the user

- Show the exact title, base branch, head branch, and filled-in description.
- Wait for explicit confirmation or requested changes. Re-show the updated description after any
  edit until confirmed.

### 6. Create the PR and request review

```sh
gh pr create --repo <owner>/<repo> --base <base-branch> --head <head-branch> \
  --title "<confirmed title>" --body "<confirmed description>"
```

Always pass `--repo <owner>/<repo>` explicitly, using the value resolved from `origin` in step 1 —
never omit it and never substitute a value the user typed, an `upstream` remote, or `gh`'s default
repo-detection. This prevents the PR from being accidentally opened against a fork's parent or an
unrelated repository.

- If a reviewer or team is known (CODEOWNERS, prior convention, or user instruction), request review
  in the same step or as a follow-up:
  `gh pr edit <number> --repo <owner>/<repo> --add-reviewer <handle-or-team>`.
- Add labels if the repo uses them and the user specifies which, e.g.
  `gh pr edit <number> --repo <owner>/<repo> --add-label "needs-review"`.
- If the user asked for a draft PR, pass `--draft`.

### 7. Verify

- `gh pr view <number> --repo <owner>/<repo> --json number,title,state,isDraft,baseRefName,headRefName,url`
- Confirm the returned `url` host/owner/repo matches the `origin` remote resolved in step 1 before
  reporting success. If it doesn't match, treat this as a failure and tell the user immediately.
- Report the PR URL and key metadata back to the user.

## Enterprise GitHub Host Note

If `gh auth status` shows an enterprise host (e.g. a `github.enterprise.com` account) but the git
remote is not `github.com`, the default `gh` invocation may still target `github.com` and fail with
"Could not resolve to a Repository". Set the host explicitly for the command:

```powershell
$env:GH_HOST = '<enterprise-host>'
gh pr create --repo <owner>/<repo> ...
```

The `<owner>/<repo>` value must still be the one resolved from `origin` in step 1 — `GH_HOST` only
changes which host `gh` talks to, never which repository the PR targets. Verify the host matches
`git remote get-url origin` before creating the PR.
