import * as assert from "assert";
import { createEmptyDocument } from "../common/models";
import {
  createGanttViewState,
  updateGanttViewDocument,
} from "../webview/viewState";

suite("viewState", () => {
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
    document.schedule = {
      tasks: [
        {
          id: "task",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-09T09:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
      milestones: [],
      groups: [
        {
          id: "group",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-09T09:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
    };

    const result = createGanttViewState(document, 4);

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

  test("replaces an entity without mutating the host document or schedule", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
    ];
    document.schedule = {
      tasks: [
        {
          id: "task",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-09T09:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
      milestones: [],
      groups: [],
    };
    const current = createGanttViewState(document, 7);

    const result = updateGanttViewDocument(current, "task", {
      id: "task",
      name: "Task",
      start: "2026-09-10",
      duration: 1,
    });

    assert.strictEqual(document.tasks[0].start, "2026-09-08");
    assert.strictEqual(result?.tasks[0].start, "2026-09-10");
    assert.strictEqual(result?.schedule, undefined);
  });

  test("returns undefined when an entity no longer exists", () => {
    const document = createEmptyDocument();
    document.schedule = { tasks: [], milestones: [], groups: [] };
    const current = createGanttViewState(document, 1);

    const result = updateGanttViewDocument(current, "task", {
      id: "missing",
      name: "Missing",
      start: "2026-09-08",
      duration: 1,
    });

    assert.strictEqual(result, undefined);
  });
});
