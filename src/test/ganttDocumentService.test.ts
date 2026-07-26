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
          { id: "d1", sourceId: "t1", targetId: "t1", type: "startAfter" },
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
});
