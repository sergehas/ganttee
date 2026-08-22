import * as assert from "assert";
import { GanttDocument } from "../common/models";
import { buildDirectGroupMemberRows } from "../webview/utils/taskForm/groupMemberRows";

suite("taskForm groupMemberRows", () => {
  test("builds direct member rows only for immediate children", () => {
    const rows = buildDirectGroupMemberRows(createDocument(), "g1");

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

  test("returns no rows for a group with no direct members", () => {
    assert.deepStrictEqual(buildDirectGroupMemberRows(createDocument(), "g2"), [
      { id: "task:t2", name: "Nested Task", kind: "task", entity: { kind: "task", id: "t2" } },
    ]);
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
