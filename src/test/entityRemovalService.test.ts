import * as assert from "assert";
import { GanttDocument } from "../common/models";
import {
  buildTaskOrMilestoneDeletionDocument,
  buildUngroupUpdate,
} from "../services/entityRemovalService";

suite("entityRemovalService", () => {
  test("builds ungroup updates for direct members", () => {
    const document = createDocument();

    const task = buildUngroupUpdate(document, { kind: "task", id: "t1" });
    const milestone = buildUngroupUpdate(document, {
      kind: "milestone",
      id: "m1",
    });
    const group = buildUngroupUpdate(document, { kind: "group", id: "g2" });

    assert.strictEqual(task?.kind, "task");
    assert.strictEqual(task?.entity.groupId, undefined);
    assert.strictEqual(milestone?.kind, "milestone");
    assert.strictEqual(milestone?.entity.groupId, undefined);
    assert.strictEqual(group?.kind, "group");
    assert.strictEqual(group?.entity.groupId, undefined);
  });

  test("returns undefined from buildUngroupUpdate when entity is missing", () => {
    const document = createDocument();

    assert.strictEqual(
      buildUngroupUpdate(document, { kind: "task", id: "missing" }),
      undefined,
    );
    assert.strictEqual(
      buildUngroupUpdate(document, { kind: "group", id: "missing" }),
      undefined,
    );
    assert.strictEqual(
      buildUngroupUpdate(document, { kind: "milestone", id: "missing" }),
      undefined,
    );
  });

  test("returns undefined when the entity to delete is missing", () => {
    assert.strictEqual(
      buildTaskOrMilestoneDeletionDocument(createDocument(), "task", "missing"),
      undefined,
    );
  });

  test("deletes a task and every connected dependency", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [...createDocument().tasks, { id: "source", name: "Source" }],
      dependencies: [
        { id: "outgoing", sourceId: "t1", targetId: "m1", type: "startAfter" },
        {
          id: "incoming",
          sourceId: "source",
          targetId: "t1",
          type: "startAfter",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(document, "task", "t1");

    assert.deepStrictEqual(next?.tasks, [{ id: "source", name: "Source" }]);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("materializes a source task start before removing its start-with anchor", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [
        { id: "source", name: "Source", end: "2026-01-05", duration: 4 },
        {
          id: "anchor",
          name: "Anchor",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      dependencies: [
        {
          id: "start-with",
          sourceId: "source",
          targetId: "anchor",
          type: "startWith",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(
      document,
      "task",
      "anchor",
    );

    assert.deepStrictEqual(next?.tasks, [
      {
        id: "source",
        name: "Source",
        start: "2026-01-03",
        end: "2026-01-05",
        duration: 4,
      },
    ]);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("materializes a source task end before removing its end-with anchor", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [
        { id: "source", name: "Source", start: "2026-01-01", duration: 4 },
        {
          id: "anchor",
          name: "Anchor",
          start: "2026-01-02",
          end: "2026-01-08",
        },
      ],
      dependencies: [
        {
          id: "end-with",
          sourceId: "source",
          targetId: "anchor",
          type: "endWith",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(
      document,
      "task",
      "anchor",
    );

    assert.deepStrictEqual(next?.tasks, [
      {
        id: "source",
        name: "Source",
        start: "2026-01-01",
        end: "2026-01-08",
        duration: 4,
      },
    ]);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("materializes a task start before deleting a milestone start-with anchor", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [{ id: "source", name: "Source", duration: 4 }],
      milestones: [{ id: "anchor", name: "Anchor", date: "2026-01-03" }],
      dependencies: [
        {
          id: "start-with",
          sourceId: "source",
          targetId: "anchor",
          type: "startWith",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(
      document,
      "milestone",
      "anchor",
    );

    assert.deepStrictEqual(next?.tasks, [
      { id: "source", name: "Source", start: "2026-01-03", duration: 4 },
    ]);
    assert.deepStrictEqual(next?.milestones, []);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("materializes a task end before deleting a milestone end-with anchor", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [{ id: "source", name: "Source", start: "2026-01-01" }],
      milestones: [{ id: "anchor", name: "Anchor", date: "2026-01-03" }],
      dependencies: [
        {
          id: "end-with",
          sourceId: "source",
          targetId: "anchor",
          type: "endWith",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(
      document,
      "milestone",
      "anchor",
    );

    assert.deepStrictEqual(next?.tasks, [
      { id: "source", name: "Source", start: "2026-01-01", end: "2026-01-03" },
    ]);
  });

  test("ignores dependencies from non-task sources and unrelated targets", () => {
    const document: GanttDocument = {
      ...createDocument(),
      groups: [{ id: "source", name: "Source" }],
      dependencies: [
        {
          id: "group-source",
          sourceId: "source",
          targetId: "t1",
          type: "startWith",
        },
        {
          id: "unrelated",
          sourceId: "t1",
          targetId: "m1",
          type: "startAfter",
        },
      ],
    };

    const next = buildTaskOrMilestoneDeletionDocument(document, "task", "t1");

    assert.deepStrictEqual(next?.tasks, []);
    assert.deepStrictEqual(next?.dependencies, []);
  });

  test("blocks deletion when a milestone anchor has no resolvable date", () => {
    const document: GanttDocument = {
      ...createDocument(),
      milestones: [{ id: "anchor", name: "Undated" }],
      dependencies: [
        {
          id: "start-with",
          sourceId: "t1",
          targetId: "anchor",
          type: "startWith",
        },
      ],
    };

    assert.strictEqual(
      buildTaskOrMilestoneDeletionDocument(document, "milestone", "anchor"),
      undefined,
    );
  });

  test("blocks deletion when a task anchor has no resolvable date", () => {
    const baseDocument = createDocument();
    const document: GanttDocument = {
      ...baseDocument,
      tasks: [...baseDocument.tasks, { id: "anchor", name: "Undated" }],
      dependencies: [
        {
          id: "start-with",
          sourceId: "t1",
          targetId: "anchor",
          type: "startWith",
        },
      ],
    };

    assert.strictEqual(
      buildTaskOrMilestoneDeletionDocument(document, "task", "anchor"),
      undefined,
    );
  });
});

function createDocument(): GanttDocument {
  return {
    version: 1,
    tasks: [
      {
        id: "t1",
        name: "Task",
        start: "2026-01-01",
        end: "2026-01-04",
        groupId: "g1",
      },
    ],
    milestones: [
      { id: "m1", name: "Milestone", date: "2026-01-02", groupId: "g1" },
    ],
    groups: [
      { id: "g1", name: "Root" },
      { id: "g2", name: "Child", groupId: "g1" },
    ],
    dependencies: [],
  };
}
