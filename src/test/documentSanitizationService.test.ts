import * as assert from "assert";
import { createEmptyDocument } from "../common/models";
import { sanitizeScheduleGraph } from "../services/documentSanitizationService";

suite("documentSanitizationService", () => {
  test("sanitizes invalid dependencies and unanchored components", () => {
    const document = createEmptyDocument();
    document.tasks = [
      {
        id: "anchored",
        name: "Anchored",
        start: "2026-01-01",
        end: "2026-01-02",
      },
      { id: "floating", name: "Floating" },
      { id: "floating-2", name: "Floating 2" },
      {
        id: "grouped",
        name: "Grouped",
        start: "2026-01-03",
        end: "2026-01-04",
      },
    ];
    document.groups = [{ id: "group", name: "Group" }];
    document.dependencies = [
      {
        id: "group-edge",
        sourceId: "grouped",
        targetId: "group",
        type: "startAfter",
      },
      {
        id: "dangling",
        sourceId: "anchored",
        targetId: "missing",
        type: "startAfter",
      },
      {
        id: "floating-edge",
        sourceId: "floating",
        targetId: "floating-2",
        type: "startAfter",
      },
    ];

    const result = sanitizeScheduleGraph(document);

    assert.deepStrictEqual(result.removedDependencyIds, [
      "group-edge",
      "dangling",
      "floating-edge",
    ]);
    assert.deepStrictEqual(result.removedEntityIds.sort(), [
      "floating",
      "floating-2",
    ]);
    assert.deepStrictEqual(result.document.tasks, [
      document.tasks[0],
      document.tasks[3],
    ]);
    assert.deepStrictEqual(result.document.dependencies, []);
    assert.strictEqual(document.dependencies.length, 3);
  });

  // Characterization: destruction is unconditional and fully reported, so the
  // caller can only warn after the fact. Deliberate product behavior.
  test("removes unanchored entities outright rather than proposing them", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "floating", name: "Floating" },
      { id: "floating-2", name: "Floating 2" },
    ];
    document.milestones = [{ id: "floating-ms", name: "Floating milestone" }];
    document.dependencies = [
      {
        id: "floating-edge",
        sourceId: "floating",
        targetId: "floating-2",
        type: "startAfter",
      },
      {
        id: "floating-ms-edge",
        sourceId: "floating-ms",
        targetId: "floating-2",
        type: "startAfter",
      },
    ];

    const result = sanitizeScheduleGraph(document);

    assert.deepStrictEqual(result.document.tasks, []);
    assert.deepStrictEqual(result.document.milestones, []);
    assert.deepStrictEqual(result.document.dependencies, []);
    assert.deepStrictEqual(result.removedEntityIds.sort(), [
      "floating",
      "floating-2",
      "floating-ms",
    ]);
    assert.deepStrictEqual(result.removedDependencyIds.sort(), [
      "floating-edge",
      "floating-ms-edge",
    ]);
  });

  test("sanitizes dangling source and target dependencies", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
    ];
    document.dependencies = [
      {
        id: "missing-source",
        sourceId: "missing",
        targetId: "task",
        type: "startAfter",
      },
      {
        id: "missing-target",
        sourceId: "task",
        targetId: "missing",
        type: "startAfter",
      },
    ];

    const result = sanitizeScheduleGraph(document);

    assert.deepStrictEqual(result.removedDependencyIds, [
      "missing-source",
      "missing-target",
    ]);
    assert.deepStrictEqual(result.removedEntityIds, []);
    assert.deepStrictEqual(result.document.tasks, document.tasks);
  });

  test("sanitizes group source and target dependencies without deleting the group", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
    ];
    document.groups = [{ id: "group", name: "Group" }];
    document.dependencies = [
      {
        id: "group-source",
        sourceId: "group",
        targetId: "task",
        type: "startAfter",
      },
      {
        id: "group-target",
        sourceId: "task",
        targetId: "group",
        type: "startAfter",
      },
    ];

    const result = sanitizeScheduleGraph(document);

    assert.deepStrictEqual(result.removedDependencyIds, [
      "group-source",
      "group-target",
    ]);
    assert.deepStrictEqual(result.removedEntityIds, []);
    assert.deepStrictEqual(result.document.groups, document.groups);
  });

  test("keeps a component anchored by a milestone date", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "task", name: "Task", duration: 1 }];
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-01-01" },
    ];
    document.dependencies = [
      {
        id: "edge",
        sourceId: "task",
        targetId: "milestone",
        type: "startAfter",
      },
    ];

    const result = sanitizeScheduleGraph(document);

    assert.deepStrictEqual(result.removedEntityIds, []);
    assert.deepStrictEqual(result.removedDependencyIds, []);
  });
});
