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
    // Warning-only: the list is a suggestion, not a closed set. A spec-driven
    // change may legitimately introduce a new feature scope.
    "scope-enum": [
      1,
      "always",
      [
        // Product surfaces
        "editor",
        "sidebar",
        "webview",
        // Shared layers
        "services",
        "models",
        "protocol",
        // Project / tooling
        "specs",
        "build",
        "deps",
        "docs",
        "test",
        // Agentic tooling: instructions, skills, agents, prompts, hooks
        "agentic",
      ],
    ],
    "scope-empty": [0], // scope is optional
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 72],
  },
};
