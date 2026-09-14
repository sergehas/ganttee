import * as assert from "assert";
import { createEmptyDocument, GanttDocument } from "../common/models";
import { projectCriticalPath } from "../services/criticalPathService";
import { hydrateDocument } from "../services/ganttModelService";
import { schedule } from "../services/schedulingService";

/** Builds a scheduled graph for a critical-path projection test. */
function project(document: GanttDocument) {
  const model = hydrateDocument(document);
  const scheduled = schedule(model, model.graph);
  return projectCriticalPath(model.graph, scheduled);
}

suite("criticalPathService", () => {
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
