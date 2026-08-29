import * as assert from "assert";
import { GanttDocument, Milestone, Task } from "../common/models";
import {
  buildSaveUpdate,
  canSaveEntity,
} from "../services/entitySaveGuardService";

suite("entitySaveGuardService", () => {
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

  test("blocks an undated milestone with both outgoing endpoint constraint types", () => {
    const update = buildSaveUpdate(
      "milestone",
      { id: "m1", name: "Milestone" },
      undefined,
      [
        {
          id: "start",
          sourceId: "m1",
          targetId: "t1",
          type: "startAfter",
        },
        {
          id: "end",
          sourceId: "m1",
          targetId: "t1",
          type: "endWith",
        },
      ],
    );

    assert.strictEqual(update, undefined);
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

  test("blocks a mixed duplicate and ordinary over-constrained save", () => {
    const update = buildSaveUpdate(
      "task",
      {
        id: "t1",
        name: "Task",
        start: "2026-01-01",
        duration: 2,
        end: "2026-01-03",
      },
      undefined,
      [{ id: "d1", sourceId: "t1", targetId: "t2", type: "startAfter" }],
    );

    assert.strictEqual(update, undefined);
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
