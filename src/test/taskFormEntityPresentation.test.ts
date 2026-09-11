import * as assert from "assert";
import { DependencyType, GanttDocument } from "../common/models";
import {
  describeDependency,
  findEntityRefById,
  titleOf,
} from "../webview/utils/taskForm/entityPresentation";

suite("taskForm entityPresentation", () => {
  test("maps entity kinds to editor titles", () => {
    assert.strictEqual(titleOf("task", testTranslate), "Edit Task");
    assert.strictEqual(titleOf("milestone", testTranslate), "Edit Milestone");
    assert.strictEqual(titleOf("group", testTranslate), "Edit Group");
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
      testTranslate,
    );
    const unknownTarget = describeDependency(
      {
        id: "d2",
        sourceId: "t1",
        targetId: "missing",
        type: "startWith",
      },
      document,
      testTranslate,
    );
    const endWith = describeDependency(
      {
        id: "d3",
        sourceId: "m1",
        targetId: "t1",
        type: "endWith",
      },
      document,
      testTranslate,
    );
    const unknownDependency = describeDependency(
      {
        id: "d4",
        sourceId: "missing",
        targetId: "t1",
        type: "legacy" as DependencyType,
      },
      document,
      testTranslate,
    );

    assert.strictEqual(known, "Task One -> Start After -> Milestone One");
    assert.strictEqual(unknownTarget, "Task One -> Start With -> ?");
    assert.strictEqual(endWith, "Milestone One -> End With -> Task One");
    assert.strictEqual(unknownDependency, "? -> legacy -> Task One");
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

/** Resolves presentation keys using the source strings registered for this test. */
function testTranslate(source: string, ...values: unknown[]): string {
  const strings: Readonly<Record<string, string>> = {
    "Edit Task": "Edit Task",
    "Edit Milestone": "Edit Milestone",
    "Edit Group": "Edit Group",
    "Start After": "Start After",
    "Start With": "Start With",
    "End With": "End With",
    "{0} → {1} → {2}": "{0} → {1} → {2}",
    "?": "?",
  };
  const message = strings[source] ?? source;
  return message.replace(/\{(\d+)\}/g, (_placeholder, indexText) =>
    String(values[Number(indexText)]),
  );
}
