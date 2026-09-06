import * as assert from "assert";
import { createEmptyDocument } from "../common/models";
import {
  createWebviewScheduleState,
  updateWebviewScheduleEntity,
} from "../webview/scheduleState";

suite("webviewScheduleState", () => {
  test("hydrates one complete schedule for a host revision", () => {
    const document = createEmptyDocument();
    document.groups = [{ id: "group", name: "Group" }];
    document.tasks = [
      {
        id: "task",
        name: "Task",
        groupId: "group",
        start: "2026-09-08",
        duration: 1,
      },
    ];

    const result = createWebviewScheduleState(document, 4);

    assert.deepStrictEqual(
      {
        revision: result.revision,
        taskStart: result.scheduledModel.tasks[0]
          .effectiveStart()
          .toISOString(),
        groupStart:
          result.scheduledModel.groups[0].effectiveStart.toISOString(),
      },
      {
        revision: 4,
        taskStart: "2026-09-08T09:00:00.000Z",
        groupStart: "2026-09-08T09:00:00.000Z",
      },
    );
  });

  test("replaces and schedules an entity without mutating the host document", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
    ];
    const current = createWebviewScheduleState(document, 7);

    const result = updateWebviewScheduleEntity(current, "task", {
      id: "task",
      name: "Task",
      start: "2026-09-10",
      duration: 1,
    });

    assert.strictEqual(document.tasks[0].start, "2026-09-08");
    assert.strictEqual(result?.document.tasks[0].start, "2026-09-10");
    assert.strictEqual(
      result?.scheduledModel.tasks[0].effectiveStart().toISOString(),
      "2026-09-10T09:00:00.000Z",
    );
    assert.strictEqual(result?.revision, 7);
  });

  test("returns undefined when an entity no longer exists", () => {
    const document = createEmptyDocument();
    const current = createWebviewScheduleState(document, 1);

    const result = updateWebviewScheduleEntity(current, "task", {
      id: "missing",
      name: "Missing",
      start: "2026-09-08",
      duration: 1,
    });

    assert.strictEqual(result, undefined);
  });
});
