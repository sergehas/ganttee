import { createEmptyDocument, ProjectDocument } from "@common/documents";
import { ProjectDependencyGraph, ProjectSchedule, ScheduledTask, Task } from "@common/models";
import { projectCriticalPath } from "@services/dependency-graph/criticalPathService";
import { hydrateDocument } from "@services/model/projectModelService";
import { schedule } from "@services/schedule/schedulingService";
import * as assert from "assert";

/** Builds a scheduled graph for a critical-path projection test. */
function project(document: ProjectDocument) {
  const model = hydrateDocument(document);
  const scheduled = schedule(model, model.graph);
  return projectCriticalPath(model.graph, scheduled);
}

suite("criticalPathService", () => {
  test("returns empty projections when the schedule has no entities", () => {
    const projection = project(createEmptyDocument());

    assert.deepStrictEqual(projection, {
      nodeIds: [],
      dependencyIds: [],
    });
  });

  test("skips graph nodes that are not scheduled and ignores missing predecessor scores", () => {
    const graph = new ProjectDependencyGraph(
      ["orphan", "t1"],
      [{ id: "dep1", sourceId: "t1", targetId: "orphan", type: "startAfter" }],
    );
    const task = new ScheduledTask(
      new Task({ id: "t1", name: "Task 1" }),
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-03T00:00:00.000Z"),
      2,
    );

    const projection = projectCriticalPath(graph, {
      tasks: [task],
      milestones: [],
      groups: [],
    });

    assert.deepStrictEqual(projection, {
      nodeIds: ["t1"],
      dependencyIds: [],
    });
  });

  test("includes milestone nodes with zero duration on the critical path", () => {
    const projection = project({
      ...createEmptyDocument(),
      version: 2,
      tasks: [
        { id: "a", name: "A", start: "2026-09-07", duration: 1 },
        { id: "b", name: "B", duration: 2 },
      ],
      milestones: [{ id: "m", name: "M" }],
      groups: [],
      dependencies: [
        { id: "am", sourceId: "m", targetId: "a", type: "startAfter" },
        { id: "mb", sourceId: "b", targetId: "m", type: "startAfter" },
      ],
    });

    assert.deepStrictEqual(projection, {
      nodeIds: ["a", "m", "b"],
      dependencyIds: ["am", "mb"],
    });
  });

  test("keeps the current path when a predecessor does not improve the score", () => {
    const projection = projectCriticalPath(
      new ProjectDependencyGraph(
        ["b", "a"],
        [{ id: "ab", sourceId: "b", targetId: "a", type: "startAfter" }],
      ),
      {
        tasks: [{ id: "a", effectiveDuration: () => 3 }],
        milestones: [{ id: "b", effectiveDuration: () => 0 }],
        groups: [],
      } as unknown as ProjectSchedule,
    );

    assert.deepStrictEqual(projection, {
      nodeIds: ["a"],
      dependencyIds: [],
    });
  });

  test("returns an empty dependency id when the projected edge is missing", () => {
    const projection = projectCriticalPath(
      {
        topologicalSort: () => ["b", "a"],
        predecessors: (nodeId: string) => (nodeId === "a" ? ["b"] : []),
        edge: () => undefined,
        getEdgeAttribute: () => ({ id: "ignore-me" }),
      } as unknown as ProjectDependencyGraph,
      {
        tasks: [{ id: "a", effectiveDuration: () => 2 }],
        milestones: [{ id: "b", effectiveDuration: () => 1 }],
        groups: [],
      } as unknown as ProjectSchedule,
    );

    assert.deepStrictEqual(projection, {
      nodeIds: ["b", "a"],
      dependencyIds: [""],
    });
  });

  test("projects the longest scheduled dependency chain", () => {
    const projection = project({
      ...createEmptyDocument(),
      version: 2,
      tasks: [
        { id: "a", name: "A", start: "2026-09-07", duration: 1 },
        { id: "b", name: "B", duration: 1 },
        { id: "c", name: "C", duration: 3 },
        { id: "d", name: "D", duration: 1 },
      ],
      groups: [],
      milestones: [],
      dependencies: [
        { id: "ab", sourceId: "b", targetId: "a", type: "startAfter" },
        { id: "bc", sourceId: "c", targetId: "b", type: "startAfter" },
        { id: "ad", sourceId: "d", targetId: "a", type: "startAfter" },
      ],
    });

    assert.deepStrictEqual(projection, {
      nodeIds: ["a", "b", "c"],
      dependencyIds: ["ab", "bc"],
    });
  });

  test("selects the first equal maximum predecessor", () => {
    const projection = project({
      ...createEmptyDocument(),
      version: 2,
      tasks: [
        { id: "a", name: "A", start: "2026-09-07", duration: 1 },
        { id: "b", name: "B", duration: 1 },
        { id: "c", name: "C", duration: 1 },
        { id: "d", name: "D", duration: 1 },
      ],
      groups: [],
      milestones: [],
      dependencies: [
        { id: "ab", sourceId: "b", targetId: "a", type: "startAfter" },
        { id: "ac", sourceId: "c", targetId: "a", type: "startAfter" },
        { id: "bd", sourceId: "d", targetId: "b", type: "startAfter" },
        { id: "cd", sourceId: "d", targetId: "c", type: "startAfter" },
      ],
    });

    assert.deepStrictEqual(projection.nodeIds, ["a", "b", "d"]);
    assert.deepStrictEqual(projection.dependencyIds, ["ab", "bd"]);
  });
});
