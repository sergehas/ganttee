import * as assert from "assert";
import { GanttDocument } from "../common/models";
import {
  describeDependency,
  findEntityRefById,
  titleOf,
} from "../webview/utils/taskForm/entityPresentation";

suite("taskForm entityPresentation", () => {
  test("maps entity kinds to editor titles", () => {
    assert.strictEqual(titleOf("task"), "Edit Task");
    assert.strictEqual(titleOf("milestone"), "Edit Milestone");
    assert.strictEqual(titleOf("group"), "Edit Group");
  });

  test("finds task and milestone refs by id", () => {
    const document = createDocument();

    assert.deepStrictEqual(findEntityRefById(document, "t1"), {
      id: "t1",
      kind: "task",
      name: "Task One",
    });
    assert.deepStrictEqual(findEntityRefById(document, "m1"), {
      id: "m1",
      kind: "milestone",
      name: "Milestone One",
    });
    assert.strictEqual(findEntityRefById(document, "missing"), undefined);
  });

  test("describes dependency with labels and fallback names", () => {
    const document = createDocument();

    const known = describeDependency(
      {
        id: "d1",
        sourceId: "t1",
        targetId: "m1",
        type: "startAfter",
      },
      document,
    );
    const unknownTarget = describeDependency(
      {
        id: "d2",
        sourceId: "t1",
        targetId: "missing",
        type: "startWith",
      },
      document,
    );

    assert.strictEqual(known, "Task One -> Start After -> Milestone One");
    assert.strictEqual(unknownTarget, "Task One -> Start With -> ?");
  });
});

function createDocument(): GanttDocument {
  return {
    version: 2,
    tasks: [
      { id: "t1", name: "Task One", start: "2026-01-01", end: "2026-01-03" },
    ],
    milestones: [{ id: "m1", name: "Milestone One", date: "2026-01-02" }],
    groups: [{ id: "g1", name: "Group One" }],
    dependencies: [],
  };
}
