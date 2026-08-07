import * as assert from "assert";
import {
  createEmptyDocument,
  Dependency,
  GanttDocument,
} from "../common/models";
import {
  topologicalOrder,
  validateGraph,
  wouldCreateCycle,
} from "../services/dependencyGraphService";

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
  test("reports a valid acyclic graph", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    const result = validateGraph(document);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.cycle, []);
  });

  test("detects a cycle", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c"), dep("c", "a")],
    );
    const result = validateGraph(document);
    assert.strictEqual(result.ok, false);
    assert.ok(result.cycle.length > 0);
  });

  test("flags dependencies that reference unknown tasks", () => {
    const document = documentWith(["a"], [dep("a", "missing")]);
    const result = validateGraph(document);
    assert.deepStrictEqual(result.danglingDependencyIds, ["a-missing"]);
  });

  test("accepts dependencies that reference a milestone", () => {
    const document = documentWith(["a"], [dep("a", "m1")]);
    document.milestones = [{ id: "m1", name: "M", date: "2026-01-03" }];
    const result = validateGraph(document);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.danglingDependencyIds, []);
  });

  test("wouldCreateCycle detects a closing edge", () => {
    const existing = [dep("a", "b"), dep("b", "c")];
    assert.strictEqual(wouldCreateCycle(existing, dep("c", "a")), true);
    assert.strictEqual(wouldCreateCycle(existing, dep("a", "c")), false);
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

  test("topologicalOrder throws on a cycle", () => {
    const document = documentWith(["a", "b"], [dep("a", "b"), dep("b", "a")]);
    assert.throws(() => topologicalOrder(document));
  });
});
