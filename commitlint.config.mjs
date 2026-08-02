/**
 * Commitlint configuration for Ganttee.
 *
 * Enforces the Conventional Commits format documented in
 * `.github/instructions/git-workflow.instructions.md`.
 */

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "editor",
        "sidebar",
        "webview",
        "services",
        "models",
        "protocol",
        "store",
        "build",
        "deps",
        "specs",
        "test",
        "instructions",
      ],
    ],
    "scope-empty": [0], // scope is optional
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 72],
  },
};
