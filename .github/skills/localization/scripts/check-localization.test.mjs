import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import {
  audit,
  compareCatalogs,
  main,
  manifestKeys,
  readCatalog,
  readEvidence,
  runtimeKeys,
} from "./check-localization.mjs";

const temporaryDirectories = [];

/** Builds an isolated miniature extension without touching the actual catalogs. */
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ganttee-localization-"));
  temporaryDirectories.push(root);
  const write = (name, value) => {
    const file = path.join(root, ...name.split("/"));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return file;
  };
  write("package.json", { displayName: "%title%", nested: [{ title: "%title%" }] });
  write("package.nls.json", { title: "Title" });
  write("package.nls.fr.json", { title: "Titre" });
  write("l10n/bundle.l10n.json", { Save: "Save" });
  write("l10n/bundle.l10n.fr.json", { Save: "Enregistrer" });
  write(
    "node_modules/@types/vscode/index.d.ts",
    `declare module "vscode" {
      export namespace l10n {
        function t(message: string, ...args: unknown[]): string;
        function t(options: { message: string; args: unknown[]; comment: string[] }): string;
      }
    }`,
  );
  write(
    "src/webview/l10n.ts",
    `export type WebviewTranslator = (source: string, ...args: unknown[]) => string;
     export function translate(catalog: unknown, source: string): string { return source; }
     export function useTranslate(): WebviewTranslator { return source => source; }`,
  );
  write("src/main.ts", `import * as vscode from "vscode"; vscode.l10n.t("Save");`);
  return { root, write };
}

after(() => {
  for (const root of temporaryDirectories) {
    rmSync(root, { recursive: true });
  }
});

test("valid complete catalogs pass with a production host consumer", () => {
  assert.deepEqual(audit(fixture().root), []);
});

test("manifest traversal reads values, not property names or unrelated words", () => {
  assert.deepEqual(
    [...manifestKeys({ "%ignored%": "plain", "nested": ["%a% / %b%", null, 2, "%a%"] })],
    ["a", "b"],
  );
});

test("catalog parsing reports invalid JSON, duplicate keys, and invalid values", () => {
  const { write } = fixture();
  for (const text of ["{", "null", "[]", "3", '"text"']) {
    const diagnostics = [];
    assert.equal(readCatalog(write("broken.json", text), diagnostics), undefined);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].severity, "error");
  }
  const diagnostics = [];
  readCatalog(write("broken.json", '{"a":"first","a":"second","b":1,"c":"  "}'), diagnostics);
  assert.equal(diagnostics.length, 3);
  assert.match(diagnostics[0].message, /Duplicate key "a"/);
  assert.equal(diagnostics[0].line, 1);
  const placeholders = [];
  readCatalog(write("broken.json", { a: "{name}", b: "{0", c: "{0}" }), placeholders);
  assert.equal(placeholders.length, 2);
});

test("parity checks exact keys, repeated placeholders, and unchanged English", () => {
  const diagnostics = [];
  compareCatalogs(
    { missing: "Missing", repeated: "{0} and {0}", same: "OK", named: "{name}", invalid: 1 },
    { extra: "Extra", repeated: "{0}", same: "OK", named: "{name}", invalid: false },
    "fr.json",
    diagnostics,
  );
  assert.deepEqual(
    diagnostics.map((item) => item.message),
    [
      'Missing key "missing".',
      'Placeholder mismatch for "repeated".',
      'Review unchanged English for "same".',
      'Unsupported placeholder for "named".',
      'Review unchanged English for "named".',
      'Extra key "extra".',
    ],
  );
});

test("placeholder reordering is valid but changing indices is not", () => {
  const diagnostics = [];
  compareCatalogs({ key: "{0} before {1}" }, { key: "{1} après {0}" }, "fr", diagnostics);
  assert.deepEqual(diagnostics, []);
  compareCatalogs({ key: "{0}" }, { key: "{1}" }, "fr", diagnostics);
  assert.match(diagnostics[0].message, /Placeholder mismatch/);
});

test("manifest and runtime usages are checked in both directions", () => {
  const { root, write } = fixture();
  write("package.nls.json", { unused: "Unused" });
  write("l10n/bundle.l10n.json", { orphan: "Orphan" });
  const messages = audit(root).map((item) => item.message);
  for (const expected of [
    'Missing reference key "title".',
    'Missing reference key "Save".',
    'Unused key "unused".',
    'Unused key "orphan".',
  ]) {
    assert.ok(messages.includes(expected), expected);
  }
});

test("locale families require counterparts and case-insensitive uniqueness", () => {
  const { root, write } = fixture();
  write("package.nls.de.json", { title: "Titel" });
  write("package.nls.FR.json", { title: "Titre" });
  const messages = audit(root).map((item) => item.message);
  assert.ok(messages.includes("Locale de needs a catalog in both families."));
  if (process.platform !== "win32") {
    assert.ok(messages.includes("Duplicate locale fr."));
  }
});

test("bad reference and localized catalogs produce errors without an apparent pass", () => {
  const { root, write } = fixture();
  write("package.nls.json", "{");
  write("l10n/bundle.l10n.fr.json", "[]");
  assert.equal(audit(root).filter((item) => item.severity === "error").length, 2);
  write("l10n/bundle.l10n.json", "null");
  assert.equal(audit(root).filter((item) => item.severity === "error").length, 3);
});

test("TSX hooks, imported aliases, typed callbacks, and catalog-first APIs count", () => {
  const { root, write } = fixture();
  write(
    "src/webview/component.tsx",
    `import { useTranslate as useT, translate as tr, WebviewTranslator } from "./l10n";
     const t = useT();
     const ui = <button title={t("Cancel")}>{tr({}, "Delete")}</button>;
     function present(translator: WebviewTranslator) { return translator("Open"); }
     type Translate = (message: string) => string;
     function other(localize: Translate) { return localize("Close"); }`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()].sort(), [
    "Cancel",
    "Close",
    "Delete",
    "Open",
    "Save",
  ]);
  assert.deepEqual(diagnostics, []);
});

test("aliases to host APIs and inline webview translators retain their localization identity", () => {
  const { root, write } = fixture();
  write(
    "src/webview/inline.ts",
    `import { l10n } from "vscode";
     const localize = l10n.t;
     localize("Alias");
     interface Input { translate: (text: string) => string; }
     function option(input: Input) { return input.translate("Legend"); }
     function tooltip(translate: (source: string) => string) {
       return translate("Tooltip");
     }`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()].sort(), [
    "Alias",
    "Legend",
    "Save",
    "Tooltip",
  ]);
  assert.deepEqual(diagnostics, []);
});

test("bounded expressions support aliases, properties, conditionals, unions, and case transforms", () => {
  const { root, write } = fixture();
  write(
    "src/main.ts",
    `import * as vscode from "vscode";
     const alias = "Save";
     const messages = { remove: "Delete" } as const;
     declare const condition: boolean;
     declare const format: "svg" | "png";
     vscode.l10n.t(alias);
     vscode.l10n.t(messages.remove);
     vscode.l10n.t(condition ? "Open" : "Closed");
     vscode.l10n.t(format.toUpperCase());
     vscode.l10n.t(("Task" as const) satisfies string);
     vscode.l10n.t(<string>"Group");
     vscode.l10n.t("Edit " + (condition ? "Task" : "Group"));
     vscode.l10n.t(format.toLowerCase());`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()].sort(), [
    "Closed",
    "Delete",
    "Edit Group",
    "Edit Task",
    "Group",
    "Open",
    "PNG",
    "SVG",
    "Save",
    "Task",
    "png",
    "svg",
  ]);
  assert.deepEqual(diagnostics, []);
});

test("options-object host overload resolves the message, not arguments or comments", () => {
  const { root, write } = fixture();
  write(
    "src/main.ts",
    `import * as vscode from "vscode";
     vscode.l10n.t({ message: "Save", args: ["Not a key"], comment: ["Nor a key"] });`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()], ["Save"]);
  assert.deepEqual(diagnostics, []);
});

test("unknown and partially bounded dynamic calls fail with source locations", () => {
  const { root, write } = fixture();
  write(
    "src/main.ts",
    `import * as vscode from "vscode";
     declare const message: string;
     declare const condition: boolean;
     vscode.l10n.t(message);
     vscode.l10n.t(condition ? "Save" : message);
     vscode.l10n.t(message + "Save");
     vscode.l10n.t({ message, args: [], comment: [] });
     vscode.l10n.t();`,
  );
  const diagnostics = [];
  assert.equal(runtimeKeys(root, diagnostics).size, 0);
  assert.equal(diagnostics.length, 5);
  assert.deepEqual(
    diagnostics.map((item) => item.line),
    [4, 5, 6, 7, 8],
  );
  assert.ok(diagnostics.every((item) => /Unresolved translation call/.test(item.message)));
});

test("tests, declarations, comments, unrelated literals, and bridge enumeration are not usage", () => {
  const { root, write } = fixture();
  const falseConsumer = `import * as vscode from "vscode"; vscode.l10n.t("Orphan");`;
  for (const name of [
    "src/test/example.ts",
    "src/tests/example.ts",
    "src/__tests__/example.ts",
    "src/example.test.tsx",
    "src/example.spec.ts",
    "src/example.integrationTest.ts",
    "src/example.d.ts",
  ]) {
    write(name, falseConsumer);
  }
  write(
    "src/other.ts",
    `// vscode.l10n.t("Orphan")
     const orphan = "Orphan";
     const t = (text: string) => text;
     t("Orphan");`,
  );
  write(
    "src/views/editor/webviewL10n.ts",
    `import * as vscode from "vscode";
     export function createWebviewL10nCatalog() {
       return Object.keys({ Orphan: "Orphan" }).map(key => vscode.l10n.t(key));
     }`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()], ["Save"]);
  assert.deepEqual(diagnostics, []);
});

test("typed direct translator forwarding does not itself establish usage", () => {
  const { root, write } = fixture();
  write(
    "src/forward.ts",
    `import * as vscode from "vscode";
     import { WebviewTranslator } from "./webview/l10n";
     export const forward: WebviewTranslator = (message, ...args) =>
       vscode.l10n.t(message, ...args);`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()], ["Save"]);
  assert.deepEqual(diagnostics, []);
});

test("source syntax errors prevent a successful audit", () => {
  const { root, write } = fixture();
  write("src/broken.ts", "export const = ;");
  const diagnostics = [];
  runtimeKeys(root, diagnostics);
  assert.ok(diagnostics.some((item) => item.message.startsWith("Cannot audit source:")));
});

test("recursive aliases terminate and report unresolved calls", () => {
  const { root, write } = fixture();
  write(
    "src/main.ts",
    `import * as vscode from "vscode"; const a = b; const b = a; vscode.l10n.t(a);`,
  );
  const diagnostics = [];
  assert.equal(runtimeKeys(root, diagnostics).size, 0);
  assert.match(diagnostics[0].message, /Unresolved/);
});

test("mutable strings do not count only their initial value as usage", () => {
  const { root, write } = fixture();
  write(
    "src/main.ts",
    `import * as vscode from "vscode";
     let label: string = "Save";
     label = String(Date.now());
     vscode.l10n.t(label);
     const record = { label: "Save" };
     record.label = String(Date.now());
     vscode.l10n.t(record.label);`,
  );
  const diagnostics = [];
  assert.equal(runtimeKeys(root, diagnostics).size, 0);
  assert.match(diagnostics[0].message, /Unresolved/);
});

test("new real consumers in bridge files are not exempt from auditing", () => {
  const { root, write } = fixture();
  write(
    "src/views/editor/webviewL10n.ts",
    `import * as vscode from "vscode";
     export function showLabel() { return vscode.l10n.t("Bridge UI"); }`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()].sort(), ["Bridge UI", "Save"]);
  assert.deepEqual(diagnostics, []);
});

test("catalog callbacks are forwarding plumbing, not actual consumers", () => {
  const { root, write } = fixture();
  write(
    "src/views/editor/webviewL10n.ts",
    `export function createWebviewL10nCatalog(localize: (source: string) => string) {
       return Object.keys({ Orphan: "Orphan" }).map(key => localize(key));
     }`,
  );
  write(
    "src/catalog.ts",
    `import * as vscode from "vscode";
     import { createWebviewL10nCatalog } from "./views/editor/webviewL10n";
     createWebviewL10nCatalog(source => vscode.l10n.t(source));`,
  );
  const diagnostics = [];
  assert.deepEqual([...runtimeKeys(root, diagnostics).keys()], ["Save"]);
  assert.deepEqual(diagnostics, []);
});

test("CLI orchestration returns failure for errors and success for warnings alone", () => {
  const { root, write } = fixture();
  const messages = [];
  const output = {
    error: (message) => messages.push(message),
    warn: (message) => messages.push(message),
    log: (message) => messages.push(message),
  };
  assert.equal(main(root, output), 0);
  write("l10n/bundle.l10n.fr.json", { Save: "Save" });
  assert.equal(main(root, output), 0);
  assert.ok(messages.some((message) => message.startsWith("WARNING")));
  write("src/main.ts", 'import * as vscode from "vscode"; vscode.l10n.t("Missing");');
  assert.equal(main(root, output), 1);
  assert.ok(messages.some((message) => /^ERROR .*main.ts:1:/.test(message)));
  assert.equal(main(path.join(root, "absent"), output), 1);
  assert.ok(
    messages.some((message) => message.startsWith("Localization audit could not complete:")),
  );
});

/** Resolves runtime keys for one source file and returns sorted keys plus diagnostics. */
function resolveSource(source, evidence) {
  const { root, write } = fixture();
  write("src/main.ts", `import * as vscode from "vscode";\n${source}`);
  const diagnostics = [];
  const keys = [...runtimeKeys(root, diagnostics, evidence).keys()].sort();
  return { keys, diagnostics };
}

test("const registries resolve through aliases, element access, and nested properties", () => {
  const { keys, diagnostics } = resolveSource(
    `const TEMPLATES = { named: "Task {0}", unnamed: "unnamed task" } as const;
     const T = TEMPLATES;
     type Kind = "task" | "group";
     const LABELS: Record<Kind, { named: string; missing: string }> = {
       task: { named: T.named, missing: "missing task" },
       group: { named: "Group {0}", missing: "missing group" },
     };
     const ORIGINS: Partial<Record<"draft" | "edit" | "other", string>> = { draft: "Draft: {0}" };
     declare const kind: Kind;
     declare const origin: "draft" | "edit" | "other";
     const labels = LABELS[kind];
     vscode.l10n.t(labels.named);
     vscode.l10n.t(LABELS[kind].missing);
     const template = ORIGINS[origin];
     if (template !== undefined) { vscode.l10n.t(template); }
     declare const open: string;
     vscode.l10n.t(LABELS[open as Kind].missing);`,
  );
  assert.deepEqual(keys, ["Draft: {0}", "Group {0}", "Task {0}", "missing group", "missing task"]);
  assert.deepEqual(diagnostics, []);
});

test("function returns resolve, and unreachable never-typed defaults add nothing", () => {
  const { keys, diagnostics } = resolveSource(
    `type State = "open" | "closed";
     function label(state: State): string {
       switch (state) {
         case "open": return "Open";
         case "closed": return "Closed";
         default: return state;
       }
     }
     const arrow = (flag: boolean) => (flag ? "Yes" : "No");
     declare const state: State;
     vscode.l10n.t(label(state));
     vscode.l10n.t(arrow(true));`,
  );
  assert.deepEqual(keys, ["Closed", "No", "Open", "Yes"]);
  assert.deepEqual(diagnostics, []);
});

test("parameters resolve from every call site unless the function escapes", () => {
  const { keys, diagnostics } = resolveSource(
    `function join(separator: string, fallback = "None") {
       return [vscode.l10n.t(separator), vscode.l10n.t(fallback)];
     }
     join(", ");
     join(" -> ", "Empty");
     function escaped(message: string) { return vscode.l10n.t(message); }
     ["Hidden"].map(escaped);
     function spread(message: string) { return vscode.l10n.t(message); }
     declare const values: [string];
     spread(...values);
     function never(message: string) { return vscode.l10n.t(message); }`,
  );
  assert.deepEqual(keys, [" -> ", ", ", "Empty", "None"]);
  assert.deepEqual(
    diagnostics.map((item) => item.line),
    [7, 9, 12],
  );
});

test("typed object-literal properties and destructured bindings resolve by declaration", () => {
  const { keys, diagnostics } = resolveSource(
    `interface Message { readonly source: string; readonly count?: number }
     declare const condition: boolean;
     const messages: Message[] = [];
     messages.push({ source: condition ? "First" : "Second" });
     const shorthandSource = "Third";
     const source = shorthandSource;
     messages.push({ source });
     messages.forEach((message) => vscode.l10n.t(message.source));
     interface Day { readonly label: string }
     const DAYS: readonly Day[] = [{ label: "Monday" }, { label: "Sunday" }];
     DAYS.map(({ label }) => vscode.l10n.t(label));
     interface Open { readonly text: string }
     declare const open: Open;
     vscode.l10n.t(open.text);`,
  );
  assert.deepEqual(keys, ["First", "Monday", "Second", "Sunday", "Third"]);
  assert.deepEqual(
    diagnostics.map((item) => item.line),
    [15],
  );
});

test("repeated variables bind once per value instead of producing spurious combinations", () => {
  const { keys, diagnostics } = resolveSource(
    `const LEVELS = ["day", "week"] as const;
     const capitalized = (value: string) =>
       vscode.l10n.t(value[0].toUpperCase() + value.slice(1));
     LEVELS.map((value) => capitalized(value));
     declare const mode: "a" | "b";
     vscode.l10n.t(\`\${mode}-\${mode.charAt(0).trim().toUpperCase()}\`);
     vscode.l10n.t("Edit " + mode.substring(0, 1));`,
  );
  assert.deepEqual(keys, ["Day", "Edit a", "Edit b", "Week", "a-A", "b-B"]);
  assert.deepEqual(diagnostics, []);
});

test("mutation, spreads, unsupported methods, and out-of-range indexes stay unresolved", () => {
  const { diagnostics } = resolveSource(
    `const table: Record<string, string> = { a: "A" };
     table["b"] = String(Date.now());
     vscode.l10n.t(table.a);
     declare const extra: { b: string };
     const merged = { ...extra, a: "A" };
     vscode.l10n.t(merged.b);
     vscode.l10n.t("A".padStart(2));
     vscode.l10n.t("A".slice(Number("1")));
     vscode.l10n.t("A"[3]);
     interface Message { source: string }
     declare const message: Message;
     message.source = "Changed";
     vscode.l10n.t(message.source);
     let mutable = "Saved";
     mutable = "Changed";
     const copy = { mutable };
     vscode.l10n.t(copy.mutable);`,
  );
  assert.deepEqual(
    diagnostics.map((item) => item.line),
    [4, 7, 8, 9, 10, 14, 18],
  );
});

test("evidence covers only unresolved calls and reports stale entries", () => {
  const evidence = [
    { file: "src/main.ts", argument: "name", reason: "Legend.", keys: ["tasks"] },
    { file: "src/main.ts", argument: '"Save"', reason: "Resolvable.", keys: ["Save"] },
    { file: "src/other.ts", argument: "name", reason: "Elsewhere.", keys: ["groups"] },
  ];
  const { keys, diagnostics } = resolveSource(
    `declare const name: string;
     vscode.l10n.t(name);
     vscode.l10n.t("Save");`,
    evidence.map((entry) => ({ ...entry, evidenceFile: "dynamic-keys.json" })),
  );
  assert.deepEqual(keys, ["Save", "tasks"]);
  assert.deepEqual(
    diagnostics.map((item) => item.message),
    [
      'Stale evidence for src/main.ts argument "\\"Save\\"": no unresolved call matches it.',
      'Stale evidence for src/other.ts argument "name": no unresolved call matches it.',
    ],
  );
});

test("evidence files are optional, validated, and drive the full audit", () => {
  const { root, write } = fixture();
  const diagnostics = [];
  assert.deepEqual(readEvidence(root, diagnostics), []);
  assert.deepEqual(diagnostics, []);
  const evidenceFile = ".github/skills/localization/dynamic-keys.json";
  for (const [text, count] of [
    ["{", 1],
    ["{}", 1],
    [{ entries: [{ file: "a", argument: "b", reason: " ", keys: ["c"] }] }, 1],
    [{ entries: [{ file: "a", argument: "b", reason: "r", keys: [] }] }, 1],
    [{ entries: [null, { file: "a", argument: "b", reason: "r", keys: [""] }] }, 2],
  ]) {
    write(evidenceFile, text);
    const errors = [];
    assert.deepEqual(readEvidence(root, errors), []);
    assert.equal(errors.length, count);
  }
  write(evidenceFile, {
    entries: [{ file: "src/main.ts", argument: "  name ", reason: "Legend.", keys: ["Legend"] }],
  });
  write(
    "src/main.ts",
    `import * as vscode from "vscode";
     declare const name: string;
     vscode.l10n.t("Save");
     vscode.l10n.t(name);`,
  );
  write("l10n/bundle.l10n.json", { Save: "Save", Legend: "Legend" });
  write("l10n/bundle.l10n.fr.json", { Save: "Enregistrer", Legend: "Légende" });
  assert.deepEqual(audit(root), []);
});

test("CLI rejects arguments instead of silently ignoring them", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-localization.mjs", import.meta.url)), "--unknown"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
