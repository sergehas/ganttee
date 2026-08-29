import * as assert from "assert";
import { GanttDocument, Milestone, Task } from "../common/models";
import {
  buildDatePatchUpdate,
  buildShiftByDaysPatch,
} from "../services/entitySchedulePatchService";

suite("entitySchedulePatchService", () => {
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
