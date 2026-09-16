import { formatShortDate } from "@common/datePresentation";
import { parseIsoDate } from "@common/dates";
import { createEmptyDocument, DependencyType, ProjectDocument } from "@common/documents";
import {
  DEPENDENCY_OPTIONS,
  dependencyTypeLabel,
  displayGroupDate,
  entityKindIcon,
  findEntityName,
  findEntityRefById,
  milestoneValidationMessages,
  STATUS_OPTIONS,
  taskStatusLabel,
  taskValidationMessages,
  titleOf,
} from "@webview/features/entity-editor/entityEditorPresentation";
import * as assert from "assert";

suite("taskForm entityPresentation", () => {
  test("exposes selectable status and dependency options", () => {
    assert.deepStrictEqual(STATUS_OPTIONS, ["todo", "inProgress", "done"]);
    assert.deepStrictEqual(DEPENDENCY_OPTIONS, ["startAfter", "startWith", "endWith"]);
  });

  test("resolves task status labels", () => {
    assert.strictEqual(taskStatusLabel("todo"), "To Do");
    assert.strictEqual(taskStatusLabel("inProgress"), "In Progress");
    assert.strictEqual(taskStatusLabel("done"), "Done");
  });

  test("resolves dependency type labels including fallback", () => {
    assert.strictEqual(dependencyTypeLabel("startAfter"), "Start After");
    assert.strictEqual(dependencyTypeLabel("startWith"), "Start With");
    assert.strictEqual(dependencyTypeLabel("endWith"), "End With");
    assert.strictEqual(dependencyTypeLabel("custom" as DependencyType), "custom");
  });

  test("resolves entity kind icons", () => {
    assert.strictEqual(entityKindIcon("task"), "checklist");
    assert.strictEqual(entityKindIcon("milestone"), "milestone");
    assert.strictEqual(entityKindIcon("group"), "folder");
  });

  test("formats group dates for display with fallback for undefined", () => {
    assert.strictEqual(displayGroupDate(undefined, "en-US"), "");

    const isoDate = "2026-03-15";
    const expected = formatShortDate(parseIsoDate(isoDate), "en-US");
    assert.strictEqual(displayGroupDate(isoDate, "en-US"), expected);
  });

  test("builds task constraint validation messages across all branch conditions", () => {
    const valid = taskValidationMessages({
      count: 2,
      duplicateStart: false,
      duplicateEnd: false,
      underConstrained: false,
      overConstrained: false,
      blocking: false,
    });
    assert.deepStrictEqual(valid, []);

    const blockingOnly = taskValidationMessages({
      count: 1,
      duplicateStart: false,
      duplicateEnd: false,
      underConstrained: true,
      overConstrained: false,
      blocking: true,
    });
    assert.deepStrictEqual(blockingOnly, [
      {
        severity: "error",
        source: "Task has {0} constraint(s); exactly 2 are needed to schedule.",
        values: [1],
      },
    ]);

    const duplicateStartOnly = taskValidationMessages({
      count: 2,
      duplicateStart: true,
      duplicateEnd: false,
      underConstrained: false,
      overConstrained: true,
      blocking: false,
    });
    assert.deepStrictEqual(duplicateStartOnly, [
      {
        severity: "warning",
        source: "Task has duplicate start constraints.",
      },
    ]);

    const duplicateEndOnly = taskValidationMessages({
      count: 2,
      duplicateStart: false,
      duplicateEnd: true,
      underConstrained: false,
      overConstrained: true,
      blocking: false,
    });
    assert.deepStrictEqual(duplicateEndOnly, [
      {
        severity: "warning",
        source: "Task has duplicate end constraints.",
      },
    ]);

    const duplicateBoth = taskValidationMessages({
      count: 3,
      duplicateStart: true,
      duplicateEnd: true,
      underConstrained: false,
      overConstrained: true,
      blocking: true,
    });
    assert.deepStrictEqual(duplicateBoth, [
      {
        severity: "error",
        source: "Task has {0} constraint(s); exactly 2 are needed to schedule.",
        values: [3],
      },
      {
        severity: "warning",
        source: "Task has duplicate start and end constraints.",
      },
    ]);
  });

  test("builds milestone constraint validation messages across all branch conditions", () => {
    const valid = milestoneValidationMessages({
      count: 2,
      duplicateStart: false,
      duplicateEnd: false,
      underConstrained: false,
      overConstrained: false,
      blocking: false,
    });
    assert.deepStrictEqual(valid, []);

    const blockingOnly = milestoneValidationMessages({
      count: 0,
      duplicateStart: false,
      duplicateEnd: false,
      underConstrained: true,
      overConstrained: false,
      blocking: true,
    });
    assert.deepStrictEqual(blockingOnly, [
      {
        severity: "error",
        source: "Milestone needs a date or an outgoing dependency.",
      },
    ]);

    const overConstrainedOnly = milestoneValidationMessages({
      count: 2,
      duplicateStart: true,
      duplicateEnd: true,
      underConstrained: false,
      overConstrained: true,
      blocking: false,
    });
    assert.deepStrictEqual(overConstrainedOnly, [
      {
        severity: "warning",
        source: "Milestone has a duplicate date constraint.",
      },
    ]);

    const blockingAndOverConstrained = milestoneValidationMessages({
      count: 0,
      duplicateStart: false,
      duplicateEnd: false,
      underConstrained: true,
      overConstrained: true,
      blocking: true,
    });
    assert.deepStrictEqual(blockingAndOverConstrained, [
      {
        severity: "error",
        source: "Milestone needs a date or an outgoing dependency.",
      },
      {
        severity: "warning",
        source: "Milestone has a duplicate date constraint.",
      },
    ]);
  });

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

  test("finds entity name by id with fallback", () => {
    const document = createDocument();

    assert.strictEqual(findEntityName(document, "t1", testTranslate), "Task One");
    assert.strictEqual(findEntityName(document, "m1", testTranslate), "Milestone One");
    assert.strictEqual(findEntityName(document, "unknown", testTranslate), "?");
  });
});

/** Creates a mock project document with tasks, milestones, and groups for testing. */
function createDocument(): ProjectDocument {
  return {
    ...createEmptyDocument(),
    version: 2,
    tasks: [{ id: "t1", name: "Task One", start: "2026-01-01", end: "2026-01-03" }],
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
    "{0} → {1}": "{0} → {1}",
    "?": "?",
  };
  const message = strings[source] ?? source;
  return message.replace(/\{(\d+)\}/g, (_placeholder, indexText) =>
    String(values[Number(indexText)]),
  );
}
