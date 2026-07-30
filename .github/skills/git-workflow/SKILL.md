---
name: git-workflow
description: "Create a gitflow-compliant branch and compose a Conventional Commit message for Ganttee. Use when starting new work (branching), committing changes, or checking that a commit/branch name follows the repo conventions."
argument-hint: "<what you are committing or the branch you are starting>"
---

# Git Workflow

Help name a **gitflow** branch and write a **Conventional Commits** message that
passes Ganttee's local git hooks (`commitlint` + branch-name check). The full
rules live in
[git-workflow.instructions.md](../../instructions/git-workflow.instructions.md);
this skill is the step-by-step procedure.

## When to Use

- Starting new work and picking a branch name.
- Writing or fixing a commit message.
- Verifying a commit/branch will pass the hooks before pushing.

## Start a Branch

1. Pick the base and prefix by intent:
   - New feature → `feature/*` from `develop`.
   - Non-urgent fix → `bugfix/*` from `develop`.
   - Urgent production fix → `hotfix/*` from `main`.
   - Release stabilization → `release/*` from `develop`.
2. Name the segment in lowercase kebab-case, optionally prefixed by an issue id:
   `feature/123-milestone-drag`.
3. Create it:

   ```sh
   git switch develop && git pull
   git switch -c feature/<slug>
   ```

## Write a Commit

1. Choose the **type** (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
   `test`, `build`, `ci`, `chore`, `revert`).
2. Choose an optional **scope** from `editor`, `sidebar`, `webview`, `services`,
   `models`, `protocol`, `store`, `build`, `deps`, `docs`, `test`.
3. Write the header as `type(scope): subject` — imperative mood, ≤ 72 chars, no
   trailing period.
4. Add a body (what & why) and footers (`BREAKING CHANGE:`, `Refs: #123`) when
   the change needs explanation.
5. Commit. Using the template (`git config commit.template .gitmessage`
   once) pre-fills the format when you run `git commit` with no `-m`.

## Verify Before Push

- `npx commitlint --from origin/develop` — lint recent commit messages.
- Confirm the branch name matches a gitflow prefix; the `pre-push` hook rejects
  non-conforming names.

## Examples

```text
feat(editor): add milestone drag-and-drop
fix(services): reject dependency cycles during validation
docs(specs): add scheduling-engine acceptance criteria
build(deps): bump echarts to 5.5.1
```
