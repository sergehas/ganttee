import { GantteeFinding } from "@common/models";
import {
  collectDocumentShape,
  GanttParseError,
  validateDocumentShape,
} from "@services/document/documentShapeValidationService";
import * as assert from "assert";

/** Returns a compact view of findings for assertions. */
function summary(findings: readonly GantteeFinding[]): string[] {
  return findings.map(
    (finding) =>
      `${finding.severity}:${finding.category}:${(finding.location?.path ?? []).join(".")}`,
  );
}

suite("documentShapeValidationService collecting mode", () => {
  test("reports an invalid root and returns no document", () => {
    const result = collectDocumentShape([]);
    assert.strictEqual(result.document, undefined);
    assert.deepStrictEqual(summary(result.findings), ["error:invalidRoot:"]);
  });

  test("collects one finding per invalid record and keeps every valid record", () => {
    const result = collectDocumentShape({
      tasks: [
        { id: "a", name: "A", start: "2026-02-30" },
        { id: "b", name: "B" },
        "not an object",
        { id: "c", name: "", duration: -1 },
      ],
      milestones: [{ id: "m", name: "M", duration: 2 }],
      groups: [{ id: "g", name: "G", sequence: [1] }],
      dependencies: [{ id: "d", sourceId: "a", targetId: "b", type: "finishAfter" }],
    });
    assert.deepStrictEqual(summary(result.findings), [
      "error:invalidField:tasks.0.start",
      "error:invalidField:tasks.2",
      "error:invalidField:tasks.3.name",
      "error:invalidField:groups.0.sequence",
      "error:invalidField:milestones.0.duration",
      "error:invalidField:dependencies.0.type",
    ]);
    assert.deepStrictEqual(
      result.document?.tasks.map((task) => task.id),
      ["b"],
    );
    assert.deepStrictEqual(result.authoredIndex.tasks, [1]);
    assert.deepStrictEqual([...result.incomplete].sort(), [
      "dependencies",
      "groups",
      "milestones",
      "tasks",
    ]);
    assert.deepStrictEqual(result.findings[0].subjects, [{ kind: "task", id: "a", index: 0 }]);
    assert.deepStrictEqual(result.findings[0].args, { field: "start", expectation: "isoDate" });
    assert.deepStrictEqual(result.findings[1].subjects, [{ kind: "project" }]);
    assert.deepStrictEqual(result.findings[4].args, {
      field: "duration",
      expectation: "zeroDuration",
    });
  });

  test("treats a non-array collection as empty and incomplete", () => {
    const result = collectDocumentShape({ tasks: {}, sequence: "x" });
    assert.deepStrictEqual(summary(result.findings), [
      "error:invalidField:tasks",
      "error:invalidField:sequence",
    ]);
    assert.deepStrictEqual(result.document?.tasks, []);
    assert.ok(result.incomplete.has("tasks"));
    assert.ok(result.incomplete.has("sequence"));
    assert.strictEqual(result.findings[0].args?.expectation, "array");
  });

  test("collects settings problems and falls back to defaults", () => {
    const defaults = collectDocumentShape({}).document?.settings;
    const result = collectDocumentShape({
      settings: {
        workingDayHours: 30,
        workingDayStart: -1,
        workingCalendar: { daysOff: [0] },
        holidays: [
          { start: "2026-01-02", end: "2026-01-01" },
          { start: "2026-01-01", end: "2026-01-01", note: "x" },
          { start: "2026-03-01", end: "2026-03-02" },
        ],
        statuses: [
          { id: "s", name: "S", color: "#fff", state: "pending" },
          { id: "t", name: "T", color: "#000", state: "closed" },
        ],
      },
    });
    assert.deepStrictEqual(summary(result.findings), [
      "error:invalidField:settings.workingCalendar.daysOff.0",
      "error:invalidField:settings.workingDayHours",
      "error:invalidField:settings.workingDayStart",
      "error:invalidHolidayRange:settings.holidays.0.end",
      "error:unsupportedField:settings.holidays.1.note",
      "error:invalidField:settings.statuses.0.state",
    ]);
    const settings = result.document?.settings;
    assert.strictEqual(settings?.workingDayHours, defaults?.workingDayHours);
    assert.strictEqual(settings?.workingDayStart, defaults?.workingDayStart);
    assert.deepStrictEqual(settings?.workingCalendar, defaults?.workingCalendar);
    assert.deepStrictEqual(settings?.holidays, [{ start: "2026-03-01", end: "2026-03-02" }]);
    assert.deepStrictEqual(
      settings?.statuses.map((status) => status.id),
      ["t"],
    );
    assert.deepStrictEqual(result.authoredIndex.holidays, [2]);
    assert.deepStrictEqual(result.authoredIndex.statuses, [1]);
    assert.deepStrictEqual(result.findings[3].subjects, [{ kind: "holiday", index: 0 }]);
    assert.strictEqual(result.findings[4].args?.field, "note");
  });

  test("keeps default statuses when the statuses value is not a list", () => {
    const defaults = collectDocumentShape({}).document?.settings.statuses;
    const result = collectDocumentShape({ settings: { statuses: "x", holidays: 1 } });
    assert.deepStrictEqual(result.document?.settings.statuses, defaults);
    assert.strictEqual(result.findings.length, 2);
  });

  test("reports unknown view keys as errors and invalid view values as warnings", () => {
    const result = collectDocumentShape({
      view: { zoomLevel: "decade", extra: 1, other: 2, showDependencies: false },
    });
    assert.deepStrictEqual(summary(result.findings), [
      "error:unsupportedField:view.extra",
      "error:unsupportedField:view.other",
      "warning:invalidViewValue:view.zoomLevel",
    ]);
    assert.strictEqual(result.findings[0].args?.field, "view.extra");
    assert.strictEqual(result.findings[2].args?.field, "zoomLevel");
    assert.strictEqual(typeof result.findings[2].args?.defaultValue, "string");
    assert.strictEqual(result.document?.view.showDependencies, false);
  });

  test("reports a non-object view and uses the default view", () => {
    const result = collectDocumentShape({ view: 3 });
    assert.deepStrictEqual(summary(result.findings), ["error:invalidField:view"]);
    assert.ok(result.document?.view);
  });

  test("throwing mode still raises the first problem with its finding", () => {
    try {
      validateDocumentShape({ tasks: [{ id: "a", name: "A", end: "bad" }] });
      assert.fail("expected a parse error");
    } catch (error) {
      assert.ok(error instanceof GanttParseError);
      assert.match(error.message, /tasks\[0\]\.end must be an ISO date/);
      assert.deepStrictEqual(summary(error.findings), ["error:invalidField:tasks.0.end"]);
    }
  });

  test("throwing mode reports the view problems it used to reject", () => {
    assert.throws(() => validateDocumentShape({ view: 3 }), /view must be an object/);
    assert.throws(() => validateDocumentShape({ view: { x: 1 } }), /view\.x is not supported/);
    assert.throws(
      () =>
        validateDocumentShape({
          settings: { statuses: [{ id: "s", name: "S", color: "c", state: 1 }] },
        }),
      /settings\.statuses\[0\]\.state must be "open" or "closed"/,
    );
  });

  test("does not swallow unexpected errors while collecting", () => {
    const hostile = {
      get tasks(): unknown {
        throw new RangeError("boom");
      },
    };
    assert.throws(() => collectDocumentShape(hostile), RangeError);
  });
});
