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

    assert.deepStrictEqual(migrateDocument(raw), raw);
  });

  test("returns non-record input unchanged", () => {
    assert.strictEqual(migrateDocument("not a document"), "not a document");
    assert.strictEqual(migrateDocument(null), null);
  });

  test("tolerates non-record entries in entity and dependency arrays", () => {
    const migrated = migrateDocument({
      version: 1,
      tasks: ["not an object", { id: "t1", title: "T" }],
      dependencies: [42],
    });

    assert.deepStrictEqual(migrated, {
      version: CURRENT_DOCUMENT_VERSION,
      tasks: ["not an object", { id: "t1", name: "T" }],
      dependencies: [42],
    });
  });

  test("renames legacy title and parentId to name and groupId", () => {
    const migrated = migrateDocument({
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [{ id: "t1", title: "Task 1", start: "2026-01-01" }],
      milestones: [{ id: "m1", title: "Kickoff", date: "2026-01-01" }],
      groups: [
        { id: "g1", name: "Root" },
        { id: "g2", name: "Child", parentId: "g1" },
      ],
      dependencies: [],
    });

    assert.deepStrictEqual(migrated, {
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [{ id: "t1", name: "Task 1", start: "2026-01-01" }],
      milestones: [{ id: "m1", name: "Kickoff", date: "2026-01-01" }],
      groups: [
        { id: "g1", name: "Root" },
        { id: "g2", name: "Child", groupId: "g1" },
      ],
      dependencies: [],
    });
  });

  test("prefers the new field name when both legacy and new are present", () => {
    const migrated = migrateDocument({
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [{ id: "t1", title: "Legacy", name: "Current" }],
      groups: [{ id: "g1", name: "G", parentId: "old", groupId: "new" }],
      dependencies: [],
    });

    assert.deepStrictEqual(migrated, {
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [{ id: "t1", name: "Current" }],
      groups: [{ id: "g1", name: "G", groupId: "new" }],
      dependencies: [],
    });
  });

  test("leaves new field names unchanged and keeps the version at 2", () => {
    const raw = {
      version: CURRENT_DOCUMENT_VERSION,
      tasks: [{ id: "t1", name: "Task", start: "2026-01-01" }],
      groups: [{ id: "g1", name: "Root", groupId: "g0" }],
      dependencies: [],
    };

    const migrated = migrateDocument(raw) as { version: number };
    assert.deepStrictEqual(migrated, raw);
    assert.strictEqual(migrated.version, 2);
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
