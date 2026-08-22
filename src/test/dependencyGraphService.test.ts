import * as assert from "assert";
import {
  createEmptyDocument,
  Dependency,
  GanttDocument,
} from "../common/models";
import {
  topologicalOrder,
  validateSemanticGraph,
  validateStructuralGraph,
  wouldCreateCycle,
} from "../services/dependencyGraphService";
import { hydrateDocument } from "../services/ganttModelService";
import { getEffectiveConstraintCount } from "../services/taskConstraintService";

function documentWith(
  taskIds: string[],
  dependencies: Dependency[],
): GanttDocument {
  const document = createEmptyDocument();
  document.tasks = taskIds.map((id) => ({
    id,
    name: id,
    start: "2026-01-01",
    end: "2026-01-02",
  }));
  document.dependencies = dependencies;
  return document;
}

function dep(sourceId: string, targetId: string): Dependency {
  return {
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    type: "startAfter",
  };
}

suite("dependencyGraphService", () => {
  test("accepts a valid acyclic structural graph", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    assert.doesNotThrow(() => validateStructuralGraph(document));
  });

  test("detects a cycle", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c"), dep("c", "a")],
    );
    assert.throws(
      () => validateStructuralGraph(document),
      /Dependency cycle detected/,
    );
  });

  test("flags dependencies that reference unknown tasks", () => {
    const document = documentWith(["a"], [dep("a", "missing")]);
    assert.throws(() => validateStructuralGraph(document), /unknown entity/);
  });

  test("accepts dependencies that reference a milestone", () => {
    const document = documentWith(["a"], [dep("a", "m1")]);
    document.milestones = [{ id: "m1", name: "M", date: "2026-01-03" }];
    assert.doesNotThrow(() => validateStructuralGraph(document));
  });

  test("wouldCreateCycle detects a closing edge", () => {
    const existing = [dep("a", "b"), dep("b", "c")];
    assert.strictEqual(wouldCreateCycle(existing, dep("c", "a")), true);
    assert.strictEqual(wouldCreateCycle(existing, dep("a", "c")), false);
  });

  test("wouldCreateCycle detects cycles that include milestones", () => {
    const existing: Dependency[] = [dep("t1", "m1"), dep("m1", "t2")];
    assert.strictEqual(wouldCreateCycle(existing, dep("t2", "t1")), true);
  });

  test("topologicalOrder places predecessors first", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    const order = topologicalOrder(document);
    assert.ok(order.indexOf("a") < order.indexOf("b"));
    assert.ok(order.indexOf("b") < order.indexOf("c"));
  });

  test("topologicalOrder includes milestones and excludes groups", () => {
    const document = documentWith(["task"], []);
    document.milestones = [{ id: "milestone", name: "M", date: "2026-01-03" }];
    document.groups = [{ id: "group", name: "G" }];
    document.dependencies = [dep("milestone", "task"), dep("group", "task")];

    const order = topologicalOrder(document);
    assert.deepStrictEqual(order.sort(), ["milestone", "task"]);
  });

  test("rejects unknown endpoints before topological ordering", () => {
    const document = documentWith(["task"], [dep("task", "missing")]);
    assert.throws(() => topologicalOrder(document), /unknown entity/);
  });

  test("topologicalOrder throws on a cycle", () => {
    const document = documentWith(["a", "b"], [dep("a", "b"), dep("b", "a")]);
    assert.throws(() => topologicalOrder(document));
  });

  test("reports effective constraint counts for task violations", () => {
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

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.deepStrictEqual(result.constraintCounts, { under: 1, over: 3 });
    assert.deepStrictEqual(result.underConstrainedIds, ["under"]);
    assert.deepStrictEqual(result.overConstrainedIds, ["over"]);
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
      { id: "inferred-end", sourceId: "inferred", targetId: "anchor", type: "endWith" },
      { id: "duplicate-start", sourceId: "duplicate", targetId: "anchor", type: "startAfter" },
    ];

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.deepStrictEqual(result.constraintCounts, {
      anchor: 2,
      under: 0,
      inferred: 2,
      duplicate: 2,
    });
    assert.deepStrictEqual(result.underConstrainedIds, ["under"]);
    assert.deepStrictEqual(result.overConstrainedIds, ["duplicate"]);
  });

  test("reports dangling dependencies without rejecting hydration", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
    ];
    document.dependencies = [dep("task", "missing")];

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.deepStrictEqual(result.danglingDependencyIds, ["task-missing"]);
    assert.strictEqual(result.ok, false);
  });

  test("accepts a determinate anchored task", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
    ];

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.unanchoredComponentIds, []);
  });

  test("reports unanchored schedulable components and exempts group-only components", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task" }];
    document.groups = [{ id: "group", name: "Group" }];

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.deepStrictEqual(result.unanchoredComponentIds, ["task"]);
  });

  test("uses a milestone as an absolute component anchor", () => {
    const document = createEmptyDocument();
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-01-01" },
    ];

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.strictEqual(result.unanchoredComponentIds.length, 0);
  });

  test("allows milestones to own end-with dependencies", () => {
    const document = createEmptyDocument();
    document.tasks = [
      {
        id: "task",
        name: "Task",
        start: "2026-01-01",
        end: "2026-01-02",
      },
    ];
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

    const result = validateSemanticGraph(hydrateDocument(document));

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.overConstrainedIds, ["milestone"]);
    assert.deepStrictEqual(result.groupDependencyIds, []);
  });

  test("supplies missing endpoints from outgoing dependencies", () => {
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
    const model = hydrateDocument(document);

    assert.strictEqual(
      getEffectiveConstraintCount("task", model, model.graph),
      3,
    );
  });

  test("does not add dependency endpoints when static endpoints exist", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
      { id: "target", name: "Target", start: "2026-01-02", end: "2026-01-03" },
    ];
    document.dependencies = [
      { id: "start", sourceId: "task", targetId: "target", type: "startAfter" },
    ];
    const model = hydrateDocument(document);

    assert.strictEqual(
      getEffectiveConstraintCount("task", model, model.graph),
      2,
    );
  });

  test("returns no constraints for an unknown task", () => {
    const model = hydrateDocument(createEmptyDocument());

    assert.strictEqual(
      getEffectiveConstraintCount("missing", model, model.graph),
      0,
    );
  });
});
