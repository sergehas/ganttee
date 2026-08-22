import * as assert from "assert";
import { GanttDocument, Milestone, Task } from "../common/models";
import {
  buildDatePatchUpdate,
  buildDependency,
  buildSaveUpdate,
  buildShiftByDaysPatch,
  buildTaskOrMilestoneDeletionDocument,
  buildUngroupUpdate,
  canSaveEntity,
  createDependencyId,
} from "../services/entityEditWorkflowService";

suite("entityEditWorkflowService", () => {
  test("rejects invalid task save updates", () => {
    const update = buildSaveUpdate("task", {
      id: "t1",
      name: "Invalid",
      start: "2026-01-02",
      end: "2026-01-01",
    });
    assert.strictEqual(update, undefined);
  });

  test("rejects self-parented group save updates", () => {
    const update = buildSaveUpdate("group", {
      id: "g1",
      name: "Group",
      groupId: "g1",
    });
    assert.strictEqual(update, undefined);
  });

  test("builds valid milestone and group save updates", () => {
    const milestone = buildSaveUpdate("milestone", {
      id: "m1",
      name: "M",
      date: "2026-03-01",
    });
    const group = buildSaveUpdate("group", { id: "g1", name: "G" });

    assert.strictEqual(milestone?.kind, "milestone");
    assert.strictEqual(group?.kind, "group");
  });

  test("returns undefined for invalid milestone saves", () => {
    const update = buildSaveUpdate("milestone", {
      id: "m-empty",
      name: "M",
      date: "",
    });

    assert.strictEqual(update, undefined);
  });

  test("allows a dependency-defined milestone save", () => {
    const update = buildSaveUpdate(
      "milestone",
      { id: "m1", name: "M" },
      undefined,
      [{ id: "d1", sourceId: "m1", targetId: "t1", type: "startAfter" }],
    );

    assert.strictEqual(update?.kind, "milestone");
  });

  test("allows duplicate endpoint warnings to be saved", () => {
    const taskUpdate = buildSaveUpdate(
      "task",
      { id: "t1", name: "Task", start: "2026-01-01" },
      undefined,
      [{ id: "d1", sourceId: "t1", targetId: "t2", type: "startAfter" }],
    );
    const milestoneUpdate = buildSaveUpdate(
      "milestone",
      { id: "m1", name: "Milestone", date: "2026-01-01" },
      undefined,
      [{ id: "d2", sourceId: "m1", targetId: "t2", type: "endWith" }],
    );

    assert.strictEqual(taskUpdate?.kind, "task");
    assert.strictEqual(milestoneUpdate?.kind, "milestone");
  });

  test("continues blocking ordinary over-constrained task saves", () => {
    const update = buildSaveUpdate("task", {
      id: "t1",
      name: "Task",
      start: "2026-01-01",
      duration: 2,
      end: "2026-01-03",
    });

    assert.strictEqual(update, undefined);
  });

  test("buildSaveUpdate preserves save options", () => {
    const update = buildSaveUpdate(
      "task",
      {
        id: "t1",
        name: "Task",
        start: "2026-01-01",
        end: "2026-01-04",
      },
      { keepEditorOpen: true },
    );

    assert.deepStrictEqual(update?.options, { keepEditorOpen: true });
  });

  test("canSaveEntity enforces shared guards for each kind", () => {
    assert.strictEqual(
      canSaveEntity("task", {
        id: "t1",
        name: "Task",
        start: "2026-01-01",
        end: "2026-01-02",
      }),
      true,
    );
    assert.strictEqual(
      canSaveEntity("milestone", {
        id: "m1",
        name: "Milestone",
        date: "",
      }),
      false,
    );
    assert.strictEqual(
      canSaveEntity("group", {
        id: "g1",
        name: "Group",
        groupId: "g2",
      }),
      true,
    );
  });

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

  test("builds dependency only when owner and target are present", () => {
    const dependency = buildDependency(
      "t1",
      "m1",
      "startAfter",
      () => "dep-test",
    );
    const missingOwner = buildDependency(
      undefined,
      "m1",
      "startAfter",
      () => "dep-test",
    );
    const missingTarget = buildDependency(
      "t1",
      "",
      "startAfter",
      () => "dep-test",
    );

    assert.deepStrictEqual(dependency, {
      id: "dep-test",
      sourceId: "t1",
      targetId: "m1",
      type: "startAfter",
    });
    assert.strictEqual(missingOwner, undefined);
    assert.strictEqual(missingTarget, undefined);
  });

  test("builds date patch updates for task and milestone", () => {
    const document = createDocument();

    const taskUpdate = buildDatePatchUpdate(
      document,
      { kind: "task", id: "t1" },
      { start: "2026-02-01", end: "2026-02-05" },
    );
    const milestoneUpdate = buildDatePatchUpdate(
      document,
      { kind: "milestone", id: "m1" },
      { date: "2026-02-10" },
    );

    assert.strictEqual(taskUpdate?.kind, "task");
    assert.strictEqual((taskUpdate?.entity as Task).start, "2026-02-01");
    assert.strictEqual((taskUpdate?.entity as Task).end, "2026-02-05");
    assert.strictEqual(milestoneUpdate?.kind, "milestone");
    assert.strictEqual(
      (milestoneUpdate?.entity as Milestone).date,
      "2026-02-10",
    );
  });

  test("builds milestone date patch from start/end fallbacks", () => {
    const document = createDocument();

    const fromStart = buildDatePatchUpdate(
      document,
      { kind: "milestone", id: "m1" },
      { start: "2026-04-01" },
    );
    const fromEnd = buildDatePatchUpdate(
      document,
      { kind: "milestone", id: "m1" },
      { end: "2026-04-02" },
    );

    assert.strictEqual((fromStart?.entity as Milestone).date, "2026-04-01");
    assert.strictEqual((fromEnd?.entity as Milestone).date, "2026-04-02");
  });

  test("falls back to entity dates when patch omits start/end", () => {
    const document = createDocument();

    const taskUpdate = buildDatePatchUpdate(
      document,
      { kind: "task", id: "t1" },
      {},
    );

    assert.strictEqual((taskUpdate?.entity as Task).start, "2026-01-01");
    assert.strictEqual((taskUpdate?.entity as Task).end, "2026-01-04");
  });

  test("returns undefined from buildDatePatchUpdate for missing or unsupported entities", () => {
    const document = createDocument();

    assert.strictEqual(
      buildDatePatchUpdate(document, { kind: "task", id: "missing" }, {}),
      undefined,
    );
    assert.strictEqual(
      buildDatePatchUpdate(
        document,
        { kind: "milestone", id: "missing" },
        { date: "2026-02-01" },
      ),
      undefined,
    );
    assert.strictEqual(
      buildDatePatchUpdate(document, { kind: "milestone", id: "m1" }, {}),
      undefined,
    );
    assert.strictEqual(
      buildDatePatchUpdate(document, { kind: "group", id: "g1" }, {}),
      undefined,
    );
  });

  test("builds shift-by-days patches", () => {
    const document = createDocument();

    const taskPatch = buildShiftByDaysPatch(
      document,
      { kind: "task", id: "t1" },
      2,
    );
    const milestonePatch = buildShiftByDaysPatch(
      document,
      { kind: "milestone", id: "m1" },
      2,
    );

    assert.deepStrictEqual(taskPatch, {
      start: "2026-01-03",
      end: "2026-01-06",
    });
    assert.deepStrictEqual(milestonePatch, {
      date: "2026-01-04",
    });
  });

  test("returns undefined from buildShiftByDaysPatch for missing or unsupported entities", () => {
    const document = createDocument();

    assert.strictEqual(
      buildShiftByDaysPatch(document, { kind: "task", id: "missing" }, 1),
      undefined,
    );
    assert.strictEqual(
      buildShiftByDaysPatch(document, { kind: "milestone", id: "missing" }, 1),
      undefined,
    );
    assert.strictEqual(
      buildShiftByDaysPatch(document, { kind: "group", id: "g1" }, 1),
      undefined,
    );
  });

  test("returns undefined from buildShiftByDaysPatch when task has no dates", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [{ id: "t-bare", name: "Bare" }],
    };

    assert.strictEqual(
      buildShiftByDaysPatch(document, { kind: "task", id: "t-bare" }, 1),
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

  test("shifts task with only start defined", () => {
    const document: GanttDocument = {
      ...createDocument(),
      tasks: [{ id: "t-start", name: "Start only", start: "2026-03-01" }],
    };

    const patch = buildShiftByDaysPatch(
      document,
      { kind: "task", id: "t-start" },
      1,
    );

    assert.deepStrictEqual(patch, { start: "2026-03-02", end: undefined });
  });

  test("createDependencyId returns a prefixed string", () => {
    const id = createDependencyId();
    assert.ok(id.startsWith("dep-"), `Expected dep- prefix, got: ${id}`);
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
