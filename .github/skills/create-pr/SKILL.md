---
name: create-pr
description: "Raise a pull request for a documentation or code repository using the gh CLI, with 
applicable quality checks, code-review request, and PR description validation. Use when: opening a PR, 
raising a PR, submitting a branch for review, creating a pull request to develop/main."
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
   `fix/*` → `develop`, `hotfix/*` → `main`, `release/*` → `develop` and `main`), but ask if the
   branch prefix is non-standard or the user hasn't stated a target.
2. **The changelog is updated and committed.** `doc/CHANGELOG.md` must contain the PR's user-visible
   changes under `Unreleased` in a commit on the branch.
3. **Quality checks have been run** (see below) and either pass, or the user explicitly accepts
   creating the PR with known failures.
4. **The PR description has been shown to the user and confirmed.** Always present the filled-in
   template and wait for explicit confirmation (or requested edits) before running `gh pr create`.
   Never create the PR silently.

## Workflow

### 1. Inspect the branch

- `git status --short --branch` — confirm current branch, upstream, and whether there are
  uncommitted changes. Uncommitted changes are the user's responsibility; do not commit or stash
  them without being asked.
- `git log <base>..HEAD --oneline` — list commits that will be in the PR.
- `git diff --stat <base>...HEAD` — summarize the file-level diff to inform the Summary/Changes
  sections.
- Confirm the branch is pushed to the remote (`git push -u origin <branch>` if not), since
  `gh pr create` requires a remote head branch.

### 2. Update and commit the changelog

- Update `doc/CHANGELOG.md` with the [`manage-changelog`](../manage-changelog/SKILL.md) skill.
- Confirm the update is committed on the branch. Do not create the PR while it remains uncommitted;
  ask the user to commit it or explicitly ask you to do so.

### 3. Run quality checks

Run the checks that apply to the repo's stack before drafting the PR. Do not invent scripts — check
`package.json` (TypeScript/Node) or `pom.xml` / `build.gradle` (Java) for the actual script/goal
names first. Documentation checks use `npx` and do not require a `package.json` file.

| Stack         | Lint / formatting                                                                                     | Type-check / compile                    | Tests                         | Build                             |
| ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- | --------------------------------- |
| Documentation | `npx --yes prettier --check "**/*.md"` and `npx --yes markdownlint-cli2 "**/*.md" "#node_modules/**"` | N/A                                     | N/A                           | N/A                               |
| TypeScript    | `npm run lint`                                                                                        | `tsc --noEmit`                          | `npm test`                    | `npm run build`                   |
| Java          | `mvn spotless:check` / `./gradlew check`                                                              | `mvn compile` / `./gradlew compileJava` | `mvn test` / `./gradlew test` | `mvn package` / `./gradlew build` |
| other         | `npx --yes prettier --config ./prettierrc.json --check .`                                             | N/A                                     | N/A                           | N/A                               |

Report any failures to the user before proceeding. Let the user decide whether to fix them first or
raise the PR anyway (e.g. draft PR for early feedback).

### 4. Draft the PR description

- Classify the repository by counting tracked files without displaying their paths. Run a shell-side
  aggregate over `git ls-files` that returns only the Markdown (`.md`) and code (`.java`, `.ts`)
  counts.
- Never load the complete tracked-file list into the conversation context.
- If the Markdown count is greater than the code count, load
  [PR_DOC_TEMPLATE.md](../create-pr/PR_DOC_TEMPLATE.md). Otherwise, including ties or an
  inconclusive count, load [PR_CODE_TEMPLATE.md](../create-pr/PR_CODE_TEMPLATE.md).- Fill in every
  `{{placeholder}}` using only evidence from the commit log, diff, and quality-check results
  gathered above. Do not invent testing steps, issue references, or reviewer notes that weren't
  actually done.
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

- If a reviewer or team is known (CODEOWNERS, prior convention, or user instruction), request review
  in the same step or as a follow-up: `gh pr edit <number> --add-reviewer <handle-or-team>`.
- Add labels if the repo uses them and the user specifies which, e.g.
  `gh pr edit <number> --add-label "needs-review"`.
- If the user asked for a draft PR, pass `--draft`.

### 7. Verify

- `gh pr view <number> --json number,title,state,isDraft,baseRefName,headRefName,url`
- Report the PR URL and key metadata back to the user.

## Enterprise GitHub Host Note

If `gh auth status` shows an enterprise host (e.g. a `github.enterprise.com` account) but the git
remote is not `github.com`, the default `gh` invocation may still target `github.com` and fail with
"Could not resolve to a Repository". Set the host explicitly for the command:

```powershell
$env:GH_HOST = '<enterprise-host>'
gh pr create ...
```

Verify the intended host matches `git remote -v` before creating the PR.
