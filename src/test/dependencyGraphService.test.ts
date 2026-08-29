import * as assert from "assert";
import {
  createEmptyDocument,
  Dependency,
  GanttDocument,
} from "../common/models";
import {
  assertAcyclicGraph,
  assertGraphIntegrity,
  assertResolvableGraph,
  topologicalOrder,
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
  test("accepts a valid acyclic structural graph", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    assert.doesNotThrow(() => assertResolvableGraph(document));
  });

  test("rejects an entity that depends on itself", () => {
    const document = documentWith(["a"], [dep("a", "a")]);
    assert.throws(() => assertGraphIntegrity(document));
  });

  test("rejects two edges between the same ordered pair", () => {
    const document = documentWith(["a", "b"], [dep("a", "b")]);
    document.dependencies.push({ ...dep("a", "b"), id: "duplicate" });
    assert.throws(() => assertGraphIntegrity(document));
  });

  test("tolerates a cycle when only integrity is asserted", () => {
    const document = documentWith(["a", "b"], [dep("a", "b"), dep("b", "a")]);
    assert.doesNotThrow(() => assertGraphIntegrity(document));
  });

  test("detects a cycle", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c"), dep("c", "a")],
    );
    assert.throws(
      () => assertAcyclicGraph(document),
      /Dependency cycle detected/,
    );
  });

  test("tolerates a missing endpoint until resolution is asserted", () => {
    const document = documentWith(["a"], [dep("a", "missing")]);
    assert.doesNotThrow(() => assertAcyclicGraph(document));
    assert.throws(() => assertResolvableGraph(document), /unknown entity/);
  });

  test("accepts dependencies that reference a milestone", () => {
    const document = documentWith(["a"], [dep("a", "m1")]);
    document.milestones = [{ id: "m1", name: "M", date: "2026-01-03" }];
    assert.doesNotThrow(() => assertResolvableGraph(document));
  });

  test("wouldCreateCycle detects a closing edge", () => {
    const document = documentWith(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    assert.strictEqual(wouldCreateCycle(document, dep("c", "a")), true);
    assert.strictEqual(wouldCreateCycle(document, dep("a", "c")), false);
  });

  test("wouldCreateCycle detects cycles that include milestones", () => {
    const document = documentWith(
      ["t1", "t2"],
      [dep("t1", "m1"), dep("m1", "t2")],
    );
    document.milestones = [{ id: "m1", name: "M", date: "2026-01-03" }];
    assert.strictEqual(wouldCreateCycle(document, dep("t2", "t1")), true);
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
});
