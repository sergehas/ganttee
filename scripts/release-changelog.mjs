// @ts-check
/**
 * Release helper for `docs/CHANGELOG.md` (Keep a Changelog format), used by the release workflows.
 *
 * Usage:
 *   node scripts/release-changelog.mjs promote <version> [date]
 *     Moves the `## [Unreleased]` entries under a new `## [<version>] - <date>` heading and keeps
 *     an empty `## [Unreleased]` section at the top. Fails when Unreleased has no entries.
 *   node scripts/release-changelog.mjs notes <version>
 *     Prints the body of the `## [<version>]` section to stdout (GitHub Release notes).
 */

import { readFileSync, writeFileSync } from "node:fs";

/** Changelog path, relative to the repository root. */
const CHANGELOG_PATH = "docs/CHANGELOG.md";

/** Heading that holds unreleased entries. */
const UNRELEASED_HEADING = "## [Unreleased]";

/** Strict `X.Y.Z` semantic version. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Finds the line index of the next level-2 heading at or after `from`.
 * @param {string[]} lines changelog lines.
 * @param {number} from first index to inspect.
 * @returns {number} the heading index, or `lines.length` when there is none.
 */
function nextSectionIndex(lines, from) {
  const index = lines.findIndex((line, i) => i >= from && line.startsWith("## "));
  return index === -1 ? lines.length : index;
}

/**
 * Returns the body lines of the section that starts with `heading`.
 * @param {string[]} lines changelog lines.
 * @param {(line: string) => boolean} isHeading matches the section heading.
 * @returns {{ start: number, end: number }} heading index and exclusive body end index.
 */
function findSection(lines, isHeading) {
  const start = lines.findIndex(isHeading);
  if (start === -1) {
    return { start, end: -1 };
  }
  return { start, end: nextSectionIndex(lines, start + 1) };
}

/**
 * Promotes the Unreleased section to a dated version section.
 * @param {string} text changelog content.
 * @param {string} version release version.
 * @param {string} date release date (`YYYY-MM-DD`).
 * @returns {string} the updated changelog content.
 */
function promote(text, version, date) {
  const lines = text.split("\n");
  if (lines.some((line) => line.startsWith(`## [${version}]`))) {
    throw new Error(`Version ${version} already exists in ${CHANGELOG_PATH}.`);
  }
  const { start, end } = findSection(lines, (line) => line.trim() === UNRELEASED_HEADING);
  if (start === -1) {
    throw new Error(`Missing "${UNRELEASED_HEADING}" heading in ${CHANGELOG_PATH}.`);
  }
  const body = lines.slice(start + 1, end);
  if (!body.some((line) => line.trim().startsWith("- "))) {
    throw new Error(`"${UNRELEASED_HEADING}" has no entries to release.`);
  }
  const promoted = [UNRELEASED_HEADING, "", `## [${version}] - ${date}`, ...body];
  return [...lines.slice(0, start), ...promoted, ...lines.slice(end)].join("\n");
}

/**
 * Extracts the release notes of a version section.
 * @param {string} text changelog content.
 * @param {string} version release version.
 * @returns {string} the trimmed section body.
 */
function notes(text, version) {
  const lines = text.split("\n");
  const { start, end } = findSection(lines, (line) => line.startsWith(`## [${version}]`));
  if (start === -1) {
    throw new Error(`Version ${version} not found in ${CHANGELOG_PATH}.`);
  }
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

/**
 * CLI entry point.
 * @param {string[]} args command-line arguments after the script path.
 */
function main(args) {
  const [command, version, date = new Date().toISOString().slice(0, 10)] = args;
  if (!VERSION_PATTERN.test(version ?? "")) {
    throw new Error(`Invalid version "${version}". Expected X.Y.Z.`);
  }
  const text = readFileSync(CHANGELOG_PATH, "utf8");
  if (command === "promote") {
    writeFileSync(CHANGELOG_PATH, promote(text, version, date));
  } else if (command === "notes") {
    process.stdout.write(`${notes(text, version)}\n`);
  } else {
    throw new Error(`Unknown command "${command}". Use "promote" or "notes".`);
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
