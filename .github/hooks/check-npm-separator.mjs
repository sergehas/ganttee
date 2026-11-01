// preToolUse hook: PowerShell strips a bare `--` before it reaches the npm/npx/pnpm/yarn .ps1
// shims, so the arguments after it are parsed as package-manager options. Deny such commands and
// return the corrected command with a quoted `'--'`.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PACKAGE_MANAGER = /^(?:npm|npx|pnpm|yarn)(?:\.ps1)?$/i;
const SEPARATORS = new Set([";", "|", "&", "(", ")", "{", "}", "\n", "\r"]);

/**
 * Blanks PowerShell here-strings so their content is not mistaken for commands.
 * @param {string} command PowerShell command text.
 * @returns {string} The command with here-string bodies replaced by spaces of equal length.
 */
function blankHereStrings(command) {
  return command.replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, (match) =>
    match.replace(/[^\r\n]/g, " "),
  );
}

/**
 * Splits a PowerShell command into statement segments of quote-aware tokens.
 * @param {string} command PowerShell command text.
 * @returns {{ text: string, start: number, quoted: boolean }[][]} Token lists, one per statement.
 */
export function tokenize(command) {
  const source = blankHereStrings(command);
  const segments = [[]];
  let token;
  const flush = () => {
    if (token) {
      segments.at(-1).push(token);
      token = undefined;
    }
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "'" || char === '"') {
      const end = source.indexOf(char, index + 1);
      const close = end === -1 ? source.length : end;
      token ??= { text: "", start: index, quoted: false };
      token.text += source.slice(index + 1, close);
      token.quoted = true;
      index = close;
    } else if (char === "`" && index + 1 < source.length) {
      token ??= { text: "", start: index, quoted: false };
      token.text += source[++index];
      token.quoted = true;
    } else if (SEPARATORS.has(char)) {
      flush();
      if (segments.at(-1).length > 0) {
        segments.push([]);
      }
    } else if (/\s/.test(char)) {
      flush();
    } else {
      token ??= { text: "", start: index, quoted: false };
      token.text += char;
    }
  }
  flush();
  return segments.filter((segment) => segment.length > 0);
}

/**
 * Finds bare `--` tokens passed to a package-manager .ps1 shim.
 * @param {string} command PowerShell command text.
 * @returns {number[]} Source offsets of every offending `--`.
 */
export function findBareSeparators(command) {
  const offsets = [];
  for (const segment of tokenize(command)) {
    if (!PACKAGE_MANAGER.test(segment[0].text) || segment[0].quoted) {
      continue;
    }
    for (const token of segment.slice(1)) {
      if (token.text === "--" && !token.quoted) {
        offsets.push(token.start);
      }
    }
  }
  return offsets;
}

/**
 * Builds the hook decision for one preToolUse event.
 * @param {unknown} event Parsed hook input (camelCase or VS Code snake_case payload).
 * @returns {object} `{}` to keep the default flow, or a deny decision with the corrected command.
 */
export function decide(event) {
  const args = event?.toolArgs ?? event?.tool_input;
  const parsed = typeof args === "string" ? JSON.parse(args) : args;
  const command = parsed?.command;
  if (typeof command !== "string") {
    return {};
  }
  const offsets = findBareSeparators(command);
  if (offsets.length === 0) {
    return {};
  }
  let fixed = command;
  for (const offset of offsets.reverse()) {
    fixed = `${fixed.slice(0, offset)}'--'${fixed.slice(offset + 2)}`;
  }
  return {
    permissionDecision: "deny",
    permissionDecisionReason:
      "PowerShell drops a bare `--` before it reaches the npm/npx/pnpm/yarn .ps1 shim. " +
      `Quote it and re-run: ${fixed}`,
  };
}

/** Reads the hook event from stdin and writes exactly one decision object. */
function main() {
  let decision = {};
  try {
    decision = decide(JSON.parse(readFileSync(0, "utf8")));
  } catch {
    // Fail open: command preToolUse hooks are fail-closed, so a malformed event must not block.
  }
  process.stdout.write(JSON.stringify(decision));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
