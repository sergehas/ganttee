# Contributing to Ganttee

Thank you for your interest in Ganttee. Read the [Code of Conduct](CODE_OF_CONDUCT.md) before you
take part.

## AI-Assisted Development

This project has been developed using AI. AI coding assistants write a large part of the code,
tests, and documentation, under human direction and review. You can use AI tools for your
contributions too, but you are responsible for every line that you submit: read it, test it, and
make sure that you have the right to contribute it. Tell us in the pull request when AI wrote a
significant part of the change.

## Report a Bug or Request a Feature

Use the [issue forms](https://github.com/sergehas/ganttee/issues/new/choose). Report security
problems privately as described in [SECURITY.md](SECURITY.md).

## Set Up

Requirements: Node.js 24 and VS Code 1.138.0 or later.

```sh
npm install
git config commit.template .gitmessage
```

`npm install` also installs the git hooks (commit message, formatting, and branch name checks).

Press `F5` in VS Code to start an Extension Development Host. The `watch` task rebuilds on change.

## Branches and Commits

The project uses gitflow and Conventional Commits. The full rules are in
[git-workflow.instructions.md](../.github/instructions/git-workflow.instructions.md).

- Branch from `develop` with `feature/<issue-id>-<summary>` or `fix/<issue-id>-<summary>`.
- Write commit titles as `<type>(<scope>): <subject>`, 72 characters or less.
- Open the pull request against `develop`. `main` receives only `release/*` and `hotfix/*` merges.

## Quality Checks

Before you open a pull request:

- `npm test` passes. It type-checks, lints, checks formatting, builds, and runs all tests.
- Branch coverage stays at 90% or more for each file (`npm run test:coverage-check`).
- Every user-facing string is localized (`vscode.l10n.t()` or `package.nls.json`), with `{0}`
  placeholders.
- Every class, method, and member has JSDoc.
- User-visible changes have an entry under `## [Unreleased]` in
  [docs/CHANGELOG.md](docs/CHANGELOG.md).

CI runs the same checks on each pull request. Branch protection rules are described in
[branch-protection.md](documentation/branch-protection.md).

## Releases

Maintainers release from GitHub Actions. Do not bump the version or create tags by hand.

1. Run **Start release** on `develop` and choose `patch`, `minor`, or `major`. The workflow creates
   `release/X.Y.Z`, bumps the version, moves the `Unreleased` changelog entries under `X.Y.Z`, and
   opens a pull request to `main`.
2. Stabilize on the release branch if necessary, then merge the pull request with a merge commit.
   **Release follow-up** deletes the merged `release/*` branch automatically.
3. Run **Release** on `main`. The workflow runs the tests, packages the VSIX, creates the `vX.Y.Z`
   tag and GitHub Release, then runs `npm version preminor --preid dev --no-git-tag-version`. It
   commits `package.json` and `package-lock.json` on `release/X.Y.Z-dev.0` and opens a PR to `main`.
   The required admin-owned `RELEASE_TOKEN` starts CI for this PR.
4. After CI and all required checks pass, **Release follow-up** merges the development bump PR using
   the admin PR-only bypass. It deletes that release branch and opens the back-merge PR from `main`
   to `develop`, which is also merged automatically after successful CI and required checks. `main`
   retains the plain release version only until the development bump PR merges.
5. Approve the `marketplace` deployment. The **Publish** job publishes the released VSIX to the VS
   Code Marketplace.

Publishing uses the original tag and VSIX; it does not wait for the follow-up PRs to merge. The
initial release PR still requires a maintainer to merge it. Follow-up merge conflicts or failed
checks require maintainer intervention. Rerun CI after resolving them.

To publish an existing release again, run **Publish** manually with its tag.
