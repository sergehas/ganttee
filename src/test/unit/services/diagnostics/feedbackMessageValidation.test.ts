import {
  FEEDBACK_LIMITS,
  parseReportFeedback,
} from "@services/diagnostics/feedbackMessageValidation";
import * as assert from "assert";

/** Builds a valid draft feedback payload, applying overrides. */
function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "reportFeedback",
    context: "entityDraft",
    generation: 1,
    baseRevision: 3,
    findings: [
      {
        category: "invalidField",
        severity: "error",
        origin: "draft",
        subjects: [{ kind: "task", id: "t", index: 0 }],
        args: {
          field: "start",
          expectation: "isoDate",
          count: 1,
          duplicateEndpoints: ["start"],
          reason: "invalidDuration",
          sequenceProblem: "missing",
          defaultValue: "x",
          line: 1,
          column: 2,
        },
        location: { path: ["tasks", 0, "start"], start: 1, end: 2 },
        related: [{ subject: { kind: "project" }, location: {} }],
      },
    ],
    labels: {
      items: [{ kind: "task", id: "t", index: 0, name: "T", groupId: "g" }],
      dependencies: [{ id: "d", sourceId: "t", targetId: "u", index: 0, type: "startWith" }],
    },
    ...overrides,
  };
}

/** Builds a valid finding inside a payload, applying overrides. */
function withFinding(overrides: Record<string, unknown>): Record<string, unknown> {
  const payload = draft();
  const [first] = payload.findings as Record<string, unknown>[];
  return { ...payload, findings: [{ ...first, ...overrides }] };
}

suite("feedbackMessageValidation", () => {
  test("accepts and normalizes a valid draft payload", () => {
    const parsed = parseReportFeedback({ ...draft(), extra: "dropped" });
    assert.ok(parsed);
    assert.strictEqual("extra" in parsed, false);
    assert.strictEqual(parsed.findings[0].args?.field, "start");
    assert.strictEqual(parsed.labels.dependencies[0].type, "startWith");
    assert.strictEqual(parsed.operationKey, undefined);
  });

  test("accepts an operation payload with its key and attempt", () => {
    const parsed = parseReportFeedback({
      ...draft({ context: "operation" }),
      findings: [
        { category: "exportFailed", severity: "error", origin: "operation", subjects: [] },
      ],
      operationKey: "export.png",
      attempt: 2,
    });
    assert.strictEqual(parsed?.operationKey, "export.png");
    assert.strictEqual(parsed?.attempt, 2);
  });

  const rejected: readonly [string, unknown][] = [
    ["a non-object", "nope"],
    ["the wrong type", draft({ type: "other" })],
    ["an unknown context", draft({ context: "chart" })],
    ["a negative generation", draft({ generation: -1 })],
    ["a fractional revision", draft({ baseRevision: 1.5 })],
    ["a non-array findings value", draft({ findings: {} })],
    ["too many findings", draft({ findings: new Array(FEEDBACK_LIMITS.findings + 1).fill(null) })],
    ["an unknown category", withFinding({ category: "made-up" })],
    ["an unknown severity", withFinding({ severity: "info" })],
    ["a mismatched origin", withFinding({ origin: "document" })],
    ["an unknown subject kind", withFinding({ subjects: [{ kind: "robot" }] })],
    ["an oversized id", withFinding({ subjects: [{ kind: "task", id: "x".repeat(1001) }] })],
    ["a bad path segment", withFinding({ location: { path: [true] } })],
    ["a negative offset", withFinding({ location: { start: -1 } })],
    ["a non-object location", withFinding({ location: 1 })],
    ["a non-object related entry", withFinding({ related: [1] })],
    ["non-object args", withFinding({ args: [] })],
    ["an unknown expectation", withFinding({ args: { expectation: "vibes" } })],
    ["an unknown reason", withFinding({ args: { reason: "vibes" } })],
    ["an unknown sequence problem", withFinding({ args: { sequenceProblem: "vibes" } })],
    ["an unknown endpoint", withFinding({ args: { duplicateEndpoints: ["middle"] } })],
    ["non-object labels", draft({ labels: null })],
    [
      "an unknown label kind",
      draft({ labels: { items: [{ kind: "holiday", id: "h", index: 0 }], dependencies: [] } }),
    ],
    [
      "a label without an index",
      draft({ labels: { items: [{ kind: "task", id: "h" }], dependencies: [] } }),
    ],
    [
      "a dependency label with a bad endpoint",
      draft({
        labels: { items: [], dependencies: [{ id: "d", sourceId: 1, targetId: "t", index: 0 }] },
      }),
    ],
    [
      "a dependency label with an unknown type",
      draft({
        labels: {
          items: [],
          dependencies: [{ id: "d", sourceId: "s", targetId: "t", index: 0, type: "x" }],
        },
      }),
    ],
    ["an operation without a key", draft({ context: "operation", findings: [], attempt: 1 })],
    [
      "an operation with an unsafe key",
      draft({ context: "operation", findings: [], operationKey: "a b", attempt: 1 }),
    ],
    [
      "an operation with a zero attempt",
      draft({ context: "operation", findings: [], operationKey: "k", attempt: 0 }),
    ],
  ];
  for (const [name, payload] of rejected) {
    test(`rejects ${name}`, () => {
      assert.strictEqual(parseReportFeedback(payload), undefined);
    });
  }

  test("does not swallow unexpected errors", () => {
    const hostile = {
      type: "reportFeedback",
      get context(): string {
        throw new RangeError("boom");
      },
    };
    assert.throws(() => parseReportFeedback(hostile), RangeError);
  });
});
