import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { decide, findBareSeparators } from "./check-npm-separator.mjs";

const SCRIPT = fileURLToPath(new URL("./check-npm-separator.mjs", import.meta.url));

/**
 * Builds a camelCase preToolUse event for a PowerShell command.
 * @param {string} command PowerShell command text.
 * @returns {object} Hook event.
 */
const event = (command) => ({ toolName: "powershell", toolArgs: { command } });

test("denies a bare separator after npm and returns the quoted command", () => {
  const decision = decide(event("npm run vsce -- ls --no-dependencies"));
  assert.equal(decision.permissionDecision, "deny");
  assert.match(decision.permissionDecisionReason, /npm run vsce '--' ls --no-dependencies$/);
});

test("fixes every bare separator in every statement", () => {
  const decision = decide(event("npx a -- b; cd x | pnpm exec -- c"));
  assert.match(decision.permissionDecisionReason, /npx a '--' b; cd x \| pnpm exec '--' c$/);
});

test("allows quoted, escaped, and non-package-manager separators", () => {
  for (const command of [
    "npm run vsce '--' ls",
    'npm run vsce "--" ls',
    "npm run vsce `-- ls",
    "npm.cmd run vsce -- ls",
    "git diff -- src",
    "node script.mjs -- x",
    "npm test",
    "'npm' run x -- y",
  ]) {
    assert.deepEqual(findBareSeparators(command), [], command);
  }
});

test("detects separators after the call operator, in subexpressions, and with the .ps1 name", () => {
  assert.equal(findBareSeparators("& npm run x -- y").length, 1);
  assert.equal(findBareSeparators("$(yarn run x -- y)").length, 1);
  assert.equal(findBareSeparators("npm.ps1 run x -- y").length, 1);
});

test("ignores here-string bodies", () => {
  assert.deepEqual(findBareSeparators("@'\nnpm run x -- y\n'@ | node -"), []);
});

test("accepts VS Code payloads and JSON-string arguments", () => {
  assert.equal(decide({ tool_input: { command: "npm run x -- y" } }).permissionDecision, "deny");
  assert.equal(
    decide({ toolArgs: JSON.stringify({ command: "npm run x -- y" }) }).permissionDecision,
    "deny",
  );
});

test("allows events without a command", () => {
  assert.deepEqual(decide({ toolArgs: { path: "x" } }), {});
  assert.deepEqual(decide(undefined), {});
});

test("CLI writes one decision object and fails open on malformed input", () => {
  const deny = spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify(event("npm run x -- y")),
  });
  assert.equal(deny.status, 0);
  assert.equal(JSON.parse(deny.stdout).permissionDecision, "deny");
  const malformed = spawnSync(process.execPath, [SCRIPT], { input: "not json" });
  assert.equal(malformed.status, 0);
  assert.deepEqual(JSON.parse(malformed.stdout), {});
});
