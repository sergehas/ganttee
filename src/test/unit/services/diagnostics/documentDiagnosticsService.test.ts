import { createEmptyDocument, ProjectDocument } from "@common/documents";
import { GantteeFinding } from "@common/models";
import {
  evaluateDocumentText,
  resolveLocation,
} from "@services/diagnostics/documentDiagnosticsService";
import { scanJson } from "@services/document/jsonSourceMapService";
import * as assert from "assert";

/** Serializes a document built from overrides of the empty document. */
function textOf(parts: Partial<ProjectDocument> | Record<string, unknown>): string {
  return JSON.stringify({ ...createEmptyDocument(), ...parts }, undefined, 2);
}

/** Returns a compact view of findings for assertions. */
function summary(findings: readonly GantteeFinding[]): string[] {
  return findings.map(
    (finding) =>
      `${finding.severity}:${finding.category}:${(finding.location?.path ?? []).join(".")}`,
  );
}

/** Returns the source text a finding's primary location covers. */
function spanOf(text: string, finding: GantteeFinding): string {
  return text.slice(finding.location?.start ?? 0, finding.location?.end ?? 0);
}

suite("documentDiagnosticsService", () => {
  test("returns nothing for blank text and a valid schedule", () => {
    assert.deepStrictEqual(evaluateDocumentText("  \n").findings, []);
    const result = evaluateDocumentText(
      textOf({
        tasks: [{ id: "t", name: "T", start: "2026-01-05", duration: 2 }],
        sequence: ["t"],
      }),
    );
    assert.deepStrictEqual(result.findings, []);
    assert.ok(result.document);
    assert.strictEqual(result.labels.items[0].name, "T");
  });

  test("positions invalid JSON at the syntax error", () => {
    const text = '{\n  "tasks": [,]\n}';
    const [finding] = evaluateDocumentText(text).findings;
    assert.strictEqual(finding.category, "invalidJson");
    assert.deepStrictEqual(finding.args, { line: 2, column: 13 });
    assert.strictEqual(spanOf(text, finding), ",");
  });

  test("reports an invalid root", () => {
    assert.deepStrictEqual(summary(evaluateDocumentText("[1]").findings), ["error:invalidRoot:"]);
  });

  test("collects several independent problems with precise ranges", () => {
    const text = textOf({
      tasks: [
        { id: "a", name: "A", start: "bad-date", duration: 1 },
        { id: "b", name: "B", start: "2026-01-05", duration: 1, groupId: "nope" },
        { id: "c", name: "C", start: "2026-01-05", duration: 1, status: "ghost" },
      ],
      view: { zoomLevel: "decade" },
      sequence: ["a", "b", "c"],
    });
    const result = evaluateDocumentText(text);
    assert.deepStrictEqual(summary(result.findings), [
      "error:invalidField:tasks.0.start",
      "warning:invalidViewValue:view.zoomLevel",
      "error:unknownItemGroup:tasks.1.groupId",
      "warning:unknownStatus:tasks.2.status",
    ]);
    assert.deepStrictEqual(
      result.findings.map((finding) => spanOf(text, finding)),
      ['"bad-date"', '"decade"', '"nope"', '"ghost"'],
    );
    assert.strictEqual(result.document, undefined);
    assert.strictEqual(result.labels.items[0].name, "A");
  });

  test("falls back to the enclosing record or the start for migrated fields", () => {
    const text = JSON.stringify({
      version: 1,
      tasks: [{ id: "a", title: "", start: "2026-01-05", duration: 1 }],
    });
    const [finding] = evaluateDocumentText(text).findings;
    assert.strictEqual(finding.category, "invalidField");
    assert.deepStrictEqual(finding.location?.path, ["tasks", 0, "name"]);
    assert.deepStrictEqual([finding.location?.start, finding.location?.end], [0, 0]);
  });

  test("maps semantic diagnostics to endpoint fields with related records", () => {
    const text = textOf({
      tasks: [
        { id: "a", name: "A", start: "2026-01-05", duration: 1 },
        { id: "b", name: "B", duration: 1 },
      ],
      groups: [{ id: "g", name: "G", sequence: [] }],
      dependencies: [
        { id: "d1", sourceId: "a", targetId: "ghost", type: "startAfter" },
        { id: "d2", sourceId: "g", targetId: "a", type: "startAfter" },
      ],
      sequence: ["g", "a", "b"],
    });
    const result = evaluateDocumentText(text);
    const byCategory = new Map(result.findings.map((finding) => [finding.category, finding]));
    const dangling = byCategory.get("danglingDependency");
    assert.deepStrictEqual(dangling?.location?.path, ["dependencies", 0, "targetId"]);
    assert.strictEqual(spanOf(text, dangling!), '"ghost"');
    assert.deepStrictEqual(
      dangling?.related?.map((related) => related.subject.id),
      ["a"],
    );
    const group = byCategory.get("groupDependency");
    assert.deepStrictEqual(group?.location?.path, ["dependencies", 1, "sourceId"]);
    const under = byCategory.get("underConstrained");
    assert.deepStrictEqual(under?.subjects, [{ kind: "task", id: "b", index: 1 }]);
    assert.strictEqual(under?.args?.count, 1);
  });

  test("reports a scheduling failure with its reason and subject", () => {
    const text = textOf({
      tasks: [{ id: "z", name: "Zero", start: "2026-01-05", duration: 0 }],
      sequence: ["z"],
    });
    const failure = evaluateDocumentText(text).findings.find(
      (finding) => finding.category === "schedulingFailed",
    );
    assert.ok(failure);
    assert.deepStrictEqual(failure.args, { reason: "invalidDuration" });
    assert.deepStrictEqual(failure.subjects, [{ kind: "task", id: "z", index: 0 }]);
    assert.deepStrictEqual(failure.location?.path, ["tasks", 0]);
  });

  test("reports an invalid working calendar on the settings", () => {
    const document = createEmptyDocument();
    const text = textOf({
      settings: { ...document.settings, workingCalendar: { daysOff: [1, 2, 3, 4, 5, 6, 7] } },
    });
    const finding = evaluateDocumentText(text).findings.find(
      (item) => item.category === "invalidWorkingCalendar",
    );
    assert.deepStrictEqual(finding?.location?.path, ["settings"]);
  });

  test("reports a dependency cycle once with every edge", () => {
    const text = textOf({
      tasks: [
        { id: "a", name: "A", start: "2026-01-05", duration: 1 },
        { id: "b", name: "B", duration: 1 },
      ],
      dependencies: [
        { id: "ab", sourceId: "a", targetId: "b", type: "startAfter" },
        { id: "ba", sourceId: "b", targetId: "a", type: "startAfter" },
      ],
      sequence: ["a", "b"],
    });
    const result = evaluateDocumentText(text);
    assert.deepStrictEqual(
      result.findings.map((finding) => finding.category),
      ["dependencyCycle"],
    );
    assert.strictEqual(result.findings[0].related?.length, 1);
  });

  test("keeps explicit ranges and falls back when no source map exists", () => {
    const explicit = { path: ["x"], start: 2, end: 4 };
    assert.strictEqual(resolveLocation(explicit, undefined, "", {}), explicit);
    assert.deepStrictEqual(resolveLocation(undefined, undefined, "", {}), {
      path: undefined,
      start: 0,
      end: 0,
    });
    const text = '{"a": [1, {"b": 2}]}';
    const scan = scanJson(text);
    assert.ok(scan.ok);
    const migrated = { a: [1, { b: 3 }] };
    assert.deepStrictEqual(resolveLocation({ path: ["a", 0] }, scan.root, text, migrated), {
      path: ["a", 0],
      start: 7,
      end: 8,
    });
    assert.deepStrictEqual(resolveLocation({ path: ["a", 1, "b"] }, scan.root, text, migrated), {
      path: ["a", 1, "b"],
      start: 0,
      end: 0,
    });
    assert.deepStrictEqual(
      resolveLocation({ path: ["a", 5, "missing"] }, scan.root, text, { a: [1] }),
      { path: ["a", 5, "missing"], start: 0, end: 0 },
    );
    assert.deepStrictEqual(resolveLocation({ path: ["a", "k"] }, scan.root, text, { a: "s" }), {
      path: ["a", "k"],
      start: 0,
      end: 0,
    });
  });
});
