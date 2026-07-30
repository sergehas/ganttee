// @ts-check
/**
 * Validates the current git branch name against the Ganttee gitflow
 * convention documented in `.github/instructions/git-workflow.instructions.md`.
 *
 * Allowed:
 *   - long-lived branches: `main`, `develop`
 *   - prefixed branches: `feature/`, `release/`, `hotfix/`, `bugfix/`, `support/`
 *     followed by a lowercase kebab-case slug (optionally an issue id).
 *
 * Exits non-zero (blocking the push) when the branch name does not conform.
 */

import { execSync } from "node:child_process";

/** Long-lived branches that need no prefix. */
const LONG_LIVED = ["main", "develop"];

/**
 * Gitflow prefixes and the allowed slug shape. The slug is lowercase
 * kebab-case, optionally starting with a numeric issue id (e.g. `123-`).
 */
const PREFIXED =
  /^(feature|release|hotfix|bugfix|support)\/[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

/**
 * Resolves the current branch name, tolerating detached-HEAD state.
 * @returns {string} the current branch name, or an empty string when detached.
 */
function currentBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

const branch = currentBranch();

// A detached HEAD (empty) or explicit "HEAD" is not a named branch to check.
if (branch === "" || branch === "HEAD") {
  process.exit(0);
}

if (LONG_LIVED.includes(branch) || PREFIXED.test(branch)) {
  process.exit(0);
}

console.error(
  [
    `\u001b[31m✖ Branch name "${branch}" does not follow the gitflow convention.\u001b[0m`,
    "",
    "  Use one of:",
    "    main, develop",
    "    feature/<slug>, release/<slug>, hotfix/<slug>, bugfix/<slug>, support/<slug>",
    "",
    "  The <slug> must be lowercase kebab-case, e.g. feature/123-milestone-drag.",
    "  See .github/instructions/git-workflow.instructions.md",
  ].join("\n"),
);

process.exit(1);
