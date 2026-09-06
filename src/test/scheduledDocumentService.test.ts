import * as assert from "assert";
import { createEmptyDocument } from "../common/models";
import { hydrateDocument } from "../services/ganttModelService";
import {
  fromScheduledDocument,
  toScheduledDocument,
} from "../services/scheduledDocumentService";
import { schedule } from "../services/schedulingService";

suite("scheduledDocumentService", () => {
  test("serializes Date-based schedules as ISO timestamp documents", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
    ];
    const model = hydrateDocument(document);
    const scheduledModel = schedule(model, model.graph);

    assert.deepStrictEqual(toScheduledDocument(scheduledModel), {
      tasks: [
        {
          id: "task",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-08T17:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
      milestones: [],
      groups: [],
    });
  });

  test("serializes milestone and group schedule projections", () => {
    const document = createEmptyDocument();
    document.groups = [{ id: "group", name: "Group" }];
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-09-08" },
    ];
    document.tasks = [
      {
        id: "task",
        name: "Task",
        groupId: "group",
        start: "2026-09-08",
        duration: 1,
      },
    ];
    const model = hydrateDocument(document);
    const scheduledModel = schedule(model, model.graph);

    assert.deepStrictEqual(toScheduledDocument(scheduledModel), {
      tasks: [
        {
          id: "task",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-08T17:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
      milestones: [
        {
          id: "milestone",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-08T09:00:00.000Z",
          effectiveDuration: 0,
        },
      ],
      groups: [
        {
          id: "group",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-08T17:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
    });
  });

  test("rehydrates serialized schedule values as Dates", () => {
    const document = createEmptyDocument();
    document.groups = [{ id: "group", name: "Group" }];
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-09-08" },
    ];
    document.tasks = [
      {
        id: "task",
        name: "Task",
        groupId: "group",
        start: "2026-09-08",
        duration: 1,
      },
    ];
    const model = hydrateDocument(document);
    const scheduledDocument = {
      tasks: [
        {
          id: "task",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-09T09:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
      milestones: [
        {
          id: "milestone",
          effectiveStart: "2026-09-08T00:00:00.000Z",
          effectiveEnd: "2026-09-08T00:00:00.000Z",
          effectiveDuration: 0,
        },
      ],
      groups: [
        {
          id: "group",
          effectiveStart: "2026-09-08T09:00:00.000Z",
          effectiveEnd: "2026-09-09T09:00:00.000Z",
          effectiveDuration: 1,
        },
      ],
    };

    const scheduledModel = fromScheduledDocument(model, scheduledDocument);

    assert.ok(scheduledModel.tasks[0].effectiveStart() instanceof Date);
    assert.ok(scheduledModel.milestones[0].effectiveStart() instanceof Date);
    assert.ok(scheduledModel.groups[0].effectiveStart instanceof Date);
    assert.strictEqual(
      scheduledModel.tasks[0].effectiveStart().toISOString(),
      "2026-09-08T09:00:00.000Z",
    );
  });

  test("rejects a schedule entry for an unknown entity", () => {
    const model = hydrateDocument(createEmptyDocument());

    assert.throws(
      () =>
        fromScheduledDocument(model, {
          tasks: [
            {
              id: "missing",
              effectiveStart: "2026-09-08T09:00:00.000Z",
              effectiveEnd: "2026-09-09T09:00:00.000Z",
              effectiveDuration: 1,
            },
          ],
          milestones: [],
          groups: [],
        }),
      /Unknown scheduled task/,
    );
  });

  test("rejects unknown milestone and group schedule entries", () => {
    const model = hydrateDocument(createEmptyDocument());
    const milestone = {
      id: "missing",
      effectiveStart: "2026-09-08T09:00:00.000Z",
      effectiveEnd: "2026-09-08T09:00:00.000Z",
      effectiveDuration: 0,
    };
    const group = {
      id: "missing",
      effectiveStart: "2026-09-08T09:00:00.000Z",
      effectiveEnd: "2026-09-08T17:00:00.000Z",
      effectiveDuration: 1,
    };

    assert.throws(
      () =>
        fromScheduledDocument(model, {
          tasks: [],
          milestones: [milestone],
          groups: [],
        }),
      /Unknown scheduled milestone/,
    );
    assert.throws(
      () =>
        fromScheduledDocument(model, {
          tasks: [],
          milestones: [],
          groups: [group],
        }),
      /Unknown scheduled group/,
    );
  });
});
