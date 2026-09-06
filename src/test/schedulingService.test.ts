import * as assert from "assert";
import {
  createEmptyDocument,
  GanttDocument,
  ScheduledTaskEntity,
  SchedulingError,
} from "../common/models";
import { hydrateDocument } from "../services/ganttModelService";
import { rollupGroupSchedules, schedule } from "../services/schedulingService";

/** Creates a document configured for an eight-hour UTC working day. */
function schedulingDocument(): GanttDocument {
  const document = createEmptyDocument();
  document.settings = {
    workingCalendar: { daysOff: [] },
    workingDayHours: 8,
    workingDayStart: 9,
  };
  return document;
}

/** Schedules a document through the public hydration and scheduling boundary. */
function scheduleDocument(document: GanttDocument) {
  const model = hydrateDocument(document);
  return schedule(model, model.graph);
}

/** Finds a scheduled task or fails the current test. */
function taskById(
  scheduled: ReturnType<typeof schedule>,
  id: string,
): ScheduledTaskEntity {
  const task = scheduled.tasks.find((candidate) => candidate.id === id);
  assert.ok(task, `Expected scheduled task "${id}".`);
  return task;
}

/** Returns the effective task values in a snapshot-friendly shape. */
function taskSchedule(task: ScheduledTaskEntity) {
  return {
    start: task.effectiveStart().toISOString(),
    end: task.effectiveEnd().toISOString(),
    duration: task.effectiveDuration(),
  };
}

suite("schedulingService", () => {
  test("schedules a start-anchored task in working time", () => {
    const document = schedulingDocument();
    document.settings = {
      workingCalendar: { daysOff: [] },
      workingDayHours: 8,
      workingDayStart: 8.5,
    };
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 2 },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.deepStrictEqual(taskSchedule(task), {
      start: "2026-09-08T08:30:00.000Z",
      end: "2026-09-09T16:30:00.000Z",
      duration: 2,
    });
  });

  test("uses the default working calendar settings", () => {
    const document = createEmptyDocument();
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.deepStrictEqual(taskSchedule(task), {
      start: "2026-09-08T09:00:00.000Z",
      end: "2026-09-08T17:00:00.000Z",
      duration: 1,
    });
  });

  test("supports a 24-hour working interval", () => {
    const document = schedulingDocument();
    document.settings!.workingDayStart = 20;
    document.settings!.workingDayHours = 24;
    document.tasks = [
      { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.deepStrictEqual(taskSchedule(task), {
      start: "2026-09-08T20:00:00.000Z",
      end: "2026-09-09T20:00:00.000Z",
      duration: 1,
    });
  });

  test("consumes fractional durations across working intervals", () => {
    const document = schedulingDocument();
    document.settings!.workingDayStart = 9.5;
    document.settings!.workingCalendar = { daysOff: [6, 7] };
    document.tasks = [
      {
        id: "task",
        name: "Task",
        start: "2026-09-08T14:30:00.000Z",
        duration: 2.5,
      },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.strictEqual(
      task.effectiveEnd().toISOString(),
      "2026-09-11T10:30:00.000Z",
    );
  });

  test("schedules an end-anchored task backward across days off", () => {
    const document = schedulingDocument();
    document.settings!.workingCalendar = { daysOff: [6, 7] };
    document.tasks = [
      { id: "task", name: "Task", end: "2026-09-14T17:00:00Z", duration: 2 },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.strictEqual(
      task.effectiveStart().toISOString(),
      "2026-09-11T09:00:00.000Z",
    );
  });

  test("normalizes timestamps outside working intervals", () => {
    const document = schedulingDocument();
    document.settings!.workingCalendar = { daysOff: [6, 7] };
    document.tasks = [
      {
        id: "before",
        name: "Before",
        start: "2026-09-08T07:00:00Z",
        duration: 1,
      },
      {
        id: "after",
        name: "After",
        start: "2026-09-11T17:00:00Z",
        duration: 1,
      },
      {
        id: "day-off",
        name: "Day off",
        start: "2026-09-12T12:00:00Z",
        duration: 1,
      },
    ];

    const scheduled = scheduleDocument(document);

    assert.deepStrictEqual(
      ["before", "after", "day-off"].map((id) =>
        taskById(scheduled, id).effectiveStart().toISOString(),
      ),
      [
        "2026-09-08T09:00:00.000Z",
        "2026-09-14T09:00:00.000Z",
        "2026-09-14T09:00:00.000Z",
      ],
    );
  });

  test("uses the latest startAfter candidate independent of edge order", () => {
    const buildDocument = (reverse: boolean): GanttDocument => {
      const document = schedulingDocument();
      document.tasks = [
        { id: "early", name: "Early", start: "2026-09-08", duration: 1 },
        { id: "late", name: "Late", start: "2026-09-10", duration: 1 },
        { id: "successor", name: "Successor", duration: 1 },
      ];
      const dependencies = [
        {
          id: "after-early",
          sourceId: "successor",
          targetId: "early",
          type: "startAfter" as const,
        },
        {
          id: "after-late",
          sourceId: "successor",
          targetId: "late",
          type: "startAfter" as const,
        },
      ];
      document.dependencies = reverse ? dependencies.reverse() : dependencies;
      return document;
    };

    const starts = [false, true].map((reverse) =>
      taskById(scheduleDocument(buildDocument(reverse)), "successor")
        .effectiveStart()
        .toISOString(),
    );

    assert.deepStrictEqual(starts, [
      "2026-09-11T09:00:00.000Z",
      "2026-09-11T09:00:00.000Z",
    ]);
  });

  test("preserves startWith and endWith target timestamps", () => {
    const document = schedulingDocument();
    document.tasks = [
      {
        id: "start-target",
        name: "Start target",
        start: "2026-09-08T11:30:00Z",
        duration: 1,
      },
      {
        id: "end-target",
        name: "End target",
        start: "2026-09-10T10:15:00Z",
        duration: 1,
      },
      { id: "start-source", name: "Start source", duration: 1 },
      { id: "end-source", name: "End source", duration: 1 },
    ];
    document.dependencies = [
      {
        id: "start-with",
        sourceId: "start-source",
        targetId: "start-target",
        type: "startWith",
      },
      {
        id: "end-with",
        sourceId: "end-source",
        targetId: "end-target",
        type: "endWith",
      },
    ];

    const scheduled = scheduleDocument(document);

    assert.deepStrictEqual(
      {
        start: taskById(scheduled, "start-source")
          .effectiveStart()
          .toISOString(),
        end: taskById(scheduled, "end-source").effectiveEnd().toISOString(),
      },
      {
        start: "2026-09-08T11:30:00.000Z",
        end: "2026-09-11T10:15:00.000Z",
      },
    );
  });

  test("aliases both milestone endpoints to a dependency-derived date", () => {
    const document = schedulingDocument();
    document.tasks = [
      {
        id: "predecessor",
        name: "Predecessor",
        start: "2026-09-08",
        duration: 1,
      },
    ];
    document.milestones = [{ id: "milestone", name: "Milestone" }];
    document.dependencies = [
      {
        id: "milestone-after",
        sourceId: "milestone",
        targetId: "predecessor",
        type: "startAfter",
      },
    ];

    const scheduled = scheduleDocument(document);
    const milestone = scheduled.milestones[0];

    assert.deepStrictEqual(
      {
        start: milestone.effectiveStart().toISOString(),
        end: milestone.effectiveEnd().toISOString(),
        duration: milestone.effectiveDuration(),
      },
      {
        start: "2026-09-09T09:00:00.000Z",
        end: "2026-09-09T09:00:00.000Z",
        duration: 0,
      },
    );
  });

  test("derives duration when both effective endpoints are available", () => {
    const document = schedulingDocument();
    document.tasks = [
      {
        id: "task",
        name: "Task",
        start: "2026-09-08T09:00:00Z",
        end: "2026-09-09T17:00:00Z",
      },
    ];

    const task = taskById(scheduleDocument(document), "task");

    assert.strictEqual(task.effectiveDuration(), 2);
  });

  test("uses one working day when a complementary task endpoint is absent", () => {
    const startAnchored = schedulingDocument();
    startAnchored.tasks = [{ id: "task", name: "Task", start: "2026-09-08" }];
    const endAnchored = schedulingDocument();
    endAnchored.tasks = [
      { id: "task", name: "Task", end: "2026-09-08T17:00:00Z" },
    ];

    assert.deepStrictEqual(
      [startAnchored, endAnchored].map((document) =>
        taskSchedule(taskById(scheduleDocument(document), "task")),
      ),
      [
        {
          start: "2026-09-08T09:00:00.000Z",
          end: "2026-09-08T17:00:00.000Z",
          duration: 1,
        },
        {
          start: "2026-09-08T09:00:00.000Z",
          end: "2026-09-08T17:00:00.000Z",
          duration: 1,
        },
      ],
    );
  });

  test("normalizes a static milestone date", () => {
    const document = schedulingDocument();
    document.milestones = [
      { id: "milestone", name: "Milestone", date: "2026-09-08" },
    ];

    const milestone = scheduleDocument(document).milestones[0];

    assert.strictEqual(
      milestone.effectiveStart().toISOString(),
      "2026-09-08T09:00:00.000Z",
    );
  });

  test("rejects zero-duration tasks without returning a partial schedule", () => {
    const document = schedulingDocument();
    document.tasks = [
      { id: "valid", name: "Valid", start: "2026-09-08", duration: 1 },
      { id: "invalid", name: "Invalid", start: "2026-09-08", duration: 0 },
    ];

    assert.throws(() => scheduleDocument(document), SchedulingError);
  });

  test("rejects under-constrained and reversed schedules", () => {
    const underConstrained = schedulingDocument();
    underConstrained.tasks = [{ id: "task", name: "Task" }];
    const reversed = schedulingDocument();
    reversed.tasks = [
      {
        id: "task",
        name: "Task",
        start: "2026-09-10",
        end: "2026-09-08",
      },
    ];

    assert.throws(() => scheduleDocument(underConstrained), SchedulingError);
    assert.throws(() => scheduleDocument(reversed), SchedulingError);
  });

  test("rejects invalid settings supplied directly to the scheduler", () => {
    const invalidSettings = [
      { workingDayHours: Number.NaN },
      { workingDayHours: 0 },
      { workingDayHours: 25 },
      { workingDayStart: Number.NaN },
      { workingDayStart: -1 },
      { workingDayStart: 24 },
      { workingCalendar: { daysOff: [0] } },
      { workingCalendar: { daysOff: [1, 2, 3, 4, 5, 6, 7] } },
    ];

    for (const settings of invalidSettings) {
      const document = schedulingDocument();
      document.settings = settings;
      document.tasks = [
        { id: "task", name: "Task", start: "2026-09-08", duration: 1 },
      ];
      assert.throws(() => scheduleDocument(document), SchedulingError);
    }
  });

  test("rolls nested groups up from scheduled descendants", () => {
    const document = schedulingDocument();
    document.groups = [
      { id: "parent", name: "Parent" },
      { id: "child", name: "Child", groupId: "parent" },
      { id: "empty", name: "Empty", groupId: "parent" },
    ];
    document.tasks = [
      {
        id: "first",
        name: "First",
        groupId: "child",
        start: "2026-09-08",
        duration: 1,
      },
      {
        id: "last",
        name: "Last",
        groupId: "parent",
        start: "2026-09-10",
        duration: 1,
      },
    ];
    const model = hydrateDocument(document);
    const scheduled = schedule(model, model.graph);

    const groups = scheduled.groups;

    assert.deepStrictEqual(
      groups.map((group) => ({
        id: group.id,
        start: group.effectiveStart.toISOString(),
        end: group.effectiveEnd.toISOString(),
      })),
      [
        {
          id: "child",
          start: "2026-09-08T09:00:00.000Z",
          end: "2026-09-08T17:00:00.000Z",
        },
        {
          id: "parent",
          start: "2026-09-08T09:00:00.000Z",
          end: "2026-09-10T17:00:00.000Z",
        },
      ],
    );
  });

  test("omits empty groups and terminates on malformed group cycles", () => {
    const document = schedulingDocument();
    document.groups = [
      { id: "first", name: "First", groupId: "second" },
      { id: "second", name: "Second", groupId: "first" },
      { id: "empty", name: "Empty" },
    ];
    const model = hydrateDocument(document);

    assert.deepStrictEqual(
      rollupGroupSchedules(model.groups, schedule(model, model.graph)),
      [],
    );
  });
});
