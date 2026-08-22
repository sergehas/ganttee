import * as assert from "assert";
import { createEmptyDocument, Dependency, GanttDocument } from "../common/models";
import {
  blockingDiagnostics,
  diagnosticsFor,
  evaluateScheduleGraph,
  hasBlockingScheduleDiagnostic,
  ScheduleDiagnostic,
} from "../services/scheduleGraphValidationService";

function dep(sourceId: string, targetId: string): Dependency {
  return {
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    type: "startAfter",
  };
}

/** Summarizes diagnostics as `kind:id` pairs for concise assertions. */
function summarize(diagnostics: readonly ScheduleDiagnostic[]): string[] {
  return diagnostics.map((diagnostic) =>
    diagnostic.kind === "danglingDependency" ||
    diagnostic.kind === "groupDependency"
      ? `${diagnostic.kind}:${diagnostic.dependencyId}`
      : `${diagnostic.kind}:${diagnostic.entityIds.join("+")}`,
  );
}

/** Returns the constraint count a diagnostic reported for an entity. */
function countFor(
  diagnostics: readonly ScheduleDiagnostic[],
  entityId: string,
): number | undefined {
  const found = diagnosticsFor(diagnostics, entityId).find(
    (diagnostic) =>
      diagnostic.kind === "underConstrained" ||
      diagnostic.kind === "overConstrained",
  );
  return found?.kind === "underConstrained" || found?.kind === "overConstrained"
    ? found.count
    : undefined;
}

function anchoredTaskDocument(): GanttDocument {
  const document = createEmptyDocument();
  document.tasks = [
    { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
  ];
  return document;
}

suite("scheduleGraphValidationService", () => {
  test("reports determinacy violations with their constraint counts", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "under", name: "Under", start: "2026-01-01" },
      {
        id: "over",
        name: "Over",
        start: "2026-01-01",
        end: "2026-01-02",
        duration: 1,
      },
    ];
    document.dependencies = [dep("over", "under")];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(summarize(diagnostics), [
      "underConstrained:under",
      "overConstrained:over",
    ]);
    assert.strictEqual(countFor(diagnostics, "under"), 1);
    assert.strictEqual(countFor(diagnostics, "over"), 3);
  });

  test("reports milestone determinacy and duplicate endpoints", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "anchor", name: "Anchor", start: "2026-01-01", end: "2026-01-02" },
    ];
    document.milestones = [
      { id: "under", name: "Under" },
      { id: "inferred", name: "Inferred" },
      { id: "duplicate", name: "Duplicate", date: "2026-01-03" },
    ];
    document.dependencies = [
      {
        id: "inferred-end",
        sourceId: "inferred",
        targetId: "anchor",
        type: "endWith",
      },
      {
        id: "duplicate-start",
        sourceId: "duplicate",
        targetId: "anchor",
        type: "startAfter",
      },
    ];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(summarize(diagnostics), [
      "underConstrained:under",
      "overConstrained:duplicate",
      "unanchoredComponent:under",
    ]);
  });

  test("treats a duplicate endpoint as a warning, not a save blocker", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "anchor", name: "Anchor", start: "2026-01-01", end: "2026-01-02" },
      { id: "duplicate", name: "Duplicate", start: "2026-01-01" },
    ];
    document.dependencies = [dep("duplicate", "anchor")];

    const diagnostics = evaluateScheduleGraph(document);
    const [duplicate] = diagnosticsFor(diagnostics, "duplicate");

    assert.strictEqual(duplicate.kind, "overConstrained");
    assert.strictEqual(duplicate.severity, "warning");
    assert.deepStrictEqual(
      duplicate.kind === "overConstrained" ? duplicate.duplicateEndpoints : [],
      ["start"],
    );
    assert.strictEqual(hasBlockingScheduleDiagnostic(diagnostics), false);
  });

  test("blocks an over-constrained task that is not merely duplicated", () => {
    const document = createEmptyDocument();
    document.tasks = [
      {
        id: "over",
        name: "Over",
        start: "2026-01-01",
        end: "2026-01-02",
        duration: 1,
      },
    ];

    const diagnostics = evaluateScheduleGraph(document);

    assert.strictEqual(hasBlockingScheduleDiagnostic(diagnostics), true);
    assert.strictEqual(blockingDiagnostics(diagnostics).length, 1);
  });

  test("reports a dangling dependency against both endpoints", () => {
    const document = anchoredTaskDocument();
    document.dependencies = [dep("missing", "task")];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(summarize(diagnostics), [
      "danglingDependency:missing-task",
    ]);
    assert.strictEqual(diagnosticsFor(diagnostics, "task").length, 1);
    assert.strictEqual(diagnosticsFor(diagnostics, "missing").length, 1);
  });

  test("reports a dependency that uses a group as an endpoint", () => {
    const document = anchoredTaskDocument();
    document.groups = [{ id: "group", name: "Group" }];
    document.dependencies = [dep("group", "task")];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(summarize(diagnostics), [
      "groupDependency:group-task",
    ]);
  });

  test("accepts a determinate anchored task", () => {
    const diagnostics = evaluateScheduleGraph(anchoredTaskDocument());

    assert.deepStrictEqual(diagnostics, []);
  });

  test("reports unanchored components and exempts group-only components", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task", duration: 1 }];
    document.groups = [{ id: "group", name: "Group" }];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(summarize(diagnostics), [
      "underConstrained:task",
      "unanchoredComponent:task",
    ]);
  });

  test("names every schedulable member of an unanchored component", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "a", name: "A", duration: 1 },
      { id: "b", name: "B", duration: 1 },
    ];
    document.dependencies = [dep("a", "b")];

    const diagnostics = evaluateScheduleGraph(document);
    const [unanchored] = diagnostics.filter(
      (diagnostic) => diagnostic.kind === "unanchoredComponent",
    );

    assert.deepStrictEqual([...unanchored.entityIds].sort(), ["a", "b"]);
  });

  test("uses a milestone date as an absolute component anchor", () => {
    const document = createEmptyDocument();
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-01-01" },
    ];

    const diagnostics = evaluateScheduleGraph(document);

    assert.deepStrictEqual(diagnostics, []);
  });

  test("allows milestones to own end-with dependencies", () => {
    const document = anchoredTaskDocument();
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-01-02" },
    ];
    document.dependencies = [
      {
        id: "end-with",
        sourceId: "milestone",
        targetId: "task",
        type: "endWith",
      },
    ];

    const diagnostics = evaluateScheduleGraph(document);

    assert.strictEqual(hasBlockingScheduleDiagnostic(diagnostics), false);
    assert.deepStrictEqual(summarize(diagnostics), [
      "overConstrained:milestone",
    ]);
  });

  test("counts a dependency-supplied endpoint toward determinacy", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", duration: 1 },
      { id: "after", name: "After", start: "2026-01-02", end: "2026-01-03" },
      { id: "with", name: "With", start: "2026-01-03", end: "2026-01-04" },
    ];
    document.dependencies = [
      { id: "start", sourceId: "task", targetId: "after", type: "startWith" },
      { id: "end", sourceId: "task", targetId: "with", type: "endWith" },
    ];

    const diagnostics = evaluateScheduleGraph(document);

    assert.strictEqual(countFor(diagnostics, "task"), 3);
  });

  test("returns no diagnostics for an entity that has none", () => {
    assert.deepStrictEqual(
      diagnosticsFor(evaluateScheduleGraph(anchoredTaskDocument()), "task"),
      [],
    );
  });
});
