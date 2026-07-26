import * as assert from "assert";
import { CURRENT_DOCUMENT_VERSION, effectiveDuration } from "../common/models";
import { migrateDocument } from "../services/ganttDocumentMigrationService";
import {
  GanttParseError,
  parseDocument,
  serializeDocument,
} from "../services/ganttDocumentService";

suite("ganttDocumentMigrationService", () => {
  test("migrates v1 dependency ids and types to v2", () => {
    const migrated = migrateDocument({
      version: 1,
      tasks: [
        {
          id: "t1",
          title: "Task 1",
          start: "2026-01-01",
          end: "2026-01-02",
        },
        {
          id: "t2",
          title: "Task 2",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "finishWith" },
        {
          id: "d2",
          sourceId: "t1",
          targetId: "t2",
          type: "finishAfter",
        },
        { id: "d3", sourceId: "t1", targetId: "t2", type: "startAfter" },
        { id: "d4", sourceId: "t1", targetId: "t2", type: "startWith" },
      ],
    });

    assert.deepStrictEqual(migrated, {
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [
        {
          id: "t1",
          title: "Task 1",
          start: "2026-01-01",
          end: "2026-01-02",
        },
        {
          id: "t2",
          title: "Task 2",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      dependencies: [
        { id: "d1", sourceId: "t2", targetId: "t1", type: "endWith" },
        { id: "d2", sourceId: "t2", targetId: "t1", type: "endBefore" },
        { id: "d3", sourceId: "t2", targetId: "t1", type: "startAfter" },
        { id: "d4", sourceId: "t2", targetId: "t1", type: "startWith" },
      ],
    });
  });

  test("leaves current-schema documents unchanged", () => {
    const raw = {
      version: CURRENT_DOCUMENT_VERSION,
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "endWith" },
      ],
    };

    assert.strictEqual(migrateDocument(raw), raw);
  });

  test("preserves unknown legacy dependency types for downstream validation", () => {
    const migrated = migrateDocument({
      version: 1,
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "legacyType" },
      ],
    });

    assert.deepStrictEqual(migrated, {
      version: CURRENT_DOCUMENT_VERSION,
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "legacyType" },
      ],
    });
  });

  test("legacy documents still fail parse validation for unknown dependency types", () => {
    const text = JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "t1",
          title: "Task 1",
          start: "2026-01-01",
          end: "2026-01-02",
        },
        {
          id: "t2",
          title: "Task 2",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "legacyType" },
      ],
    });

    assert.throws(() => parseDocument(text), GanttParseError);
  });

  test("keeps a v1 start+end task as the start+end pair with derived duration, round-trip stable", () => {
    const text = JSON.stringify({
      version: 1,
      tasks: [
        { id: "t1", title: "Task 1", start: "2026-01-01", end: "2026-01-05" },
      ],
      dependencies: [],
    });

    const document = parseDocument(text);
    const task = document.tasks[0];
    assert.strictEqual(task.start, "2026-01-01");
    assert.strictEqual(task.end, "2026-01-05");
    assert.strictEqual(task.duration, undefined);
    assert.strictEqual(effectiveDuration(task), 4);

    const reparsed = parseDocument(serializeDocument(document));
    assert.deepStrictEqual(reparsed, document);
  });
});
