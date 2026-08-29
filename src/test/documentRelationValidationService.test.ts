import * as assert from "assert";
import { createEmptyDocument, GanttDocument } from "../common/models";
import { assertDocumentRelations } from "../services/documentRelationValidationService";
import { GanttParseError } from "../services/documentShapeValidationService";

suite("documentRelationValidationService", () => {
  test("accepts a document with valid relations", () => {
    assert.doesNotThrow(() => assertDocumentRelations(createEmptyDocument()));
  });

  test("rejects duplicate ids across entity kinds", () => {
    const document = createEmptyDocument();
    document.tasks = [{ id: "same", name: "Task" }];
    document.groups = [{ id: "same", name: "Group" }];

    assert.throws(
      () => assertDocumentRelations(document),
      /must be unique across tasks, groups, and milestones/,
    );
  });

  test("rejects a task whose start is after its end", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-01-03", end: "2026-01-02" },
    ];

    assert.throws(
      () => assertDocumentRelations(document),
      /invalid date range/,
    );
  });

  test("rejects invalid group hierarchy relations", () => {
    const selfParent = documentWithGroups([
      { id: "group", name: "Group", groupId: "group" },
    ]);
    assert.throws(
      () => assertDocumentRelations(selfParent),
      /cannot reference itself/,
    );

    const missingParent = documentWithGroups([
      { id: "group", name: "Group", groupId: "missing" },
    ]);
    assert.throws(
      () => assertDocumentRelations(missingParent),
      /unknown group id/,
    );

    const cycle = documentWithGroups([
      { id: "a", name: "A", groupId: "b" },
      { id: "b", name: "B", groupId: "a" },
    ]);
    assert.throws(() => assertDocumentRelations(cycle), /parent cycle/);
  });

  test("rejects unknown group references on tasks and milestones", () => {
    const taskReference = createEmptyDocument();
    taskReference.tasks = [{ id: "task", name: "Task", groupId: "missing" }];
    assert.throws(() => assertDocumentRelations(taskReference), /tasks\[0\]/);

    const milestoneReference = createEmptyDocument();
    milestoneReference.milestones = [
      { id: "milestone", name: "Milestone", groupId: "missing" },
    ];
    assert.throws(
      () => assertDocumentRelations(milestoneReference),
      /milestones\[0\]/,
    );
  });

  test("converts graph integrity errors to parse errors", () => {
    const selfLoop = createEmptyDocument();
    selfLoop.tasks = [{ id: "task", name: "Task" }];
    selfLoop.dependencies = [
      { id: "self", sourceId: "task", targetId: "task", type: "startAfter" },
    ];
    assert.throws(() => assertDocumentRelations(selfLoop), GanttParseError);

    const parallel = createEmptyDocument();
    parallel.tasks = [
      { id: "source", name: "Source" },
      { id: "target", name: "Target" },
    ];
    parallel.dependencies = [
      {
        id: "first",
        sourceId: "source",
        targetId: "target",
        type: "startAfter",
      },
      { id: "second", sourceId: "source", targetId: "target", type: "endWith" },
    ];
    assert.throws(() => assertDocumentRelations(parallel), GanttParseError);
  });
});

/** Builds an empty document with the supplied group hierarchy. */
function documentWithGroups(groups: GanttDocument["groups"]): GanttDocument {
  return { ...createEmptyDocument(), groups };
}
