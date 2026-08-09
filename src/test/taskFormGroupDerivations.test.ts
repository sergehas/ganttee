import * as assert from "assert";
import { GanttDocument } from "../common/models";
import {
  buildDirectGroupMemberRows,
  collectGroupScope,
  computeGroupEffectiveSchedule,
} from "../webview/utils/taskForm/groupDerivations";

suite("taskForm groupDerivations", () => {
  test("collects transitive group scope for nested children", () => {
    const document = createDocument();

    const scope = collectGroupScope(document, "g1");

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

  test("computes effective schedule across tasks and milestones", () => {
    const document = createDocument();
    const scope = collectGroupScope(document, "g1");

    const schedule = computeGroupEffectiveSchedule(
      scope.tasks,
      scope.milestones,
    );

    assert.deepStrictEqual(schedule, {
      start: "2026-01-01",
      end: "2026-01-06",
      duration: "5",
    });
  });

  test("returns empty schedule when no dated entities exist", () => {
    const schedule = computeGroupEffectiveSchedule([], []);
    assert.deepStrictEqual(schedule, {});
  });

  test("builds direct member rows only for immediate children", () => {
    const document = createDocument();

    const rows = buildDirectGroupMemberRows(document, "g1");

    assert.deepStrictEqual(rows.map((row) => row.id).sort(), [
      "group:g2",
      "milestone:m1",
      "task:t1",
    ]);
    assert.strictEqual(
      rows.some((row) => row.id === "task:t2"),
      false,
    );
  });
});

function createDocument(): GanttDocument {
  return {
    version: 2,
    groups: [
      { id: "g1", name: "Root" },
      { id: "g2", name: "Child", groupId: "g1" },
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
    ],
    milestones: [
      { id: "m1", name: "Direct Milestone", date: "2026-01-02", groupId: "g1" },
    ],
    dependencies: [],
  };
}
