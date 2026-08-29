import * as assert from "assert";
import { GanttDocument } from "../common/models";
import {
  collectDescendantGroupIds,
  selectGroupScheduleScope,
} from "../services/groupHierarchyService";
import { deriveGroupSchedule } from "../services/groupScheduleProjectionService";

function createDocument(): GanttDocument {
  return {
    version: 2,
    groups: [
      { id: "g1", name: "Root" },
      { id: "g2", name: "Child", groupId: "g1" },
      { id: "g3", name: "Unrelated" },
    ],
    tasks: [
      {
        id: "t1",
        name: "Direct Task",
        start: "2026-01-01",
        end: "2026-01-03",
        groupId: "g1",
      },
      {
        id: "t2",
        name: "Nested Task",
        start: "2026-01-04",
        end: "2026-01-06",
        groupId: "g2",
      },
      { id: "t3", name: "Ungrouped Task", start: "2026-02-01" },
    ],
    milestones: [
      { id: "m1", name: "Direct Milestone", date: "2026-01-02", groupId: "g1" },
    ],
    dependencies: [],
  };
}

suite("groupHierarchyService", () => {
  test("collects the root group and its nested descendants", () => {
    const ids = collectDescendantGroupIds(createDocument().groups, "g1");

    assert.deepStrictEqual([...ids].sort(), ["g1", "g2"]);
  });

  test("collects only the root when it has no children", () => {
    const ids = collectDescendantGroupIds(createDocument().groups, "g3");

    assert.deepStrictEqual([...ids], ["g3"]);
  });

  test("ignores a group that owns itself", () => {
    const ids = collectDescendantGroupIds(
      [{ id: "g1", name: "Self", groupId: "g1" }],
      "g1",
    );

    assert.deepStrictEqual([...ids], ["g1"]);
  });

  test("selects transitively owned tasks and milestones", () => {
    const scope = selectGroupScheduleScope(createDocument(), "g1");

    assert.deepStrictEqual([...scope.groupIds].sort(), ["g1", "g2"]);
    assert.deepStrictEqual(scope.tasks.map((task) => task.id).sort(), [
      "t1",
      "t2",
    ]);
    assert.deepStrictEqual(
      scope.milestones.map((milestone) => milestone.id),
      ["m1"],
    );
  });

  test("excludes entities that belong to no group", () => {
    const scope = selectGroupScheduleScope(createDocument(), "g3");

    assert.deepStrictEqual(scope.tasks, []);
    assert.deepStrictEqual(scope.milestones, []);
  });
});

suite("groupScheduleProjectionService", () => {
  test("spans the earliest start and latest end of its members", () => {
    const schedule = deriveGroupSchedule(
      selectGroupScheduleScope(createDocument(), "g1"),
    );

    assert.deepStrictEqual(schedule, {
      start: "2026-01-01",
      end: "2026-01-06",
      durationDays: 5,
    });
  });

  test("returns an empty schedule when no member is dated", () => {
    assert.deepStrictEqual(
      deriveGroupSchedule({
        groupIds: new Set(["g1"]),
        tasks: [],
        milestones: [],
      }),
      {},
    );
  });

  test("uses a milestone date as both ends of the span", () => {
    const schedule = deriveGroupSchedule({
      groupIds: new Set(["g1"]),
      tasks: [],
      milestones: [{ id: "m1", name: "M", date: "2026-03-01" }],
    });

    assert.deepStrictEqual(schedule, {
      start: "2026-03-01",
      end: "2026-03-01",
      durationDays: 0,
    });
  });

  test("skips a milestone that has no date", () => {
    const schedule = deriveGroupSchedule({
      groupIds: new Set(["g1"]),
      tasks: [{ id: "t1", name: "T", start: "2026-03-01", end: "2026-03-04" }],
      milestones: [{ id: "m1", name: "M" }],
    });

    assert.deepStrictEqual(schedule, {
      start: "2026-03-01",
      end: "2026-03-04",
      durationDays: 3,
    });
  });
});
