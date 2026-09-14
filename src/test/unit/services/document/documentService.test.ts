import { CURRENT_DOCUMENT_VERSION } from "@common/documents";
import {
  GanttParseError,
  parseDocument,
  serializeDocument,
} from "@services/document/documentService";
import * as assert from "assert";

suite("documentService", () => {
  test("parses an empty string into an empty document", () => {
    const document = parseDocument("");
    assert.strictEqual(document.version, CURRENT_DOCUMENT_VERSION);
    assert.deepStrictEqual(document.tasks, []);
    assert.deepStrictEqual(document.dependencies, []);
  });

  test("round-trips a document through serialize and parse", () => {
    const document = parseDocument(
      JSON.stringify({
        version: CURRENT_DOCUMENT_VERSION,
        tasks: [
          {
            id: "t1",
            name: "Design",
            start: "2026-01-01",
            end: "2026-01-05",
            progress: 0.5,
            status: "inProgress",
          },
        ],
        groups: [{ id: "g1", name: "Phase 1" }],
        milestones: [{ id: "m1", name: "Kickoff", date: "2026-01-01" }],
        dependencies: [
          { id: "d1", sourceId: "t1", targetId: "m1", type: "startAfter" },
        ],
      }),
    );

    const reparsed = parseDocument(serializeDocument(document));
    assert.deepStrictEqual(reparsed, document);
  });

  test("omits the transient schedule when serializing to disk", () => {
    const document = createDocumentWithSchedule();

    const persisted = parseDocument(serializeDocument(document));

    assert.strictEqual(persisted.schedule, undefined);
    assert.deepStrictEqual(persisted.tasks, document.tasks);
  });

  test("throws GanttParseError on invalid JSON", () => {
    assert.throws(() => parseDocument("{ not json"), GanttParseError);
  });

  test("throws GanttParseError when a required field is missing", () => {
    const text = JSON.stringify({ tasks: [{ id: "t1" }] });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("accepts a task constrained by start and duration", () => {
    const text = JSON.stringify({
      tasks: [{ id: "t1", name: "Build", start: "2026-01-01", duration: 3 }],
    });
    const task = parseDocument(text).tasks[0];
    assert.strictEqual(task.start, "2026-01-01");
    assert.strictEqual(task.duration, 3);
    assert.strictEqual(task.end, undefined);
  });

  test("accepts an under-constrained task at parse time", () => {
    const text = JSON.stringify({
      tasks: [{ id: "t1", name: "No constraints" }],
    });
    const task = parseDocument(text).tasks[0];
    assert.strictEqual(task.start, undefined);
    assert.strictEqual(task.end, undefined);
    assert.strictEqual(task.duration, undefined);
  });

  test("rejects a negative task duration", () => {
    const text = JSON.stringify({
      tasks: [{ id: "t1", name: "Bad", start: "2026-01-01", duration: -1 }],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("accepts a milestone with an explicit zero duration", () => {
    const text = JSON.stringify({
      milestones: [
        { id: "m1", name: "Kickoff", date: "2026-01-01", duration: 0 },
      ],
    });
    assert.strictEqual(parseDocument(text).milestones.length, 1);
  });

  test("accepts a milestone without a date", () => {
    const text = JSON.stringify({
      milestones: [{ id: "m1", name: "Dependency-defined" }],
    });

    assert.strictEqual(parseDocument(text).milestones[0].date, undefined);
  });

  test("rejects a milestone with a non-zero duration", () => {
    const text = JSON.stringify({
      milestones: [
        { id: "m1", name: "Kickoff", date: "2026-01-01", duration: 2 },
      ],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects a non-ISO date", () => {
    const text = JSON.stringify({
      tasks: [
        { id: "t1", name: "Bad", start: "01/01/2026", end: "2026-01-02" },
      ],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects a task when start is after end", () => {
    const text = JSON.stringify({
      tasks: [
        {
          id: "t1",
          name: "Bad order",
          start: "2026-02-10",
          end: "2026-02-01",
        },
      ],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects a group that points to itself as parent", () => {
    const text = JSON.stringify({
      groups: [{ id: "g1", name: "Group", groupId: "g1" }],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects a parent cycle in the group hierarchy", () => {
    const text = JSON.stringify({
      groups: [
        { id: "g1", name: "G1", groupId: "g2" },
        { id: "g2", name: "G2", groupId: "g1" },
      ],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects dangling task and milestone group references", () => {
    const text = JSON.stringify({
      groups: [{ id: "g1", name: "Known" }],
      tasks: [
        {
          id: "t1",
          name: "Task",
          start: "2026-01-01",
          end: "2026-01-02",
          groupId: "missing",
        },
      ],
      milestones: [
        {
          id: "m1",
          name: "Milestone",
          date: "2026-01-03",
          groupId: "missing",
        },
      ],
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects duplicate ids across entity kinds", () => {
    const text = JSON.stringify({
      tasks: [{ id: "shared", name: "Task" }],
      groups: [{ id: "shared", name: "Group" }],
    });

    assert.throws(() => parseDocument(text), /must be unique/);
  });

  test("preserves dependencies with unknown endpoints for semantic validation", () => {
    const text = JSON.stringify({
      tasks: [{ id: "task", name: "Task" }],
      dependencies: [
        {
          id: "dependency",
          sourceId: "task",
          targetId: "missing",
          type: "startAfter",
        },
      ],
    });

    assert.deepStrictEqual(parseDocument(text).dependencies, [
      {
        id: "dependency",
        sourceId: "task",
        targetId: "missing",
        type: "startAfter",
      },
    ]);
  });

  test("clamps progress into the 0..1 range", () => {
    const text = JSON.stringify({
      tasks: [
        {
          id: "t1",
          name: "Over",
          start: "2026-01-01",
          end: "2026-01-02",
          progress: 5,
        },
      ],
    });
    assert.strictEqual(parseDocument(text).tasks[0].progress, 1);
  });

  test("does not migrate ids or types for current schema", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [
        {
          id: "t1",
          name: "Task 1",
          start: "2026-01-01",
          end: "2026-01-02",
        },
        {
          id: "t2",
          name: "Task 2",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "endWith" },
      ],
    });

    const document = parseDocument(text);
    assert.deepStrictEqual(document.dependencies, [
      { id: "d1", sourceId: "t1", targetId: "t2", type: "endWith" },
    ]);
  });

  test("preserves reserved project settings through parse", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: {
        workingCalendar: { daysOff: [6, 7] },
        workingDayHours: 8,
        workingDayStart: 8.5,
      },
    });

    const document = parseDocument(text);
    assert.deepStrictEqual(document.settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
      workingDayStart: 8.5,
      holidays: [],
    });
    assert.deepStrictEqual(
      parseDocument(serializeDocument(document)),
      document,
    );
  });

  test("materializes defaults for missing settings and view", () => {
    const document = parseDocument(JSON.stringify({ version: 2 }));

    assert.deepStrictEqual(document.settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
      workingDayStart: 9,
      holidays: [],
    });
    assert.deepStrictEqual(document.view, {
      zoomLevel: "week",
      showDependencies: true,
      showOffDays: false,
      showHolidays: false,
      showCriticalPath: false,
    });
    assert.deepStrictEqual(
      parseDocument(serializeDocument(document)),
      document,
    );
  });

  test("creates independent mutable project defaults", () => {
    const first = parseDocument(JSON.stringify({ version: 2 }));
    const second = parseDocument(JSON.stringify({ version: 2 }));

    first.settings.workingCalendar.daysOff.push(1);
    first.settings.holidays.push({ start: "2026-01-01", end: "2026-01-01" });

    assert.deepStrictEqual(second.settings.workingCalendar.daysOff, [6, 7]);
    assert.deepStrictEqual(second.settings.holidays, []);
  });

  test("fills omitted view values while preserving an explicit view section", () => {
    const document = parseDocument(
      JSON.stringify({
        version: 2,
        view: { zoomLevel: "month", showHolidays: true },
      }),
    );

    assert.deepStrictEqual(document.view, {
      zoomLevel: "month",
      showDependencies: true,
      showOffDays: false,
      showHolidays: true,
      showCriticalPath: false,
    });
    assert.deepStrictEqual(
      parseDocument(serializeDocument(document)).view,
      document.view,
    );
  });

  test("preserves holiday ranges and rejects malformed view or holiday values", () => {
    const document = parseDocument(
      JSON.stringify({
        version: 2,
        settings: {
          holidays: [{ start: "2026-12-24", end: "2026-12-26" }],
        },
        view: {
          zoomLevel: "week",
          showDependencies: false,
          showOffDays: true,
          showHolidays: true,
          showCriticalPath: true,
        },
      }),
    );

    assert.deepStrictEqual(document.settings.holidays, [
      { start: "2026-12-24", end: "2026-12-26" },
    ]);
    assert.throws(
      () => parseDocument(JSON.stringify({ view: { zoomLevel: "decade" } })),
      GanttParseError,
    );
    assert.throws(
      () => parseDocument(JSON.stringify({ view: { showHolidays: "yes" } })),
      GanttParseError,
    );
    assert.throws(
      () =>
        parseDocument(
          JSON.stringify({
            settings: {
              holidays: [{ start: "2026-12-26", end: "2026-12-24" }],
            },
          }),
        ),
      GanttParseError,
    );
  });

  test("nests legacy top-level working config under settings on parse", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      workingDayHours: 8,
    });

    assert.deepStrictEqual(parseDocument(text).settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
      workingDayStart: 9,
      holidays: [],
    });
  });

  test("rejects a non-numeric working-day-hours value", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { workingDayHours: "eight" },
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("rejects out-of-range working-time settings", () => {
    const invalidSettings = [
      { workingDayHours: 0 },
      { workingDayHours: 25 },
      { workingDayStart: -0.5 },
      { workingDayStart: 24 },
      { workingCalendar: { daysOff: [0] } },
      { workingCalendar: { daysOff: [8] } },
      { workingCalendar: { daysOff: [1.5] } },
    ];

    for (const settings of invalidSettings) {
      const text = JSON.stringify({
        version: CURRENT_DOCUMENT_VERSION,
        settings,
      });
      assert.throws(() => parseDocument(text), GanttParseError);
    }
  });

  test("drops unknown settings keys and resolves defaults", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { unknown: true },
    });
    assert.deepStrictEqual(parseDocument(text).settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
      workingDayStart: 9,
      holidays: [],
    });
  });

  test("resolves a working calendar without days off to the default calendar", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { workingCalendar: {} },
    });
    assert.deepStrictEqual(parseDocument(text).settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
      workingDayStart: 9,
      holidays: [],
    });
  });
});

/** Creates a document containing a transient serialized schedule. */
function createDocumentWithSchedule() {
  const document = parseDocument(
    JSON.stringify({
      tasks: [{ id: "task", name: "Task", start: "2026-09-08", duration: 1 }],
    }),
  );
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
  return document;
}
