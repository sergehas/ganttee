import * as assert from "assert";
import { CURRENT_DOCUMENT_VERSION } from "../common/models";
import {
  GanttParseError,
  parseDocument,
  serializeDocument,
} from "../services/ganttDocumentService";

suite("ganttDocumentService", () => {
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

  test("rejects dependencies with unknown endpoints", () => {
    const text = JSON.stringify({
      tasks: [{ id: "task", name: "Task" }],
      dependencies: [
        { id: "dependency", sourceId: "task", targetId: "missing", type: "startAfter" },
      ],
    });

    assert.throws(() => parseDocument(text), /unknown entity/);
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
      settings: { workingCalendar: { daysOff: [6, 7] }, workingDayHours: 8 },
    });

    const document = parseDocument(text);
    assert.deepStrictEqual(document.settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
    });
    assert.deepStrictEqual(
      parseDocument(serializeDocument(document)),
      document,
    );
  });

  test("nests legacy top-level working config under settings on parse", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      workingDayHours: 8,
    });

    assert.deepStrictEqual(parseDocument(text).settings, {
      workingDayHours: 8,
    });
  });

  test("rejects a non-numeric working-day-hours value", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { workingDayHours: "eight" },
    });
    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("drops unknown settings keys and empty settings", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { unknown: true },
    });
    assert.strictEqual(parseDocument(text).settings, undefined);
  });

  test("normalizes a working calendar without days off to an empty calendar", () => {
    const text = JSON.stringify({
      version: CURRENT_DOCUMENT_VERSION,
      settings: { workingCalendar: {} },
    });
    assert.deepStrictEqual(parseDocument(text).settings, {
      workingCalendar: {},
    });
  });
});
