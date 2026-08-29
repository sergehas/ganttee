import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { CURRENT_DOCUMENT_VERSION } from "../../common/models";
import { migrateDocument } from "../../services/ganttDocumentMigrationService";
import { parseDocument } from "../../services/ganttDocumentService";
import { FIXTURES_DIR } from "../testFixtures";

function readFixtureRaw(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8"));
}

/** Verifies that `migrateDocument` transforms v1 raw JSON into the current
 * schema and that calling it more than once is safe. */
suite("migrationFlow integration", () => {
  test("migrates v1 fixture raw object: version bumped and fields renamed", () => {
    const raw = readFixtureRaw("v1-minimal.ganttee");
    const migrated = migrateDocument(raw) as Record<string, unknown>;

    assert.strictEqual(migrated["version"], CURRENT_DOCUMENT_VERSION);

    const tasks = migrated["tasks"] as Array<Record<string, unknown>>;
    assert.ok(
      tasks.every((t) => "name" in t && !("title" in t)),
      "title should be renamed to name",
    );

    const groups = migrated["groups"] as Array<Record<string, unknown>>;
    assert.ok(
      groups.every((g) => !("parentId" in g)),
      "parentId should be removed from groups",
    );
  });

  /** Direction swap must happen at the raw-object level, before any typed model is constructed. */
  test("v1 finishAfter type is no longer supported and remains unmigrated", () => {
    const raw = {
      version: 1,
      tasks: [
        { id: "t1", title: "A", start: "2026-01-01", end: "2026-01-02" },
        { id: "t2", title: "B", start: "2026-01-03", end: "2026-01-04" },
      ],
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "finishAfter" },
      ],
    };
    const migrated = migrateDocument(raw) as Record<string, unknown>;
    const deps = migrated["dependencies"] as Array<Record<string, unknown>>;

    // finishAfter is no longer supported; it remains unmigrated as finishAfter
    assert.strictEqual(deps[0]["type"], "finishAfter");
    assert.strictEqual(deps[0]["sourceId"], "t1");
    assert.strictEqual(deps[0]["targetId"], "t2");
  });

  /** Idempotency lets callers call `migrateDocument` defensively
   * without corrupting an already-current document. */
  test("migration is idempotent on a v2 fixture", () => {
    const raw = readFixtureRaw("v2-simple.ganttee");
    const once = migrateDocument(raw);
    const twice = migrateDocument(once);

    assert.deepStrictEqual(once, twice);
  });

  test("migration is idempotent on already-migrated v1 output", () => {
    const raw = readFixtureRaw("v1-minimal.ganttee");
    const once = migrateDocument(raw);
    const twice = migrateDocument(once);

    assert.deepStrictEqual(once, twice);
  });

  /** `parseDocument` must never expose `migrateDocument` as
   * a required caller concern. */
  test("parseDocument applies migration transparently for v1 fixtures", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURES_DIR, "v1-minimal.ganttee"),
      "utf-8",
    );
    // parseDocument must not throw even for v1 input
    const doc = parseDocument(raw);
    assert.strictEqual(doc.version, CURRENT_DOCUMENT_VERSION);
  });
});
