import { createEmptyDocument, ProjectDocument } from "@common/documents";
import {
  collectDescendantGroupIds,
  selectGroupScheduleScope,
} from "@services/groups/groupHierarchyService";
import * as assert from "assert";

function createDocument(): ProjectDocument {
  return {
    ...createEmptyDocument(),
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
    milestones: [{ id: "m1", name: "Direct Milestone", date: "2026-01-02", groupId: "g1" }],
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
    const ids = collectDescendantGroupIds([{ id: "g1", name: "Self", groupId: "g1" }], "g1");

    assert.deepStrictEqual([...ids], ["g1"]);
  });

  test("selects transitively owned tasks and milestones", () => {
    const scope = selectGroupScheduleScope(createDocument(), "g1");

    assert.deepStrictEqual([...scope.groupIds].sort(), ["g1", "g2"]);
    assert.deepStrictEqual(scope.tasks.map((task) => task.id).sort(), ["t1", "t2"]);
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
