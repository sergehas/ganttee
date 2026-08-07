import * as assert from "assert";
import {
  CyclicDependencyError,
  Dependency,
  DependencyGraph,
} from "../common/models";

/** Builds a dependency edge from `sourceId` to `targetId`. */
function dep(sourceId: string, targetId: string): Dependency {
  return {
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    type: "startAfter",
  };
}

suite("DependencyGraph", () => {
  test("exposes the union of declared nodes and edge endpoints", () => {
    const graph = new DependencyGraph(["a", "b", "isolated"], [dep("a", "b")]);
    assert.deepStrictEqual([...graph.nodes].sort(), ["a", "b", "isolated"]);
  });

  test("reports no cycle for an acyclic edge set", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    assert.strictEqual(graph.hasCycle(), false);
    assert.deepStrictEqual([...graph.findCycle()], []);
  });

  test("reports the participating ids for a cyclic edge set", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c"), dep("c", "a")],
    );
    assert.strictEqual(graph.hasCycle(), true);
    const cycle = [...graph.findCycle()];
    assert.ok(cycle.length > 0);
    assert.ok(["a", "b", "c"].every((id) => cycle.includes(id)));
  });

  test("treats a self-loop as a cycle", () => {
    const graph = new DependencyGraph(["a"], [dep("a", "a")]);
    assert.strictEqual(graph.hasCycle(), true);
    assert.deepStrictEqual([...graph.findCycle()], ["a", "a"]);
  });

  test("detects a closing candidate without mutating the graph", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c"],
      [dep("a", "b"), dep("b", "c")],
    );
    assert.strictEqual(graph.wouldCreateCycle(dep("c", "a")), true);
    assert.strictEqual(graph.wouldCreateCycle(dep("a", "c")), false);
    assert.strictEqual(graph.hasCycle(), false);
    assert.deepStrictEqual([...graph.successors("c")], []);
  });

  test("sorts predecessors before successors and includes isolated nodes", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c", "lonely"],
      [dep("a", "b"), dep("b", "c")],
    );
    const order = [...graph.topologicalSort()];
    assert.strictEqual(order.length, 4);
    assert.ok(order.indexOf("a") < order.indexOf("b"));
    assert.ok(order.indexOf("b") < order.indexOf("c"));
    assert.ok(order.includes("lonely"));
  });

  test("throws a cycle error when a topological order does not exist", () => {
    const graph = new DependencyGraph(
      ["a", "b"],
      [dep("a", "b"), dep("b", "a")],
    );
    assert.throws(() => graph.topologicalSort(), CyclicDependencyError);
  });

  test("returns adjacent ids in both directions", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c"],
      [dep("a", "c"), dep("b", "c")],
    );
    assert.deepStrictEqual([...graph.successors("a")], ["c"]);
    assert.deepStrictEqual([...graph.predecessors("c")].sort(), ["a", "b"]);
    assert.deepStrictEqual([...graph.predecessors("a")], []);
    assert.deepStrictEqual([...graph.successors("c")], []);
  });

  test("groups nodes into weakly-connected components", () => {
    const graph = new DependencyGraph(
      ["a", "b", "c", "d", "lonely"],
      [dep("a", "b"), dep("c", "b"), dep("d", "d")],
    );
    const components = graph
      .connectedComponents()
      .map((component) => [...component].sort())
      .sort((left, right) => left[0].localeCompare(right[0]));
    assert.deepStrictEqual(components, [["a", "b", "c"], ["d"], ["lonely"]]);
  });

  test("returns one single-element component per node when there are no edges", () => {
    const graph = new DependencyGraph(["a", "b"], []);
    const components = graph.connectedComponents();
    assert.strictEqual(components.length, 2);
    assert.ok(components.every((component) => component.length === 1));
  });
});
