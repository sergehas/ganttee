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

Reference file [.gitmessage](../../../.gitmessage) for the template and rules.

1. Choose the **type** (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`,
   `test`, `build`, `ci`, `chore`, `revert`).
2. Choose an optional **scope**. The suggested list is a warning-only hint, so
   introduce a new scope when none fits:
   - Product surfaces — `editor`, `sidebar`, `webview`.
   - Shared layers — `services`, `models`, `protocol`.
   - Project & tooling — `specs`, `build`, `deps`, `docs`, `test`.
   - Agentic tooling (instructions, skills, agents, prompts, hooks) —
     `agentic`.
3. Write the header as `type(scope): subject` — imperative mood, 72 chars max, no
   trailing period.
4. Add a body (what & why) when the change needs more details or an explanation.
5. Add footers (`BREAKING CHANGE:`, `Refs: #123`) when
   the change introduces a breaking change or relates to an issue.
6. Commit. Using the template (`git config commit.template .gitmessage`
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
chore(agentic): tighten the spec reviewer constraints
```
